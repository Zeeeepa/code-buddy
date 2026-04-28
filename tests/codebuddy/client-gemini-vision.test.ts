import { GeminiNativeProvider } from '../../src/codebuddy/providers/provider-gemini-native.js';

// Vague 2 Phase B: convertContentToGeminiParts and parseDataUrl moved out
// of CodeBuddyClient into GeminiNativeProvider. These tests now exercise
// them via the provider directly.
describe('Gemini Vision - convertContentToGeminiParts', () => {
  let provider: GeminiNativeProvider;

  beforeEach(() => {
    provider = new GeminiNativeProvider({
      apiKey: 'test-key',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      model: 'gemini-2.5-flash',
      defaultMaxTokens: 8192,
      geminiRequestTimeoutMs: 60000,
    });
  });

  // Access private methods for testing (pre-existing pattern preserved)
  const callConvert = (p: GeminiNativeProvider, content: unknown) =>
    (p as unknown as { convertContentToGeminiParts: (c: unknown) => unknown[] }).convertContentToGeminiParts(content);

  const callParseDataUrl = (p: GeminiNativeProvider, url: string) =>
    (p as unknown as { parseDataUrl: (u: string) => { mimeType: string; data: string } }).parseDataUrl(url);

  it('should convert string content to text part', () => {
    const result = callConvert(provider, 'Hello world');
    expect(result).toEqual([{ text: 'Hello world' }]);
  });

  it('should convert null content to empty text part', () => {
    const result = callConvert(provider, null);
    expect(result).toEqual([{ text: '' }]);
  });

  it('should convert undefined content to empty text part', () => {
    const result = callConvert(provider, undefined);
    expect(result).toEqual([{ text: '' }]);
  });

  it('should convert text-only MessageContentPart array', () => {
    const content = [{ type: 'text', text: 'Describe this image' }];
    const result = callConvert(provider, content);
    expect(result).toEqual([{ text: 'Describe this image' }]);
  });

  it('should convert image_url data URL to inlineData', () => {
    const content = [
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' },
      },
    ];
    const result = callConvert(provider, content);
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
    const result = callConvert(provider, content);
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
    const result = callConvert(provider, content);
    expect(result).toEqual([
      { inlineData: { mimeType: 'image/png', data: 'https://example.com/image.png' } },
    ]);
  });

  describe('parseDataUrl', () => {
    it('should parse a valid data URL', () => {
      const result = callParseDataUrl(provider, 'data:image/webp;base64,UklGR...');
      expect(result).toEqual({ mimeType: 'image/webp', data: 'UklGR...' });
    });

    it('should fallback for non-data URLs', () => {
      const result = callParseDataUrl(provider, 'https://example.com/img.jpg');
      expect(result).toEqual({ mimeType: 'image/png', data: 'https://example.com/img.jpg' });
    });
  });
});
