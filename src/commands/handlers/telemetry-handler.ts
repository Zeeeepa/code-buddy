/**
 * /telemetry Slash Command Handler
 *
 * Controls telemetry opt-in/opt-out settings.
 *
 * Usage:
 *   /telemetry on       — enable telemetry
 *   /telemetry off      — disable telemetry
 *   /telemetry status   — show current telemetry settings
 */

import type { CommandHandlerResult } from './branch-handlers.js';

export async function handleTelemetry(args: string[]): Promise<CommandHandlerResult> {
  const action = args[0]?.toLowerCase() || 'status';

  const {
    getTelemetryConfig,
    setTelemetryEnabled,
    setTelemetryLevel,
    isTelemetryEnabled,
  } = await import('../../utils/telemetry-config.js');

  switch (action) {
    case 'on': {
      setTelemetryEnabled(true);
      return result('Telemetry enabled. Error reports and tracing data will be collected.\nRestart may be needed for changes to take full effect.');
    }

    case 'off': {
      setTelemetryEnabled(false);
      return result('Telemetry disabled. No error reports or tracing data will be collected.\nRestart may be needed for changes to take full effect.');
    }

    case 'errors-only': {
      setTelemetryLevel('errors-only');
      return result('Telemetry set to errors-only mode. Only error reports will be sent (no tracing).');
    }

    case 'full': {
      setTelemetryLevel('full');
      return result('Telemetry set to full mode. Error reports and tracing data will be collected.');
    }

    case 'status':
    default: {
      const config = getTelemetryConfig();
      const enabled = isTelemetryEnabled();
      const sentryDsn = process.env.SENTRY_DSN ? 'configured' : 'not set';
      const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? 'configured' : 'not set';

      return result(
        `Telemetry status:\n` +
        `  Enabled: ${enabled ? 'yes' : 'no'}\n` +
        `  Level:   ${config.level}\n` +
        `  Sentry:  ${sentryDsn}\n` +
        `  OTEL:    ${otelEndpoint}\n\n` +
        `Use /telemetry on|off|errors-only|full to change settings.`
      );
    }
  }
}

function result(content: string): CommandHandlerResult {
  return {
    handled: true,
    entry: { type: 'assistant', content, timestamp: new Date() },
  };
}
