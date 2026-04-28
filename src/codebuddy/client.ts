import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionChunk, ChatCompletionCreateParamsNonStreaming, ChatCompletionCreateParamsStreaming } from "openai/resources/chat";
import { validateModel, getModelInfo } from "../utils/model-utils.js";
import { getModelToolConfig } from "../config/model-tools.js";
import { logger } from "../utils/logger.js";
import { retry, RetryStrategies, RetryPredicates } from "../utils/retry.js";
import { normalizeBaseURL, DEFAULT_BASE_URL } from "../utils/base-url.js";
import { getCircuitBreaker, CircuitOpenError } from "../providers/circuit-breaker.js";
import type { CircuitBreakerConfig } from "../providers/circuit-breaker.js";
import { parseRateLimitHeaders, storeRateLimitInfo } from "../utils/rate-limit-display.js";
import { mapProviderError } from "../errors/index.js";
import { GeminiNativeProvider } from "./providers/provider-gemini-native.js";
import {
  injectAnthropicCacheBreakpoints,
  injectJsonSystemPromptForAnthropic,
} from "./providers/provider-openai-compat-hooks.js";

export type CodeBuddyMessage = ChatCompletionMessageParam;

/** JSON Schema property definition */
export interface JsonSchemaProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  default?: unknown;
}

export interface CodeBuddyTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, JsonSchemaProperty>;
      required: string[];
    };
  };
}

/** Chat completion request payload - extends OpenAI types with Grok-specific fields */
interface ChatRequestPayload extends Omit<ChatCompletionCreateParamsNonStreaming, 'tools' | 'tool_choice'> {
  tools?: CodeBuddyTool[];
  tool_choice?: "auto" | "none" | "required";
  search_parameters?: SearchParameters;
  thinking?: { type: 'enabled'; budget_tokens: number };
  /** Anthropic/OpenAI service tier for latency vs quality trade-off */
  service_tier?: 'auto' | 'default' | 'flex';
}

/** Streaming chat completion request payload */
interface ChatRequestPayloadStreaming extends Omit<ChatCompletionCreateParamsStreaming, 'tools' | 'tool_choice'> {
  tools?: CodeBuddyTool[];
  tool_choice?: "auto" | "none" | "required";
  search_parameters?: SearchParameters;
  thinking?: { type: 'enabled'; budget_tokens: number };
  /** Anthropic/OpenAI service tier for latency vs quality trade-off */
  service_tier?: 'auto' | 'default' | 'flex';
}

export interface CodeBuddyToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/** Message with tool calls (assistant message that requested tool use) */
export interface CodeBuddyMessageWithToolCalls {
  role: 'assistant';
  content: string | null;
  tool_calls: CodeBuddyToolCall[];
}

/** Type guard for messages with tool calls */
export function hasToolCalls(msg: CodeBuddyMessage): msg is CodeBuddyMessageWithToolCalls {
  return msg.role === 'assistant' && 'tool_calls' in msg && Array.isArray((msg as CodeBuddyMessageWithToolCalls).tool_calls);
}

export interface SearchParameters {
  mode?: "auto" | "on" | "off";
  // sources removed - let API use default sources to avoid format issues
}

export interface SearchOptions {
  search_parameters?: SearchParameters;
}

export type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export interface ChatOptions {
  model?: string;
  temperature?: number;
  searchOptions?: SearchOptions;
  /** Optional request timeout override (ms) for Gemini native API calls */
  timeoutMs?: number;
  /** Gemini 3.x thinkingLevel — controls reasoning depth. Never mix with budget_tokens. */
  thinkingLevel?: GeminiThinkingLevel;
  /** Internal: retry counter for Gemini malformed function-call recovery */
  geminiMalformedRetryCount?: number;
  /** Internal: guard against infinite model fallback loops on Gemini */
  geminiModelFallbackTried?: boolean;
  /** Service tier for latency/quality trade-off (Anthropic/OpenAI fast mode) */
  service_tier?: 'auto' | 'default' | 'flex';
  /** Enable circuit breaker for this call (opt-in). Wraps the API call with provider-level circuit breaker. */
  circuitBreaker?: boolean;
  /** Response format: 'text' (default) or 'json' for structured JSON output */
  responseFormat?: 'text' | 'json';
  /** tool_choice override for this request */
  tool_choice?: 'auto' | 'none' | 'required';
}

export interface CodeBuddyResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: CodeBuddyToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    /** Cached prompt tokens (OpenAI/xAI automatic prefix caching) */
    cached_tokens?: number;
  };
}

export class CodeBuddyClient {
  private client: OpenAI | null;
  private currentModel: string = "grok-code-fast-1";
  private defaultMaxTokens: number;
  private baseURL: string;
  private apiKey: string;
  private toolSupportProbed: boolean = false;
  private toolSupportDetected: boolean | null = null;
  private probePromise: Promise<boolean> | null = null;
  private isGeminiProvider: boolean = false;
  private geminiRequestTimeoutMs: number;
  private circuitBreakerConfig: Partial<CircuitBreakerConfig> | undefined;
  private defaultThinkingLevel: GeminiThinkingLevel | undefined;
  /** Strategy for native Gemini API calls — non-null only when isGeminiProvider. */
  private geminiProvider: GeminiNativeProvider | null = null;

  /** Prompt cache tracking: total cached tokens across all calls */
  private _promptCacheHits: number = 0;
  /** Prompt cache tracking: total non-cached prompt tokens */
  private _promptCacheMisses: number = 0;

  /**
   * Configure the circuit breaker for this client.
   * Once configured, calls with `circuitBreaker: true` in ChatOptions
   * will be wrapped with the circuit breaker for the provider.
   */
  /**
   * Set default thinking level for Gemini 3.x models (from settings).
   */
  setDefaultThinkingLevel(level: GeminiThinkingLevel): void {
    this.defaultThinkingLevel = level;
    this.geminiProvider?.setDefaultThinkingLevel(level);
    logger.debug('Default Gemini thinkingLevel set from settings', { level });
  }

  setCircuitBreakerConfig(config: Partial<CircuitBreakerConfig>): void {
    this.circuitBreakerConfig = config;
  }

  /**
   * Get the circuit breaker key for this client (based on base URL).
   */
  private getCircuitBreakerKey(): string {
    return `provider:${this.baseURL}`;
  }

  /**
   * Wrap a function call with the circuit breaker if enabled.
   */
  private async withCircuitBreaker<T>(
    enabled: boolean | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!enabled) {
      return fn();
    }
    const key = this.getCircuitBreakerKey();
    const cb = getCircuitBreaker(key, this.circuitBreakerConfig);
    return cb.execute(fn);
  }

  private static isGeminiModelName(model: string): boolean {
    return model.toLowerCase().includes('gemini');
  }

  constructor(apiKey: string, model?: string, baseURL?: string) {
    // Validate API key
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API key is required and must be a non-empty string');
    }
    if (apiKey.trim().length === 0) {
      throw new Error('API key cannot be empty or whitespace only');
    }

    const selectedBaseURL = baseURL ?? process.env.GROK_BASE_URL ?? DEFAULT_BASE_URL;
    this.baseURL = normalizeBaseURL(selectedBaseURL);
    this.apiKey = apiKey;

    // Detect Gemini provider
    this.isGeminiProvider = this.baseURL.includes('generativelanguage.googleapis.com');
    const envGeminiTimeout = Number(
      process.env.CODEBUDDY_GEMINI_TIMEOUT_MS || process.env.CODEBUDDY_REQUEST_TIMEOUT_MS
    );
    this.geminiRequestTimeoutMs =
      Number.isFinite(envGeminiTimeout) && envGeminiTimeout >= 5000
        ? envGeminiTimeout
        : 60000;

    // Only create OpenAI client for non-Gemini providers
    if (!this.isGeminiProvider) {
      this.client = new OpenAI({
        apiKey,
        baseURL: this.baseURL,
        timeout: 360000,
      });
    } else {
      // Gemini uses native API, no OpenAI client needed
      this.client = null;
    }
    const envMax = Number(process.env.CODEBUDDY_MAX_TOKENS);
    if (Number.isFinite(envMax) && envMax > 0) {
      this.defaultMaxTokens = envMax;
    } else {
      const toolConfig = getModelToolConfig(model || this.currentModel);
      this.defaultMaxTokens = toolConfig.maxOutputTokens ?? 16384;
    }

    // Instantiate the Gemini strategy if applicable. Done after defaultMaxTokens
    // is resolved so the provider gets the same value the legacy methods used.
    if (this.isGeminiProvider) {
      this.geminiProvider = new GeminiNativeProvider({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
        model: model || this.currentModel,
        defaultMaxTokens: this.defaultMaxTokens,
        geminiRequestTimeoutMs: this.geminiRequestTimeoutMs,
        defaultThinkingLevel: this.defaultThinkingLevel,
      });
    }
    if (model) {
      // Validate model type
      if (typeof model !== 'string') {
        throw new Error('Model name must be a string');
      }
      // Validate model (non-strict to allow custom models)
      validateModel(model, false);

      // Guard against provider/model mismatch: using a Grok model with Gemini API
      // leads to hard 404 errors at runtime.
      if (this.isGeminiProvider && !CodeBuddyClient.isGeminiModelName(model)) {
        logger.warn(
          `Model '${model}' is incompatible with Gemini provider. Falling back to 'gemini-2.5-flash'.`
        );
        this.currentModel = 'gemini-2.5-flash';
      } else {
        this.currentModel = model;
      }

      // Log warning if model is not officially supported
      const modelInfo = getModelInfo(model);
      if (!modelInfo.isSupported) {
        logger.warn(
          `Model '${model}' is not officially supported. Using default token limits.`
        );
      }
    }
  }

  /**
   * Probe the model to check if it supports function calling
   * Makes a quick test request with a simple tool
   * Uses promise-based locking to prevent concurrent probes
   */
  async probeToolSupport(): Promise<boolean> {
    // Skip if already probed
    if (this.toolSupportProbed && this.toolSupportDetected !== null) {
      return this.toolSupportDetected;
    }

    // Return existing probe if already in progress (prevent race condition)
    // Check AFTER the probed flag to ensure atomicity
    if (this.probePromise) {
      return this.probePromise;
    }

    // Skip probe for known providers that support tools
    const modelInfo = getModelInfo(this.currentModel);
    if (['xai', 'anthropic', 'google', 'ollama'].includes(modelInfo.provider)) {
      this.toolSupportProbed = true;
      this.toolSupportDetected = true;
      return true;
    }

    // Skip probe if force tools is enabled
    if (process.env.GROK_FORCE_TOOLS === 'true') {
      this.toolSupportProbed = true;
      this.toolSupportDetected = true;
      return true;
    }

    // Check static list first (fast path)
    if (this.modelSupportsFunctionCalling()) {
      this.toolSupportProbed = true;
      this.toolSupportDetected = true;
      return true;
    }

    // Create and cache the probe promise IMMEDIATELY to prevent concurrent probes.
    // The assignment must happen synchronously before any await to close the race window.
    const probe = this.performToolProbe();
    this.probePromise = probe;
    return probe;
  }

  /**
   * Perform the actual tool support probe
   */
  private async performToolProbe(): Promise<boolean> {
    try {
      const testTool: CodeBuddyTool = {
        type: "function",
        function: {
          name: "get_current_time",
          description: "Get the current time",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      };

      if (!this.client) {
        logger.warn("Cannot probe tool support: no OpenAI client (Gemini provider)");
        this.toolSupportProbed = true;
        this.toolSupportDetected = true;
        return true;
      }

      const response = await this.client.chat.completions.create({
        model: this.currentModel,
        messages: [{ role: "user", content: "What time is it? Use the get_current_time tool." }],
        tools: [testTool as unknown as OpenAI.ChatCompletionTool],
        tool_choice: "auto",
        max_tokens: 50,
      });

      // Check if response has valid choices
      if (!response.choices || response.choices.length === 0) {
        logger.warn("Tool support probe returned empty choices array");
        this.toolSupportProbed = true;
        this.toolSupportDetected = false;
        return false;
      }

      // Check if the model attempted to use the tool
      const message = response.choices[0].message;
      const hasToolCall = !!(message?.tool_calls && message.tool_calls.length > 0);

      this.toolSupportProbed = true;
      this.toolSupportDetected = hasToolCall;

      if (hasToolCall) {
        logger.debug("Tool support detected: model supports function calling");
      }

      return hasToolCall;
    } catch (_error) {
      // If the request fails (e.g., tools not supported), assume no tool support
      this.toolSupportProbed = true;
      this.toolSupportDetected = false;
      return false;
    }
  }

  /**
   * Models known to support function calling / tool use
   */
  private static readonly FUNCTION_CALLING_MODELS = [
    'hermes',        // Hermes 2 Pro, Hermes 3, Hermes 4
    'functionary',   // MeetKai Functionary
    'gorilla',       // Gorilla OpenFunctions
    'nexusraven',    // NexusRaven
    'firefunction',  // FireFunction
    'toolllama',     // ToolLLaMA
    'glaive',        // Glaive function calling
    'llama-3.1',     // Llama 3.1 has native tool support
    'llama-3.2',     // Llama 3.2 has native tool support
    'llama3.1',      // Alternative naming
    'llama3.2',      // Alternative naming
    'qwen2.5',       // Qwen 2.5 supports tools
    'qwen-2.5',      // Alternative naming
    'mistral',       // Mistral models support function calling
    'mixtral',       // Mixtral supports function calling
    'command-r',     // Cohere Command-R
  ];

  /**
   * Check if the current model supports function calling based on its name
   */
  private modelSupportsFunctionCalling(): boolean {
    const modelLower = this.currentModel.toLowerCase();
    return CodeBuddyClient.FUNCTION_CALLING_MODELS.some(pattern =>
      modelLower.includes(pattern)
    );
  }

  /**
   * Check if using LM Studio or other local inference server
   * Can be overridden with GROK_FORCE_TOOLS=true for models that support function calling
   * Auto-enables tools for models known to support function calling
   */
  private isLocalInference(): boolean {
    // Allow forcing tools for local models that support function calling
    if (process.env.GROK_FORCE_TOOLS === 'true') {
      return false;
    }

    // Use probed result if available
    if (this.toolSupportProbed && this.toolSupportDetected === true) {
      return false; // Enable tools - probe detected support
    }

    // Auto-detect function calling support based on model name
    if (this.modelSupportsFunctionCalling()) {
      return false; // Enable tools for this model
    }

    const modelInfo = getModelInfo(this.currentModel);
    // Ollama supports tools via OpenAI-compatible API - always enable
    if (modelInfo.provider === 'ollama') return false;
    if (this.baseURL.includes('localhost:11434')) return false;
    if (this.baseURL.includes('127.0.0.1:11434')) return false;
    // Check if provider is lmstudio or if baseURL points to common local servers
    if (modelInfo.provider === 'lmstudio') return true;
    if (this.baseURL.includes('localhost:1234')) return true;
    if (this.baseURL.includes('127.0.0.1:1234')) return true;
    if (this.baseURL.match(/10\.\d+\.\d+\.\d+:1234/)) return true; // LAN IP with LM Studio port
    if (this.baseURL.match(/172\.\d+\.\d+\.\d+:1234/)) return true; // WSL/Docker IP with LM Studio port
    if (this.baseURL.match(/192\.168\.\d+\.\d+:1234/)) return true; // Private network with LM Studio port
    return false;
  }

  /**
   * xAI no longer accepts legacy search_parameters payloads.
   */
  private isXaiProvider(): boolean {
    return this.baseURL.includes('api.x.ai');
  }

  /**
   * Gate legacy search_parameters by provider compatibility.
   */
  private shouldIncludeSearchParameters(searchParams?: SearchParameters): boolean {
    if (!searchParams) {
      return false;
    }

    if (this.isLocalInference()) {
      return false;
    }

    if (this.isXaiProvider()) {
      logger.debug('Skipping deprecated search_parameters for xAI provider', {
        source: 'CodeBuddyClient',
      });
      return false;
    }

    return true;
  }

  setModel(model: string): void {
    // Validate model input
    if (!model || typeof model !== 'string') {
      throw new Error('Model name is required and must be a non-empty string');
    }
    if (model.trim().length === 0) {
      throw new Error('Model name cannot be empty or whitespace only');
    }
    // Validate model (non-strict to allow custom models)
    validateModel(model, false);

    const modelInfo = getModelInfo(model);
    if (!modelInfo.isSupported) {
      logger.warn(
        `Model '${model}' is not officially supported. Using default token limits.`
      );
    }

    this.currentModel = model;
    this.geminiProvider?.setModel(model);
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Derive a human-readable provider name from the base URL.
   */
  getProviderName(): string {
    const url = this.baseURL.toLowerCase();
    if (url.includes('api.x.ai') || url.includes('xai')) return 'xAI';
    if (url.includes('openai.com')) return 'OpenAI';
    if (url.includes('anthropic.com')) return 'Anthropic';
    if (url.includes('generativelanguage.googleapis.com')) return 'Gemini';
    if (url.includes('openrouter.ai')) return 'OpenRouter';
    if (url.includes('groq.com')) return 'Groq';
    if (url.includes('together.xyz')) return 'Together';
    if (url.includes('fireworks.ai')) return 'Fireworks';
    if (url.includes('localhost') || url.includes('127.0.0.1')) return 'Local';
    return 'API';
  }

  /**
   * Get prompt cache statistics
   */
  getPromptCacheStats(): { hits: number; misses: number; hitRatio: number } {
    const total = this._promptCacheHits + this._promptCacheMisses;
    return {
      hits: this._promptCacheHits,
      misses: this._promptCacheMisses,
      hitRatio: total > 0 ? this._promptCacheHits / total : 0,
    };
  }

  /**
   * Track prompt cache metrics from API response usage
   */
  private trackPromptCache(usage?: { prompt_tokens?: number; cached_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }): void {
    if (!usage) return;
    // OpenAI returns cached_tokens in prompt_tokens_details or at top-level
    let cachedTokens = usage.cached_tokens ?? 0;
    if (cachedTokens === 0 && usage.prompt_tokens_details) {
      cachedTokens = usage.prompt_tokens_details.cached_tokens ?? 0;
    }

    const promptTokens = usage.prompt_tokens ?? 0;
    if (cachedTokens > 0) {
      this._promptCacheHits += cachedTokens;
      this._promptCacheMisses += Math.max(0, promptTokens - cachedTokens);
      logger.debug(`Prompt cache: ${cachedTokens} cached / ${promptTokens} total tokens`, {
        source: 'CodeBuddyClient',
        hitRatio: promptTokens > 0 ? (cachedTokens / promptTokens * 100).toFixed(1) + '%' : '0%',
      });
    } else if (promptTokens > 0) {
      this._promptCacheMisses += promptTokens;
    }
  }

  /**
   * Check if using Gemini provider
   */
  isGemini(): boolean {
    return this.isGeminiProvider;
  }

  async chat(
    messages: CodeBuddyMessage[],
    tools?: CodeBuddyTool[],
    options?: string | ChatOptions,
    searchOptions?: SearchOptions
  ): Promise<CodeBuddyResponse> {
    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      throw new Error('Messages must be a non-empty array');
    }
    if (messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }
    // Validate each message has required fields
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== 'object') {
        throw new Error(`Message at index ${i} must be an object`);
      }
      if (!msg.role || typeof msg.role !== 'string') {
        throw new Error(`Message at index ${i} must have a valid 'role' field`);
      }
      if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
        throw new Error(`Message at index ${i} has invalid role '${msg.role}'. Must be one of: system, user, assistant, tool`);
      }
    }

    try {
      // Support both old signature (model as string) and new signature (options object)
      const opts: ChatOptions = typeof options === "string"
        ? { model: options, searchOptions }
        : options || {};

      // Route to Gemini if using Gemini provider
      if (this.geminiProvider) {
        return await this.geminiProvider.chat(messages, tools, opts);
      }

      // Disable tools for local inference (LM Studio) as they may not support function calling
      const useTools = !this.isLocalInference() && tools && tools.length > 0;

      // Inject Anthropic prompt-cache breakpoints (Manus AI #20).
      // Marks the last system message with cache_control so the stable prefix is always cached.
      // Hook lives in src/codebuddy/providers/provider-openai-compat-hooks.ts (Phase C1).
      let finalMessages: CodeBuddyMessage[] = messages;
      const modelInfo = getModelInfo(this.currentModel);
      if (modelInfo.provider === 'anthropic') {
        finalMessages = injectAnthropicCacheBreakpoints(messages) as CodeBuddyMessage[];
      }

      const requestPayload: ChatRequestPayload = {
        model: opts.model || this.currentModel,
        messages: finalMessages,
        tools: useTools ? tools : [],
        tool_choice: useTools ? "auto" : undefined,
        temperature: opts.temperature ?? 0.7,
        max_tokens: this.defaultMaxTokens,
      };

      // Add search parameters if specified (skip for local inference)
      const searchOpts = opts.searchOptions || searchOptions;
      const searchParameters = searchOpts?.search_parameters;
      if (this.shouldIncludeSearchParameters(searchParameters)) {
        requestPayload.search_parameters = searchParameters;
      }

      // Add extended thinking budget if enabled
      const { getExtendedThinking } = await import('../agent/extended-thinking.js');
      const thinkingConfig = getExtendedThinking().getThinkingConfig();
      if (thinkingConfig.thinking) {
        requestPayload.thinking = thinkingConfig.thinking;
      }

      // Add service tier for fast mode (Anthropic/OpenAI)
      if (opts.service_tier) {
        requestPayload.service_tier = opts.service_tier;
      }

      // JSON mode: add response_format for OpenAI/xAI providers.
      // For Anthropic, also inject the system-prompt instruction since the API
      // has no native equivalent. Hook lives in provider-openai-compat-hooks.ts.
      if (opts.responseFormat === 'json') {
        (requestPayload as unknown as Record<string, unknown>).response_format = { type: 'json_object' };
        if (modelInfo.provider === 'anthropic') {
          finalMessages = injectJsonSystemPromptForAnthropic(finalMessages);
        }
      }
      // Sync any post-payload-creation mutation of finalMessages back into the payload.
      // injectJsonSystemPromptForAnthropic above returns a new array; without
      // this line, requestPayload.messages would keep pointing at the original.
      requestPayload.messages = finalMessages;

      // Apply tool_choice override from options
      if (opts.tool_choice && useTools) {
        requestPayload.tool_choice = opts.tool_choice;
      }

      // Use retry with exponential backoff for API calls, optionally wrapped with circuit breaker
      const response = await this.withCircuitBreaker(opts.circuitBreaker, () =>
        retry(
          async () => {
            return await this.client!.chat.completions.create(
              requestPayload as unknown as ChatCompletionCreateParamsNonStreaming
            );
          },
          {
            ...RetryStrategies.llmApi,
            isRetryable: RetryPredicates.llmApiError,
            onRetry: (error, attempt, delay) => {
              logger.warn(`API call failed, retrying (attempt ${attempt}) in ${delay}ms...`, {
                source: 'CodeBuddyClient',
                error: error instanceof Error ? error.message : String(error),
              });
            },
          }
        )
      );

      // Track rate limit headers from API response (if available via OpenAI SDK)
      try {
        const rawResponse = (response as unknown as { _response?: { headers?: Record<string, string> } })._response;
        if (rawResponse?.headers) {
          const providerName = this.getProviderName();
          const rateLimitInfo = parseRateLimitHeaders(rawResponse.headers, providerName);
          if (rateLimitInfo.remainingRequests !== undefined || rateLimitInfo.remainingTokens !== undefined) {
            storeRateLimitInfo(rateLimitInfo);
          }
        }
      } catch {
        // Non-critical: rate limit tracking is best-effort
      }

      // Track prompt cache metrics from usage response
      const codeBuddyResponse = response as unknown as CodeBuddyResponse;
      const rawUsage = (response as unknown as Record<string, unknown>).usage as Record<string, unknown> | undefined;
      if (rawUsage) {
        this.trackPromptCache(rawUsage as { prompt_tokens?: number; cached_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } });

        // Normalize usage to include cached_tokens
        if (codeBuddyResponse.usage) {
          const cachedTokens = (rawUsage.cached_tokens as number | undefined)
            ?? ((rawUsage.prompt_tokens_details as { cached_tokens?: number } | undefined)?.cached_tokens);
          if (cachedTokens !== undefined) {
            codeBuddyResponse.usage.cached_tokens = cachedTokens;
          }
        }
      }

      return codeBuddyResponse;
    } catch (error: unknown) {
      // Re-throw CircuitOpenError directly for caller handling
      if (error instanceof CircuitOpenError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      // Map raw provider errors to actionable, user-friendly messages so
      // the CLI tells the user *how* to recover (bad key → config set;
      // rate limit → wait or /switch; context too large → /compact, etc.)
      throw new Error(mapProviderError(message, this.detectProviderLabel()));
    }
  }

  /**
   * Derive a short provider label from the current model for error messages.
   * E.g. "grok-code-fast-1" → "grok", "claude-sonnet-4-6" → "claude".
   */
  private detectProviderLabel(): string {
    const m = this.currentModel.toLowerCase();
    if (m.startsWith('grok')) return 'grok';
    if (m.startsWith('claude')) return 'anthropic';
    if (m.startsWith('gemini')) return 'gemini';
    if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 'openai';
    if (m.startsWith('ollama') || m.includes(':ollama')) return 'ollama';
    if (m.startsWith('deepseek')) return 'deepseek';
    if (m.startsWith('qwen')) return 'qwen';
    if (m.startsWith('mistral')) return 'mistral';
    return 'provider';
  }

  /**
   * Convert tool messages to user messages for models that don't support the tool role
   * LM Studio and some local models require this transformation
   */
  private convertToolMessagesForLocalModels(messages: CodeBuddyMessage[]): CodeBuddyMessage[] {
    // Check if we need conversion (has tool role messages and is using a local model)
    const hasToolMessages = messages.some((m: CodeBuddyMessage) => m.role === 'tool');
    if (!hasToolMessages) return messages;

    // Check if model uses local inference that might not support tool role
    const needsConversion = this.baseURL.includes(':1234') ||
                            this.baseURL.includes('lmstudio') ||
                            process.env.GROK_CONVERT_TOOL_MESSAGES === 'true';
    if (!needsConversion) return messages;

    return messages.map((msg: CodeBuddyMessage) => {
      if (msg.role === 'tool') {
        // Convert tool result to user message format
        return {
          role: 'user' as const,
          content: `[Tool Result]\n${msg.content}`,
        };
      }
      // Remove tool_calls from assistant messages for local models that don't support them in history
      if (hasToolCalls(msg)) {
        const toolCallsDesc = msg.tool_calls.map((tc: CodeBuddyToolCall) =>
          `Called ${tc.function.name}(${tc.function.arguments})`
        ).join('\n');
        return {
          role: 'assistant' as const,
          content: msg.content ? `${msg.content}\n\n[Tools Used]\n${toolCallsDesc}` : `[Tools Used]\n${toolCallsDesc}`,
        };
      }
      return msg;
    });
  }

  async *chatStream(
    messages: CodeBuddyMessage[],
    tools?: CodeBuddyTool[],
    options?: string | ChatOptions,
    searchOptions?: SearchOptions
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    try {
      // Support both old signature (model as string) and new signature (options object)
      const opts: ChatOptions = typeof options === "string"
        ? { model: options, searchOptions }
        : options || {};

      // Route to Gemini if using Gemini provider
      if (this.geminiProvider) {
        yield* this.geminiProvider.chatStream(messages, tools, opts);
        return;
      }

      // Disable tools for local inference (LM Studio) as they may not support function calling
      const useTools = !this.isLocalInference() && tools && tools.length > 0;

      // Convert tool messages for local models that don't support tool role
      const processedMessages = this.convertToolMessagesForLocalModels(messages);

      const requestPayload = {
        model: opts.model || this.currentModel,
        messages: processedMessages,
        tools: useTools ? tools : [],
        tool_choice: useTools ? "auto" as const : undefined,
        temperature: opts.temperature ?? 0.7,
        max_tokens: this.defaultMaxTokens,
      };

      // Add search parameters if specified (skip for local inference)
      const searchOpts = opts.searchOptions || searchOptions;
      const searchParameters = searchOpts?.search_parameters;
      const searchParams = this.shouldIncludeSearchParameters(searchParameters)
        ? { search_parameters: searchParameters }
        : {};

      // Add extended thinking budget if enabled (same as non-streaming path)
      const { getExtendedThinking } = await import('../agent/extended-thinking.js');
      const thinkingConfig = getExtendedThinking().getThinkingConfig();

      // Create streaming request payload
      const streamingPayload: ChatRequestPayloadStreaming = {
        ...requestPayload,
        ...searchParams,
        stream: true,
        ...(thinkingConfig.thinking ? { thinking: thinkingConfig.thinking } : {}),
        ...(opts.service_tier ? { service_tier: opts.service_tier } : {}),
        ...(opts.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
      };

      // Use retry with exponential backoff for stream initialization, optionally wrapped with circuit breaker
      const stream = await this.withCircuitBreaker(opts.circuitBreaker, () =>
        retry(
          async () => {
            return await this.client!.chat.completions.create(
              streamingPayload as unknown as ChatCompletionCreateParamsStreaming
            );
          },
          {
            ...RetryStrategies.llmApi,
            isRetryable: RetryPredicates.llmApiError,
            onRetry: (error, attempt, delay) => {
              logger.warn(`Stream initialization failed, retrying (attempt ${attempt}) in ${delay}ms...`, {
                source: 'CodeBuddyClient',
                error: error instanceof Error ? error.message : String(error),
              });
            },
          }
        )
      );

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error: unknown) {
      // Re-throw CircuitOpenError directly for caller handling
      if (error instanceof CircuitOpenError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      // Map raw provider errors to actionable messages (see chat()).
      throw new Error(mapProviderError(message, this.detectProviderLabel()));
    }
  }

  async search(
    query: string,
    searchParameters?: SearchParameters
  ): Promise<CodeBuddyResponse> {
    const searchMessage: CodeBuddyMessage = {
      role: "user",
      content: query,
    };

    const searchOptions: SearchOptions = {
      search_parameters: searchParameters || { mode: "on" },
    };

    return this.chat([searchMessage], [], undefined, searchOptions);
  }
}
