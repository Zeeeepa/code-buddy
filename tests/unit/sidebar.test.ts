/**
 * Tests for Sidebar component
 */

import React from 'react';
import { vi, describe, it, expect } from 'vitest';

// Mock ink-testing-library with a lightweight render that extracts text from React elements
vi.mock('ink-testing-library', () => {
  function extractText(element: unknown, depth = 0): string {
    if (depth > 50) return '';
    if (!element) return '';
    if (typeof element === 'string') return element;
    if (typeof element === 'number') return String(element);
    if (typeof element === 'boolean') return '';
    if (Array.isArray(element)) {
      return element.map((e) => extractText(e, depth + 1)).join('');
    }
    if (React.isValidElement(element)) {
      const { props, type } = element as React.ReactElement<{ children?: unknown }>;
      if (typeof type === 'function') {
        try {
          const rendered = (type as (p: unknown) => unknown)(props);
          return extractText(rendered, depth + 1);
        } catch {
          return props?.children ? extractText(props.children, depth + 1) : '';
        }
      }
      if (props?.children) {
        return extractText(props.children, depth + 1);
      }
    }
    return '';
  }

  return {
    render(component: unknown) {
      let lastOutput = extractText(component);
      return {
        lastFrame: () => lastOutput,
        frames: [lastOutput],
        unmount: vi.fn(),
        rerender: vi.fn((newComponent: unknown) => {
          lastOutput = extractText(newComponent);
          return lastOutput;
        }),
        stdin: { write: vi.fn() },
        stdout: lastOutput,
      };
    },
  };
});

// Mock ink to provide simple passthrough components
vi.mock('ink', () => ({
  Text: ({ children }: { children?: React.ReactNode }) => children,
  Box: ({ children }: { children?: React.ReactNode }) => children,
}));

import { render } from 'ink-testing-library';
import { Sidebar } from '../../src/ui/components/Sidebar.js';

describe('Sidebar', () => {
  const defaultProps = {
    model: 'grok-4-fast',
    sessionCost: 0.0042,
    costLimit: 10,
    visible: true,
  };

  it('returns null when visible is false', () => {
    const { lastFrame } = render(
      React.createElement(Sidebar, { ...defaultProps, visible: false })
    );
    expect(lastFrame()).toBe('');
  });

  it('renders model name when visible', () => {
    const { lastFrame } = render(
      React.createElement(Sidebar, defaultProps)
    );
    const output = lastFrame()!;
    expect(output).toContain('Model');
    expect(output).toContain('grok-4-fast');
  });

  it('renders cost section', () => {
    const { lastFrame } = render(
      React.createElement(Sidebar, defaultProps)
    );
    const output = lastFrame()!;
    expect(output).toContain('Cost');
    expect(output).toContain('0.0042');
  });

  it('renders git branch when provided', () => {
    const { lastFrame } = render(
      React.createElement(Sidebar, {
        ...defaultProps,
        gitBranch: 'feat/sidebar',
        diffCount: 3,
      })
    );
    const output = lastFrame()!;
    expect(output).toContain('Git');
    expect(output).toContain('feat/sidebar');
    expect(output).toContain('3 files');
  });

  it('does not render git section when branch is undefined', () => {
    const { lastFrame } = render(
      React.createElement(Sidebar, defaultProps)
    );
    const output = lastFrame()!;
    expect(output).not.toContain('Git');
    expect(output).not.toContain('Branch');
  });

  it('renders MCP servers', () => {
    const { lastFrame } = render(
      React.createElement(Sidebar, {
        ...defaultProps,
        mcpServers: [
          { name: 'memory', status: 'connected' as const },
          { name: 'tools', status: 'error' as const },
        ],
      })
    );
    const output = lastFrame()!;
    expect(output).toContain('MCP');
    expect(output).toContain('memory');
    expect(output).toContain('tools');
  });

  it('renders todo count when greater than zero', () => {
    const { lastFrame } = render(
      React.createElement(Sidebar, {
        ...defaultProps,
        todoCount: 5,
      })
    );
    const output = lastFrame()!;
    expect(output).toContain('Todos');
    expect(output).toContain('5 pending');
  });

  it('does not render todo section when count is zero', () => {
    const { lastFrame } = render(
      React.createElement(Sidebar, {
        ...defaultProps,
        todoCount: 0,
      })
    );
    const output = lastFrame()!;
    expect(output).not.toContain('Todos');
  });
});
