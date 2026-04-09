/**
 * SettingsA2AAgents — Claude Cowork parity Phase 3 step 19
 *
 * Registry for remote A2A (Agent-to-Agent) agents. Users add an agent
 * by URL, the bridge fetches the remote AgentCard, and the UI lists
 * skills, status, and last-ping information. Each agent exposes an
 * "Invoke" button that posts a one-shot message to the remote task
 * endpoint so users can quickly smoke-test a connection.
 */
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, RefreshCw, Play, AlertCircle, CheckCircle2, Globe, Cpu } from 'lucide-react';

interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  skills: Array<{ id: string; name: string; description?: string }>;
}

interface RegisteredAgent {
  id: string;
  url: string;
  addedAt: number;
  lastPingAt?: number;
  lastStatus?: 'ok' | 'error' | 'unknown';
  lastError?: string;
  card: AgentCard;
}

export function SettingsA2AAgents() {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<RegisteredAgent[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [invokeInput, setInvokeInput] = useState<Record<string, string>>({});
  const [invokeResult, setInvokeResult] = useState<Record<string, string>>({});
  const [invoking, setInvoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!window.electronAPI?.a2a?.list) return;
    try {
      const list = (await window.electronAPI.a2a.list()) as RegisteredAgent[];
      setAgents(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = useCallback(async () => {
    if (!newUrl.trim() || !window.electronAPI?.a2a?.add) return;
    setIsAdding(true);
    setError(null);
    try {
      const result = await window.electronAPI.a2a.add(newUrl.trim());
      if (!result.success) {
        setError(result.error ?? 'Add failed');
      } else {
        setNewUrl('');
        setNotice(t('a2a.added', 'Agent registered'));
        setTimeout(() => setNotice(null), 2000);
        await load();
      }
    } finally {
      setIsAdding(false);
    }
  }, [newUrl, load, t]);

  const handleRemove = useCallback(
    async (id: string) => {
      if (!window.confirm(t('a2a.removeConfirm', 'Remove this agent?'))) return;
      await window.electronAPI?.a2a?.remove(id);
      await load();
    },
    [load, t]
  );

  const handlePing = useCallback(
    async (id: string) => {
      await window.electronAPI?.a2a?.ping(id);
      await load();
    },
    [load]
  );

  const handleInvoke = useCallback(
    async (id: string) => {
      const msg = invokeInput[id]?.trim();
      if (!msg || !window.electronAPI?.a2a?.invoke) return;
      setInvoking(id);
      try {
        const result = await window.electronAPI.a2a.invoke(id, msg);
        setInvokeResult((prev) => ({
          ...prev,
          [id]: result.success ? (result.result ?? 'OK') : (result.error ?? 'Failed'),
        }));
      } finally {
        setInvoking(null);
      }
    },
    [invokeInput]
  );

  return (
    <div className="space-y-4" data-testid="settings-a2a-agents">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">
          {t('a2a.title', 'Remote agents (A2A)')}
        </h3>
        <p className="text-xs text-text-muted mt-1">
          {t(
            'a2a.hint',
            'Register remote agents exposing the Google Agent-to-Agent protocol by URL. The bridge fetches /.well-known/agent.json on add.'
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={newUrl}
          onChange={(ev) => setNewUrl(ev.target.value)}
          placeholder="https://agent.example.com"
          data-testid="a2a-add-url-input"
          className="flex-1 px-3 py-1.5 rounded-md bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent font-mono"
        />
        <button
          onClick={() => void handleAdd()}
          disabled={isAdding || !newUrl.trim()}
          data-testid="a2a-add-button"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          <Plus size={12} />
          {isAdding ? t('a2a.adding', 'Adding…') : t('a2a.add', 'Add')}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-error bg-error/10 border border-error/30 rounded-md px-3 py-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-2 text-xs text-success bg-success/10 border border-success/30 rounded-md px-3 py-2">
          <CheckCircle2 size={14} />
          {notice}
        </div>
      )}

      <div className="space-y-3">
        {agents.length === 0 && (
          <div className="text-center py-8 text-xs text-text-muted" data-testid="a2a-empty-state">
            {t('a2a.empty', 'No remote agents registered')}
          </div>
        )}
        {agents.map((agent) => (
          <div key={agent.id} className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <Cpu size={14} className="mt-0.5 text-accent shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{agent.card.name}</span>
                    <span className="text-[10px] text-text-muted">v{agent.card.version}</span>
                    {agent.lastStatus === 'ok' && (
                      <span className="text-[10px] text-success flex items-center gap-1">
                        <CheckCircle2 size={10} /> ok
                      </span>
                    )}
                    {agent.lastStatus === 'error' && (
                      <span className="text-[10px] text-error flex items-center gap-1">
                        <AlertCircle size={10} /> error
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                    {agent.card.description}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted mt-1 font-mono truncate">
                    <Globe size={10} /> {agent.url}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => void handlePing(agent.id)}
                  className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary"
                  title={t('a2a.ping', 'Ping')}
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  onClick={() => void handleRemove(agent.id)}
                  className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-error"
                  title={t('common.remove', 'Remove')}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            {agent.card.skills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {agent.card.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent"
                    title={skill.description}
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={invokeInput[agent.id] ?? ''}
                onChange={(ev) =>
                  setInvokeInput((prev) => ({ ...prev, [agent.id]: ev.target.value }))
                }
                placeholder={t('a2a.invokePlaceholder', 'Send a message…')}
                className="flex-1 px-2 py-1 rounded bg-surface border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <button
                onClick={() => void handleInvoke(agent.id)}
                disabled={invoking === agent.id || !invokeInput[agent.id]?.trim()}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                <Play size={10} />
                {invoking === agent.id ? t('a2a.invoking', 'Invoking…') : t('a2a.invoke', 'Invoke')}
              </button>
            </div>
            {invokeResult[agent.id] && (
              <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap bg-surface rounded p-2 max-h-32 overflow-y-auto">
                {invokeResult[agent.id]}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
