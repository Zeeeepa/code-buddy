import axios from 'axios';
import { ToolResult, getErrorMessage } from '../types/index.js';
import { logger } from '../utils/logger.js';

export interface WebSearchOptions {
  maxResults?: number;
  safeSearch?: boolean;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Serper API response types
 */
interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position?: number;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
  answerBox?: {
    title?: string;
    answer?: string;
    snippet?: string;
  };
  knowledgeGraph?: {
    title?: string;
    description?: string;
  };
}

/**
 * Web Search Tool using Serper API (Google Search) with DuckDuckGo fallback
 *
 * Set SERPER_API_KEY environment variable to enable Serper
 */
export class WebSearchTool {
  private cache: Map<string, { results: SearchResult[]; timestamp: number }> = new Map();
  private cacheTTL = 15 * 60 * 1000; // 15 minutes cache
  private serperApiKey: string | undefined;

  constructor() {
    this.serperApiKey = process.env.SERPER_API_KEY;
    if (this.serperApiKey) {
      logger.debug('Serper API key configured for web search');
    }
  }

  /**
   * Search the web using Serper API (Google) or DuckDuckGo fallback
   */
  async search(query: string, options: WebSearchOptions = {}): Promise<ToolResult> {
    const { maxResults = 5 } = options;

    try {
      // Check cache first
      const cacheKey = `${query}-${maxResults}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return {
          success: true,
          output: this.formatResults(cached.results, query)
        };
      }

      let results: SearchResult[];

      // Use Serper API if key is available
      if (this.serperApiKey) {
        results = await this.searchSerper(query, maxResults);
      } else {
        // Fallback to DuckDuckGo
        results = await this.searchDuckDuckGo(query, maxResults);
      }

      if (results.length === 0) {
        return {
          success: true,
          output: `No results found for: "${query}"`
        };
      }

      // Cache results
      this.cache.set(cacheKey, { results, timestamp: Date.now() });

      return {
        success: true,
        output: this.formatResults(results, query)
      };
    } catch (error) {
      return {
        success: false,
        error: `Web search failed: ${getErrorMessage(error)}`
      };
    }
  }

  /**
   * Search using Serper API (Google Search)
   */
  private async searchSerper(query: string, maxResults: number): Promise<SearchResult[]> {
    const response = await axios.post<SerperResponse>(
      'https://google.serper.dev/search',
      {
        q: query,
        num: maxResults,
      },
      {
        headers: {
          'X-API-KEY': this.serperApiKey!,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const results: SearchResult[] = [];

    // Add answer box if present
    if (response.data.answerBox?.answer) {
      results.push({
        title: response.data.answerBox.title || 'Answer',
        url: '',
        snippet: response.data.answerBox.answer,
      });
    }

    // Add knowledge graph if present
    if (response.data.knowledgeGraph?.description) {
      results.push({
        title: response.data.knowledgeGraph.title || 'Knowledge',
        url: '',
        snippet: response.data.knowledgeGraph.description,
      });
    }

    // Add organic results
    if (response.data.organic) {
      for (const result of response.data.organic.slice(0, maxResults)) {
        results.push({
          title: result.title,
          url: result.link,
          snippet: result.snippet,
        });
      }
    }

    logger.debug('Serper search completed', {
      query,
      resultCount: results.length,
    });

    return results;
  }

  /**
   * Fetch and summarize a web page
   */
  async fetchPage(url: string, _prompt?: string): Promise<ToolResult> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CodeBuddyCLI/1.0; +https://github.com/code-buddy)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 10000,
        maxRedirects: 5
      });

      const html = response.data;
      const text = this.extractTextFromHtml(html);

      // Truncate if too long
      const maxLength = 8000;
      const truncatedText = text.length > maxLength
        ? text.substring(0, maxLength) + '\n\n[Content truncated...]'
        : text;

      return {
        success: true,
        output: `Content from ${url}:\n\n${truncatedText}`,
        data: { url, contentLength: text.length }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch page: ${getErrorMessage(error)}`
      };
    }
  }

  /**
   * Search using DuckDuckGo HTML
   */
  private async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000
    });

    const html = response.data;
    const results: SearchResult[] = [];

    // Parse DuckDuckGo HTML results
    // Looking for result divs with class "result"
    const resultRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    const titleRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/i;
    const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i;

    let match;
    while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
      const resultHtml = match[1];

      const titleMatch = titleRegex.exec(resultHtml);
      const snippetMatch = snippetRegex.exec(resultHtml);

      if (titleMatch) {
        let url = titleMatch[1];
        // DuckDuckGo wraps URLs, need to extract actual URL
        if (url.includes('uddg=')) {
          const uddgMatch = url.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
          }
        }

        results.push({
          title: this.decodeHtmlEntities(titleMatch[2].trim()),
          url: url,
          snippet: snippetMatch
            ? this.decodeHtmlEntities(this.stripHtml(snippetMatch[1]).trim())
            : ''
        });
      }
    }

    // Fallback: try alternative parsing if no results
    if (results.length === 0) {
      const linkRegex = /<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
      while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
        let url = match[1];
        if (url.includes('uddg=')) {
          const uddgMatch = url.match(/uddg=([^&]+)/);
          if (uddgMatch) {
            url = decodeURIComponent(uddgMatch[1]);
          }
        }
        results.push({
          title: this.decodeHtmlEntities(match[2].trim()) || url,
          url: url,
          snippet: ''
        });
      }
    }

    return results;
  }

  /**
   * Detect if query is weather-related
   */
  private isWeatherQuery(query: string): boolean {
    const weatherKeywords = ['météo', 'meteo', 'weather', 'température', 'temperature', 'forecast', 'prévisions'];
    const q = query.toLowerCase();
    return weatherKeywords.some(kw => q.includes(kw));
  }

  /**
   * Get weather emoji based on condition
   */
  private getWeatherEmoji(text: string): string {
    const t = text.toLowerCase();
    if (t.includes('soleil') || t.includes('sunny') || t.includes('ensoleillé')) return '☀️';
    if (t.includes('pluie') || t.includes('rain') || t.includes('averse')) return '🌧️';
    if (t.includes('nuage') || t.includes('cloud') || t.includes('couvert')) return '☁️';
    if (t.includes('neige') || t.includes('snow')) return '❄️';
    if (t.includes('orage') || t.includes('thunder') || t.includes('storm')) return '⛈️';
    if (t.includes('brouillard') || t.includes('fog')) return '🌫️';
    if (t.includes('vent') || t.includes('wind')) return '💨';
    if (t.includes('éclaircies') || t.includes('partly')) return '⛅';
    return '🌡️';
  }

  /**
   * Format weather results nicely
   */
  private formatWeatherResults(results: SearchResult[], query: string): string {
    const lines: string[] = [];

    // Header with location
    const location = query.replace(/météo|meteo|weather/gi, '').trim();
    lines.push(`\n🌍 Météo ${location || 'actuelle'}`);
    lines.push('═'.repeat(40));
    lines.push('');

    // Extract and format weather info
    for (const result of results.slice(0, 4)) {
      const emoji = this.getWeatherEmoji(result.snippet);

      if (!result.url && result.snippet) {
        // Answer box (quick answer)
        lines.push(`${emoji} ${result.title}: ${result.snippet}`);
        lines.push('');
      } else if (result.url) {
        // Regular result
        lines.push(`${emoji} **${result.title}**`);
        if (result.snippet) {
          // Clean and format snippet
          const cleanSnippet = result.snippet
            .replace(/·/g, '|')
            .replace(/\s+/g, ' ')
            .trim();
          lines.push(`   ${cleanSnippet}`);
        }
        lines.push(`   🔗 ${result.url}`);
        lines.push('');
      }
    }

    lines.push('─'.repeat(40));
    return lines.join('\n');
  }

  /**
   * Format search results for display
   */
  private formatResults(results: SearchResult[], query: string): string {
    // Use special formatting for weather queries
    if (this.isWeatherQuery(query)) {
      return this.formatWeatherResults(results, query);
    }

    // Standard formatting for other queries
    const lines: string[] = [];
    lines.push(`\n🔍 Résultats pour: "${query}"`);
    lines.push('═'.repeat(50));
    lines.push('');

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const num = `${i + 1}.`;

      if (!result.url && result.snippet) {
        // Answer box
        lines.push(`📌 ${result.title}`);
        lines.push(`   ${result.snippet}`);
      } else {
        lines.push(`${num} **${result.title}**`);
        if (result.snippet) {
          lines.push(`   ${result.snippet}`);
        }
        if (result.url) {
          lines.push(`   🔗 ${result.url}`);
        }
      }
      lines.push('');
    }

    lines.push('─'.repeat(50));
    return lines.join('\n');
  }

  /**
   * Extract readable text from HTML
   */
  private extractTextFromHtml(html: string): string {
    // Remove script and style tags
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');

    // Convert common elements to newlines
    text = text
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ');

    // Strip remaining HTML tags
    text = this.stripHtml(text);

    // Decode HTML entities
    text = this.decodeHtmlEntities(text);

    // Clean up whitespace
    text = text
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    return text;
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&ndash;': '–',
      '&mdash;': '—',
      '&hellip;': '…',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™',
    };

    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.replace(new RegExp(entity, 'gi'), char);
    }

    // Handle numeric entities
    result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
    result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

    return result;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
