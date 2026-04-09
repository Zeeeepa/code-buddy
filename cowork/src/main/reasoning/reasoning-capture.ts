import type { ReasoningBridge } from './reasoning-bridge';

interface ReasoningCaptureOptions {
  bridge: ReasoningBridge;
  toolUseId: string;
  sessionId: string;
  problem: string;
  mode: string;
  flushThreshold?: number;
}

export class ReasoningCapture {
  private readonly bridge: ReasoningBridge;
  private readonly toolUseId: string;
  private readonly sessionId: string;
  private readonly problem: string;
  private readonly mode: string;
  private readonly flushThreshold: number;
  private started = false;
  private completed = false;
  private nodeIndex = 0;
  private buffer = '';

  constructor(options: ReasoningCaptureOptions) {
    this.bridge = options.bridge;
    this.toolUseId = options.toolUseId;
    this.sessionId = options.sessionId;
    this.problem = options.problem;
    this.mode = options.mode;
    this.flushThreshold = options.flushThreshold ?? 160;
  }

  push(delta: string | undefined): void {
    if (!delta) return;
    this.buffer += delta;
    if (this.buffer.length >= this.flushThreshold || delta.includes('\n')) {
      this.flush();
    }
  }

  flush(): void {
    const label = this.buffer.trim();
    if (!label) {
      this.buffer = '';
      return;
    }
    this.ensureStarted();
    this.nodeIndex += 1;
    this.bridge.pushEvent({
      toolUseId: this.toolUseId,
      sessionId: this.sessionId,
      type: 'node',
      node: {
        id: `node-${this.nodeIndex}`,
        parentId: this.nodeIndex > 1 ? `node-${this.nodeIndex - 1}` : null,
        depth: Math.max(0, this.nodeIndex - 1),
        label,
        selected: this.nodeIndex === 1,
      },
    });
    this.buffer = '';
  }

  complete(finalAnswer?: string): void {
    if (this.completed) return;
    this.flush();
    if (!this.started) return;
    this.completed = true;
    this.bridge.pushEvent({
      toolUseId: this.toolUseId,
      sessionId: this.sessionId,
      type: 'complete',
      finalAnswer,
      iterations: this.nodeIndex,
    });
  }

  private ensureStarted(): void {
    if (this.started) return;
    this.started = true;
    this.bridge.pushEvent({
      toolUseId: this.toolUseId,
      sessionId: this.sessionId,
      type: 'start',
      problem: this.problem,
      mode: this.mode,
    });
  }
}

export function createReasoningCapture(options: ReasoningCaptureOptions): ReasoningCapture {
  return new ReasoningCapture(options);
}
