/**
 * Triggers Module
 *
 * Event-driven webhook triggers for Code Buddy.
 * Closes the gap with Cursor (Slack/Linear/GitHub/PagerDuty triggers).
 */

export {
  WebhookTriggerManager,
  getWebhookTriggerManager,
  resetWebhookTriggerManager,
  resolveTemplate,
  matchFilters,
  verifyWebhookSignature,
  type WebhookTriggerConfig,
  type WebhookSource,
  type TriggerResult,
  type WebhookEvent,
  type WebhookTriggerEvents,
} from './webhook-trigger.js';

export {
  parseGitHubWebhook,
  verifyGitHubSignature,
  buildGitHubEventSummary,
  type GitHubWebhookPayload,
} from './github-webhook.js';

export {
  parseGenericWebhook,
  verifyGenericAuth,
  getPath,
  buildGenericEventSummary,
  type GenericWebhookConfig,
} from './generic-webhook.js';
