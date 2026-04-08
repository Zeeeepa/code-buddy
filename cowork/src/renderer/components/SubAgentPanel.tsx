/**
 * SubAgentPanel — Visualization for active sub-agents in a session
 * Claude Cowork parity: parallel multi-agent execution view.
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronRight,
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
  Pause,
  Power,
  Eye,
  Search,
  Wrench,
  FileSearch,
  List,
  GitBranch,
} from 'lucide-react';
import { useActiveSessionSubAgents, useSubAgentOutput } from '../store/selectors';
import type { LucideIcon } from 'lucide-react';
import type { SubAgent, SubAgentStatus, SubAgentRole } from '../types';

const ROLE_ICONS: Record<string, LucideIcon> = {
  explorer: Search,
  worker: Wrench,
  researcher: FileSearch,
  reviewer: Eye,
  default: Bot,
};

function getRoleIcon(role: SubAgentRole): LucideIcon {
  return ROLE_ICONS[role] ?? ROLE_ICONS.default;
}

function getStatusIcon(status: SubAgentStatus) {
  switch (status) {
    case 'running':
      return <Loader2 size={12} className="animate-spin text-accent" />;
    case 'waiting':
      return <Pause size={12} className="text-warning" />;
    case 'completed':
      return <CheckCircle2 size={12} className="text-success" />;
    case 'error':
      return <XCircle size={12} className="text-error" />;
    case 'closed':
      return <Power size={12} className="text-text-muted" />;
    default:
      return null;
  }
}

interface SubAgentRowProps {
  agent: SubAgent;
}

const SubAgentRow: React.FC<SubAgentRowProps> = ({ agent }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const output = useSubAgentOutput(agent.id);
  const RoleIcon = getRoleIcon(agent.role);

  function getStatusLabel(status: SubAgentStatus): string {
    switch (status) {
      case 'running':
        return t('subAgents.running');
      case 'completed':
        return t('subAgents.completed');
      case 'error':
        return t('subAgents.failed');
      case 'closed':
        return t('subAgents.killed');
      default:
        return status;
    }
  }

  return (
    <div className="border border-border-muted rounded-lg bg-surface/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-text-muted shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-text-muted shrink-0" />
        )}
        <RoleIcon size={12} className="text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary truncate">{agent.nickname}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-active text-text-secondary">
              {agent.role}
            </span>
          </div>
          {agent.currentStep && (
            <div className="text-[10px] text-text-muted truncate mt-0.5">{agent.currentStep}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {getStatusIcon(agent.status)}
          <span className="text-[10px] text-text-secondary">{getStatusLabel(agent.status)}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 py-2 border-t border-border-muted bg-background/40">
          <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider">
            {t('subAgents.viewOutput')}
          </div>
          {output ? (
            <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {output}
            </pre>
          ) : (
            <div className="text-xs text-text-muted italic">{t('subAgents.noOutput')}</div>
          )}
          {agent.result && (
            <>
              <div className="text-[10px] text-text-muted mt-2 mb-1 uppercase tracking-wider">
                {t('subAgents.completed')}
              </div>
              <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {agent.result}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Graph mode ──────────────────────────────────────────────────────────────

interface GraphNode {
  agent: SubAgent;
  children: GraphNode[];
  depth: number;
}

interface LayoutNode {
  node: GraphNode;
  x: number;
  y: number;
}

function buildGraph(agents: SubAgent[]): GraphNode[] {
  const byId = new Map<string, GraphNode>();
  for (const a of agents) {
    byId.set(a.id, { agent: a, children: [], depth: 0 });
  }
  const roots: GraphNode[] = [];
  for (const node of byId.values()) {
    const parentId = node.agent.parentId;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Assign depths
  const walk = (n: GraphNode, d: number): void => {
    n.depth = d;
    for (const c of n.children) walk(c, d + 1);
  };
  for (const r of roots) walk(r, 0);
  return roots;
}

function layoutGraph(roots: GraphNode[]): {
  nodes: LayoutNode[];
  edges: Array<{ from: LayoutNode; to: LayoutNode }>;
  width: number;
  height: number;
} {
  const nodeWidth = 140;
  const nodeHeight = 52;
  const hGap = 28;
  const vGap = 32;

  const layoutNodes: LayoutNode[] = [];
  const edges: Array<{ from: LayoutNode; to: LayoutNode }> = [];
  const nodeToLayout = new Map<GraphNode, LayoutNode>();

  // Simple level-order layout with sibling spread
  const rowCursors: Record<number, number> = {};
  const walk = (n: GraphNode): LayoutNode => {
    const level = n.depth;
    const col = rowCursors[level] ?? 0;
    const x = col * (nodeWidth + hGap) + 12;
    const y = level * (nodeHeight + vGap) + 12;
    rowCursors[level] = col + 1;
    const layout: LayoutNode = { node: n, x, y };
    layoutNodes.push(layout);
    nodeToLayout.set(n, layout);
    for (const child of n.children) {
      const childLayout = walk(child);
      edges.push({ from: layout, to: childLayout });
    }
    return layout;
  };
  for (const r of roots) walk(r);

  const maxX = Math.max(0, ...layoutNodes.map((l) => l.x + nodeWidth));
  const maxY = Math.max(0, ...layoutNodes.map((l) => l.y + nodeHeight));
  return { nodes: layoutNodes, edges, width: maxX + 12, height: maxY + 12 };
}

function statusColor(status: SubAgentStatus): string {
  switch (status) {
    case 'running':
      return 'var(--color-accent, #60a5fa)';
    case 'completed':
      return 'var(--color-success, #4ade80)';
    case 'error':
      return 'var(--color-error, #f87171)';
    case 'waiting':
      return 'var(--color-warning, #facc15)';
    case 'closed':
    default:
      return 'var(--color-text-muted, #6b7280)';
  }
}

interface SubAgentGraphProps {
  agents: SubAgent[];
}

const SubAgentGraph: React.FC<SubAgentGraphProps> = ({ agents }) => {
  const { t } = useTranslation();
  const layout = useMemo(() => layoutGraph(buildGraph(agents)), [agents]);
  const nodeWidth = 140;
  const nodeHeight = 52;

  if (agents.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-text-muted text-center">
        {t('subAgents.noAgents')}
      </div>
    );
  }

  return (
    <div className="overflow-auto bg-background/40 rounded-lg border border-border-muted">
      <svg
        width={Math.max(layout.width, 300)}
        height={Math.max(layout.height, 140)}
        className="min-w-full"
      >
        {layout.edges.map((edge, idx) => {
          const x1 = edge.from.x + nodeWidth / 2;
          const y1 = edge.from.y + nodeHeight;
          const x2 = edge.to.x + nodeWidth / 2;
          const y2 = edge.to.y;
          const midY = (y1 + y2) / 2;
          return (
            <path
              key={idx}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={1.4}
              fill="none"
              className="text-text-muted"
            />
          );
        })}
        {layout.nodes.map((ln) => {
          const agent = ln.node.agent;
          return (
            <g key={agent.id} transform={`translate(${ln.x},${ln.y})`}>
              <rect
                width={nodeWidth}
                height={nodeHeight}
                rx={8}
                className="fill-surface stroke-border"
                strokeWidth={1.2}
              />
              <circle cx={10} cy={10} r={4} fill={statusColor(agent.status)} />
              <text
                x={22}
                y={15}
                className="text-[11px] fill-text-primary"
                style={{ fontWeight: 500 }}
              >
                {agent.nickname.slice(0, 14)}
              </text>
              <text x={10} y={32} className="text-[10px] fill-text-muted">
                {agent.role}
              </text>
              <text x={10} y={46} className="text-[9px] fill-text-muted">
                {agent.status}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

interface SubAgentPanelProps {
  /** Show as a compact inline card (for use in ChatView) */
  compact?: boolean;
  /** Show as a full panel section (for use in ContextPanel) */
  title?: string;
}

export const SubAgentPanel: React.FC<SubAgentPanelProps> = ({ compact = false, title }) => {
  const { t } = useTranslation();
  const subAgents = useActiveSessionSubAgents();
  const [collapsed, setCollapsed] = useState(false);
  const [mode, setMode] = useState<'list' | 'graph'>(() => {
    try {
      return (localStorage.getItem('cowork.subagent.mode') as 'list' | 'graph') ?? 'list';
    } catch {
      return 'list';
    }
  });
  const toggleMode = () => {
    const next = mode === 'list' ? 'graph' : 'list';
    setMode(next);
    try {
      localStorage.setItem('cowork.subagent.mode', next);
    } catch {
      /* ignore */
    }
  };

  if (subAgents.length === 0) {
    if (compact) return null;
    return (
      <div className="px-3 py-4 text-xs text-text-muted text-center">
        {t('subAgents.noAgents')}
      </div>
    );
  }

  const runningCount = subAgents.filter((a) => a.status === 'running').length;
  const completedCount = subAgents.filter((a) => a.status === 'completed').length;

  return (
    <div className={compact ? 'mb-3' : ''}>
      {title && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
        >
          {collapsed ? (
            <ChevronRight size={12} className="text-text-muted" />
          ) : (
            <ChevronDown size={12} className="text-text-muted" />
          )}
          <Bot size={12} className="text-accent" />
          <span className="text-xs font-medium text-text-secondary flex-1">{title}</span>
          <div className="flex items-center gap-1 text-[10px] text-text-muted">
            {runningCount > 0 && <span className="text-accent">{runningCount} {t('subAgents.running')}</span>}
            {completedCount > 0 && (
              <span className="text-success">{completedCount} {t('subAgents.completed')}</span>
            )}
            <span>({subAgents.length})</span>
          </div>
        </button>
      )}

      {!collapsed && (
        <div className={title ? 'px-2 pb-2 space-y-2' : 'space-y-2'}>
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                toggleMode();
              }}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-surface border border-border hover:bg-surface-hover text-text-secondary transition-colors"
              title={mode === 'list' ? t('subAgents.graphMode', 'Graph view') : t('subAgents.listMode', 'List view')}
            >
              {mode === 'list' ? <GitBranch size={10} /> : <List size={10} />}
              {mode === 'list' ? t('subAgents.graphMode', 'Graph') : t('subAgents.listMode', 'List')}
            </button>
          </div>
          {mode === 'graph' ? (
            <SubAgentGraph agents={subAgents} />
          ) : (
            <div className="space-y-1.5">
              {subAgents.map((agent) => (
                <SubAgentRow key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
