/**
 * SessionTimeline - Interactive session message timeline with fork-from-any-point
 *
 * Renders a vertical list of messages from the current session branch.
 * Arrow keys navigate, Enter forks from the selected message, Escape closes.
 * Shows branch tree indicators for forked conversations.
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { getBranchManager } from '../../persistence/conversation-branches.js';
import type { CodeBuddyMessage } from '../../codebuddy/client.js';

export interface SessionTimelineProps {
  /** Called when a fork is created from a message index */
  onFork?: (branchId: string, messageIndex: number) => void;
  /** Called when the timeline is closed via Escape */
  onClose?: () => void;
}

/**
 * Role icon for display
 */
function getRoleIcon(role: string): string {
  switch (role) {
    case 'user': return '>';
    case 'assistant': return '<';
    case 'system': return '*';
    case 'tool': return '#';
    default: return '?';
  }
}

/**
 * Truncate a message content string for display
 */
function truncateContent(message: CodeBuddyMessage, maxLen: number = 60): string {
  const content = typeof message.content === 'string'
    ? message.content
    : Array.isArray(message.content)
      ? message.content.map(p => (typeof p === 'string' ? p : ('text' in p ? p.text : '[media]'))).join(' ')
      : JSON.stringify(message.content);

  const singleLine = content.replace(/\n/g, ' ').trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.slice(0, maxLen - 3) + '...';
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(date?: Date): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get branch indicators for messages that have forks
 */
function getBranchIndicators(): Map<number, string[]> {
  const indicators = new Map<number, string[]>();
  const branchManager = getBranchManager();
  const currentBranch = branchManager.getCurrentBranch();
  const allBranches = branchManager.getAllBranches();

  for (const branch of allBranches) {
    if (branch.parentId === currentBranch.id && branch.parentMessageIndex !== undefined) {
      const existing = indicators.get(branch.parentMessageIndex) || [];
      existing.push(branch.name);
      indicators.set(branch.parentMessageIndex, existing);
    }
  }

  return indicators;
}

/**
 * SessionTimeline component
 */
const SessionTimeline: React.FC<SessionTimelineProps> = ({ onFork, onClose }) => {
  const branchManager = getBranchManager();
  const currentBranch = branchManager.getCurrentBranch();
  const messages = currentBranch.messages;
  const branchIndicators = getBranchIndicators();

  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, messages.length - 1));

  // Calculate visible window (show up to 15 messages centered on selection)
  const windowSize = 15;
  const halfWindow = Math.floor(windowSize / 2);
  const windowStart = Math.max(0, Math.min(selectedIndex - halfWindow, messages.length - windowSize));
  const windowEnd = Math.min(messages.length, windowStart + windowSize);
  const visibleMessages = messages.slice(windowStart, windowEnd);

  useInput(useCallback((input: string, key: { upArrow?: boolean; downArrow?: boolean; return?: boolean; escape?: boolean }) => {
    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(messages.length - 1, prev + 1));
    } else if (key.return) {
      // Fork from selected message
      if (messages.length > 0) {
        const branchName = `fork-at-${selectedIndex}-${Date.now().toString(36)}`;
        const branch = branchManager.forkFromMessage(branchName, selectedIndex);
        if (onFork) {
          onFork(branch.id, selectedIndex);
        }
      }
    } else if (key.escape || input === 'q') {
      if (onClose) {
        onClose();
      }
    }
  }, [messages.length, selectedIndex, branchManager, onFork, onClose]));

  if (messages.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Session Timeline</Text>
        <Text color="gray">No messages in current session.</Text>
        <Text dimColor>Press Escape to close</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyan">
        Session Timeline - {currentBranch.name} ({messages.length} messages)
      </Text>
      <Text dimColor>
        {'\u2191\u2193'} navigate | Enter: fork from selected | Esc: close
      </Text>
      <Text dimColor>{'\u2500'.repeat(60)}</Text>

      {windowStart > 0 && (
        <Text dimColor>  ... {windowStart} earlier message(s)</Text>
      )}

      {visibleMessages.map((msg, i) => {
        const actualIndex = windowStart + i;
        const isSelected = actualIndex === selectedIndex;
        const roleIcon = getRoleIcon(msg.role);
        const content = truncateContent(msg);
        const branchNames = branchIndicators.get(actualIndex);
        const hasBranch = branchNames && branchNames.length > 0;

        return (
          <Box key={actualIndex} flexDirection="column">
            <Box>
              <Text color={isSelected ? 'cyan' : 'gray'}>
                {isSelected ? '>' : ' '}
              </Text>
              <Text color={isSelected ? 'whiteBright' : 'white'}>
                [{actualIndex.toString().padStart(3)}]
              </Text>
              <Text> </Text>
              <Text color={msg.role === 'user' ? 'green' : msg.role === 'assistant' ? 'blue' : 'yellow'}>
                {roleIcon}
              </Text>
              <Text> </Text>
              <Text color={isSelected ? 'whiteBright' : 'white'} bold={isSelected}>
                {content}
              </Text>
            </Box>
            {hasBranch && (
              <Box paddingLeft={7}>
                <Text color="magenta">
                  {'\u251c\u2500 '}{branchNames!.join(', ')}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}

      {windowEnd < messages.length && (
        <Text dimColor>  ... {messages.length - windowEnd} more message(s)</Text>
      )}

      <Text dimColor>{'\u2500'.repeat(60)}</Text>
      <Text>
        <Text dimColor>Selected: </Text>
        <Text color="cyan">{selectedIndex}</Text>
        <Text dimColor> / {messages.length - 1}</Text>
      </Text>
    </Box>
  );
};

export default SessionTimeline;
