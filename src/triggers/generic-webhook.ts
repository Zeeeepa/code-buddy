/**
 * Generic Webhook Parser
 *
 * Handles webhooks from non-specific sources. Accepts any JSON body
 * and resolves template variables from the body path.
 *
 * Supports:
 * - Arbitrary JSON body with dot-notation path resolution
 * - Header-based authentication (Bearer token or custom header)
 * - Event type detection from body or headers
 */

import type { WebhookEvent } from './webhook-trigger.js';

// ============================================================================
// Types
// ============================================================================

export interface GenericWebhookConfig {
  /** Custom event type field path in the body (default: 'event' or 'type') */
  eventTypePath?: string;
  /** Custom header for event type (e.g. 'X-Event-Type') */
  eventTypeHeader?: string;
  /** Authentication mode */
  authMode?: 'bearer' | 'header' | 'none';
  /** Custom auth header name (when authMode is 'header') */
  authHeaderName?: string;
}

// ============================================================================
// Generic Event Parser
// ============================================================================

/**
 * Parse a generic webhook into a standardized WebhookEvent.
 * Flattens top-level scalar fields into the data map.
 */
export function parseGenericWebhook(
  headers: Record<string, string>,
  body: unknown,
  config?: GenericWebhookConfig,
): WebhookEvent {
  const payload = body as Record<string, unknown>;

  // Determine event type
  let eventType = 'generic';
  if (config?.eventTypePath) {
    eventType = String(getPath(payload, config.eventTypePath) || 'generic');
  } else if (config?.eventTypeHeader) {
    eventType = headers[config.eventTypeHeader.toLowerCase()] ||
                headers[config.eventTypeHeader] ||
                'generic';
  } else {
    // Auto-detect from common field names
    eventType = String(
      payload.event ||
      payload.type ||
      payload.action ||
      payload.event_type ||
      payload.eventType ||
      headers['x-event-type'] ||
      headers['X-Event-Type'] ||
      'generic'
    );
  }

  // Flatten scalar fields into data
  const data: Record<string, string> = {
    type: eventType,
  };

  flattenObject(payload, data, '');

  return {
    source: 'generic',
    type: eventType,
    data,
    rawBody: body,
    headers,
  };
}

/**
 * Verify a generic webhook's authentication.
 */
export function verifyGenericAuth(
  headers: Record<string, string>,
  secret: string,
  config?: GenericWebhookConfig,
): boolean {
  if (!secret) return true;

  const authMode = config?.authMode || 'bearer';

  switch (authMode) {
    case 'bearer': {
      const authHeader = headers['authorization'] || headers['Authorization'] || '';
      return authHeader === `Bearer ${secret}`;
    }

    case 'header': {
      const headerName = config?.authHeaderName || 'X-Webhook-Secret';
      const headerValue = headers[headerName.toLowerCase()] || headers[headerName] || '';
      return headerValue === secret;
    }

    case 'none':
      return true;

    default:
      return false;
  }
}

// ============================================================================
// Path Resolution
// ============================================================================

/**
 * Get a value from a nested object using dot notation.
 * E.g. getPath(obj, 'data.items.0.name')
 */
export function getPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    if (Array.isArray(current)) {
      const idx = parseInt(part, 10);
      if (Number.isNaN(idx)) return undefined;
      current = current[idx];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

/**
 * Flatten an object's scalar fields into a Record<string, string>.
 * Handles nested objects up to 3 levels deep.
 */
function flattenObject(
  obj: unknown,
  result: Record<string, string>,
  prefix: string,
  depth: number = 0,
): void {
  if (depth > 3) return;
  if (typeof obj !== 'object' || obj === null) return;

  const entries = Array.isArray(obj)
    ? obj.map((v, i) => [String(i), v] as const)
    : Object.entries(obj as Record<string, unknown>);

  for (const [key, value] of entries) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      continue;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[fullKey] = String(value);
    } else if (typeof value === 'object') {
      flattenObject(value, result, fullKey, depth + 1);
    }
  }
}

/**
 * Build a human-readable summary of a generic webhook event.
 */
export function buildGenericEventSummary(event: WebhookEvent): string {
  const parts: string[] = [`Webhook Event: ${event.type}`];

  // Include a selection of top-level fields
  const skip = new Set(['type']);
  let fieldCount = 0;
  for (const [key, value] of Object.entries(event.data)) {
    if (skip.has(key)) continue;
    if (fieldCount >= 20) {
      parts.push(`  ... (${Object.keys(event.data).length - fieldCount} more fields)`);
      break;
    }
    parts.push(`  ${key}: ${value.slice(0, 200)}`);
    fieldCount++;
  }

  return parts.join('\n');
}
