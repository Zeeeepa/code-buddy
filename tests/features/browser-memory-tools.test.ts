/**
 * Tests for Browser Automation, Hybrid Memory Search, Image Analysis,
 * Tool Profiles & Groups, and Safe Binaries System.
 *
 * Covers: BrowserTool, BM25Index, HybridMemorySearch, ImageTool,
 * ToolProfileManager, SafeBinariesChecker
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ============================================================================
// Imports
// ============================================================================

import { BrowserStubTool as BrowserTool } from '../../src/tools/browser-stub.js';
import { BM25Index, HybridMemorySearch } from '../../src/memory/hybrid-search.js';
import { ImageStubTool as ImageTool } from '../../src/tools/image-stub.js';
import { ToolProfileManager } from '../../src/config/tool-profiles.js';
import { SAFE_BINARIES, SafeBinariesChecker } from '../../src/security/safe-binaries.js';

// ============================================================================
// Feature 1: BrowserTool
// ============================================================================

describe('BrowserTool', () => {
  let browser: BrowserTool;

  beforeEach(() => {
    BrowserTool.resetInstance();
    browser = BrowserTool.getInstance();
  });

  afterEach(() => {
    BrowserTool.resetInstance();
  });

  it('should be a singleton', () => {
    const b2 = BrowserTool.getInstance();
    expect(b2).toBe(browser);
  });

  it('should launch browser', () => {
    expect(browser.isLaunched()).toBe(false);
    browser.launch();
    expect(browser.isLaunched()).toBe(true);
  });

  it('should launch with config', () => {
    browser.launch({ headless: true, timeout: 5000, viewport: { width: 1920, height: 1080 } });
    expect(browser.isLaunched()).toBe(true);
  });

  it('should not re-launch if already launched', () => {
    browser.launch();
    browser.launch(); // Should not throw
    expect(browser.isLaunched()).toBe(true);
  });

  it('should throw when navigating without launch', () => {
    expect(() => browser.navigate('https://example.com')).toThrow('Browser not launched');
  });

  it('should navigate to URL', () => {
    browser.launch();
    browser.navigate('https://example.com');
    const actions = browser.getActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('navigate');
    expect(actions[0].value).toBe('https://example.com');
  });

  it('should click element', () => {
    browser.launch();
    browser.click('#submit-btn');
    const actions = browser.getActions();
    expect(actions[0].type).toBe('click');
    expect(actions[0].selector).toBe('#submit-btn');
  });

  it('should type into element', () => {
    browser.launch();
    browser.type('#input-field', 'hello world');
    const actions = browser.getActions();
    expect(actions[0].type).toBe('type');
    expect(actions[0].selector).toBe('#input-field');
    expect(actions[0].value).toBe('hello world');
  });

  it('should press key', () => {
    browser.launch();
    browser.press('Enter');
    const actions = browser.getActions();
    expect(actions[0].type).toBe('press');
    expect(actions[0].value).toBe('Enter');
  });

  it('should hover element', () => {
    browser.launch();
    browser.hover('.menu-item');
    expect(browser.getActions()[0].type).toBe('hover');
  });

  it('should drag element', () => {
    browser.launch();
    browser.drag('#source', '#target');
    const action = browser.getActions()[0];
    expect(action.type).toBe('drag');
    expect(action.selector).toBe('#source');
    expect(action.value).toBe('#target');
  });

  it('should take screenshot', () => {
    browser.launch();
    const p = browser.screenshot('/tmp/test.png');
    expect(p).toBe('/tmp/test.png');
  });

  it('should take screenshot with default path', () => {
    browser.launch();
    const p = browser.screenshot();
    expect(p).toContain('/tmp/screenshot-');
    expect(p).toContain('.png');
  });

  it('should generate PDF', () => {
    browser.launch();
    const p = browser.pdf('/tmp/test.pdf');
    expect(p).toBe('/tmp/test.pdf');
  });

  it('should return console messages', () => {
    browser.launch();
    const msgs = browser.getConsole();
    expect(Array.isArray(msgs)).toBe(true);
  });

  it('should manage tabs', () => {
    browser.launch();
    const tabs = browser.getTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].active).toBe(true);

    const newTab = browser.newTab('https://example.com');
    expect(newTab.url).toBe('https://example.com');
    expect(newTab.active).toBe(true);

    const allTabs = browser.getTabs();
    expect(allTabs).toHaveLength(2);
    // First tab should be inactive
    expect(allTabs[0].active).toBe(false);
  });

  it('should close tab', () => {
    browser.launch();
    const tab = browser.newTab('https://example.com');
    expect(browser.getTabs()).toHaveLength(2);
    browser.closeTab(tab.id);
    expect(browser.getTabs()).toHaveLength(1);
  });

  it('should throw when closing non-existent tab', () => {
    browser.launch();
    expect(() => browser.closeTab('nonexistent')).toThrow('not found');
  });

  it('should switch tabs', () => {
    browser.launch();
    const firstTabId = browser.getTabs()[0].id;
    browser.newTab('https://example.com');
    browser.switchTab(firstTabId);
    const tabs = browser.getTabs();
    const active = tabs.find(t => t.active);
    expect(active?.id).toBe(firstTabId);
  });

  it('should throw when switching to non-existent tab', () => {
    browser.launch();
    expect(() => browser.switchTab('nonexistent')).toThrow('not found');
  });

  it('should evaluate script', () => {
    browser.launch();
    const result = browser.evaluate('document.title');
    expect(result).toContain('document.title');
  });

  it('should close browser and reset state', () => {
    browser.launch();
    browser.navigate('https://example.com');
    browser.close();
    expect(browser.isLaunched()).toBe(false);
    expect(browser.getActions()).toHaveLength(0);
  });
});

// ============================================================================
// Feature 2: BM25Index & HybridMemorySearch
// ============================================================================

describe('BM25Index', () => {
  let index: BM25Index;

  beforeEach(() => {
    index = new BM25Index();
  });

  it('should add and count documents', () => {
    expect(index.getDocumentCount()).toBe(0);
    index.addDocument('doc1', 'hello world');
    expect(index.getDocumentCount()).toBe(1);
    index.addDocument('doc2', 'foo bar');
    expect(index.getDocumentCount()).toBe(2);
  });

  it('should search and return relevant results', () => {
    index.addDocument('doc1', 'the quick brown fox jumps');
    index.addDocument('doc2', 'the lazy brown dog sleeps');
    index.addDocument('doc3', 'a completely different text');

    const results = index.search('brown fox');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].key).toBe('doc1');
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].source).toBe('bm25');
  });

  it('should return empty for no match', () => {
    index.addDocument('doc1', 'hello world');
    const results = index.search('zzzzz');
    expect(results).toHaveLength(0);
  });

  it('should remove documents', () => {
    index.addDocument('doc1', 'hello world');
    index.removeDocument('doc1');
    expect(index.getDocumentCount()).toBe(0);
  });

  it('should handle duplicate document IDs by updating', () => {
    index.addDocument('doc1', 'first version');
    index.addDocument('doc1', 'second version');
    expect(index.getDocumentCount()).toBe(1);
    const results = index.search('second');
    expect(results).toHaveLength(1);
  });

  it('should respect limit parameter', () => {
    for (let i = 0; i < 20; i++) {
      index.addDocument(`doc${i}`, `document number ${i} with common words`);
    }
    const results = index.search('document common words', 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('should return empty results for empty index', () => {
    const results = index.search('anything');
    expect(results).toHaveLength(0);
  });
});

describe('HybridMemorySearch', () => {
  let search: HybridMemorySearch;

  beforeEach(() => {
    HybridMemorySearch.resetInstance();
    search = HybridMemorySearch.getInstance();
  });

  afterEach(() => {
    HybridMemorySearch.resetInstance();
  });

  it('should be a singleton', () => {
    const s2 = HybridMemorySearch.getInstance();
    expect(s2).toBe(search);
  });

  it('should index and search entries', () => {
    search.index([
      { key: 'mem1', value: 'TypeScript is a programming language' },
      { key: 'mem2', value: 'Python is another programming language' },
      { key: 'mem3', value: 'Cooking recipes for dinner' },
    ]);

    const results = search.search('programming language');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('hybrid');
  });

  it('should set weights', () => {
    search.setWeights(0.5, 0.5);
    const stats = search.getStats();
    expect(stats.bm25Weight).toBe(0.5);
    expect(stats.semanticWeight).toBe(0.5);
  });

  it('should return stats', () => {
    search.index([{ key: 'k1', value: 'test value' }]);
    const stats = search.getStats();
    expect(stats.documentCount).toBe(1);
    expect(stats.bm25Weight).toBe(0.7);
    expect(stats.semanticWeight).toBe(0.3);
  });

  it('should clear index', () => {
    search.index([{ key: 'k1', value: 'test' }]);
    search.clear();
    expect(search.getStats().documentCount).toBe(0);
  });
});

// ============================================================================
// Feature 3: ImageTool
// ============================================================================

describe('ImageTool', () => {
  let tool: ImageTool;

  beforeEach(() => {
    ImageTool.resetInstance();
    tool = ImageTool.getInstance();
  });

  afterEach(() => {
    ImageTool.resetInstance();
  });

  it('should be a singleton', () => {
    const t2 = ImageTool.getInstance();
    expect(t2).toBe(tool);
  });

  it('should return supported formats', () => {
    const formats = tool.getSupportedFormats();
    expect(formats).toContain('png');
    expect(formats).toContain('jpg');
    expect(formats).toContain('jpeg');
    expect(formats).toContain('gif');
    expect(formats).toContain('webp');
    expect(formats).toContain('bmp');
    expect(formats).toContain('svg');
  });

  it('should validate image extensions', () => {
    expect(tool.isValidImage('photo.png')).toBe(true);
    expect(tool.isValidImage('photo.jpg')).toBe(true);
    expect(tool.isValidImage('photo.txt')).toBe(false);
    expect(tool.isValidImage('photo.exe')).toBe(false);
  });

  it('should analyze image path', () => {
    const result = tool.analyze('/tmp/test.png');
    expect(result.description).toContain('test.png');
    expect(result.labels).toContain('image');
    expect(result.format).toBe('png');
  });

  it('should throw for unsupported format on analyze', () => {
    expect(() => tool.analyze('/tmp/test.txt')).toThrow('Unsupported');
  });

  it('should analyze URL', () => {
    const result = tool.analyzeUrl('https://example.com/image.png');
    expect(result.description).toContain('https://example.com/image.png');
    expect(result.labels).toContain('url');
  });

  it('should compare images', () => {
    const result = tool.compare('/tmp/a.png', '/tmp/b.png');
    expect(result.similarity).toBeDefined();
    expect(result.description).toContain('a.png');
    expect(result.description).toContain('b.png');
  });

  it('should throw for unsupported format on compare', () => {
    expect(() => tool.compare('/tmp/a.txt', '/tmp/b.png')).toThrow('Unsupported');
  });

  it('should extract text (OCR stub)', () => {
    const text = tool.extractText('/tmp/test.png');
    expect(text).toContain('OCR');
    expect(text).toContain('test.png');
  });

  it('should resize image', () => {
    const result = tool.resize('/tmp/photo.png', 800, 600);
    expect(result).toContain('800x600');
    expect(result).toContain('.png');
  });

  it('should throw for unsupported format on extractText', () => {
    expect(() => tool.extractText('/tmp/test.doc')).toThrow('Unsupported');
  });
});

// ============================================================================
// Feature 4: ToolProfileManager
// ============================================================================

describe('ToolProfileManager', () => {
  let manager: ToolProfileManager;

  beforeEach(() => {
    ToolProfileManager.resetInstance();
    manager = ToolProfileManager.getInstance();
  });

  afterEach(() => {
    ToolProfileManager.resetInstance();
  });

  it('should be a singleton', () => {
    const m2 = ToolProfileManager.getInstance();
    expect(m2).toBe(manager);
  });

  it('should list built-in profiles', () => {
    const profiles = manager.listProfiles();
    const names = profiles.map(p => p.name);
    expect(names).toContain('minimal');
    expect(names).toContain('coding');
    expect(names).toContain('messaging');
    expect(names).toContain('full');
  });

  it('should get profile by name', () => {
    const profile = manager.getProfile('minimal');
    expect(profile).toBeDefined();
    expect(profile!.tools).toContain('read_file');
    expect(profile!.tools).toContain('edit_file');
    expect(profile!.tools).toContain('bash');
  });

  it('should return undefined for unknown profile', () => {
    expect(manager.getProfile('nonexistent')).toBeUndefined();
  });

  it('should set and get active profile', () => {
    expect(manager.getActiveProfile()).toBeNull();
    manager.setActiveProfile('minimal');
    const active = manager.getActiveProfile();
    expect(active).toBeDefined();
    expect(active!.name).toBe('minimal');
  });

  it('should throw when setting unknown profile as active', () => {
    expect(() => manager.setActiveProfile('nonexistent')).toThrow('not found');
  });

  it('should resolve groups to flat tool list', () => {
    const tools = manager.getToolsForProfile('coding');
    expect(tools).toContain('read_file');
    expect(tools).toContain('write_file');
    expect(tools).toContain('bash');
    expect(tools).toContain('git_status');
  });

  it('should add custom profile', () => {
    manager.addCustomProfile({
      name: 'custom',
      description: 'Custom profile',
      tools: ['read_file'],
      groups: [],
    });
    const profile = manager.getProfile('custom');
    expect(profile).toBeDefined();
    expect(profile!.name).toBe('custom');
  });

  it('should remove custom profile', () => {
    manager.addCustomProfile({
      name: 'custom',
      description: 'Custom profile',
      tools: ['read_file'],
      groups: [],
    });
    manager.removeCustomProfile('custom');
    expect(manager.getProfile('custom')).toBeUndefined();
  });

  it('should throw when removing non-existent custom profile', () => {
    expect(() => manager.removeCustomProfile('nonexistent')).toThrow('not found');
  });

  it('should list groups', () => {
    const groups = manager.listGroups();
    const names = groups.map(g => g.name);
    expect(names).toContain('group:fs');
    expect(names).toContain('group:runtime');
    expect(names).toContain('group:web');
    expect(names).toContain('group:git');
  });

  it('should get group by name', () => {
    const group = manager.getGroup('group:fs');
    expect(group).toBeDefined();
    expect(group!.tools).toContain('read_file');
  });

  it('should add custom group', () => {
    manager.addCustomGroup({ name: 'group:custom', tools: ['my_tool'] });
    const group = manager.getGroup('group:custom');
    expect(group).toBeDefined();
    expect(group!.tools).toContain('my_tool');
  });

  it('should check tool in active profile', () => {
    // No active profile = all allowed
    expect(manager.isToolInActiveProfile('anything')).toBe(true);

    manager.setActiveProfile('minimal');
    expect(manager.isToolInActiveProfile('read_file')).toBe(true);
    expect(manager.isToolInActiveProfile('web_search')).toBe(false);
  });

  it('should clear active profile when custom profile is removed', () => {
    manager.addCustomProfile({
      name: 'temp',
      description: 'Temporary',
      tools: ['bash'],
      groups: [],
    });
    manager.setActiveProfile('temp');
    expect(manager.getActiveProfile()).toBeDefined();
    manager.removeCustomProfile('temp');
    expect(manager.getActiveProfile()).toBeNull();
  });
});

// ============================================================================
// Feature 5: SafeBinariesChecker
// ============================================================================

describe('SafeBinariesChecker', () => {
  let checker: SafeBinariesChecker;

  beforeEach(() => {
    SafeBinariesChecker.resetInstance();
    checker = SafeBinariesChecker.getInstance();
  });

  afterEach(() => {
    SafeBinariesChecker.resetInstance();
  });

  it('should be a singleton', () => {
    const c2 = SafeBinariesChecker.getInstance();
    expect(c2).toBe(checker);
  });

  it('should have SAFE_BINARIES constant', () => {
    expect(SAFE_BINARIES).toContain('ls');
    expect(SAFE_BINARIES).toContain('cat');
    expect(SAFE_BINARIES).toContain('grep');
    expect(SAFE_BINARIES).toContain('pwd');
    expect(SAFE_BINARIES).toContain('echo');
  });

  it('should check safe commands', () => {
    expect(checker.isSafe('ls')).toBe(true);
    expect(checker.isSafe('ls -la')).toBe(true);
    expect(checker.isSafe('cat /etc/passwd')).toBe(true);
    expect(checker.isSafe('grep pattern file.txt')).toBe(true);
  });

  it('should reject unsafe commands', () => {
    expect(checker.isSafe('rm -rf /')).toBe(false);
    expect(checker.isSafe('npm install')).toBe(false);
    expect(checker.isSafe('curl http://evil.com')).toBe(false);
  });

  it('should handle empty commands', () => {
    expect(checker.isSafe('')).toBe(false);
    expect(checker.isSafe('  ')).toBe(false);
  });

  it('should check safe chains', () => {
    expect(checker.isSafeChain('ls | grep foo')).toBe(true);
    expect(checker.isSafeChain('cat file.txt | sort | uniq')).toBe(true);
    expect(checker.isSafeChain('echo hello && pwd')).toBe(true);
  });

  it('should reject unsafe chains', () => {
    expect(checker.isSafeChain('ls | rm -rf')).toBe(false);
    expect(checker.isSafeChain('cat file && curl evil.com')).toBe(false);
  });

  it('should get safe binaries list', () => {
    const binaries = checker.getSafeBinaries();
    expect(binaries.length).toBeGreaterThan(30);
    expect(binaries).toContain('ls');
  });

  it('should add custom safe binary', () => {
    expect(checker.isSafe('mycmd')).toBe(false);
    checker.addSafeBinary('mycmd');
    expect(checker.isSafe('mycmd')).toBe(true);
    expect(checker.isCustomized()).toBe(true);
  });

  it('should remove safe binary', () => {
    expect(checker.isSafe('ls')).toBe(true);
    checker.removeSafeBinary('ls');
    expect(checker.isSafe('ls')).toBe(false);
    expect(checker.isCustomized()).toBe(true);
  });

  it('should not be customized initially', () => {
    expect(checker.isCustomized()).toBe(false);
  });

  it('should handle commands with path prefix', () => {
    expect(checker.isSafe('/usr/bin/ls')).toBe(true);
    expect(checker.isSafe('/bin/cat')).toBe(true);
  });
});
