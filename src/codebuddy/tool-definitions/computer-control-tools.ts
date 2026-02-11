/**
 * Computer Control Tool Definitions
 *
 * OpenClaw-inspired unified computer control for AI agents.
 */

import { CodeBuddyTool } from './types.js';

/**
 * Computer Control Tool
 *
 * Unified interface for controlling the computer:
 * - UI element detection via Smart Snapshot
 * - Mouse/keyboard automation
 * - System control (volume, brightness, notifications)
 * - Screen recording
 */
export const COMPUTER_CONTROL_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'computer_control',
    description: `Control the computer with mouse, keyboard, and system actions.

WORKFLOW:
1. First call 'snapshot' action to detect UI elements
2. Elements are assigned numeric references [1], [2], [3], etc.
3. Use these refs in click/type actions instead of coordinates

ACTIONS:
- snapshot: Take UI snapshot, returns element list with refs
- snapshot_with_screenshot: Take snapshot + capture normalized screenshot (returns text + base64 image)
- get_element: Get details of element by ref
- find_elements: Search elements by role/name
- click: Click at position or element ref
- double_click: Double-click at position or element ref
- right_click: Right-click at position or element ref
- move_mouse: Move mouse to position or element ref
- drag: Drag from current position to target
- scroll: Scroll vertically/horizontally
- type: Type text at current focus
- key: Press a single key (enter, tab, escape, etc.)
- hotkey: Press key combination (ctrl+c, alt+tab, etc.)
- get_windows: List all open windows
- focus_window: Focus window by title
- close_window: Close window by title
- get_volume: Get current volume level
- set_volume: Set volume level (0-100)
- get_brightness: Get current brightness
- set_brightness: Set brightness (0-100)
- notify: Send system notification
- start_recording: Start screen recording
- stop_recording: Stop and save recording
- system_info: Get system information
- battery_info: Get battery status
- network_info: Get network status`,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            'snapshot',
            'snapshot_with_screenshot',
            'get_element',
            'find_elements',
            'click',
            'double_click',
            'right_click',
            'move_mouse',
            'drag',
            'scroll',
            'type',
            'key',
            'hotkey',
            'get_windows',
            'focus_window',
            'close_window',
            'get_volume',
            'set_volume',
            'get_brightness',
            'set_brightness',
            'notify',
            'lock',
            'sleep',
            'start_recording',
            'stop_recording',
            'recording_status',
            'system_info',
            'battery_info',
            'network_info',
            'check_permission',
          ],
          description: 'The action to perform',
        },
        ref: {
          type: 'number',
          description: 'Element reference number from snapshot (e.g., 1, 2, 3)',
        },
        x: {
          type: 'number',
          description: 'X coordinate for mouse actions',
        },
        y: {
          type: 'number',
          description: 'Y coordinate for mouse actions',
        },
        text: {
          type: 'string',
          description: 'Text to type',
        },
        key: {
          type: 'string',
          description: 'Key to press (enter, tab, escape, backspace, delete, up, down, left, right, f1-f12, etc.)',
        },
        modifiers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Modifier keys (ctrl, alt, shift, meta/command)',
        },
        button: {
          type: 'string',
          enum: ['left', 'right', 'middle'],
          description: 'Mouse button',
        },
        deltaX: {
          type: 'number',
          description: 'Horizontal scroll amount (negative = left)',
        },
        deltaY: {
          type: 'number',
          description: 'Vertical scroll amount (negative = down)',
        },
        windowTitle: {
          type: 'string',
          description: 'Window title to find/focus',
        },
        level: {
          type: 'number',
          description: 'Volume or brightness level (0-100)',
        },
        muted: {
          type: 'boolean',
          description: 'Mute state',
        },
        title: {
          type: 'string',
          description: 'Notification title',
        },
        body: {
          type: 'string',
          description: 'Notification body',
        },
        role: {
          type: 'string',
          description: 'Element role to find (button, link, text-field, checkbox, etc.)',
        },
        name: {
          type: 'string',
          description: 'Element name to search for',
        },
        interactiveOnly: {
          type: 'boolean',
          description: 'Only include interactive elements in snapshot',
        },
        format: {
          type: 'string',
          enum: ['mp4', 'webm', 'gif'],
          description: 'Recording format',
        },
        fps: {
          type: 'number',
          description: 'Recording frame rate',
        },
        audio: {
          type: 'boolean',
          description: 'Include audio in recording',
        },
        permission: {
          type: 'string',
          description: 'Permission to check (screen-recording, accessibility, camera, microphone)',
        },
      },
      required: ['action'],
    },
  },
};

/**
 * All computer control tools
 */
export const COMPUTER_CONTROL_TOOLS: CodeBuddyTool[] = [
  COMPUTER_CONTROL_TOOL,
];

export default COMPUTER_CONTROL_TOOLS;
