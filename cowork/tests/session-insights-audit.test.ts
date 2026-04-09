import { describe, expect, it } from 'vitest';
import {
  auditSessionTranscript,
  repairSessionTranscript,
} from '../src/main/session/session-insights-bridge';

describe('session transcript audit', () => {
  it('detects orphan tool results, missing tool results, and empty messages', () => {
    const audit = auditSessionTranscript('s1', [
      {
        id: 'm-empty',
        sessionId: 's1',
        role: 'assistant',
        content: [],
        timestamp: Date.now(),
      },
      {
        id: 'm-tool-use',
        sessionId: 's1',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Read',
            input: { path: 'src/index.ts' },
          },
        ],
        timestamp: Date.now(),
      },
      {
        id: 'm-orphan-result',
        sessionId: 's1',
        role: 'assistant',
        content: [
          {
            type: 'tool_result',
            toolUseId: 'missing-tool',
            content: 'not found',
          },
        ],
        timestamp: Date.now(),
      },
    ]);

    expect(audit.issueCount).toBe(3);
    expect(audit.emptyMessages).toBe(1);
    expect(audit.missingToolResults).toBe(1);
    expect(audit.orphanToolResults).toBe(1);
  });

  it('repairs simple transcript structure issues', () => {
    const repaired = repairSessionTranscript('s1', [
      {
        id: 'm-empty',
        sessionId: 's1',
        role: 'assistant',
        content: [],
        timestamp: 1,
      },
      {
        id: 'm-tool-use',
        sessionId: 's1',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Read',
            input: { path: 'src/index.ts' },
          },
        ],
        timestamp: 2,
      },
      {
        id: 'm-orphan-result',
        sessionId: 's1',
        role: 'assistant',
        content: [
          {
            type: 'tool_result',
            toolUseId: 'missing-tool',
            content: 'not found',
          },
        ],
        timestamp: 3,
      },
    ]);

    expect(repaired.changed).toBe(true);
    expect(repaired.removedEmptyMessages).toBe(2);
    expect(repaired.removedOrphanToolResults).toBe(1);
    expect(repaired.injectedSyntheticToolResults).toBe(1);
    expect(repaired.audit.issueCount).toBe(0);
  });
});
