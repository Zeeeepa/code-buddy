/**
 * Automation — polls, auth monitoring, and trigger sources.
 */

export { PollManager, type PollConfig, type PollResult, type PollType } from './polls.js';
export { AuthMonitor, type AuthMonitorConfig, type AuthTarget, type AuthState, type AuthEvent } from './auth-monitoring.js';
export {
  GmailTrigger,
  getGmailTrigger,
  resetGmailTrigger,
  type GmailTriggerConfig,
  type GmailTriggerEvent,
} from './gmail-trigger.js';
