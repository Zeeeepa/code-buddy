/**
 * Twilio Voice Channel Adapter
 *
 * Manages voice calls via Twilio API.
 * This is a stub implementation.
 */

import { logger } from '../../utils/logger.js';

export interface TwilioVoiceConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  webhookUrl?: string;
}

let callCounter = 0;

export class TwilioVoiceAdapter {
  private config: TwilioVoiceConfig;
  private running = false;
  private activeCalls: Map<string, { to: string; startedAt: Date }> = new Map();

  constructor(config: TwilioVoiceConfig) {
    this.config = { ...config };
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('TwilioVoiceAdapter is already running');
    }
    logger.debug('TwilioVoiceAdapter: initializing', {
      accountSid: this.config.accountSid,
      phoneNumber: this.config.phoneNumber,
    });
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) {
      throw new Error('TwilioVoiceAdapter is not running');
    }
    logger.debug('TwilioVoiceAdapter: stopping');
    this.activeCalls.clear();
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async makeCall(to: string, message: string): Promise<{ success: boolean; callSid: string }> {
    if (!this.running) {
      throw new Error('TwilioVoiceAdapter is not running');
    }
    const callSid = `CA${Date.now()}_${++callCounter}`;
    this.activeCalls.set(callSid, { to, startedAt: new Date() });
    logger.debug('TwilioVoiceAdapter: making call', { to, callSid });
    return { success: true, callSid };
  }

  async endCall(callSid: string): Promise<{ success: boolean }> {
    if (!this.running) {
      throw new Error('TwilioVoiceAdapter is not running');
    }
    const existed = this.activeCalls.delete(callSid);
    logger.debug('TwilioVoiceAdapter: ending call', { callSid, existed });
    return { success: existed };
  }

  getActiveCalls(): Array<{ callSid: string; to: string; startedAt: Date }> {
    return Array.from(this.activeCalls.entries()).map(([callSid, info]) => ({
      callSid,
      ...info,
    }));
  }

  generateTwiML(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${this.escapeXml(message)}</Say></Response>`;
  }

  getConfig(): TwilioVoiceConfig {
    return { ...this.config };
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export default TwilioVoiceAdapter;
