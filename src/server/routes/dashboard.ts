/**
 * Dashboard Routes
 *
 * Serves a self-contained React SPA dashboard for monitoring
 * and interacting with the Code Buddy server.
 *
 * Endpoints:
 *   GET /__codebuddy__/dashboard/   — Serve dashboard SPA
 *   GET /__codebuddy__/dashboard/*  — SPA fallback (all routes)
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Dashboard HTML (self-contained React SPA with inline CSS)
// ============================================================================

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Code Buddy Dashboard</title>
<style>
  :root {
    --bg: #0d1117;
    --bg-surface: #161b22;
    --bg-surface-hover: #1c2129;
    --bg-inset: #0d1117;
    --border: #30363d;
    --border-light: #21262d;
    --text: #e6edf3;
    --text-muted: #8b949e;
    --text-dim: #484f58;
    --accent: #58a6ff;
    --accent-muted: #388bfd33;
    --green: #3fb950;
    --green-muted: #23863633;
    --red: #f85149;
    --red-muted: #f8514933;
    --yellow: #d29922;
    --yellow-muted: #d2992233;
    --purple: #bc8cff;
    --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    --sidebar-w: 220px;
    --header-h: 48px;
    --mobile-tab-h: 56px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }

  body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    overflow: hidden;
  }

  /* ---- Layout ---- */
  .app { display: flex; height: 100%; }

  .sidebar {
    width: var(--sidebar-w);
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .sidebar-brand {
    padding: 16px;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: -0.3px;
  }
  .sidebar-brand small {
    display: block;
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .sidebar-nav { flex: 1; padding: 8px; overflow-y: auto; }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-muted);
    transition: background 0.15s, color 0.15s;
    user-select: none;
  }
  .nav-item:hover { background: var(--bg-surface-hover); color: var(--text); }
  .nav-item.active { background: var(--accent-muted); color: var(--accent); font-weight: 600; }
  .nav-icon { font-size: 16px; width: 20px; text-align: center; }

  .sidebar-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-dim);
  }

  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  .header {
    height: var(--header-h);
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 20px;
    gap: 12px;
    flex-shrink: 0;
  }
  .header-title { font-size: 15px; font-weight: 600; }
  .header-spacer { flex: 1; }
  .header-kbd {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--text-dim);
    background: var(--bg-inset);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 6px;
    cursor: pointer;
  }
  .header-kbd:hover { color: var(--text-muted); border-color: var(--text-dim); }

  .content { flex: 1; overflow-y: auto; padding: 24px; }

  /* ---- Mobile bottom tabs ---- */
  .mobile-tabs {
    display: none;
    height: var(--mobile-tab-h);
    background: var(--bg-surface);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  .mobile-tabs-inner {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: space-around;
  }
  .mob-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 10px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    user-select: none;
  }
  .mob-tab.active { color: var(--accent); }
  .mob-tab-icon { font-size: 20px; }

  @media (max-width: 768px) {
    .sidebar { display: none; }
    .mobile-tabs { display: block; }
  }

  /* ---- Command palette ---- */
  .palette-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 1000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
  }
  .palette {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 520px;
    max-width: 90vw;
    box-shadow: 0 16px 48px rgba(0,0,0,0.4);
    overflow: hidden;
  }
  .palette-input {
    width: 100%;
    padding: 14px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    font-size: 15px;
    font-family: var(--font-sans);
    outline: none;
  }
  .palette-input::placeholder { color: var(--text-dim); }
  .palette-results { max-height: 300px; overflow-y: auto; padding: 4px; }
  .palette-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-muted);
  }
  .palette-item:hover, .palette-item.selected { background: var(--accent-muted); color: var(--text); }
  .palette-item-icon { width: 20px; text-align: center; }
  .palette-empty { padding: 20px; text-align: center; color: var(--text-dim); font-size: 13px; }

  /* ---- Cards and widgets ---- */
  .card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
  }
  .card-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }

  .grid { display: grid; gap: 16px; }
  .grid-2 { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .grid-3 { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  .grid-4 { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }

  .stat-value {
    font-size: 28px;
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: -1px;
  }
  .stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

  .badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .badge-ok { background: var(--green-muted); color: var(--green); }
  .badge-warn { background: var(--yellow-muted); color: var(--yellow); }
  .badge-err { background: var(--red-muted); color: var(--red); }

  .check-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-light);
    font-size: 13px;
  }
  .check-row:last-child { border-bottom: none; }

  /* ---- Chat ---- */
  .chat-container { display: flex; flex-direction: column; height: 100%; }
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .chat-msg {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .chat-msg.user {
    align-self: flex-end;
    background: var(--accent-muted);
    color: var(--text);
    border-bottom-right-radius: 4px;
  }
  .chat-msg.assistant {
    align-self: flex-start;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-bottom-left-radius: 4px;
  }
  .chat-msg.error {
    align-self: center;
    background: var(--red-muted);
    color: var(--red);
    font-size: 12px;
  }
  .chat-input-row {
    display: flex;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .chat-input {
    flex: 1;
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    color: var(--text);
    font-size: 14px;
    font-family: var(--font-sans);
    outline: none;
    resize: none;
  }
  .chat-input:focus { border-color: var(--accent); }
  .chat-send {
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .chat-send:hover { opacity: 0.9; }
  .chat-send:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ---- Table ---- */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th {
    text-align: left;
    padding: 8px 12px;
    border-bottom: 2px solid var(--border);
    color: var(--text-muted);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-light);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12px;
  }
  tr:hover td { background: var(--bg-surface-hover); }

  /* ---- Config ---- */
  .config-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-light);
    font-size: 13px;
  }
  .config-item:last-child { border-bottom: none; }
  .config-key { color: var(--text-muted); }
  .config-val { font-family: var(--font-mono); font-size: 12px; color: var(--accent); }

  /* ---- Loading / Error states ---- */
  .loading { text-align: center; padding: 40px; color: var(--text-dim); }
  .loading-spinner {
    display: inline-block;
    width: 24px; height: 24px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-box {
    background: var(--red-muted);
    border: 1px solid var(--red);
    border-radius: 8px;
    padding: 12px 16px;
    color: var(--red);
    font-size: 13px;
    margin-bottom: 16px;
  }

  .refresh-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-muted);
    padding: 4px 10px;
    font-size: 12px;
    cursor: pointer;
  }
  .refresh-btn:hover { border-color: var(--text-dim); color: var(--text); }

  /* ---- Agent cards ---- */
  .agent-card {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }
  .agent-name { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .agent-desc { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
  .agent-skills { display: flex; flex-wrap: wrap; gap: 4px; }
  .skill-tag {
    font-size: 10px;
    background: var(--accent-muted);
    color: var(--accent);
    padding: 2px 8px;
    border-radius: 8px;
  }
</style>
</head>
<body>
<div id="root"></div>

<script crossorigin src="https://esm.sh/react@19.1.0/umd/react.production.min.js"></script>
<script crossorigin src="https://esm.sh/react-dom@19.1.0/umd/react-dom.production.min.js"></script>

<script>
// ============================================================================
// React app (no JSX, no transpiler needed)
// ============================================================================
const { createElement: h, useState, useEffect, useRef, useCallback, Fragment } = React;

// ---- API helpers ----
const BASE = location.origin;

async function apiFetch(path, options) {
  try {
    const res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(res.status + ' ' + (body || res.statusText));
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
}

function useApi(path, interval) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(function() {
    setLoading(true);
    apiFetch(path)
      .then(function(d) { setData(d); setError(null); })
      .catch(function(e) { setError(e.message); })
      .finally(function() { setLoading(false); });
  }, [path]);

  useEffect(function() {
    load();
    if (interval) {
      var id = setInterval(load, interval);
      return function() { clearInterval(id); };
    }
  }, [load, interval]);

  return { data: data, error: error, loading: loading, reload: load };
}

// ---- Navigation config ----
var VIEWS = [
  { id: 'overview', label: 'Overview', icon: '\\u25C9' },
  { id: 'chat',     label: 'Chat',     icon: '\\u2709' },
  { id: 'sessions', label: 'Sessions', icon: '\\u29C9' },
  { id: 'agents',   label: 'Agents',   icon: '\\u2699' },
  { id: 'config',   label: 'Config',   icon: '\\u2638' },
];

// ---- Command palette items ----
var PALETTE_ITEMS = [
  { label: 'Go to Overview',  view: 'overview',  icon: '\\u25C9' },
  { label: 'Go to Chat',      view: 'chat',      icon: '\\u2709' },
  { label: 'Go to Sessions',  view: 'sessions',  icon: '\\u29C9' },
  { label: 'Go to Agents',    view: 'agents',    icon: '\\u2699' },
  { label: 'Go to Config',    view: 'config',    icon: '\\u2638' },
  { label: 'Refresh Data',    action: 'refresh',  icon: '\\u21BB' },
  { label: 'Toggle Health Check', action: 'health', icon: '\\u2665' },
];

// ---- Components ----

function Badge(props) {
  var cls = 'badge ';
  if (props.status === 'ok' || props.status === 'healthy' || props.status === 'ready') cls += 'badge-ok';
  else if (props.status === 'degraded' || props.status === 'stale' || props.status === 'warn') cls += 'badge-warn';
  else cls += 'badge-err';
  return h('span', { className: cls }, props.status);
}

function LoadingSpinner() {
  return h('div', { className: 'loading' },
    h('div', { className: 'loading-spinner' }),
    h('div', { style: { marginTop: 8 } }, 'Loading...')
  );
}

function ErrorBox(props) {
  return h('div', { className: 'error-box' },
    'Error: ' + props.message,
    props.onRetry ? h('button', {
      className: 'refresh-btn',
      style: { marginLeft: 12 },
      onClick: props.onRetry,
    }, 'Retry') : null
  );
}

// ---- Overview View ----
function OverviewView() {
  var health = useApi('/api/health', 10000);

  if (health.loading && !health.data) return h(LoadingSpinner);
  if (health.error && !health.data) return h(ErrorBox, { message: health.error, onRetry: health.reload });

  var d = health.data || {};
  var mem = d.memory || {};
  var checks = d.checks || {};
  var ws = (d.connections && d.connections.websocket) || {};
  var hb = d.apiHeartbeat || {};

  return h(Fragment, null,
    h('div', { className: 'grid grid-4', style: { marginBottom: 16 } },
      h('div', { className: 'card' },
        h('div', { className: 'card-title' }, 'Status'),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h(Badge, { status: d.status || 'unknown' }),
          h('span', { style: { fontSize: 13 } }, 'v' + (d.version || '?'))
        )
      ),
      h('div', { className: 'card' },
        h('div', { className: 'card-title' }, 'Uptime'),
        h('div', { className: 'stat-value' }, d.uptimeFormatted || '0s')
      ),
      h('div', { className: 'card' },
        h('div', { className: 'card-title' }, 'Memory'),
        h('div', { className: 'stat-value' }, (mem.heapUsedMB || 0) + 'MB'),
        h('div', { className: 'stat-label' }, mem.percentUsed + '% of ' + (mem.heapTotalMB || 0) + 'MB heap')
      ),
      h('div', { className: 'card' },
        h('div', { className: 'card-title' }, 'WebSocket'),
        h('div', { className: 'stat-value' }, ws.total != null ? ws.total : '-'),
        h('div', { className: 'stat-label' },
          (ws.authenticated || 0) + ' auth, ' + (ws.streaming || 0) + ' streaming')
      )
    ),

    h('div', { className: 'grid grid-2' },
      h('div', { className: 'card' },
        h('div', { className: 'card-title' }, 'Health Checks'),
        Object.keys(checks).map(function(key) {
          return h('div', { className: 'check-row', key: key },
            h('span', null, key),
            h(Badge, { status: checks[key] })
          );
        })
      ),
      h('div', { className: 'card' },
        h('div', { className: 'card-title' }, 'API Heartbeat'),
        h('div', { className: 'check-row' },
          h('span', null, 'Status'),
          h(Badge, { status: hb.status || 'unknown' })
        ),
        h('div', { className: 'check-row' },
          h('span', null, 'Last Check'),
          h('span', { style: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' } },
            hb.lastCheck ? new Date(hb.lastCheck).toLocaleTimeString() : 'Never')
        ),
        h('div', { className: 'check-row' },
          h('span', null, 'Latency'),
          h('span', { style: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' } },
            hb.latencyMs != null ? hb.latencyMs + 'ms' : '-')
        )
      )
    ),

    h('div', { className: 'card', style: { marginTop: 16 } },
      h('div', { className: 'card-title' }, 'Memory Breakdown'),
      h('div', { className: 'grid grid-4' },
        h('div', null,
          h('div', { style: { fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' } }, (mem.heapUsedMB || 0) + 'MB'),
          h('div', { className: 'stat-label' }, 'Heap Used')
        ),
        h('div', null,
          h('div', { style: { fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' } }, (mem.heapTotalMB || 0) + 'MB'),
          h('div', { className: 'stat-label' }, 'Heap Total')
        ),
        h('div', null,
          h('div', { style: { fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' } }, (mem.rssMB || 0) + 'MB'),
          h('div', { className: 'stat-label' }, 'RSS')
        ),
        h('div', null,
          h('div', { style: { fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)' } }, (mem.externalMB || 0) + 'MB'),
          h('div', { className: 'stat-label' }, 'External')
        )
      )
    )
  );
}

// ---- Chat View ----
function ChatView() {
  var messagesRef = useRef(null);
  var inputRef = useRef(null);
  var msgs = useState([]); var messages = msgs[0]; var setMessages = msgs[1];
  var inp = useState(''); var input = inp[0]; var setInput = inp[1];
  var send = useState(false); var sending = send[0]; var setSending = send[1];

  function scrollToBottom() {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }

  useEffect(scrollToBottom, [messages]);

  function handleSend() {
    var text = input.trim();
    if (!text || sending) return;

    var userMsg = { role: 'user', content: text };
    setMessages(function(prev) { return prev.concat([userMsg]); });
    setInput('');
    setSending(true);

    apiFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    })
    .then(function(data) {
      var content = data.response || data.message || data.content || JSON.stringify(data);
      setMessages(function(prev) {
        return prev.concat([{ role: 'assistant', content: content }]);
      });
    })
    .catch(function(err) {
      setMessages(function(prev) {
        return prev.concat([{ role: 'error', content: 'Failed to send: ' + err.message }]);
      });
    })
    .finally(function() { setSending(false); });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return h('div', { className: 'chat-container', style: { height: 'calc(100vh - var(--header-h) - 48px)' } },
    h('div', { className: 'chat-messages', ref: messagesRef },
      messages.length === 0
        ? h('div', { style: { textAlign: 'center', color: 'var(--text-dim)', padding: 40 } },
            h('div', { style: { fontSize: 32, marginBottom: 8 } }, '\\u2709'),
            'Start a conversation with Code Buddy'
          )
        : messages.map(function(msg, i) {
            return h('div', { className: 'chat-msg ' + msg.role, key: i }, msg.content);
          })
    ),
    h('div', { className: 'chat-input-row' },
      h('textarea', {
        ref: inputRef,
        className: 'chat-input',
        placeholder: 'Type a message... (Enter to send, Shift+Enter for newline)',
        value: input,
        onChange: function(e) { setInput(e.target.value); },
        onKeyDown: handleKeyDown,
        rows: 1,
        disabled: sending,
      }),
      h('button', {
        className: 'chat-send',
        onClick: handleSend,
        disabled: sending || !input.trim(),
      }, sending ? '...' : 'Send')
    )
  );
}

// ---- Sessions View ----
function SessionsView() {
  var sessions = useApi('/api/sessions');

  if (sessions.loading && !sessions.data) return h(LoadingSpinner);
  if (sessions.error) return h(ErrorBox, { message: sessions.error, onRetry: sessions.reload });

  var list = Array.isArray(sessions.data) ? sessions.data : (sessions.data && sessions.data.sessions) || [];

  return h(Fragment, null,
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 } },
      h('span', { style: { fontSize: 13, color: 'var(--text-muted)' } }, list.length + ' session(s)'),
      h('button', { className: 'refresh-btn', onClick: sessions.reload }, '\\u21BB Refresh')
    ),
    list.length === 0
      ? h('div', { className: 'card' },
          h('div', { style: { textAlign: 'center', padding: 32, color: 'var(--text-dim)' } },
            'No sessions found')
        )
      : h('div', { className: 'card' },
          h('div', { className: 'table-wrap' },
            h('table', null,
              h('thead', null,
                h('tr', null,
                  h('th', null, 'ID'),
                  h('th', null, 'Model'),
                  h('th', null, 'Messages'),
                  h('th', null, 'Created'),
                  h('th', null, 'Updated')
                )
              ),
              h('tbody', null,
                list.map(function(s) {
                  return h('tr', { key: s.id || s.sessionId },
                    h('td', null, (s.id || s.sessionId || '').slice(0, 12) + '...'),
                    h('td', null, s.model || '-'),
                    h('td', null, s.messageCount != null ? s.messageCount : (s.messages ? s.messages.length : '-')),
                    h('td', null, s.createdAt ? new Date(s.createdAt).toLocaleString() : '-'),
                    h('td', null, s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '-')
                  );
                })
              )
            )
          )
        )
  );
}

// ---- Agents View ----
function AgentsView() {
  var agents = useApi('/api/a2a/agents');
  var card = useApi('/api/a2a/.well-known/agent.json');

  if (agents.loading && !agents.data && card.loading && !card.data) return h(LoadingSpinner);

  return h(Fragment, null,
    card.data ? h('div', { className: 'card', style: { marginBottom: 16 } },
      h('div', { className: 'card-title' }, 'Host Agent'),
      h('div', { className: 'agent-card' },
        h('div', { className: 'agent-name' }, card.data.name || 'Code Buddy'),
        h('div', { className: 'agent-desc' }, card.data.description || ''),
        card.data.skills && card.data.skills.length > 0
          ? h('div', { className: 'agent-skills' },
              card.data.skills.map(function(sk) {
                return h('span', { className: 'skill-tag', key: sk.id }, sk.name || sk.id);
              })
            )
          : null
      )
    ) : null,

    agents.error
      ? h(ErrorBox, { message: 'Agents API: ' + agents.error })
      : null,

    agents.data && agents.data.agents
      ? h(Fragment, null,
          h('div', { className: 'card-title', style: { marginBottom: 12 } },
            'Registered Agents (' + agents.data.agents.length + ')'),
          h('div', { className: 'grid grid-2' },
            agents.data.agents.map(function(a) {
              var c = a.card || {};
              return h('div', { className: 'agent-card', key: a.name },
                h('div', { className: 'agent-name' }, a.name),
                h('div', { className: 'agent-desc' }, c.description || 'No description'),
                c.skills && c.skills.length > 0
                  ? h('div', { className: 'agent-skills' },
                      c.skills.map(function(sk) {
                        return h('span', { className: 'skill-tag', key: sk.id }, sk.name || sk.id);
                      })
                    )
                  : null
              );
            })
          )
        )
      : (!agents.error ? h('div', { className: 'card' },
          h('div', { style: { textAlign: 'center', padding: 32, color: 'var(--text-dim)' } },
            'No registered agents')
        ) : null)
  );
}

// ---- Config View ----
function ConfigView() {
  var cfg = useApi('/api/health/config');
  var ver = useApi('/api/health/version');

  if (cfg.loading && !cfg.data) return h(LoadingSpinner);

  return h(Fragment, null,
    ver.data ? h('div', { className: 'card' },
      h('div', { className: 'card-title' }, 'Version Info'),
      h('div', { className: 'config-item' },
        h('span', { className: 'config-key' }, 'Version'),
        h('span', { className: 'config-val' }, ver.data.version || '-')
      ),
      h('div', { className: 'config-item' },
        h('span', { className: 'config-key' }, 'Node.js'),
        h('span', { className: 'config-val' }, ver.data.nodeVersion || '-')
      ),
      h('div', { className: 'config-item' },
        h('span', { className: 'config-key' }, 'Platform'),
        h('span', { className: 'config-val' }, (ver.data.platform || '-') + ' / ' + (ver.data.arch || '-'))
      ),
      h('div', { className: 'config-item' },
        h('span', { className: 'config-key' }, 'Environment'),
        h('span', { className: 'config-val' }, ver.data.env || 'development')
      )
    ) : null,

    cfg.data ? h('div', { className: 'card' },
      h('div', { className: 'card-title' }, 'Configuration'),
      h('div', { className: 'config-item' },
        h('span', { className: 'config-key' }, 'Model'),
        h('span', { className: 'config-val' }, cfg.data.model || '-')
      ),
      h('div', { className: 'config-item' },
        h('span', { className: 'config-key' }, 'Base URL'),
        h('span', { className: 'config-val' }, cfg.data.baseUrl || '-')
      ),
      cfg.data.features ? h(Fragment, null,
        h('div', { className: 'config-item' },
          h('span', { className: 'config-key' }, 'YOLO Mode'),
          h(Badge, { status: cfg.data.features.yoloMode ? 'warn' : 'ok' }),
          h('span', { className: 'config-val' }, cfg.data.features.yoloMode ? 'ON' : 'OFF')
        ),
        h('div', { className: 'config-item' },
          h('span', { className: 'config-key' }, 'Max Cost'),
          h('span', { className: 'config-val' }, '$' + (cfg.data.features.maxCost || 10))
        ),
        h('div', { className: 'config-item' },
          h('span', { className: 'config-key' }, 'Morph API'),
          h(Badge, { status: cfg.data.features.morphEnabled ? 'ok' : 'warn' }),
          h('span', { className: 'config-val' }, cfg.data.features.morphEnabled ? 'Enabled' : 'Disabled')
        )
      ) : null
    ) : null,

    cfg.error ? h(ErrorBox, { message: cfg.error }) : null
  );
}

// ---- Command Palette ----
function CommandPalette(props) {
  var qState = useState(''); var query = qState[0]; var setQuery = qState[1];
  var selState = useState(0); var selected = selState[0]; var setSelected = selState[1];
  var inputRef = useRef(null);

  useEffect(function() {
    if (props.open && inputRef.current) {
      inputRef.current.focus();
    }
    setQuery('');
    setSelected(0);
  }, [props.open]);

  var filtered = PALETTE_ITEMS.filter(function(item) {
    if (!query) return true;
    return item.label.toLowerCase().indexOf(query.toLowerCase()) >= 0;
  });

  function exec(item) {
    props.onClose();
    if (item.view) {
      props.onNavigate(item.view);
    } else if (item.action === 'refresh') {
      location.reload();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      props.onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(function(s) { return Math.min(s + 1, filtered.length - 1); });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(function(s) { return Math.max(s - 1, 0); });
    } else if (e.key === 'Enter' && filtered[selected]) {
      exec(filtered[selected]);
    }
  }

  if (!props.open) return null;

  return h('div', {
    className: 'palette-overlay',
    onClick: function(e) { if (e.target === e.currentTarget) props.onClose(); },
  },
    h('div', { className: 'palette' },
      h('input', {
        ref: inputRef,
        className: 'palette-input',
        placeholder: 'Search commands...',
        value: query,
        onChange: function(e) { setQuery(e.target.value); setSelected(0); },
        onKeyDown: handleKeyDown,
      }),
      h('div', { className: 'palette-results' },
        filtered.length === 0
          ? h('div', { className: 'palette-empty' }, 'No results')
          : filtered.map(function(item, i) {
              return h('div', {
                className: 'palette-item' + (i === selected ? ' selected' : ''),
                key: item.label,
                onClick: function() { exec(item); },
                onMouseEnter: function() { setSelected(i); },
              },
                h('span', { className: 'palette-item-icon' }, item.icon),
                h('span', null, item.label)
              );
            })
      )
    )
  );
}

// ---- Main App ----
function App() {
  var viewState = useState('overview'); var view = viewState[0]; var setView = viewState[1];
  var palState = useState(false); var paletteOpen = palState[0]; var setPaletteOpen = palState[1];

  // Keyboard shortcut: Ctrl+K
  useEffect(function() {
    function handler(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(function(v) { return !v; });
      }
      if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    }
    document.addEventListener('keydown', handler);
    return function() { document.removeEventListener('keydown', handler); };
  }, [paletteOpen]);

  var viewInfo = VIEWS.find(function(v) { return v.id === view; }) || VIEWS[0];
  var content;
  switch (view) {
    case 'overview': content = h(OverviewView); break;
    case 'chat':     content = h(ChatView); break;
    case 'sessions': content = h(SessionsView); break;
    case 'agents':   content = h(AgentsView); break;
    case 'config':   content = h(ConfigView); break;
    default:         content = h(OverviewView);
  }

  return h('div', { className: 'app' },
    // Sidebar (desktop)
    h('div', { className: 'sidebar' },
      h('div', { className: 'sidebar-brand' },
        'Code Buddy',
        h('small', null, 'Dashboard v2')
      ),
      h('nav', { className: 'sidebar-nav' },
        VIEWS.map(function(v) {
          return h('div', {
            className: 'nav-item' + (view === v.id ? ' active' : ''),
            key: v.id,
            onClick: function() { setView(v.id); },
          },
            h('span', { className: 'nav-icon' }, v.icon),
            v.label
          );
        })
      ),
      h('div', { className: 'sidebar-footer' },
        h('span', null, 'Ctrl+K for command palette')
      )
    ),

    // Main content
    h('div', { className: 'main' },
      h('div', { className: 'header' },
        h('span', { className: 'header-title' }, viewInfo.label),
        h('span', { className: 'header-spacer' }),
        h('span', {
          className: 'header-kbd',
          onClick: function() { setPaletteOpen(true); },
        }, '\\u2318K')
      ),
      h('div', { className: 'content' }, content),

      // Mobile bottom tabs
      h('div', { className: 'mobile-tabs' },
        h('div', { className: 'mobile-tabs-inner' },
          VIEWS.map(function(v) {
            return h('div', {
              className: 'mob-tab' + (view === v.id ? ' active' : ''),
              key: v.id,
              onClick: function() { setView(v.id); },
            },
              h('span', { className: 'mob-tab-icon' }, v.icon),
              v.label
            );
          })
        )
      )
    ),

    // Command Palette
    h(CommandPalette, {
      open: paletteOpen,
      onClose: function() { setPaletteOpen(false); },
      onNavigate: setView,
    })
  );
}

// ---- Mount ----
var root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));
</script>
</body>
</html>`;

// ============================================================================
// Express Router
// ============================================================================

export function createDashboardRouter(): Router {
  const router = Router();

  // Serve dashboard SPA
  router.get('/', (_req: Request, res: Response) => {
    try {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(DASHBOARD_HTML);
    } catch (error) {
      logger.error('Failed to serve dashboard', { error: String(error) });
      res.status(500).send('Internal Server Error');
    }
  });

  // SPA fallback — serve the same HTML for any sub-path
  router.get('/{*path}', (_req: Request, res: Response) => {
    try {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(DASHBOARD_HTML);
    } catch (error) {
      logger.error('Failed to serve dashboard', { error: String(error) });
      res.status(500).send('Internal Server Error');
    }
  });

  return router;
}
