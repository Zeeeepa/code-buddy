/**
 * Browser Automation Stub Tool
 *
 * Provides browser automation capabilities as stubs for future
 * Playwright/Puppeteer integration. Tracks state internally
 * for testing and simulation purposes.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface BrowserStubConfig {
  headless?: boolean;
  timeout?: number;
  viewport?: { width: number; height: number };
}

export interface BrowserStubAction {
  type: string;
  selector?: string;
  value?: string;
  timestamp: number;
}

export interface BrowserStubTab {
  id: string;
  url: string;
  active: boolean;
}

// ============================================================================
// BrowserStubTool
// ============================================================================

export class BrowserStubTool {
  private static instance: BrowserStubTool | null = null;

  private launched = false;
  private config: BrowserStubConfig = {};
  private currentUrl = '';
  private actions: BrowserStubAction[] = [];
  private tabs: BrowserStubTab[] = [];
  private activeTabId = '';
  private consoleMessages: string[] = [];
  private tabCounter = 0;

  private constructor() {}

  static getInstance(): BrowserStubTool {
    if (!BrowserStubTool.instance) {
      BrowserStubTool.instance = new BrowserStubTool();
    }
    return BrowserStubTool.instance;
  }

  static resetInstance(): void {
    if (BrowserStubTool.instance) {
      BrowserStubTool.instance.close();
    }
    BrowserStubTool.instance = null;
  }

  launch(config?: BrowserStubConfig): void {
    if (this.launched) {
      logger.debug('Browser already launched');
      return;
    }
    this.config = config || {};
    this.launched = true;
    this.actions = [];
    this.consoleMessages = [];
    this.tabs = [];
    this.tabCounter = 0;

    // Create initial tab
    const tabId = this.generateTabId();
    this.tabs.push({ id: tabId, url: 'about:blank', active: true });
    this.activeTabId = tabId;

    logger.debug('Browser launched', { config: this.config });
  }

  navigate(url: string): void {
    this.ensureLaunched();
    this.currentUrl = url;
    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    if (activeTab) {
      activeTab.url = url;
    }
    this.recordAction('navigate', undefined, url);
    logger.debug('Navigated to', { url });
  }

  click(selector: string): void {
    this.ensureLaunched();
    this.recordAction('click', selector);
  }

  type(selector: string, text: string): void {
    this.ensureLaunched();
    this.recordAction('type', selector, text);
  }

  press(key: string): void {
    this.ensureLaunched();
    this.recordAction('press', undefined, key);
  }

  hover(selector: string): void {
    this.ensureLaunched();
    this.recordAction('hover', selector);
  }

  drag(from: string, to: string): void {
    this.ensureLaunched();
    this.recordAction('drag', from, to);
  }

  screenshot(path?: string): string {
    this.ensureLaunched();
    const screenshotPath = path || `/tmp/screenshot-${Date.now()}.png`;
    this.recordAction('screenshot', undefined, screenshotPath);
    return screenshotPath;
  }

  pdf(path?: string): string {
    this.ensureLaunched();
    const pdfPath = path || `/tmp/page-${Date.now()}.pdf`;
    this.recordAction('pdf', undefined, pdfPath);
    return pdfPath;
  }

  getConsole(): string[] {
    this.ensureLaunched();
    return [...this.consoleMessages];
  }

  getTabs(): BrowserStubTab[] {
    this.ensureLaunched();
    return this.tabs.map(t => ({ ...t }));
  }

  newTab(url?: string): BrowserStubTab {
    this.ensureLaunched();
    const tabId = this.generateTabId();
    const tabUrl = url || 'about:blank';

    // Deactivate current tab
    for (const tab of this.tabs) {
      tab.active = false;
    }

    const newTab: BrowserStubTab = { id: tabId, url: tabUrl, active: true };
    this.tabs.push(newTab);
    this.activeTabId = tabId;
    this.currentUrl = tabUrl;

    this.recordAction('newTab', undefined, tabUrl);
    return { ...newTab };
  }

  closeTab(tabId: string): void {
    this.ensureLaunched();
    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) {
      throw new Error(`Tab ${tabId} not found`);
    }
    this.tabs.splice(idx, 1);

    if (this.activeTabId === tabId && this.tabs.length > 0) {
      this.tabs[0].active = true;
      this.activeTabId = this.tabs[0].id;
      this.currentUrl = this.tabs[0].url;
    }

    this.recordAction('closeTab', undefined, tabId);
  }

  switchTab(tabId: string): void {
    this.ensureLaunched();
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} not found`);
    }

    for (const t of this.tabs) {
      t.active = false;
    }
    tab.active = true;
    this.activeTabId = tabId;
    this.currentUrl = tab.url;

    this.recordAction('switchTab', undefined, tabId);
  }

  evaluate(script: string): string {
    this.ensureLaunched();
    this.recordAction('evaluate', undefined, script);
    return `[eval result: ${script}]`;
  }

  getActions(): BrowserStubAction[] {
    return [...this.actions];
  }

  close(): void {
    this.launched = false;
    this.currentUrl = '';
    this.actions = [];
    this.tabs = [];
    this.activeTabId = '';
    this.consoleMessages = [];
    this.tabCounter = 0;
    logger.debug('Browser closed');
  }

  isLaunched(): boolean {
    return this.launched;
  }

  private ensureLaunched(): void {
    if (!this.launched) {
      throw new Error('Browser not launched. Call launch() first.');
    }
  }

  private recordAction(type: string, selector?: string, value?: string): void {
    this.actions.push({
      type,
      selector,
      value,
      timestamp: Date.now(),
    });
  }

  private generateTabId(): string {
    this.tabCounter++;
    return `tab-${this.tabCounter}`;
  }
}
