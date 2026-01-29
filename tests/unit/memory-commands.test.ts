
import { handleMemory, handleRemember } from '../../src/commands/handlers/memory-handlers.js';
import { getEnhancedMemory } from '../../src/memory/index.js';

// Mock getEnhancedMemory
jest.mock('../../src/memory/index.js', () => {
  const mockMemory = {
    store: jest.fn().mockResolvedValue({ id: '1' }),
    recall: jest.fn().mockResolvedValue([]),
    forget: jest.fn().mockResolvedValue(true),
    formatStatus: jest.fn().mockReturnValue('Memory Status OK'),
    buildContext: jest.fn().mockResolvedValue('Memory Context'),
    isEnabled: jest.fn().mockReturnValue(true),
  };
  return {
    getEnhancedMemory: jest.fn().mockReturnValue(mockMemory),
    EnhancedMemory: jest.fn(),
  };
});

jest.mock('../../src/tools/comment-watcher.js', () => ({
  getCommentWatcher: jest.fn(),
}));

describe('Memory Commands', () => {
  let mockMemory: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockMemory = getEnhancedMemory();
  });

  describe('handleMemory', () => {
    it('should show list/status by default', async () => {
      const result = await handleMemory([]);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Memory Status OK');
      expect(mockMemory.formatStatus).toHaveBeenCalled();
    });

    it('should handle store/remember command', async () => {
      const result = await handleMemory(['store', 'key', 'value']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('✅ Remembered');
      expect(mockMemory.store).toHaveBeenCalledWith(expect.objectContaining({
        content: 'value',
        tags: ['key']
      }));
    });

    it('should handle recall command with results', async () => {
      mockMemory.recall.mockResolvedValueOnce([
        { type: 'fact', content: 'test content', importance: 0.8, createdAt: new Date() }
      ]);
      const result = await handleMemory(['recall', 'query']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Recall Results');
      expect(mockMemory.recall).toHaveBeenCalledWith(expect.objectContaining({
        query: 'query'
      }));
    });

    it('should handle recall command with no results', async () => {
        mockMemory.recall.mockResolvedValueOnce([]);
        const result = await handleMemory(['recall', 'query']);
        expect(result.handled).toBe(true);
        expect(result.entry?.content).toContain('No matching memories found');
    });

    it('should handle context command', async () => {
      const result = await handleMemory(['context']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Current Context Injection');
      expect(mockMemory.buildContext).toHaveBeenCalled();
    });
    
    it('should handle forget command with exact tag match', async () => {
      mockMemory.recall.mockResolvedValue([{ id: '1', content: 'test', tags: ['tag'] }]);
      const result = await handleMemory(['forget', 'tag']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Forgot 1');
      expect(mockMemory.forget).toHaveBeenCalledWith('1');
    });

    it('should handle forget command with fuzzy content match', async () => {
      // Reset mock for this specific test
      mockMemory.recall.mockReset();
      mockMemory.forget.mockReset();

      // First call: tags search returns empty (no exact tag match)
      // Second call: query search returns memories that match content
      mockMemory.recall
        .mockResolvedValueOnce([]) // No tag match for 'api key'
        .mockResolvedValueOnce([
          { id: '2', content: 'api key for service', tags: [] },
          { id: '3', content: 'another api key', tags: [] }
        ]);
      mockMemory.forget.mockResolvedValue(true);

      // Args are passed as separate strings, then joined with space
      const result = await handleMemory(['forget', 'api', 'key']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Forgot 2');
      expect(mockMemory.forget).toHaveBeenCalledTimes(2);
    });

    it('should handle forget last command', async () => {
      // Reset mock for this specific test
      mockMemory.recall.mockReset();
      mockMemory.forget.mockReset();

      // Recall returns memories unsorted - the handler will sort them by createdAt (descending)
      mockMemory.recall.mockResolvedValueOnce([
        { id: '1', content: 'oldest', createdAt: '2024-01-01T00:00:00Z' },
        { id: '2', content: 'middle', createdAt: '2024-01-02T00:00:00Z' },
        { id: '3', content: 'newest', createdAt: '2024-01-03T00:00:00Z' },
      ]);
      mockMemory.forget.mockResolvedValue(true);

      const result = await handleMemory(['forget', 'last']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Forgot 1 most recent memory');
      // Should forget the newest one (id: '3')
      expect(mockMemory.forget).toHaveBeenCalledWith('3');
    });

    it('should handle forget last N command', async () => {
      // Reset mock for this specific test
      mockMemory.recall.mockReset();
      mockMemory.forget.mockReset();

      mockMemory.recall.mockResolvedValueOnce([
        { id: '1', content: 'oldest', createdAt: '2024-01-01T00:00:00Z' },
        { id: '2', content: 'middle', createdAt: '2024-01-02T00:00:00Z' },
        { id: '3', content: 'newest', createdAt: '2024-01-03T00:00:00Z' },
      ]);
      mockMemory.forget.mockResolvedValue(true);

      const result = await handleMemory(['forget', 'last', '2']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Forgot 2 most recent memories');
      expect(mockMemory.forget).toHaveBeenCalledTimes(2);
      // Should forget newest first (id: '3'), then second newest (id: '2')
      expect(mockMemory.forget).toHaveBeenCalledWith('3');
      expect(mockMemory.forget).toHaveBeenCalledWith('2');
    });

    it('should show preview for many matches', async () => {
      // Reset mock for this specific test
      mockMemory.recall.mockReset();
      mockMemory.forget.mockReset();

      const manyMemories = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        content: `memory ${i} about testing things`,
        tags: ['testing']  // tag matches the search term
      }));
      mockMemory.recall
        .mockResolvedValueOnce([]) // No exact tag match (exact tag would be 'testing' but we use tags:[searchTerm])
        .mockResolvedValueOnce(manyMemories);
      mockMemory.forget.mockResolvedValue(true);

      const result = await handleMemory(['forget', 'testing']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Found 10 memories');
      expect(result.entry?.content).toContain('forget-confirm');
      // Should not have forgotten anything yet
      expect(mockMemory.forget).not.toHaveBeenCalled();
    });

    it('should handle forget-confirm command', async () => {
      // Reset mock for this specific test
      mockMemory.recall.mockReset();
      mockMemory.forget.mockReset();

      const manyMemories = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        content: `memory ${i} about testing things`,
        tags: ['testing']  // tag matches the search term
      }));
      mockMemory.recall
        .mockResolvedValueOnce([]) // No exact tag match
        .mockResolvedValueOnce(manyMemories);
      mockMemory.forget.mockResolvedValue(true);

      const result = await handleMemory(['forget-confirm', 'testing']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Forgot 10');
      expect(mockMemory.forget).toHaveBeenCalledTimes(10);
    });

    it('should show usage for forget without args', async () => {
      const result = await handleMemory(['forget']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Usage:');
      expect(result.entry?.content).toContain('forget last');
    });
  });

  describe('handleRemember', () => {
     it('should handle shortcut', async () => {
       const result = await handleRemember(['key', 'value']);
       expect(result.handled).toBe(true);
       expect(mockMemory.store).toHaveBeenCalled();
     });
     
     it('should show usage if args missing', async () => {
       const result = await handleRemember(['key']);
       expect(result.handled).toBe(true);
       expect(result.entry?.content).toContain('Usage:');
     });
  });
});
