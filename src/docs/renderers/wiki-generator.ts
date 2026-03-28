/**
 * Wiki Generator — produces navigable wiki pages from RenderInput.
 *
 * Generates:
 *   - Individual wiki pages (HTML with sidebar navigation)
 *   - Index page (grid of module cards with search)
 *   - Search index (JSON for client-side search)
 *
 * All output is self-contained with inline CSS/JS.
 */

import type { RenderInput, RenderOutput } from './types.js';
import { slug } from './types.js';
import { HtmlThemeEngine } from './html-theme.js';

// ============================================================================
// Wiki Generator
// ============================================================================

export class WikiGenerator {
  /**
   * Generate all wiki outputs for a single module page.
   * Returns array: [page.html, index.html, search-index.json]
   */
  static generate(input: RenderInput, allModules: RenderInput[]): RenderOutput[] {
    const outputs: RenderOutput[] = [];

    // 1. Wiki page
    const pageContent = WikiGenerator.renderWikiPage(input, allModules);
    const pageFilename = `wiki/${slug(input.moduleId)}.html`;
    outputs.push({
      format: 'wiki',
      content: pageContent,
      filename: pageFilename,
      sizeBytes: Buffer.byteLength(pageContent, 'utf-8'),
    });

    // 2. Index page
    const indexContent = WikiGenerator.renderIndex(allModules);
    outputs.push({
      format: 'wiki',
      content: indexContent,
      filename: 'wiki/index.html',
      sizeBytes: Buffer.byteLength(indexContent, 'utf-8'),
    });

    // 3. Search index
    const searchIndex = WikiGenerator.buildSearchIndex(allModules);
    const searchJson = JSON.stringify(searchIndex, null, 2);
    outputs.push({
      format: 'wiki',
      content: searchJson,
      filename: 'wiki/search-index.json',
      sizeBytes: Buffer.byteLength(searchJson, 'utf-8'),
    });

    return outputs;
  }

  /**
   * Render a single wiki page with sidebar and member list.
   */
  static renderWikiPage(input: RenderInput, allModules: RenderInput[]): string {
    const moduleSlug = slug(input.moduleId);
    const bodyHtml = HtmlThemeEngine.mdToHtml(input.markdown);
    const navItems = allModules.map(mod => {
      const s = slug(mod.moduleId);
      const active = s === moduleSlug ? ' class="wiki-nav-active"' : '';
      return `<li><a href="${s}.html"${active}>${WikiGenerator.escapeHtml(mod.title)}</a></li>`;
    }).join('\n        ');

    const memberList = input.members.length > 0
      ? `<div class="wiki-members">
      <h3>Members (${input.members.length})</h3>
      <ul>${input.members.map(m => `<li><code>${WikiGenerator.escapeHtml(m)}</code></li>`).join('')}</ul>
    </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${WikiGenerator.escapeHtml(input.title)} — Wiki</title>
<style>
${WikiGenerator.getWikiStyles()}
</style>
</head>
<body>
<div class="wiki-layout">
  <aside class="wiki-sidebar">
    <div class="wiki-sidebar-header">
      <a href="index.html" class="wiki-home">Wiki</a>
    </div>
    <nav>
      <ul class="wiki-nav-list">
        ${navItems}
      </ul>
    </nav>
  </aside>
  <main class="wiki-content">
    <div class="wiki-breadcrumb">
      <a href="index.html">Home</a> &raquo; ${WikiGenerator.escapeHtml(input.title)}
    </div>
    <article>
      <h1>${WikiGenerator.escapeHtml(input.title)}</h1>
      <div class="wiki-meta">
        Cohesion: <strong>${input.cohesion.toFixed(2)}</strong>
        &middot; Members: <strong>${input.members.length}</strong>
        &middot; Files: <strong>${input.filePaths.length}</strong>
      </div>
      ${bodyHtml}
      ${memberList}
    </article>
    <footer class="wiki-footer">
      Generated ${input.generatedAt ?? new Date().toISOString().split('T')[0]}
    </footer>
  </main>
</div>
</body>
</html>`;
  }

  /**
   * Render the wiki index page with a searchable grid of module cards.
   */
  static renderIndex(modules: RenderInput[]): string {
    const cards = modules.map(mod => {
      const moduleSlug = slug(mod.moduleId);
      const excerpt = WikiGenerator.extractExcerpt(mod.markdown, 120);
      const barWidth = Math.round(mod.cohesion * 100);
      return `<a href="${moduleSlug}.html" class="wiki-card" data-title="${WikiGenerator.escapeHtml(mod.title.toLowerCase())}">
        <h3>${WikiGenerator.escapeHtml(mod.title)}</h3>
        <p>${WikiGenerator.escapeHtml(excerpt)}</p>
        <div class="wiki-card-meta">
          <span>${mod.members.length} members</span>
          <span class="wiki-card-bar"><span style="width:${barWidth}%"></span></span>
        </div>
      </a>`;
    }).join('\n      ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wiki Index</title>
<style>
${WikiGenerator.getWikiStyles()}
${WikiGenerator.getIndexStyles()}
</style>
</head>
<body>
<div class="wiki-index">
  <header class="wiki-index-header">
    <h1>Documentation Wiki</h1>
    <p>${modules.length} modules documented</p>
    <input type="text" id="wikiSearch" placeholder="Search modules..." class="wiki-search-input">
  </header>
  <div class="wiki-grid" id="wikiGrid">
    ${cards}
  </div>
</div>
<script>
(function() {
  var input = document.getElementById('wikiSearch');
  var cards = document.querySelectorAll('.wiki-card');
  input.addEventListener('input', function() {
    var q = this.value.toLowerCase();
    cards.forEach(function(card) {
      var title = card.getAttribute('data-title') || '';
      card.style.display = (!q || title.indexOf(q) !== -1) ? '' : 'none';
    });
  });
})();
</script>
</body>
</html>`;
  }

  /**
   * Build a search index array for client-side search.
   */
  static buildSearchIndex(modules: RenderInput[]): unknown[] {
    return modules.map(mod => ({
      id: mod.moduleId,
      title: mod.title,
      slug: slug(mod.moduleId),
      members: mod.members,
      excerpt: WikiGenerator.extractExcerpt(mod.markdown, 200),
    }));
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /** Extract a plain-text excerpt from markdown */
  private static extractExcerpt(markdown: string, maxLen: number): string {
    let text = markdown;

    // Strip YAML frontmatter
    if (text.startsWith('---')) {
      const endIdx = text.indexOf('---', 3);
      if (endIdx !== -1) text = text.slice(endIdx + 3);
    }

    // Strip markdown formatting
    text = text
      .replace(/```[\s\S]*?```/g, '')        // code blocks
      .replace(/^#+\s+/gm, '')               // headings
      .replace(/\*\*(.+?)\*\*/g, '$1')       // bold
      .replace(/\*(.+?)\*/g, '$1')           // italic
      .replace(/`([^`]+)`/g, '$1')           // inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
      .replace(/\n+/g, ' ')
      .trim();

    if (text.length > maxLen) {
      return text.slice(0, maxLen - 3) + '...';
    }
    return text;
  }

  /** Escape HTML special characters */
  private static escapeHtml(text: string): string {
    return HtmlThemeEngine.escapeHtml(text);
  }

  // --------------------------------------------------------------------------
  // Wiki CSS
  // --------------------------------------------------------------------------

  private static getWikiStyles(): string {
    return `
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #1a1a2e;
  background: #ffffff;
  line-height: 1.65;
}

.wiki-layout {
  display: flex;
  min-height: 100vh;
}

.wiki-sidebar {
  width: 240px;
  min-width: 240px;
  background: #fafbfc;
  border-right: 1px solid #e0e0e0;
  padding: 0;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  overflow-y: auto;
}

.wiki-sidebar-header {
  padding: 18px 16px;
  border-bottom: 1px solid #e0e0e0;
}

.wiki-home {
  font-weight: 700;
  font-size: 18px;
  color: #1D9E75;
  text-decoration: none;
}

.wiki-nav-list {
  list-style: none;
  padding: 8px 0;
}

.wiki-nav-list li a {
  display: block;
  padding: 7px 20px;
  color: #555;
  text-decoration: none;
  font-size: 13px;
  border-left: 3px solid transparent;
}

.wiki-nav-list li a:hover {
  background: #f0f2f5;
  color: #1a1a2e;
}

.wiki-nav-list li a.wiki-nav-active {
  border-left-color: #1D9E75;
  color: #1D9E75;
  font-weight: 600;
  background: #f0f2f5;
}

.wiki-content {
  flex: 1;
  margin-left: 240px;
  padding: 32px 48px;
  max-width: 900px;
}

.wiki-breadcrumb {
  font-size: 13px;
  color: #888;
  margin-bottom: 20px;
}

.wiki-breadcrumb a {
  color: #1D9E75;
  text-decoration: none;
}

.wiki-meta {
  font-size: 13px;
  color: #888;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.wiki-content article h1 { font-size: 28px; margin-bottom: 8px; }
.wiki-content article h2 { font-size: 22px; margin: 32px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e0e0e0; }
.wiki-content article h3 { font-size: 18px; margin: 24px 0 8px; }
.wiki-content article p { margin: 10px 0; }
.wiki-content article a { color: #1D9E75; }
.wiki-content article code { background: #f0f2f5; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: "SFMono-Regular", Consolas, monospace; }
.wiki-content article pre { background: #f0f2f5; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 14px 0; border: 1px solid #e0e0e0; }
.wiki-content article pre code { background: none; padding: 0; font-size: 13px; }
.wiki-content article table { border-collapse: collapse; width: 100%; margin: 14px 0; }
.wiki-content article th, .wiki-content article td { border: 1px solid #e0e0e0; padding: 8px 12px; text-align: left; }
.wiki-content article th { background: #fafbfc; font-weight: 600; }
.wiki-content article ul, .wiki-content article ol { padding-left: 24px; margin: 10px 0; }
.wiki-content article blockquote { border-left: 4px solid #1D9E75; padding: 8px 16px; margin: 12px 0; color: #555; background: #fafbfc; border-radius: 0 6px 6px 0; }

.wiki-members { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
.wiki-members h3 { font-size: 16px; margin-bottom: 10px; }
.wiki-members ul { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.wiki-members li { background: #f0f2f5; padding: 4px 10px; border-radius: 4px; font-size: 12px; }

.wiki-footer {
  margin-top: 40px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
  font-size: 12px;
  color: #aaa;
}

@media (max-width: 800px) {
  .wiki-sidebar { display: none; }
  .wiki-content { margin-left: 0; padding: 20px; }
}
`;
  }

  private static getIndexStyles(): string {
    return `
.wiki-index {
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px 24px;
}

.wiki-index-header {
  text-align: center;
  margin-bottom: 32px;
}

.wiki-index-header h1 {
  font-size: 32px;
  color: #1a1a2e;
}

.wiki-index-header p {
  color: #888;
  margin: 6px 0 16px;
}

.wiki-search-input {
  width: 100%;
  max-width: 420px;
  padding: 10px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.wiki-search-input:focus {
  border-color: #1D9E75;
}

.wiki-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.wiki-card {
  display: block;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  padding: 18px;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.wiki-card:hover {
  border-color: #1D9E75;
  box-shadow: 0 4px 12px rgba(29, 158, 117, 0.12);
}

.wiki-card h3 {
  font-size: 16px;
  margin-bottom: 6px;
  color: #1a1a2e;
}

.wiki-card p {
  font-size: 13px;
  color: #555;
  margin-bottom: 10px;
  line-height: 1.5;
}

.wiki-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #888;
}

.wiki-card-bar {
  width: 60px;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
}

.wiki-card-bar span {
  display: block;
  height: 100%;
  background: #1D9E75;
  border-radius: 2px;
}
`;
  }
}
