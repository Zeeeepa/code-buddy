/**
 * Tests for the multi-format doc renderers.
 */

import { describe, it, expect } from 'vitest';
import { MultiFormatRenderer } from '../../src/docs/renderers/multi-format-renderer.js';
import type { RenderInput } from '../../src/docs/renderers/multi-format-renderer.js';
import { HtmlThemeEngine } from '../../src/docs/renderers/html-theme.js';

// ============================================================================
// Fixtures
// ============================================================================

function makeInput(overrides: Partial<RenderInput> = {}): RenderInput {
  return {
    moduleId: 'agent-executor',
    title: 'Agent Executor',
    markdown: [
      '# Agent Executor',
      '',
      'The core execution engine.',
      '',
      '## Architecture',
      '',
      'Uses a middleware pipeline.',
      '',
      '## API Reference',
      '',
      '`executePlan()` is the main entry point.',
      '',
      '### Sub-section',
      '',
      'Details here.',
    ].join('\n'),
    members: ['executePlan', 'runTurn', 'handleToolCall'],
    cohesion: 0.82,
    filePaths: ['src/agent/execution/agent-executor.ts'],
    generatedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  };
}

function makeModules(): RenderInput[] {
  return [
    makeInput(),
    makeInput({
      moduleId: 'context-manager',
      title: 'Context Manager',
      members: ['compress', 'truncate'],
      cohesion: 0.71,
      filePaths: ['src/context/context-manager-v2.ts'],
    }),
  ];
}

// ============================================================================
// MultiFormatRenderer.slug
// ============================================================================

describe('MultiFormatRenderer.slug', () => {
  it('converts to lowercase kebab-case', () => {
    expect(MultiFormatRenderer.slug('AgentExecutor')).toBe('agentexecutor');
  });

  it('replaces non-alphanumeric with hyphens', () => {
    expect(MultiFormatRenderer.slug('agent/executor_v2')).toBe('agent-executor-v2');
  });

  it('trims leading and trailing hyphens', () => {
    expect(MultiFormatRenderer.slug('--hello--world--')).toBe('hello-world');
  });

  it('collapses multiple special chars into single hyphen', () => {
    expect(MultiFormatRenderer.slug('a...b___c')).toBe('a-b-c');
  });

  it('handles empty string', () => {
    expect(MultiFormatRenderer.slug('')).toBe('');
  });
});

// ============================================================================
// MultiFormatRenderer.extractSections
// ============================================================================

describe('MultiFormatRenderer.extractSections', () => {
  it('splits by H2 headings', () => {
    const input = makeInput();
    const sections = MultiFormatRenderer.extractSections(input.markdown);

    expect(sections).toHaveProperty('architecture');
    expect(sections).toHaveProperty('api-reference');
    expect(sections['architecture']).toContain('middleware pipeline');
    expect(sections['api-reference']).toContain('executePlan');
  });

  it('captures intro content before first H2', () => {
    const sections = MultiFormatRenderer.extractSections(
      '# Title\n\nIntro text.\n\n## First Section\n\nContent.',
    );
    expect(sections).toHaveProperty('_intro');
    expect(sections['_intro']).toContain('Title');
    expect(sections['_intro']).toContain('Intro text.');
  });

  it('strips YAML frontmatter before extracting', () => {
    const md = '---\ntitle: "Test"\n---\n\n## Section One\n\nBody.';
    const sections = MultiFormatRenderer.extractSections(md);
    expect(sections).toHaveProperty('section-one');
    expect(sections['section-one']).toBe('Body.');
  });

  it('handles markdown with no H2 headings', () => {
    const sections = MultiFormatRenderer.extractSections('Just plain text.\nMore text.');
    expect(sections).toHaveProperty('_intro');
    expect(sections['_intro']).toContain('plain text');
  });

  it('handles empty markdown', () => {
    const sections = MultiFormatRenderer.extractSections('');
    expect(Object.keys(sections)).toHaveLength(0);
  });
});

// ============================================================================
// MultiFormatRenderer.toMarkdown
// ============================================================================

describe('MultiFormatRenderer.toMarkdown', () => {
  it('adds YAML frontmatter', () => {
    const input = makeInput();
    const output = MultiFormatRenderer.toMarkdown(input);

    expect(output.format).toBe('markdown');
    expect(output.filename).toBe('agent-executor.md');
    expect(output.content).toMatch(/^---\n/);
    expect(output.content).toContain('title: "Agent Executor"');
    expect(output.content).toContain('module: "agent-executor"');
    expect(output.content).toContain('cohesion: 0.82');
    expect(output.content).toContain('members: 3');
    expect(output.content).toContain('generated: "2026-03-24T00:00:00.000Z"');
  });

  it('preserves original markdown after frontmatter', () => {
    const input = makeInput();
    const output = MultiFormatRenderer.toMarkdown(input);
    expect(output.content).toContain('## Architecture');
    expect(output.content).toContain('middleware pipeline');
  });

  it('escapes double quotes in title', () => {
    const input = makeInput({ title: 'The "Core" Engine' });
    const output = MultiFormatRenderer.toMarkdown(input);
    expect(output.content).toContain('title: "The \\"Core\\" Engine"');
  });

  it('reports correct size in bytes', () => {
    const input = makeInput();
    const output = MultiFormatRenderer.toMarkdown(input);
    expect(output.sizeBytes).toBe(Buffer.byteLength(output.content, 'utf-8'));
  });
});

// ============================================================================
// MultiFormatRenderer.toJson
// ============================================================================

describe('MultiFormatRenderer.toJson', () => {
  it('produces valid JSON with correct structure', () => {
    const input = makeInput();
    const output = MultiFormatRenderer.toJson(input);

    expect(output.format).toBe('json');
    expect(output.filename).toBe('agent-executor.json');

    const data = JSON.parse(output.content);
    expect(data.id).toBe('agent-executor');
    expect(data.title).toBe('Agent Executor');
    expect(data.cohesion).toBe(0.82);
    expect(data.members).toEqual(['executePlan', 'runTurn', 'handleToolCall']);
  });

  it('extracts sections correctly into JSON', () => {
    const input = makeInput();
    const output = MultiFormatRenderer.toJson(input);
    const data = JSON.parse(output.content);

    expect(data.sections).toHaveProperty('architecture');
    expect(data.sections).toHaveProperty('api-reference');
    expect(data.sections['architecture']).toContain('middleware pipeline');
  });

  it('includes filePaths and generatedAt', () => {
    const input = makeInput();
    const output = MultiFormatRenderer.toJson(input);
    const data = JSON.parse(output.content);

    expect(data.filePaths).toEqual(['src/agent/execution/agent-executor.ts']);
    expect(data.generatedAt).toBe('2026-03-24T00:00:00.000Z');
  });
});

// ============================================================================
// MultiFormatRenderer.toHtml
// ============================================================================

describe('MultiFormatRenderer.toHtml', () => {
  it('produces self-contained HTML', () => {
    const input = makeInput();
    const modules = makeModules();
    const output = MultiFormatRenderer.toHtml(input, modules);

    expect(output.format).toBe('html');
    expect(output.filename).toBe('agent-executor.html');
    expect(output.content).toContain('<!DOCTYPE html>');
    expect(output.content).toContain('<style>');
    expect(output.content).toContain('<script>');
    expect(output.content).toContain('</html>');
  });

  it('includes sidebar with all modules', () => {
    const input = makeInput();
    const modules = makeModules();
    const output = MultiFormatRenderer.toHtml(input, modules);

    expect(output.content).toContain('Agent Executor');
    expect(output.content).toContain('Context Manager');
    expect(output.content).toContain('context-manager.html');
  });

  it('marks the active module in sidebar', () => {
    const input = makeInput();
    const modules = makeModules();
    const output = MultiFormatRenderer.toHtml(input, modules);

    // The active module link should have class="active"
    expect(output.content).toContain('class="active"');
  });

  it('includes theme toggle', () => {
    const input = makeInput();
    const output = MultiFormatRenderer.toHtml(input, [input]);

    expect(output.content).toContain('themeToggle');
    expect(output.content).toContain('data-theme');
  });

  it('includes search box', () => {
    const input = makeInput();
    const output = MultiFormatRenderer.toHtml(input, [input]);

    expect(output.content).toContain('searchBox');
    expect(output.content).toContain('Search modules');
  });
});

// ============================================================================
// MultiFormatRenderer.toWiki
// ============================================================================

describe('MultiFormatRenderer.toWiki', () => {
  it('returns three outputs: page, index, search-index', () => {
    const input = makeInput();
    const modules = makeModules();
    const outputs = MultiFormatRenderer.toWiki(input, modules);

    expect(outputs.length).toBe(3);

    const filenames = outputs.map(o => o.filename);
    expect(filenames).toContain('wiki/agent-executor.html');
    expect(filenames).toContain('wiki/index.html');
    expect(filenames).toContain('wiki/search-index.json');
  });

  it('wiki page has breadcrumb navigation', () => {
    const input = makeInput();
    const outputs = MultiFormatRenderer.toWiki(input, [input]);
    const page = outputs.find(o => o.filename.endsWith('agent-executor.html'));

    expect(page).toBeDefined();
    expect(page!.content).toContain('Home');
    expect(page!.content).toContain('index.html');
  });

  it('search index contains module data', () => {
    const input = makeInput();
    const outputs = MultiFormatRenderer.toWiki(input, [input]);
    const searchOutput = outputs.find(o => o.filename === 'wiki/search-index.json');

    expect(searchOutput).toBeDefined();
    const data = JSON.parse(searchOutput!.content);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('agent-executor');
    expect(data[0].slug).toBe('agent-executor');
    expect(data[0].members).toContain('executePlan');
  });
});

// ============================================================================
// MultiFormatRenderer.buildIndex
// ============================================================================

describe('MultiFormatRenderer.buildIndex', () => {
  it('generates a markdown table with module rows', () => {
    const modules = makeModules();
    const index = MultiFormatRenderer.buildIndex(modules, ['markdown', 'html'], 'MyProject');

    expect(index).toContain('# MyProject');
    expect(index).toContain('Documentation');
    expect(index).toContain('Agent Executor');
    expect(index).toContain('Context Manager');
  });

  it('includes links for each requested format', () => {
    const modules = [makeInput()];
    const index = MultiFormatRenderer.buildIndex(modules, ['markdown', 'html', 'json'], 'Test');

    expect(index).toContain('[markdown](agent-executor.md)');
    expect(index).toContain('[html](agent-executor.html)');
    expect(index).toContain('[json](agent-executor.json)');
  });

  it('uses wiki/ prefix for wiki format links', () => {
    const modules = [makeInput()];
    const index = MultiFormatRenderer.buildIndex(modules, ['wiki'], 'Test');

    expect(index).toContain('[wiki](wiki/agent-executor.html)');
  });

  it('shows cohesion and member count in table', () => {
    const modules = [makeInput()];
    const index = MultiFormatRenderer.buildIndex(modules, ['markdown'], 'Test');

    expect(index).toContain('0.82');
    expect(index).toContain('3');
  });
});

// ============================================================================
// HtmlThemeEngine.mdToHtml
// ============================================================================

describe('HtmlThemeEngine.mdToHtml', () => {
  it('converts headings with id anchors', () => {
    const html = HtmlThemeEngine.mdToHtml('## My Section');
    expect(html).toContain('<h2 id="my-section">My Section</h2>');
  });

  it('converts code blocks with language class', () => {
    const html = HtmlThemeEngine.mdToHtml('```typescript\nconst x = 1;\n```');
    expect(html).toContain('<pre><code class="lang-typescript">');
    expect(html).toContain('const');
  });

  it('converts inline code', () => {
    const html = HtmlThemeEngine.mdToHtml('Use `foo()` here.');
    expect(html).toContain('<code>foo()</code>');
  });

  it('converts bold and italic', () => {
    const html = HtmlThemeEngine.mdToHtml('This is **bold** and *italic*.');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('converts links', () => {
    const html = HtmlThemeEngine.mdToHtml('See [docs](https://example.com) for more.');
    expect(html).toContain('<a href="https://example.com">docs</a>');
  });

  it('converts unordered lists', () => {
    const html = HtmlThemeEngine.mdToHtml('- First\n- Second\n- Third');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>First</li>');
    expect(html).toContain('<li>Second</li>');
  });

  it('converts tables', () => {
    const md = '| Name | Value |\n| ---- | ----- |\n| foo  | 42    |';
    const html = HtmlThemeEngine.mdToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>foo</td>');
  });

  it('converts blockquotes', () => {
    const html = HtmlThemeEngine.mdToHtml('> Important note');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('Important note');
  });

  it('strips YAML frontmatter', () => {
    const html = HtmlThemeEngine.mdToHtml('---\ntitle: "Test"\n---\n\nHello world.');
    expect(html).not.toContain('title: "Test"');
    expect(html).toContain('Hello world');
  });

  it('wraps plain text in paragraphs', () => {
    const html = HtmlThemeEngine.mdToHtml('First paragraph.\n\nSecond paragraph.');
    expect(html).toContain('<p>');
    expect(html).toContain('First paragraph.');
    expect(html).toContain('Second paragraph.');
  });

  it('handles horizontal rules', () => {
    const html = HtmlThemeEngine.mdToHtml('Above\n\n---\n\nBelow');
    expect(html).toContain('<hr>');
  });
});

// ============================================================================
// HtmlThemeEngine.escapeHtml
// ============================================================================

describe('HtmlThemeEngine.escapeHtml', () => {
  it('escapes &, <, >, ", \'', () => {
    expect(HtmlThemeEngine.escapeHtml('a & b < c > d "e" \'f\''))
      .toBe('a &amp; b &lt; c &gt; d &quot;e&quot; &#39;f&#39;');
  });

  it('returns empty string for empty input', () => {
    expect(HtmlThemeEngine.escapeHtml('')).toBe('');
  });
});
