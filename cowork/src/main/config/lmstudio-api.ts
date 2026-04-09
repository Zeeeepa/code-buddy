import type { ProviderModelInfo } from '../../renderer/types';
import { normalizeLmStudioBaseUrl } from './auth-utils';

const MODELS_TIMEOUT_MS = 8000;

function buildBaseUrl(baseUrl: string | undefined): string {
  return normalizeLmStudioBaseUrl(baseUrl) || 'http://localhost:1234/v1';
}

function buildHeaders(apiKey: string | undefined): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const trimmedApiKey = apiKey?.trim();
  if (trimmedApiKey) {
    headers.Authorization = `Bearer ${trimmedApiKey}`;
  }
  return headers;
}

export async function listLmStudioModels(input: {
  baseUrl?: string;
  apiKey?: string;
}): Promise<ProviderModelInfo[]> {
  const baseUrl = buildBaseUrl(input.baseUrl);
  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: buildHeaders(input.apiKey),
    signal: AbortSignal.timeout(MODELS_TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status}`);
  }

  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Failed to parse LM Studio API response: ${text.substring(0, 200)}`);
  }

  return (Array.isArray((data as { data?: unknown[] })?.data)
    ? (data as { data: unknown[] }).data
    : []
  )
    .map((item: unknown) => {
      const modelItem = item as { id?: unknown };
      const id = typeof modelItem?.id === 'string' ? modelItem.id.trim() : '';
      if (!id) {
        return null;
      }
      return {
        id,
        name: id,
      };
    })
    .filter((item: ProviderModelInfo | null): item is ProviderModelInfo => Boolean(item));
}
