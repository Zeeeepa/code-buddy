import { CodeBuddyClient } from '../../src/codebuddy/client.js';

describe('Gemini Vision - convertContentToGeminiParts', () => {
  let client: CodeBuddyClient;

  beforeEach(() => {
    client = new CodeBuddyClient('test-key');
  });

  // Access private methods for testing
  const callConvert = (client: CodeBuddyClient, content: unknown) =>
    (client as unknown as { convertContentToGeminiParts: (c: unknown) => unknown[] }).convertContentToGeminiParts(content);

  const callParseDataUrl = (client: CodeBuddyClient, url: string) =>
    (client as unknown as { parseDataUrl: (u: string) => { mimeType: string; data: string } }).parseDataUrl(url);

  it('should convert string content to text part', () => {
    const result = callConvert(client, 'Hello world');
    expect(result).toEqual([{ text: 'Hello world' }]);
  });

  it('should convert null content to empty text part', () => {
    const result = callConvert(client, null);
    expect(result).toEqual([{ text: '' }]);
  });

  it('should convert undefined content to empty text part', () => {
    const result = callConvert(client, undefined);
    expect(result).toEqual([{ text: '' }]);
  });

  it('should convert text-only MessageContentPart array', () => {
    const content = [{ type: 'text', text: 'Describe this image' }];
    const result = callConvert(client, content);
    expect(result).toEqual([{ text: 'Describe this image' }]);
  });

  it('should convert image_url data URL to inlineData', () => {
    const content = [
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' },
      },
    ];
    const result = callConvert(client, content);
    expect(result).toEqual([
      { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUg==' } },
    ]);
  });

  it('should convert mixed text + image parts', () => {
    const content = [
      { type: 'text', text: 'What is in this image?' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/jpeg;base64,/9j/4AAQ==' },
      },
    ];
    const result = callConvert(client, content);
    expect(result).toEqual([
      { text: 'What is in this image?' },
      { inlineData: { mimeType: 'image/jpeg', data: '/9j/4AAQ==' } },
    ]);
  });

  it('should fallback to image/png for non-data URLs', () => {
    const content = [
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/image.png' },
      },
    ];
    const result = callConvert(client, content);
    expect(result).toEqual([
      { inlineData: { mimeType: 'image/png', data: 'https://example.com/image.png' } },
    ]);
  });

  describe('parseDataUrl', () => {
    it('should parse a valid data URL', () => {
      const result = callParseDataUrl(client, 'data:image/webp;base64,UklGR...');
      expect(result).toEqual({ mimeType: 'image/webp', data: 'UklGR...' });
    });

    it('should fallback for non-data URLs', () => {
      const result = callParseDataUrl(client, 'https://example.com/img.jpg');
      expect(result).toEqual({ mimeType: 'image/png', data: 'https://example.com/img.jpg' });
    });
  });
});
