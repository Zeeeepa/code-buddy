#!/usr/bin/env node
// scripts/generate-html.js
// Génère le livre au format HTML

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const livreDir = path.join(__dirname, '../docs/livre');
const outputFile = path.join(livreDir, 'livre-grok-cli.html');

const chapters = [
  '00-avant-propos.md',
  '01-comprendre-les-llms.md',
  '02-role-des-agents.md',
  '03-anatomie-agent.md',
  '04-tree-of-thought.md',
  '05-mcts.md',
  '06-repair-reflexion.md',
  '07-rag-moderne.md',
  '08-dependency-aware-rag.md',
  '09-context-compression.md',
  '10-tool-use.md',
  '11-plugins-mcp.md',
  '12-optimisations-cognitives.md',
  '13-optimisations-systeme.md',
  '14-apprentissage-persistant.md',
  '15-architecture-complete.md',
  '16-system-prompts-securite.md',
  '17-perspectives-futures.md'
];

// Configurer marked pour le code highlighting
marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true
});

// CSS pour le livre
const css = `
<style>
  :root {
    --bg: #fafafa;
    --text: #333;
    --heading: #1a1a2e;
    --link: #1976d2;
    --code-bg: #f5f5f5;
    --border: #e0e0e0;
    --accent: #1976d2;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1a1a2e;
      --text: #e0e0e0;
      --heading: #fff;
      --link: #64b5f6;
      --code-bg: #2d2d44;
      --border: #3d3d5c;
    }
  }

  * { box-sizing: border-box; }

  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    line-height: 1.7;
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
    background: var(--bg);
    color: var(--text);
  }

  h1, h2, h3, h4 {
    color: var(--heading);
    margin-top: 2.5rem;
    margin-bottom: 1rem;
  }

  h1 {
    font-size: 2.2rem;
    border-bottom: 3px solid var(--accent);
    padding-bottom: 0.5rem;
    page-break-before: always;
  }

  h1:first-of-type { page-break-before: avoid; }

  h2 {
    font-size: 1.6rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0.3rem;
  }

  h3 { font-size: 1.3rem; }

  a { color: var(--link); text-decoration: none; }
  a:hover { text-decoration: underline; }

  code {
    font-family: 'Fira Code', 'Consolas', monospace;
    font-size: 0.9em;
    background: var(--code-bg);
    padding: 0.15em 0.4em;
    border-radius: 4px;
  }

  pre {
    background: var(--code-bg);
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    border: 1px solid var(--border);
  }

  pre code {
    background: none;
    padding: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
    font-size: 0.95rem;
  }

  th, td {
    border: 1px solid var(--border);
    padding: 0.75rem;
    text-align: left;
  }

  th {
    background: var(--code-bg);
    font-weight: 600;
  }

  blockquote {
    margin: 1.5rem 0;
    padding: 1rem 1.5rem;
    border-left: 4px solid var(--accent);
    background: var(--code-bg);
    border-radius: 0 8px 8px 0;
  }

  blockquote p { margin: 0.5rem 0; }

  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1.5rem auto;
  }

  hr {
    border: none;
    border-top: 2px solid var(--border);
    margin: 3rem 0;
  }

  /* Print styles */
  @media print {
    body {
      max-width: none;
      padding: 0;
      font-size: 11pt;
    }

    pre, blockquote {
      page-break-inside: avoid;
    }

    h1, h2, h3 {
      page-break-after: avoid;
    }
  }
</style>
`;

// Générer le HTML
let html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Construire un Agent LLM Moderne — De la Théorie à Grok-CLI</title>
  ${css}
</head>
<body>
`;

// Lire et convertir chaque chapitre
for (const chapter of chapters) {
  const filePath = path.join(livreDir, chapter);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    html += marked.parse(content);
    html += '\n<hr>\n';
    console.log(`✅ ${chapter}`);
  } else {
    console.warn(`⚠️ Fichier manquant: ${chapter}`);
  }
}

html += `
</body>
</html>`;

// Écrire le fichier
fs.writeFileSync(outputFile, html);
console.log(`\n📄 HTML généré: ${outputFile}`);
console.log(`   Taille: ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB`);
console.log(`\n💡 Pour créer un PDF:`);
console.log(`   1. Ouvrez ${outputFile} dans votre navigateur`);
console.log(`   2. Ctrl+P → "Enregistrer en PDF"`);
