/**
 * Context Visualization Handler
 *
 * Renders a colored grid showing context window usage breakdown.
 * Each cell represents ~1% of the total context window.
 *
 * Colors:
 *   Green   = available space
 *   Blue    = system prompt tokens
 *   Yellow  = message tokens
 *   Magenta = tool definition tokens
 *
 * @module commands/handlers/context-handler
 */

// ANSI color codes
const COLORS = {
  green: '\x1b[42m',   // Background green (available)
  blue: '\x1b[44m',    // Background blue (system prompt)
  yellow: '\x1b[43m',  // Background yellow (messages)
  magenta: '\x1b[45m', // Background magenta (tools)
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  fgGreen: '\x1b[32m',
  fgBlue: '\x1b[34m',
  fgYellow: '\x1b[33m',
  fgMagenta: '\x1b[35m',
  fgWhite: '\x1b[37m',
};

/**
 * Token usage breakdown for the context window
 */
export interface ContextTokenCounts {
  /** Tokens used by the system prompt */
  systemPrompt: number;
  /** Tokens used by conversation messages */
  messages: number;
  /** Tokens used by tool definitions */
  tools: number;
  /** Tokens available (remaining) */
  available: number;
  /** Total context window size */
  total: number;
}

/**
 * Grid dimensions
 */
const GRID_WIDTH = 50;
const GRID_TOTAL_CELLS = 100;

/**
 * Render a colored grid visualizing context window usage.
 *
 * @param counts - Token usage breakdown
 * @returns Formatted string with ANSI colors
 */
export function handleContextVisualization(counts: ContextTokenCounts): string {
  const { systemPrompt, messages, tools, available, total } = counts;

  // Calculate percentages (ensure they sum to 100)
  const usedTotal = systemPrompt + messages + tools + available;
  const scale = usedTotal > 0 ? total / usedTotal : 1;

  const systemPct = total > 0 ? Math.round((systemPrompt / total) * 100) : 0;
  const messagesPct = total > 0 ? Math.round((messages / total) * 100) : 0;
  const toolsPct = total > 0 ? Math.round((tools / total) * 100) : 0;
  // Available gets the remainder to ensure we always sum to 100
  const availablePct = Math.max(0, 100 - systemPct - messagesPct - toolsPct);

  // Build the grid cells
  const cells: string[] = [];

  // Fill cells in order: system prompt, messages, tools, available
  for (let i = 0; i < systemPct && cells.length < GRID_TOTAL_CELLS; i++) {
    cells.push(`${COLORS.blue} ${COLORS.reset}`);
  }
  for (let i = 0; i < messagesPct && cells.length < GRID_TOTAL_CELLS; i++) {
    cells.push(`${COLORS.yellow} ${COLORS.reset}`);
  }
  for (let i = 0; i < toolsPct && cells.length < GRID_TOTAL_CELLS; i++) {
    cells.push(`${COLORS.magenta} ${COLORS.reset}`);
  }
  // Fill remaining with available (green)
  while (cells.length < GRID_TOTAL_CELLS) {
    cells.push(`${COLORS.green} ${COLORS.reset}`);
  }

  // Render grid rows
  const lines: string[] = [];
  lines.push(`${COLORS.bold}Context Window Usage${COLORS.reset}`);
  lines.push('');

  for (let row = 0; row < GRID_TOTAL_CELLS / GRID_WIDTH; row++) {
    const start = row * GRID_WIDTH;
    const end = Math.min(start + GRID_WIDTH, GRID_TOTAL_CELLS);
    lines.push(cells.slice(start, end).join(''));
  }

  lines.push('');

  // Legend and summary
  lines.push(`${COLORS.fgBlue}██${COLORS.reset} System Prompt: ${formatTokens(systemPrompt)} (${systemPct}%)`);
  lines.push(`${COLORS.fgYellow}██${COLORS.reset} Messages:      ${formatTokens(messages)} (${messagesPct}%)`);
  lines.push(`${COLORS.fgMagenta}██${COLORS.reset} Tools:         ${formatTokens(tools)} (${toolsPct}%)`);
  lines.push(`${COLORS.fgGreen}██${COLORS.reset} Available:     ${formatTokens(available)} (${availablePct}%)`);
  lines.push('');
  lines.push(`${COLORS.dim}Total: ${formatTokens(total)} tokens${COLORS.reset}`);

  return lines.join('\n');
}

/**
 * Format token count with thousands separators
 */
function formatTokens(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Slash command definition for /context-viz
 */
export const CONTEXT_COMMAND = {
  name: 'context-viz',
  description: 'Visualize context window usage as a colored grid',
  prompt: '__CONTEXT_VIZ__',
  filePath: '',
  isBuiltin: true,
};
