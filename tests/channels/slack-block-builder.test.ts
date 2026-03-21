/**
 * Tests for Slack Block Kit Builder
 *
 * Phase 4: Block Kit builder, passthrough, auto-format
 */

import { describe, it, expect } from 'vitest';
import { SlackBlockBuilder, formatResponseAsBlocks } from '../../src/channels/slack/block-builder.js';

describe('SlackBlockBuilder', () => {
  it('should build empty blocks array', () => {
    const builder = new SlackBlockBuilder();
    expect(builder.build()).toEqual([]);
  });

  it('should add header block', () => {
    const blocks = new SlackBlockBuilder()
      .header('Welcome')
      .build();

    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('header');
    expect((blocks[0] as any).text.type).toBe('plain_text');
    expect((blocks[0] as any).text.text).toBe('Welcome');
  });

  it('should add section block with mrkdwn', () => {
    const blocks = new SlackBlockBuilder()
      .section('*Bold* and _italic_')
      .build();

    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('section');
    expect((blocks[0] as any).text.type).toBe('mrkdwn');
    expect((blocks[0] as any).text.text).toBe('*Bold* and _italic_');
  });

  it('should add section with fields', () => {
    const blocks = new SlackBlockBuilder()
      .sectionFields(['*Field 1*\nValue 1', '*Field 2*\nValue 2'])
      .build();

    expect(blocks.length).toBe(1);
    expect((blocks[0] as any).fields.length).toBe(2);
  });

  it('should add divider', () => {
    const blocks = new SlackBlockBuilder()
      .divider()
      .build();

    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('divider');
  });

  it('should add context block', () => {
    const blocks = new SlackBlockBuilder()
      .context(['Last updated: today', { type: 'mrkdwn', text: '*by* bot' }])
      .build();

    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('context');
    const elements = (blocks[0] as any).elements;
    expect(elements.length).toBe(2);
    expect(elements[0].type).toBe('mrkdwn');
    expect(elements[0].text).toBe('Last updated: today');
  });

  it('should add actions block', () => {
    const blocks = new SlackBlockBuilder()
      .actions([
        {
          type: 'button',
          action_id: 'approve',
          text: { type: 'plain_text', text: 'Approve' },
          style: 'primary',
        },
      ])
      .build();

    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('actions');
    expect((blocks[0] as any).elements.length).toBe(1);
  });

  it('should add image block', () => {
    const blocks = new SlackBlockBuilder()
      .image('https://example.com/img.png', 'Example image')
      .build();

    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('image');
    expect((blocks[0] as any).image_url).toBe('https://example.com/img.png');
  });

  it('should chain multiple blocks', () => {
    const blocks = new SlackBlockBuilder()
      .header('Report')
      .divider()
      .section('Some content here')
      .context(['Footer text'])
      .build();

    expect(blocks.length).toBe(4);
    expect(blocks.map(b => b.type)).toEqual(['header', 'divider', 'section', 'context']);
  });

  it('should truncate header text to 150 chars', () => {
    const longText = 'A'.repeat(200);
    const blocks = new SlackBlockBuilder()
      .header(longText)
      .build();

    expect((blocks[0] as any).text.text.length).toBe(150);
  });

  it('build() should return a copy', () => {
    const builder = new SlackBlockBuilder().section('test');
    const blocks1 = builder.build();
    const blocks2 = builder.build();
    expect(blocks1).not.toBe(blocks2);
    expect(blocks1).toEqual(blocks2);
  });
});

describe('formatResponseAsBlocks', () => {
  it('should convert headings to header blocks', () => {
    const blocks = formatResponseAsBlocks('# My Title');
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('header');
    expect((blocks[0] as any).text.text).toBe('My Title');
  });

  it('should convert --- to divider', () => {
    const blocks = formatResponseAsBlocks('Text above\n---\nText below');
    expect(blocks.length).toBe(3);
    expect(blocks[0].type).toBe('section');
    expect(blocks[1].type).toBe('divider');
    expect(blocks[2].type).toBe('section');
  });

  it('should wrap code blocks in sections', () => {
    const content = '```js\nconsole.log("hi")\n```';
    const blocks = formatResponseAsBlocks(content);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('section');
    expect((blocks[0] as any).text.text).toContain('console.log');
  });

  it('should handle mixed content', () => {
    const content = [
      '# Status Report',
      '',
      'Everything is working.',
      '',
      '---',
      '',
      '## Details',
      '',
      '```',
      'OK: 42 tests passed',
      '```',
    ].join('\n');

    const blocks = formatResponseAsBlocks(content);
    const types = blocks.map(b => b.type);

    expect(types).toContain('header');
    expect(types).toContain('divider');
    expect(types).toContain('section');
  });

  it('should handle empty content', () => {
    const blocks = formatResponseAsBlocks('');
    expect(blocks).toEqual([]);
  });

  it('should handle plain text', () => {
    const blocks = formatResponseAsBlocks('Just some text.');
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe('section');
  });
});
