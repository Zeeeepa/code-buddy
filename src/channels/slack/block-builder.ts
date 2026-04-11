/**
 * Slack Block Kit Builder
 *
 * Native Engine v2026.3.12 alignment: fluent API for building Block Kit messages.
 * Supports `channelData.slack.blocks` passthrough and markdown auto-formatting.
 */

import type {
  SlackBlock,
  SlackSectionBlock,
  SlackDividerBlock,
  SlackHeaderBlock,
  SlackContextBlock,
  SlackActionsBlock,
  SlackImageBlock,
  SlackTextObject,
  SlackBlockElement,
} from './types.js';

/**
 * Fluent builder for Slack Block Kit messages
 */
export class SlackBlockBuilder {
  private blocks: SlackBlock[] = [];

  /**
   * Add a header block
   */
  header(text: string): this {
    this.blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: text.slice(0, 150), emoji: true },
    } as SlackHeaderBlock);
    return this;
  }

  /**
   * Add a section block with mrkdwn text
   */
  section(text: string, blockId?: string): this {
    const block: SlackSectionBlock = {
      type: 'section',
      text: { type: 'mrkdwn', text },
    };
    if (blockId) block.block_id = blockId;
    this.blocks.push(block);
    return this;
  }

  /**
   * Add a section block with fields (2-column layout)
   */
  sectionFields(fields: string[], blockId?: string): this {
    const block: SlackSectionBlock = {
      type: 'section',
      fields: fields.map(f => ({ type: 'mrkdwn', text: f })),
    };
    if (blockId) block.block_id = blockId;
    this.blocks.push(block);
    return this;
  }

  /**
   * Add a section with an accessory element
   */
  sectionWithAccessory(text: string, accessory: SlackBlockElement): this {
    this.blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text },
      accessory,
    } as SlackSectionBlock);
    return this;
  }

  /**
   * Add a divider block
   */
  divider(): this {
    this.blocks.push({ type: 'divider' } as SlackDividerBlock);
    return this;
  }

  /**
   * Add a context block (small text / images)
   */
  context(elements: (string | SlackTextObject)[]): this {
    this.blocks.push({
      type: 'context',
      elements: elements.map(el =>
        typeof el === 'string' ? { type: 'mrkdwn', text: el } : el
      ),
    } as SlackContextBlock);
    return this;
  }

  /**
   * Add an actions block with interactive elements
   */
  actions(elements: SlackBlockElement[], blockId?: string): this {
    const block: SlackActionsBlock = {
      type: 'actions',
      elements,
    };
    if (blockId) block.block_id = blockId;
    this.blocks.push(block);
    return this;
  }

  /**
   * Add an image block
   */
  image(imageUrl: string, altText: string, blockId?: string): this {
    const block: SlackImageBlock = {
      type: 'image',
      image_url: imageUrl,
      alt_text: altText,
    };
    if (blockId) block.block_id = blockId;
    this.blocks.push(block);
    return this;
  }

  /**
   * Build and return the blocks array
   */
  build(): SlackBlock[] {
    return [...this.blocks];
  }
}

/**
 * Auto-format markdown content as Slack Block Kit blocks
 *
 * Converts common markdown patterns:
 * - `# heading` → header block
 * - `---` → divider block
 * - ```` ```code``` ```` → section with mrkdwn
 * - Regular text → section block
 */
export function formatResponseAsBlocks(content: string): SlackBlock[] {
  const builder = new SlackBlockBuilder();
  const lines = content.split('\n');
  let buffer = '';
  let inCodeBlock = false;

  function flushBuffer(): void {
    const text = buffer.trim();
    if (text) {
      builder.section(text);
    }
    buffer = '';
  }

  for (const line of lines) {
    // Toggle code block
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        buffer += line + '\n';
        // End of code block — flush as single section
        flushBuffer();
        inCodeBlock = false;
      } else {
        // Start of code block — flush any preceding text
        flushBuffer();
        inCodeBlock = true;
        buffer += line + '\n';
      }
      continue;
    }

    if (inCodeBlock) {
      buffer += line + '\n';
      continue;
    }

    // Heading → header block
    if (/^#{1,3}\s+/.test(line)) {
      flushBuffer();
      const headingText = line.replace(/^#{1,3}\s+/, '');
      builder.header(headingText);
      continue;
    }

    // Horizontal rule → divider
    if (/^---+\s*$/.test(line)) {
      flushBuffer();
      builder.divider();
      continue;
    }

    // Accumulate regular text
    buffer += line + '\n';
  }

  // Flush remaining buffer
  flushBuffer();

  return builder.build();
}
