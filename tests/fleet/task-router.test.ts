/**
 * Fleet P3 — verify the task router scores peers correctly and
 * respects the privacy / cost / latency / context-window constraints.
 *
 * The router is pure logic over the input shapes — no LLM, no
 * network. Each test builds a synthetic `PeerSlot[]` and asserts
 * the resulting `DispatchPlan`.
 */
import { describe, expect, it } from 'vitest';

import {
  TaskRouter,
  NoPeerAvailableError,
  type PeerSlot,
} from '../../src/fleet/task-router';
import type {
  FleetModelDescriptor,
  PeerCapability,
} from '../../src/fleet/types';
import type { TaskClassification } from '../../src/optimization/model-routing';

function model(
  id: string,
  partial: Partial<FleetModelDescriptor> = {},
): FleetModelDescriptor {
  return {
    id,
    contextWindow: 200_000,
    strengths: [],
    provider: 'unknown' as const,
    ...partial,
  };
}

function peer(
  peerId: string,
  cap: Partial<PeerCapability>,
): PeerSlot {
  return {
    peerId,
    capability: {
      models: [],
      egress: 'local',
      machineLabel: peerId,
      ...cap,
    },
  };
}

function classify(
  partial: Partial<TaskClassification> = {},
): TaskClassification {
  return {
    complexity: 'simple',
    requiresVision: false,
    requiresReasoning: false,
    requiresLongContext: false,
    estimatedTokens: 1000,
    confidence: 0.8,
    ...partial,
  };
}

const router = new TaskRouter();

describe('TaskRouter — basic plan', () => {
  it('returns the only candidate when one peer × one model is available', () => {
    const peers: PeerSlot[] = [
      peer('ministar', {
        models: [model('qwen3.6:35b', { provider: 'ollama' })],
      }),
    ];
    const plan = router.plan(classify(), peers);
    expect(plan.primary.peerId).toBe('ministar');
    expect(plan.primary.model).toBe('qwen3.6:35b');
    expect(plan.fallback).toBeUndefined(); // only one peer
  });

  it('throws NoPeerAvailableError when no peer satisfies', () => {
    expect(() => router.plan(classify(), [])).toThrow(NoPeerAvailableError);
  });
});

describe('TaskRouter — strength matching', () => {
  it('prefers a model with reasoning + thinking for complex tasks', () => {
    const peers: PeerSlot[] = [
      peer('ministar', {
        models: [
          model('gemma4:8b', {
            provider: 'ollama',
            strengths: ['cheap', 'fast'],
          }),
          model('qwen3.6:35b-a3b', {
            provider: 'ollama',
            strengths: ['reasoning', 'thinking'],
          }),
        ],
      }),
    ];
    const plan = router.plan(
      classify({ complexity: 'reasoning_heavy', requiresReasoning: true }),
      peers,
    );
    expect(plan.primary.model).toBe('qwen3.6:35b-a3b');
  });

  it('prefers a model with vision when task requires images', () => {
    const peers: PeerSlot[] = [
      peer('cloud', {
        egress: 'cloud',
        models: [
          model('gpt-5-mini', {
            provider: 'openai',
            strengths: ['cheap', 'fast'],
            costInputUsdPerMtok: 0.4,
          }),
          model('gemini-2.5-pro', {
            provider: 'gemini',
            strengths: ['vision', 'long-context'],
            costInputUsdPerMtok: 2.5,
          }),
        ],
      }),
    ];
    const plan = router.plan(
      classify({ requiresVision: true }),
      peers,
    );
    expect(plan.primary.model).toBe('gemini-2.5-pro');
  });
});

describe('TaskRouter — privacy veto', () => {
  it('drops cloud peers when privacyTag=sensitive', () => {
    const peers: PeerSlot[] = [
      peer('ministar', {
        egress: 'local',
        models: [model('qwen3.6:35b', { provider: 'ollama' })],
      }),
      peer('cloud-claude', {
        egress: 'cloud',
        models: [model('claude-opus-4', { provider: 'anthropic' })],
      }),
    ];
    const plan = router.plan(classify(), peers, { privacyTag: 'sensitive' });
    expect(plan.primary.peerId).toBe('ministar');
    expect(plan.fallback).toBeUndefined(); // cloud vetoed
  });

  it('throws when sensitive task has only cloud peers available', () => {
    const peers: PeerSlot[] = [
      peer('cloud', {
        egress: 'cloud',
        models: [model('claude-opus-4', { provider: 'anthropic' })],
      }),
    ];
    expect(() =>
      router.plan(classify(), peers, { privacyTag: 'sensitive' }),
    ).toThrow(NoPeerAvailableError);
  });

  it('passes through cloud peers when privacyTag=public', () => {
    const peers: PeerSlot[] = [
      peer('cloud', {
        egress: 'cloud',
        models: [model('claude-opus-4', { provider: 'anthropic' })],
      }),
    ];
    const plan = router.plan(classify(), peers, { privacyTag: 'public' });
    expect(plan.primary.peerId).toBe('cloud');
  });
});

describe('TaskRouter — context window filter', () => {
  it('drops models whose contextWindow is too small', () => {
    const peers: PeerSlot[] = [
      peer('a', {
        models: [
          model('small-ctx', { contextWindow: 4000, provider: 'ollama' }),
          model('big-ctx', {
            contextWindow: 128_000,
            provider: 'ollama',
            strengths: ['long-context'],
          }),
        ],
      }),
    ];
    const plan = router.plan(
      classify({ requiresLongContext: true, estimatedTokens: 50_000 }),
      peers,
      { estimatedTokens: 50_000 },
    );
    expect(plan.primary.model).toBe('big-ctx');
  });
});

describe('TaskRouter — cost scoring', () => {
  it('prefers cheaper models when match scores are equal', () => {
    const peers: PeerSlot[] = [
      peer('cloud', {
        egress: 'cloud',
        models: [
          model('gpt-5', {
            provider: 'openai',
            strengths: ['reasoning'],
            costInputUsdPerMtok: 5,
            costOutputUsdPerMtok: 20,
          }),
          model('gpt-5-mini', {
            provider: 'openai',
            strengths: ['reasoning'],
            costInputUsdPerMtok: 0.4,
            costOutputUsdPerMtok: 1.6,
          }),
        ],
      }),
    ];
    const plan = router.plan(
      classify({ complexity: 'moderate', requiresReasoning: true }),
      peers,
    );
    expect(plan.primary.model).toBe('gpt-5-mini');
  });

  it('local (no cost) beats cloud at equal match', () => {
    const peers: PeerSlot[] = [
      peer('ministar', {
        egress: 'local',
        models: [
          model('qwen3.6:35b', {
            provider: 'ollama',
            strengths: ['reasoning', 'thinking'],
          }),
        ],
      }),
      peer('cloud', {
        egress: 'cloud',
        models: [
          model('claude-opus-4', {
            provider: 'anthropic',
            strengths: ['reasoning', 'thinking'],
            costInputUsdPerMtok: 15,
            costOutputUsdPerMtok: 75,
          }),
        ],
      }),
    ];
    const plan = router.plan(
      classify({ complexity: 'reasoning_heavy', requiresReasoning: true }),
      peers,
    );
    expect(plan.primary.peerId).toBe('ministar');
    expect(plan.fallback?.peerId).toBe('cloud');
  });
});

describe('TaskRouter — load scoring', () => {
  it('prefers the less-loaded peer when match scores are equal', () => {
    const peers: PeerSlot[] = [
      peer('busy', {
        models: [model('claude-haiku-4', { strengths: ['cheap'] })],
        maxConcurrency: 4,
        activeRequests: 3, // 75% loaded
      }),
      peer('idle', {
        models: [model('claude-haiku-4', { strengths: ['cheap'] })],
        maxConcurrency: 4,
        activeRequests: 0, // idle
      }),
    ];
    const plan = router.plan(classify(), peers);
    expect(plan.primary.peerId).toBe('idle');
  });
});

describe('TaskRouter — parallelism', () => {
  it('emits N parallel lanes across distinct peers when parallelism set', () => {
    const peers: PeerSlot[] = [
      peer('p1', { models: [model('m1', { strengths: ['reasoning'] })] }),
      peer('p2', { models: [model('m2', { strengths: ['reasoning'] })] }),
      peer('p3', { models: [model('m3', { strengths: ['reasoning'] })] }),
    ];
    const plan = router.plan(
      classify({ complexity: 'complex', requiresReasoning: true }),
      peers,
      { parallelism: 3 },
    );
    expect(plan.parallel).toHaveLength(3);
    expect(new Set(plan.parallel!.map((l) => l.peerId)).size).toBe(3);
  });

  it('falls back to multi-model on same peer when not enough peers', () => {
    const peers: PeerSlot[] = [
      peer('only', {
        models: [
          model('a', { strengths: ['reasoning'] }),
          model('b', { strengths: ['reasoning'] }),
        ],
      }),
    ];
    const plan = router.plan(
      classify({ complexity: 'complex', requiresReasoning: true }),
      peers,
      { parallelism: 2 },
    );
    expect(plan.parallel).toHaveLength(2);
    expect(plan.parallel![0].peerId).toBe('only');
    expect(plan.parallel![1].peerId).toBe('only');
    expect(plan.parallel![0].model).not.toBe(plan.parallel![1].model);
  });
});

describe('TaskRouter — rationale text', () => {
  it('mentions primary peer + score in rationale', () => {
    const peers: PeerSlot[] = [
      peer('ministar', {
        models: [model('qwen3.6:35b', { strengths: ['reasoning'] })],
      }),
    ];
    const plan = router.plan(
      classify({ requiresReasoning: true }),
      peers,
    );
    expect(plan.rationale).toContain('ministar');
    expect(plan.rationale).toContain('qwen3.6:35b');
  });
});
