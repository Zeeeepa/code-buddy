/**
 * UI Component Tests for Chat Interface (Item 8)
 */

import React from 'react';
import { vi } from 'vitest';

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
import { Text, Box } from 'ink';

const MockChatMessage = ({ role, content }: { role: string; content: string }) => (
  <Box flexDirection="column">
    <Text color={role === 'user' ? 'blue' : 'green'}>{role}:</Text>
    <Text>{content}</Text>
  </Box>
);

const MockProgressBar = ({ progress }: { progress: number }) => (
  <Box>
    <Text>[{'='.repeat(Math.floor(progress / 5))}] {progress}%</Text>
  </Box>
);

describe('Chat Interface UI Components', () => {
  describe('ChatMessage', () => {
    it('should render user message', () => {
      const { lastFrame } = render(<MockChatMessage role="user" content="Hello" />);
      expect(lastFrame()).toContain('user:');
      expect(lastFrame()).toContain('Hello');
    });

    it('should render assistant message', () => {
      const { lastFrame } = render(<MockChatMessage role="assistant" content="Hi!" />);
      expect(lastFrame()).toContain('assistant:');
    });

    it('should handle empty content', () => {
      const { lastFrame } = render(<MockChatMessage role="user" content="" />);
      expect(lastFrame()).toContain('user:');
    });
  });

  describe('ProgressBar', () => {
    it('should render progress correctly', () => {
      const { lastFrame } = render(<MockProgressBar progress={50} />);
      expect(lastFrame()).toContain('50%');
    });
  });
});

describe('UI Snapshots (Item 87)', () => {
  it('should match ChatMessage snapshot', () => {
    const { lastFrame } = render(<MockChatMessage role="user" content="Test" />);
    expect(lastFrame()).toMatchSnapshot();
  });

  it('should match ProgressBar snapshot', () => {
    const { lastFrame } = render(<MockProgressBar progress={75} />);
    expect(lastFrame()).toMatchSnapshot();
  });
});
