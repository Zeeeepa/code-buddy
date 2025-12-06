import { ChatEntry } from "../../agent/grok-agent.js";
import { GrokClient } from "../../grok/client.js";
import { AITestRunner, createAITestRunner } from "../../testing/ai-integration-tests.js";
import stringWidth from "string-width";

export interface CommandHandlerResult {
  handled: boolean;
  entry?: ChatEntry;
  passToAI?: boolean;
  prompt?: string;
}

/**
 * Generate Tests - Create test scaffolds
 */
export function handleGenerateTests(args: string[]): CommandHandlerResult {
  const targetFile = args[0];

  if (!targetFile) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `🧪 Test Generator

Usage: /generate-tests <file>

Example: /generate-tests src/utils/helpers.ts

This will:
1. Analyze the file
2. Detect the test framework
3. Generate comprehensive tests`,
        timestamp: new Date(),
      },
    };
  }

  return {
    handled: true,
    passToAI: true,
    prompt: `Generate comprehensive tests for: ${targetFile}

1. Read and analyze the file
2. Identify all testable functions/methods
3. Generate unit tests covering:
   - Happy paths
   - Edge cases
   - Error conditions
4. Use the detected test framework conventions
5. Create the test file in the appropriate location`,
  };
}

/**
 * AI Test - Run integration tests on the current AI provider
 */
export async function handleAITest(
  args: string[],
  grokClient: GrokClient | null
): Promise<CommandHandlerResult> {
  const option = args[0]?.toLowerCase();

  // Check for API key
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `❌ AI Test Failed

No GROK_API_KEY environment variable found.
Set your API key to run integration tests.`,
        timestamp: new Date(),
      },
    };
  }

  // Use current client if available, otherwise create new one from env
  let client = grokClient;
  if (!client) {
    // Fallback: create client from environment variables
    const model = process.env.GROK_MODEL || process.env.OPENAI_MODEL;
    const baseURL = process.env.GROK_BASE_URL || process.env.OPENAI_BASE_URL;
    client = new GrokClient(apiKey, model, baseURL);
  }

  const currentModel = client.getCurrentModel();
  const currentBaseURL = client.getBaseURL();

  // Detect local models (LM Studio, Ollama) and increase timeout
  const isLocalModel = currentBaseURL.includes(':1234') ||
                       currentBaseURL.includes(':11434') ||
                       currentBaseURL.includes('localhost') ||
                       currentBaseURL.includes('127.0.0.1') ||
                       currentBaseURL.match(/10\.\d+\.\d+\.\d+/) !== null;

  // Local models get 120s timeout (vs 30s for cloud APIs)
  const timeout = isLocalModel ? 120000 : 30000;

  // Configure test options based on argument
  const testOptions = {
    timeout,
    verbose: false,
    skipExpensive: option === 'quick',
    testTools: option !== 'stream',
    testStreaming: option !== 'tools',
  };

  // Fun test names and emojis
  const testEmojis: Record<string, string> = {
    'Basic Completion': '🧠',
    'Simple Math': '🔢',
    'JSON Output': '📋',
    'Code Generation': '💻',
    'Context Understanding': '🧩',
    'Streaming Response': '🌊',
    'Tool Calling': '🔧',
    'Error Handling': '🛡️',
    'Long Context': '📚',
  };

  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let spinnerIndex = 0;
  let currentTest = '';
  const completedTests: string[] = [];
  let spinnerInterval: NodeJS.Timeout | null = null;

  // Create client and run tests
  try {
    const runner = createAITestRunner(client, testOptions);

    // Helper to pad string to width accounting for emoji visual width
    const padEnd = (str: string, targetWidth: number): string => {
      const currentWidth = stringWidth(str);
      if (currentWidth >= targetWidth) return str;
      return str + ' '.repeat(targetWidth - currentWidth);
    };

    const W = 60; // box width

    // Build progress display with proper emoji width handling
    const buildProgressDisplay = () => {
      const lines: string[] = [];
      lines.push('┌' + '─'.repeat(W - 2) + '┐');
      lines.push('│' + padEnd('          🧪 AI INTEGRATION TESTS IN PROGRESS', W - 2) + '│');
      lines.push('├' + '─'.repeat(W - 2) + '┤');
      lines.push('│' + padEnd(`  Model: ${currentModel}`, W - 2) + '│');
      lines.push('├' + '─'.repeat(W - 2) + '┤');

      // Show completed tests
      for (const test of completedTests) {
        lines.push('│' + padEnd(`  ${test}`, W - 2) + '│');
      }

      // Show current test with spinner
      if (currentTest) {
        const emoji = testEmojis[currentTest] || '🔬';
        const spinner = spinnerFrames[spinnerIndex % spinnerFrames.length];
        lines.push('│' + padEnd(`  ${spinner} ${emoji} ${currentTest}...`, W - 2) + '│');
      }

      lines.push('└' + '─'.repeat(W - 2) + '┘');
      return lines.join('\n');
    };

    // Track progress
    runner.on('test:start', ({ name }) => {
      currentTest = name;
    });

    runner.on('test:complete', (result) => {
      const emoji = testEmojis[result.name] || '🔬';
      const status = result.passed ? '✅' : '❌';
      const duration = result.duration ? `${(result.duration / 1000).toFixed(1)}s` : '';
      completedTests.push(`${status} ${emoji} ${result.name} ${duration}`);
      currentTest = '';
    });

    runner.on('test:skipped', ({ name }) => {
      const emoji = testEmojis[name] || '🔬';
      completedTests.push(`⏭️  ${emoji} ${name} (skipped)`);
    });

    // Start spinner animation (write to stderr to not interfere with output)
    spinnerInterval = setInterval(() => {
      spinnerIndex++;
      // Clear and redraw progress (using ANSI escape codes)
      const progress = buildProgressDisplay();
      process.stderr.write(`\x1b[${completedTests.length + 7}A\x1b[0J${progress}\n`);
    }, 100);

    // Show initial progress
    process.stderr.write('\n' + buildProgressDisplay() + '\n');

    const suite = await runner.runAll();

    // Stop spinner
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
    }

    // Clear progress display
    const clearLines = completedTests.length + 8;
    process.stderr.write(`\x1b[${clearLines}A\x1b[0J`);

    // Format final results
    const resultContent = AITestRunner.formatResults(suite);

    return {
      handled: true,
      entry: {
        type: "assistant",
        content: resultContent,
        timestamp: new Date(),
      },
    };
  } catch (error) {
    // Stop spinner on error
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
    }

    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `❌ AI Test Error

${error instanceof Error ? error.message : String(error)}

Check your API key and network connection.`,
        timestamp: new Date(),
      },
    };
  }
}
