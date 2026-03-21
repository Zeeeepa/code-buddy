/**
 * Graph Visualizer — Interactive D3.js HTML Export
 *
 * Generates a self-contained HTML file with:
 *   - Force-directed graph layout (D3.js v7)
 *   - Nodes colored by community
 *   - Node size proportional to PageRank
 *   - Filterable by predicate type
 *   - Tooltips with entity details
 *   - Pan/zoom support
 *
 * Output: `.codebuddy/graph-viz.html` (can be opened in any browser)
 */

import fs from 'fs';
import path from 'path';
import { KnowledgeGraph } from './knowledge-graph.js';
import type { CommunityResult } from './community-detection.js';
import { logger } from '../utils/logger.js';

export interface VisualizerOptions {
  /** Maximum nodes to render (default 200) */
  maxNodes?: number;
  /** Predicates to include (default: imports, calls, extends, implements) */
  predicates?: string[];
  /** Output file name (default: graph-viz.html) */
  outputFile?: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  rank: number;
  community: number;
  connections: number;
}

interface GraphEdge {
  source: string;
  target: string;
  predicate: string;
}

/**
 * Generate an interactive HTML visualization of the code graph.
 * Returns the output file path.
 */
export function generateVisualization(
  graph: KnowledgeGraph,
  cwd: string,
  communities?: CommunityResult,
  options: VisualizerOptions = {},
): string {
  const {
    maxNodes = 200,
    predicates = ['imports', 'calls', 'extends', 'implements'],
    outputFile = 'graph-viz.html',
  } = options;

  // Collect PageRank scores
  let prScores: Map<string, number>;
  try { prScores = graph.getPageRank(); } catch { prScores = new Map(); }

  // Collect relevant triples
  const edges: GraphEdge[] = [];
  const entitySet = new Set<string>();

  for (const pred of predicates) {
    for (const t of graph.query({ predicate: pred })) {
      edges.push({ source: t.subject, target: t.object, predicate: pred });
      entitySet.add(t.subject);
      entitySet.add(t.object);
    }
  }

  // Rank entities and take top N
  const rankedEntities = [...entitySet]
    .map(id => ({ id, rank: prScores.get(id) ?? 0 }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, maxNodes);

  const topEntities = new Set(rankedEntities.map(e => e.id));

  // Build nodes
  const nodes: GraphNode[] = rankedEntities.map(({ id, rank }) => {
    const prefix = id.split(':')[0] || 'other';
    const label = id.replace(/^(mod|cls|fn|iface|layer|pat):/, '');
    const community = communities?.communities.get(id) ?? 0;
    const connections = (graph.query({ subject: id }).length) +
      (graph.query({ object: id }).length);

    return { id, label, type: prefix, rank, community, connections };
  });

  // Filter edges to only include top entities
  const filteredEdges = edges.filter(e => topEntities.has(e.source) && topEntities.has(e.target));

  // Generate HTML
  const html = generateHTML(nodes, filteredEdges, predicates);

  const outPath = path.join(cwd, '.codebuddy', outputFile);
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outPath, html, 'utf-8');
  logger.debug(`GraphVisualizer: wrote ${outPath} (${nodes.length} nodes, ${filteredEdges.length} edges)`);

  return outPath;
}

function generateHTML(nodes: GraphNode[], edges: GraphEdge[], predicates: string[]): string {
  const graphData = JSON.stringify({ nodes, edges });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Code Graph Visualization</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0d1117; color: #c9d1d9; overflow: hidden; }
  #controls {
    position: fixed; top: 12px; left: 12px; z-index: 10;
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 12px; min-width: 220px;
  }
  #controls h3 { font-size: 14px; margin-bottom: 8px; color: #58a6ff; }
  .filter-row { display: flex; align-items: center; margin: 4px 0; font-size: 13px; }
  .filter-row input { margin-right: 6px; }
  .filter-row label { cursor: pointer; }
  #search {
    width: 100%; padding: 6px 8px; margin-bottom: 8px;
    background: #0d1117; border: 1px solid #30363d; border-radius: 4px;
    color: #c9d1d9; font-size: 13px;
  }
  #stats {
    position: fixed; bottom: 12px; left: 12px; z-index: 10;
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
    padding: 8px 12px; font-size: 12px; opacity: 0.8;
  }
  #tooltip {
    position: fixed; display: none; z-index: 20;
    background: #1c2128; border: 1px solid #30363d; border-radius: 6px;
    padding: 10px; font-size: 12px; max-width: 300px; pointer-events: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }
  #tooltip strong { color: #58a6ff; }
  svg { width: 100vw; height: 100vh; }
  .legend { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .legend-item { display: flex; align-items: center; font-size: 11px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
</style>
</head>
<body>
<div id="controls">
  <h3>Code Graph Explorer</h3>
  <input type="text" id="search" placeholder="Search entities..." />
  <div id="filters"></div>
  <div class="legend" id="legend"></div>
</div>
<div id="stats"></div>
<div id="tooltip"></div>
<svg id="graph"></svg>

<script>
// D3.js v7 (minified inline for self-contained HTML)
// Using CDN for D3 — requires internet on first load
</script>
<script src="https://d3js.org/d3.v7.min.js"></script>
<script>
const DATA = ${graphData};
const PREDICATES = ${JSON.stringify(predicates)};
const TYPE_COLORS = {
  mod: '#3fb950', cls: '#d2a8ff', fn: '#79c0ff', iface: '#f0883e',
  layer: '#ffa657', pat: '#ff7b72', other: '#8b949e',
};
const COMMUNITY_COLORS = [
  '#58a6ff','#3fb950','#d2a8ff','#f0883e','#ff7b72','#ffa657',
  '#79c0ff','#7ee787','#e3b341','#f778ba','#a5d6ff','#56d364',
];

const width = window.innerWidth;
const height = window.innerHeight;

// State
let activePredicates = new Set(PREDICATES);
let searchTerm = '';

// Build filters
const filtersDiv = document.getElementById('filters');
for (const pred of PREDICATES) {
  const row = document.createElement('div');
  row.className = 'filter-row';
  row.innerHTML = '<input type="checkbox" checked id="f-' + pred + '"><label for="f-' + pred + '">' + pred + '</label>';
  filtersDiv.appendChild(row);
  row.querySelector('input').addEventListener('change', (e) => {
    if (e.target.checked) activePredicates.add(pred);
    else activePredicates.delete(pred);
    updateGraph();
  });
}

// Build legend
const legendDiv = document.getElementById('legend');
for (const [type, color] of Object.entries(TYPE_COLORS)) {
  const item = document.createElement('div');
  item.className = 'legend-item';
  item.innerHTML = '<div class="legend-dot" style="background:' + color + '"></div>' + type;
  legendDiv.appendChild(item);
}

// Search
document.getElementById('search').addEventListener('input', (e) => {
  searchTerm = e.target.value.toLowerCase();
  updateHighlight();
});

// SVG setup
const svg = d3.select('#graph');
const g = svg.append('g');
svg.call(d3.zoom().scaleExtent([0.1, 8]).on('zoom', (e) => g.attr('transform', e.transform)));

// Force simulation
const simulation = d3.forceSimulation()
  .force('link', d3.forceLink().id(d => d.id).distance(80))
  .force('charge', d3.forceManyBody().strength(-120))
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide().radius(d => nodeRadius(d) + 2));

let linkElements, nodeElements, labelElements;

function nodeRadius(d) {
  return Math.max(4, Math.min(20, 4 + d.rank * 30));
}

function nodeColor(d) {
  return TYPE_COLORS[d.type] || TYPE_COLORS.other;
}

function updateGraph() {
  const visibleEdges = DATA.edges.filter(e => activePredicates.has(e.predicate));
  const connectedNodes = new Set();
  for (const e of visibleEdges) { connectedNodes.add(e.source.id || e.source); connectedNodes.add(e.target.id || e.target); }
  const visibleNodes = DATA.nodes.filter(n => connectedNodes.has(n.id));

  // Update links
  linkElements = g.selectAll('.link').data(visibleEdges, d => d.source.id + '-' + d.target.id + '-' + d.predicate);
  linkElements.exit().remove();
  const linkEnter = linkElements.enter().append('line')
    .attr('class', 'link')
    .attr('stroke', '#30363d')
    .attr('stroke-width', 0.5)
    .attr('stroke-opacity', 0.4);
  linkElements = linkEnter.merge(linkElements);

  // Update nodes
  nodeElements = g.selectAll('.node').data(visibleNodes, d => d.id);
  nodeElements.exit().remove();
  const nodeEnter = nodeElements.enter().append('circle')
    .attr('class', 'node')
    .attr('r', d => nodeRadius(d))
    .attr('fill', d => nodeColor(d))
    .attr('stroke', '#0d1117')
    .attr('stroke-width', 1.5)
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded))
    .on('mouseover', showTooltip)
    .on('mouseout', hideTooltip);
  nodeElements = nodeEnter.merge(nodeElements);

  // Update labels (only for high-rank nodes)
  labelElements = g.selectAll('.label').data(visibleNodes.filter(n => n.rank > 0.15), d => d.id);
  labelElements.exit().remove();
  const labelEnter = labelElements.enter().append('text')
    .attr('class', 'label')
    .attr('font-size', 10)
    .attr('fill', '#8b949e')
    .attr('text-anchor', 'middle')
    .attr('dy', d => -nodeRadius(d) - 4)
    .text(d => d.label.length > 25 ? d.label.slice(-25) : d.label);
  labelElements = labelEnter.merge(labelElements);

  // Restart simulation
  simulation.nodes(visibleNodes).on('tick', ticked);
  simulation.force('link').links(visibleEdges);
  simulation.alpha(0.3).restart();

  document.getElementById('stats').textContent =
    visibleNodes.length + ' nodes · ' + visibleEdges.length + ' edges';
}

function ticked() {
  linkElements
    .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
  nodeElements.attr('cx', d => d.x).attr('cy', d => d.y);
  labelElements.attr('x', d => d.x).attr('y', d => d.y);
}

function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) { d.fx = event.x; d.fy = event.y; }
function dragEnded(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null; d.fy = null;
}

const tooltip = document.getElementById('tooltip');
function showTooltip(event, d) {
  tooltip.style.display = 'block';
  tooltip.style.left = (event.pageX + 12) + 'px';
  tooltip.style.top = (event.pageY - 10) + 'px';
  tooltip.innerHTML = '<strong>' + d.id + '</strong><br>'
    + 'Type: ' + d.type + '<br>'
    + 'PageRank: ' + d.rank.toFixed(4) + '<br>'
    + 'Community: ' + d.community + '<br>'
    + 'Connections: ' + d.connections;
}
function hideTooltip() { tooltip.style.display = 'none'; }

function updateHighlight() {
  if (!nodeElements) return;
  nodeElements.attr('opacity', d => {
    if (!searchTerm) return 1;
    return d.label.toLowerCase().includes(searchTerm) ? 1 : 0.15;
  });
  if (labelElements) {
    labelElements.attr('opacity', d => {
      if (!searchTerm) return 1;
      return d.label.toLowerCase().includes(searchTerm) ? 1 : 0.15;
    });
  }
}

// Initial render
updateGraph();
</script>
</body>
</html>`;
}
