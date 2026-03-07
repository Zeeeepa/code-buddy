
import { handleMemory, handleRemember } from '../../src/commands/handlers/memory-handlers.js';
import { getEnhancedMemory, getMemoryManager } from '../../src/memory/index.js';

// Mock getEnhancedMemory and getMemoryManager
vi.mock('../../src/memory/index.js', () => {
  const mockEnhancedMemory = {
    store: vi.fn().mockResolvedValue({ id: '1' }),
    recall: vi.fn().mockResolvedValue([]),
    forget: vi.fn().mockResolvedValue(true),
    formatStatus: vi.fn().mockReturnValue('Memory Status OK'),
    buildContext: vi.fn().mockResolvedValue('Memory Context'),
    isEnabled: vi.fn().mockReturnValue(true),
  };
  const mockPersistentMemory = {
    remember: vi.fn().mockResolvedValue(undefined),
    recall: vi.fn().mockReturnValue(null),
    forget: vi.fn().mockResolvedValue(false),
    formatMemories: vi.fn().mockReturnValue('Persistent Memory Status OK'),
    getContextForPrompt: vi.fn().mockReturnValue('Persistent Context'),
  };
  return {
    getEnhancedMemory: vi.fn().mockReturnValue(mockEnhancedMemory),
    getMemoryManager: vi.fn().mockReturnValue(mockPersistentMemory),
    EnhancedMemory: vi.fn(),
  };
});

vi.mock('../../src/tools/comment-watcher.js', () => ({
  getCommentWatcher: vi.fn(),
}));

vi.mock('../../src/errors/index.js', () => ({
  getErrorMessage: vi.fn((e: unknown) => e instanceof Error ? e.message : String(e)),
}));

describe('Memory Commands', () => {
  let mockEnhancedMem: any;
  let mockPersistentMem: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnhancedMem = getEnhancedMemory();
    mockPersistentMem = getMemoryManager();
  });

  describe('handleMemory', () => {
    it('should show list/status by default', async () => {
      const result = await handleMemory([]);
      expect(result.handled).toBe(true);
      // The handler now uses persistentMemory.formatMemories() for list/status
      expect(result.entry?.content).toContain('Persistent Memory Status OK');
      expect(mockPersistentMem.formatMemories).toHaveBeenCalled();
    });

    it('should handle store/remember command', async () => {
      const result = await handleMemory(['store', 'key', 'value']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Remembered');
      // Both persistent and enhanced memory are called
      expect(mockPersistentMem.remember).toHaveBeenCalled();
      expect(mockEnhancedMem.store).toHaveBeenCalled();
    });

    it('should handle recall command with results', async () => {
      mockEnhancedMem.recall.mockResolvedValueOnce([
        { type: 'fact', content: 'test content', importance: 0.8, createdAt: new Date() }
      ]);
      const result = await handleMemory(['recall', 'query']);
      expect(result.handled).toBe(true);
      // The handler shows results from enhanced memory as "Enhanced Memory (Semantic)"
      expect(result.entry?.content).toContain('Enhanced Memory');
      expect(mockEnhancedMem.recall).toHaveBeenCalledWith(expect.objectContaining({
        query: 'query'
      }));
    });

    it('should handle recall command with no results', async () => {
        mockEnhancedMem.recall.mockResolvedValueOnce([]);
        mockPersistentMem.recall.mockReturnValue(null);
        const result = await handleMemory(['recall', 'query']);
        expect(result.handled).toBe(true);
        expect(result.entry?.content).toContain('No matching memories found');
    });

    it('should handle context command', async () => {
      const result = await handleMemory(['context']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Current Context Injection');
      expect(mockEnhancedMem.buildContext).toHaveBeenCalled();
      expect(mockPersistentMem.getContextForPrompt).toHaveBeenCalled();
    });

    it('should handle forget command', async () => {
      // The new implementation uses persistentMemory.forget first, then falls back to enhanced
      mockPersistentMem.forget.mockResolvedValue(true);
      const result = await handleMemory(['forget', 'tag']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Forgot');
      expect(mockPersistentMem.forget).toHaveBeenCalledWith('tag', 'project');
    });

    it('should handle forget via enhanced memory fallback', async () => {
      mockPersistentMem.forget.mockResolvedValue(false);
      mockEnhancedMem.recall.mockResolvedValueOnce([
        { id: '2', content: 'api key for service', tags: [] },
      ]);
      mockEnhancedMem.forget.mockResolvedValue(true);

      const result = await handleMemory(['forget', 'api']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Forgot');
      expect(mockEnhancedMem.forget).toHaveBeenCalledWith('2');
    });

    it('should show usage for forget without args', async () => {
      const result = await handleMemory(['forget']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Usage:');
      expect(result.entry?.content).toContain('forget');
    });
  });

  describe('handleRemember', () => {
     it('should handle shortcut', async () => {
       const result = await handleRemember(['key', 'value']);
       expect(result.handled).toBe(true);
       // handleRemember calls both persistentMemory.remember and enhancedMemory.store
       expect(mockPersistentMem.remember).toHaveBeenCalled();
       expect(mockEnhancedMem.store).toHaveBeenCalled();
     });

     it('should show usage if args missing', async () => {
       const result = await handleRemember(['key']);
       expect(result.handled).toBe(true);
       expect(result.entry?.content).toContain('Usage:');
     });
  });
});
