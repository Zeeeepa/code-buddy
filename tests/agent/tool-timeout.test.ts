/**
 * Tests for tool timeout functionality
 */

import { ToolExecutor, GrokToolCall } from "../../src/agent/tool-executor";

// Mock all dependencies
jest.mock("../../src/tools/index.js", () => ({
  TextEditorTool: jest.fn().mockImplementation(() => ({
    view: jest.fn().mockResolvedValue({ success: true, output: "file content" }),
    create: jest.fn().mockResolvedValue({ success: true }),
    strReplace: jest.fn().mockResolvedValue({ success: true }),
  })),
  BashTool: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockImplementation(async () => {
      // Simulate a slow command
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { success: true, output: "command output" };
    }),
  })),
  SearchTool: jest.fn().mockImplementation(() => ({
    search: jest.fn().mockResolvedValue({ success: true, output: "search results" }),
  })),
  TodoTool: jest.fn().mockImplementation(() => ({
    createTodoList: jest.fn().mockResolvedValue({ success: true }),
    updateTodoList: jest.fn().mockResolvedValue({ success: true }),
  })),
  ImageTool: jest.fn().mockImplementation(() => ({
    processImage: jest.fn().mockResolvedValue({ success: true }),
  })),
  WebSearchTool: jest.fn().mockImplementation(() => ({
    search: jest.fn().mockResolvedValue({ success: true, output: "web results" }),
    fetchPage: jest.fn().mockResolvedValue({ success: true, output: "page content" }),
  })),
  MorphEditorTool: jest.fn().mockImplementation(() => ({
    editFile: jest.fn().mockResolvedValue({ success: true }),
  })),
}));

jest.mock("../../src/checkpoints/checkpoint-manager.js", () => ({
  CheckpointManager: jest.fn().mockImplementation(() => ({
    checkpointBeforeCreate: jest.fn(),
    checkpointBeforeEdit: jest.fn(),
  })),
}));

jest.mock("../../src/grok/tools.js", () => ({
  getMCPManager: jest.fn().mockReturnValue({
    callTool: jest.fn().mockResolvedValue({
      isError: false,
      content: [{ type: "text", text: "MCP result" }],
    }),
  }),
}));

// Mock settings manager to control timeouts
const mockGetToolTimeout = jest.fn();
jest.mock("../../src/utils/settings-manager.js", () => {
  const actual = jest.requireActual("../../src/utils/settings-manager.js");
  return {
    ...actual,
    getSettingsManager: jest.fn(() => ({
      getToolTimeout: mockGetToolTimeout,
      getToolTimeouts: jest.fn(() => ({
        default: 60000,
        bash: 300000,
        search: 30000,
        hardLimit: 600000,
      })),
      updateToolTimeouts: jest.fn(),
    })),
  };
});

import { TextEditorTool, BashTool, SearchTool, TodoTool, ImageTool, WebSearchTool, MorphEditorTool } from "../../src/tools/index.js";
import { CheckpointManager } from "../../src/checkpoints/checkpoint-manager.js";

describe("Tool Timeout Functionality", () => {
  let executor: ToolExecutor;
  let mockTextEditor: jest.Mocked<TextEditorTool>;
  let mockBash: jest.Mocked<BashTool>;
  let mockSearch: jest.Mocked<SearchTool>;
  let mockTodoTool: jest.Mocked<TodoTool>;
  let mockImageTool: jest.Mocked<ImageTool>;
  let mockWebSearch: jest.Mocked<WebSearchTool>;
  let mockCheckpointManager: jest.Mocked<CheckpointManager>;
  let mockMorphEditor: jest.Mocked<MorphEditorTool>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTextEditor = new TextEditorTool() as jest.Mocked<TextEditorTool>;
    mockBash = new BashTool() as jest.Mocked<BashTool>;
    mockSearch = new SearchTool() as jest.Mocked<SearchTool>;
    mockTodoTool = new TodoTool() as jest.Mocked<TodoTool>;
    mockImageTool = new ImageTool() as jest.Mocked<ImageTool>;
    mockWebSearch = new WebSearchTool() as jest.Mocked<WebSearchTool>;
    mockCheckpointManager = new CheckpointManager() as jest.Mocked<CheckpointManager>;
    mockMorphEditor = new MorphEditorTool() as jest.Mocked<MorphEditorTool>;

    executor = new ToolExecutor({
      textEditor: mockTextEditor,
      bash: mockBash,
      search: mockSearch,
      todoTool: mockTodoTool,
      imageTool: mockImageTool,
      webSearch: mockWebSearch,
      checkpointManager: mockCheckpointManager,
      morphEditor: mockMorphEditor,
    });

    // Reset mock to return default timeouts
    mockGetToolTimeout.mockImplementation((toolName: string) => {
      const defaults: Record<string, number> = {
        bash: 300000,
        search: 30000,
        view_file: 10000,
        default: 60000,
      };
      return defaults[toolName] || defaults.default;
    });
  });

  describe("Timeout Configuration", () => {
    it("should use configured timeout for tools", async () => {
      mockGetToolTimeout.mockReturnValue(10000); // 10 seconds

      const toolCall: GrokToolCall = {
        id: "call_timeout_1",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "/test/file.ts" }),
        },
      };

      await executor.execute(toolCall);

      expect(mockGetToolTimeout).toHaveBeenCalledWith("view_file");
    });

    it("should respect different timeouts for different tools", async () => {
      mockGetToolTimeout.mockImplementation((toolName: string) => {
        return toolName === "bash" ? 300000 : 10000;
      });

      const bashCall: GrokToolCall = {
        id: "call_bash",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "ls" }),
        },
      };

      const viewCall: GrokToolCall = {
        id: "call_view",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "/test/file.ts" }),
        },
      };

      await executor.execute(bashCall);
      expect(mockGetToolTimeout).toHaveBeenCalledWith("bash");

      await executor.execute(viewCall);
      expect(mockGetToolTimeout).toHaveBeenCalledWith("view_file");
    });
  });

  describe("Timeout Behavior", () => {
    it("should timeout long-running tool execution", async () => {
      // Mock a slow tool
      mockBash.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms delay
        return { success: true, output: "slow output" };
      });

      // Set very short timeout
      mockGetToolTimeout.mockReturnValue(50); // 50ms timeout

      const toolCall: GrokToolCall = {
        id: "call_timeout",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "sleep 10" }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
      expect(result.error).toContain("50ms");
    });

    it("should complete fast operations within timeout", async () => {
      // Mock a fast tool
      mockTextEditor.view.mockResolvedValue({ success: true, output: "quick content" });

      mockGetToolTimeout.mockReturnValue(10000); // 10 second timeout

      const toolCall: GrokToolCall = {
        id: "call_fast",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "/test/file.ts" }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(true);
      expect(result.output).toBe("quick content");
    });

    it("should provide meaningful error message on timeout", async () => {
      mockSearch.search.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { success: true, output: "results" };
      });

      mockGetToolTimeout.mockReturnValue(50);

      const toolCall: GrokToolCall = {
        id: "call_timeout_msg",
        type: "function",
        function: {
          name: "search",
          arguments: JSON.stringify({ query: "test" }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("search");
      expect(result.error).toContain("timed out");
      expect(result.error).toContain("50ms");
      expect(result.error).toContain("Consider increasing the timeout");
    });
  });

  describe("Timeout Metrics", () => {
    it("should track timeout count", async () => {
      mockBash.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { success: true, output: "output" };
      });

      mockGetToolTimeout.mockReturnValue(50);

      const toolCall: GrokToolCall = {
        id: "call_metrics_1",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "slow command" }),
        },
      };

      await executor.execute(toolCall);
      await executor.execute({ ...toolCall, id: "call_metrics_2" });

      const metrics = executor.getMetrics();
      expect(metrics.timeoutCount).toBe(2);
    });

    it("should track timeouts by tool", async () => {
      mockBash.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { success: true, output: "output" };
      });

      mockSearch.search.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { success: true, output: "output" };
      });

      mockGetToolTimeout.mockReturnValue(50);

      await executor.execute({
        id: "bash_1",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "cmd1" }),
        },
      });

      await executor.execute({
        id: "bash_2",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "cmd2" }),
        },
      });

      await executor.execute({
        id: "search_1",
        type: "function",
        function: {
          name: "search",
          arguments: JSON.stringify({ query: "test" }),
        },
      });

      const metrics = executor.getMetrics();
      expect(metrics.timeoutsByTool.get("bash")).toBe(2);
      expect(metrics.timeoutsByTool.get("search")).toBe(1);
    });

    it("should not count successful executions as timeouts", async () => {
      mockTextEditor.view.mockResolvedValue({ success: true, output: "content" });
      mockGetToolTimeout.mockReturnValue(10000);

      const toolCall: GrokToolCall = {
        id: "call_success",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "/test/file.ts" }),
        },
      };

      await executor.execute(toolCall);

      const metrics = executor.getMetrics();
      expect(metrics.timeoutCount).toBe(0);
      expect(metrics.successfulExecutions).toBe(1);
    });

    it("should reset timeout metrics", async () => {
      mockBash.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { success: true, output: "output" };
      });

      mockGetToolTimeout.mockReturnValue(50);

      await executor.execute({
        id: "call_reset",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "cmd" }),
        },
      });

      let metrics = executor.getMetrics();
      expect(metrics.timeoutCount).toBe(1);

      executor.resetMetrics();

      metrics = executor.getMetrics();
      expect(metrics.timeoutCount).toBe(0);
      expect(metrics.timeoutsByTool.size).toBe(0);
    });
  });

  describe("Execution Control", () => {
    it("should track active executions", async () => {
      mockBash.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true, output: "output" };
      });

      mockGetToolTimeout.mockReturnValue(10000);

      const promise = executor.execute({
        id: "call_active",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "cmd" }),
        },
      });

      // Check active count during execution
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(executor.getActiveExecutionCount()).toBeGreaterThan(0);

      await promise;

      // Should be cleared after execution
      expect(executor.getActiveExecutionCount()).toBe(0);
    });

    it("should abort specific execution", async () => {
      mockBash.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { success: true, output: "output" };
      });

      mockGetToolTimeout.mockReturnValue(10000);

      const promise = executor.execute({
        id: "call_abort",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "cmd" }),
        },
      });

      // Abort after a short delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      const aborted = executor.abortExecution("call_abort");

      expect(aborted).toBe(true);

      await promise;
      // Execution should have been interrupted
      expect(executor.getActiveExecutionCount()).toBe(0);
    });

    it("should abort all executions", async () => {
      mockBash.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return { success: true, output: "output" };
      });

      mockGetToolTimeout.mockReturnValue(10000);

      const promise1 = executor.execute({
        id: "call_abort_all_1",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "cmd1" }),
        },
      });

      const promise2 = executor.execute({
        id: "call_abort_all_2",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "cmd2" }),
        },
      });

      // Abort all after a short delay
      await new Promise((resolve) => setTimeout(resolve, 50));
      executor.abortAllExecutions();

      await Promise.all([promise1, promise2]);

      expect(executor.getActiveExecutionCount()).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle tool that throws error before timeout", async () => {
      mockBash.execute.mockRejectedValue(new Error("Tool error"));
      mockGetToolTimeout.mockReturnValue(10000);

      const toolCall: GrokToolCall = {
        id: "call_error",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "bad command" }),
        },
      };

      const result = await executor.execute(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Tool execution error");

      const metrics = executor.getMetrics();
      expect(metrics.timeoutCount).toBe(0); // Should not count as timeout
    });

    it("should clean up timeout on successful completion", async () => {
      mockTextEditor.view.mockResolvedValue({ success: true, output: "content" });
      mockGetToolTimeout.mockReturnValue(10000);

      const toolCall: GrokToolCall = {
        id: "call_cleanup",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "/test/file.ts" }),
        },
      };

      await executor.execute(toolCall);

      // Should have no active executions
      expect(executor.getActiveExecutionCount()).toBe(0);
    });

    it("should handle concurrent executions with different timeouts", async () => {
      mockBash.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true, output: "bash output" };
      });

      mockTextEditor.view.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { success: true, output: "view output" };
      });

      mockGetToolTimeout.mockImplementation((toolName: string) => {
        return toolName === "bash" ? 200 : 100;
      });

      const bashCall: GrokToolCall = {
        id: "concurrent_bash",
        type: "function",
        function: {
          name: "bash",
          arguments: JSON.stringify({ command: "cmd" }),
        },
      };

      const viewCall: GrokToolCall = {
        id: "concurrent_view",
        type: "function",
        function: {
          name: "view_file",
          arguments: JSON.stringify({ path: "/test/file.ts" }),
        },
      };

      const [bashResult, viewResult] = await Promise.all([
        executor.execute(bashCall),
        executor.execute(viewCall),
      ]);

      expect(bashResult.success).toBe(true);
      expect(viewResult.success).toBe(true);
    });
  });
});
