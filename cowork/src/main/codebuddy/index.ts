/**
 * @module main/codebuddy
 *
 * Barrel export for the Code Buddy backend adapter.
 */
export {
  CodeBuddyAdapter,
  getCodeBuddyAdapter,
  resetCodeBuddyAdapter,
  type CodeBuddyConfig,
  type CodeBuddyMessage,
  type CodeBuddyStreamEvent,
  type CodeBuddyStreamEventType,
  type CodeBuddyToolCall,
} from './codebuddy-adapter';

export { SessionBridge } from './session-bridge';
