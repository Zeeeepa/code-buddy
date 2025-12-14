/**
 * Tests for PipelineRunner - Multi-stage agent workflows
 */

import {
  PipelineRunner,
  AgentPipeline,
  PipelineStage,
  PipelineResult,
  StageResult,
  PREDEFINED_PIPELINES,
  getPipelineRunner,
} from "../../src/agent/pipelines";

// Mock SubagentManager
jest.mock("../../src/agent/subagents.js", () => ({
  getSubagentManager: jest.fn().mockReturnValue({
    spawn: jest.fn().mockResolvedValue({
      success: true,
      output: "Test output from subagent",
      toolsUsed: ["bash", "view_file"],
      duration: 1000,
      rounds: 1,
    }),
    stopAll: jest.fn(),
  }),
  SubagentManager: jest.fn(),
}));

describe("PipelineRunner", () => {
  let runner: PipelineRunner;

  beforeEach(() => {
    jest.clearAllMocks();
    runner = new PipelineRunner("test-api-key");
  });

  afterEach(() => {
    runner.removeAllListeners();
  });

  describe("Constructor", () => {
    it("should create instance with API key", () => {
      expect(runner).toBeInstanceOf(PipelineRunner);
    });

    it("should create instance with custom base URL", () => {
      const customRunner = new PipelineRunner("test-api-key", "https://custom.api.com");
      expect(customRunner).toBeInstanceOf(PipelineRunner);
    });
  });

  describe("Pipeline Registration", () => {
    it("should register custom pipeline", () => {
      const customPipeline: AgentPipeline = {
        name: "custom-pipeline",
        description: "A custom test pipeline",
        stages: [
          { name: "stage1", agent: "explorer" },
        ],
        passContext: true,
        haltOnFailure: false,
      };

      runner.registerPipeline(customPipeline);
      expect(runner.getPipeline("custom-pipeline")).toEqual(customPipeline);
    });

    it("should get predefined pipeline", () => {
      const pipeline = runner.getPipeline("code-review");
      expect(pipeline).toBeDefined();
      expect(pipeline?.name).toBe("code-review");
    });

    it("should return null for non-existent pipeline", () => {
      const pipeline = runner.getPipeline("non-existent");
      expect(pipeline).toBeNull();
    });

    it("should list all available pipelines", () => {
      const pipelines = runner.getAvailablePipelines();
      expect(pipelines).toContain("code-review");
      expect(pipelines).toContain("bug-fix");
      expect(pipelines).toContain("feature-development");
    });

    it("should include custom pipelines in available list", () => {
      runner.registerPipeline({
        name: "my-custom",
        description: "Custom",
        stages: [],
        passContext: true,
        haltOnFailure: false,
      });
      const pipelines = runner.getAvailablePipelines();
      expect(pipelines).toContain("my-custom");
    });
  });

  describe("Pipeline Execution", () => {
    it("should run a simple pipeline", async () => {
      runner.registerPipeline({
        name: "simple-test",
        description: "Simple test pipeline",
        stages: [
          { name: "stage1", agent: "explorer" },
        ],
        passContext: false,
        haltOnFailure: false,
      });

      const result = await runner.runPipeline("simple-test", "test task");
      expect(result.success).toBe(true);
      expect(result.pipelineName).toBe("simple-test");
      expect(result.stageResults.size).toBe(1);
    });

    it("should return error for non-existent pipeline", async () => {
      const result = await runner.runPipeline("non-existent", "test task");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Pipeline not found");
    });

    it("should capture output variables", async () => {
      runner.registerPipeline({
        name: "capture-test",
        description: "Test output capture",
        stages: [
          { name: "stage1", agent: "explorer", outputCapture: "stageOutput" },
        ],
        passContext: false,
        haltOnFailure: false,
      });

      const result = await runner.runPipeline("capture-test", "test task");
      expect(result.capturedVariables.stageOutput).toBeDefined();
    });

    it("should pass initial variables", async () => {
      runner.registerPipeline({
        name: "var-test",
        description: "Test variables",
        stages: [
          { name: "stage1", agent: "explorer", inputTransform: "${myVar}" },
        ],
        passContext: false,
        haltOnFailure: false,
        variables: { defaultVar: "default" },
      });

      const result = await runner.runPipeline("var-test", "test", {
        initialVariables: { myVar: "custom value" },
      });
      expect(result.success).toBe(true);
      expect(result.capturedVariables.myVar).toBe("custom value");
    });

    it("should track total duration", async () => {
      runner.registerPipeline({
        name: "duration-test",
        description: "Test duration",
        stages: [
          { name: "stage1", agent: "explorer" },
        ],
        passContext: false,
        haltOnFailure: false,
      });

      const result = await runner.runPipeline("duration-test", "test");
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Events", () => {
    it("should be an EventEmitter", () => {
      expect(runner.on).toBeDefined();
      expect(runner.emit).toBeDefined();
      expect(runner.off).toBeDefined();
    });

    it("should emit pipeline:start event", async () => {
      const startHandler = jest.fn();
      runner.on("pipeline:start", startHandler);

      runner.registerPipeline({
        name: "event-test",
        description: "Test events",
        stages: [{ name: "stage1", agent: "explorer" }],
        passContext: false,
        haltOnFailure: false,
      });

      await runner.runPipeline("event-test", "test");
      expect(startHandler).toHaveBeenCalledWith(
        expect.objectContaining({ pipeline: "event-test" })
      );
    });

    it("should emit pipeline:stage-start event", async () => {
      const stageHandler = jest.fn();
      runner.on("pipeline:stage-start", stageHandler);

      runner.registerPipeline({
        name: "stage-event-test",
        description: "Test stage events",
        stages: [{ name: "stage1", agent: "explorer" }],
        passContext: false,
        haltOnFailure: false,
      });

      await runner.runPipeline("stage-event-test", "test");
      expect(stageHandler).toHaveBeenCalledWith(
        expect.objectContaining({ stage: "stage1", agent: "explorer" })
      );
    });

    it("should emit pipeline:stage-complete event", async () => {
      const completeHandler = jest.fn();
      runner.on("pipeline:stage-complete", completeHandler);

      runner.registerPipeline({
        name: "complete-event-test",
        description: "Test complete events",
        stages: [{ name: "stage1", agent: "explorer" }],
        passContext: false,
        haltOnFailure: false,
      });

      await runner.runPipeline("complete-event-test", "test");
      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ stage: "stage1", success: true })
      );
    });

    it("should emit pipeline:complete event", async () => {
      const completeHandler = jest.fn();
      runner.on("pipeline:complete", completeHandler);

      runner.registerPipeline({
        name: "pipeline-complete-test",
        description: "Test pipeline complete",
        stages: [{ name: "stage1", agent: "explorer" }],
        passContext: false,
        haltOnFailure: false,
      });

      await runner.runPipeline("pipeline-complete-test", "test");
      expect(completeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ pipeline: "pipeline-complete-test", success: true })
      );
    });
  });

  describe("Stop Pipeline", () => {
    it("should emit pipeline:stopped event", () => {
      const stoppedHandler = jest.fn();
      runner.on("pipeline:stopped", stoppedHandler);

      runner.stop();
      expect(stoppedHandler).toHaveBeenCalled();
    });
  });

  describe("Format Results", () => {
    it("should format successful pipeline result", () => {
      const result: PipelineResult = {
        success: true,
        pipelineName: "test-pipeline",
        stageResults: new Map([
          ["stage1", {
            stageName: "stage1",
            agentType: "explorer",
            result: { success: true, output: "Stage 1 output", toolsUsed: ["bash"], duration: 100, rounds: 1 },
            duration: 1000,
            retries: 0,
          }],
        ]),
        capturedVariables: { task: "test", output: "result" },
        totalDuration: 1500,
      };

      const formatted = runner.formatResult(result);
      expect(formatted).toContain("Pipeline Results: test-pipeline");
      expect(formatted).toContain("SUCCESS");
      expect(formatted).toContain("stage1");
    });

    it("should format failed pipeline result", () => {
      const result: PipelineResult = {
        success: false,
        pipelineName: "test-pipeline",
        stageResults: new Map(),
        capturedVariables: {},
        totalDuration: 500,
        failedStage: "stage2",
        error: "Stage failed",
      };

      const formatted = runner.formatResult(result);
      expect(formatted).toContain("FAILED");
      expect(formatted).toContain("Failed at: stage2");
      expect(formatted).toContain("Error: Stage failed");
    });

    it("should show retries in formatted output", () => {
      const result: PipelineResult = {
        success: true,
        pipelineName: "test",
        stageResults: new Map([
          ["stage1", {
            stageName: "stage1",
            agentType: "explorer",
            result: { success: true, output: "output", toolsUsed: [], duration: 100, rounds: 3 },
            duration: 1000,
            retries: 2,
          }],
        ]),
        capturedVariables: {},
        totalDuration: 1000,
      };

      const formatted = runner.formatResult(result);
      expect(formatted).toContain("Retries: 2");
    });
  });

  describe("Format Available Pipelines", () => {
    it("should format all available pipelines", () => {
      const formatted = runner.formatAvailablePipelines();
      expect(formatted).toContain("Available Pipelines");
      expect(formatted).toContain("code-review");
      expect(formatted).toContain("bug-fix");
    });

    it("should include custom pipelines", () => {
      runner.registerPipeline({
        name: "my-custom-pipeline",
        description: "My custom description",
        stages: [{ name: "custom-stage", agent: "explorer" }],
        passContext: true,
        haltOnFailure: false,
      });

      const formatted = runner.formatAvailablePipelines();
      expect(formatted).toContain("my-custom-pipeline");
      expect(formatted).toContain("My custom description");
    });
  });
});

describe("PREDEFINED_PIPELINES", () => {
  it("should have code-review pipeline", () => {
    expect(PREDEFINED_PIPELINES["code-review"]).toBeDefined();
    expect(PREDEFINED_PIPELINES["code-review"].stages.length).toBeGreaterThan(0);
  });

  it("should have bug-fix pipeline", () => {
    expect(PREDEFINED_PIPELINES["bug-fix"]).toBeDefined();
    expect(PREDEFINED_PIPELINES["bug-fix"].haltOnFailure).toBe(true);
  });

  it("should have feature-development pipeline", () => {
    expect(PREDEFINED_PIPELINES["feature-development"]).toBeDefined();
  });

  it("should have security-audit pipeline", () => {
    expect(PREDEFINED_PIPELINES["security-audit"]).toBeDefined();
  });

  it("should have documentation pipeline", () => {
    expect(PREDEFINED_PIPELINES["documentation"]).toBeDefined();
  });

  describe("code-review pipeline structure", () => {
    const pipeline = PREDEFINED_PIPELINES["code-review"];

    it("should have explore, review, and test stages", () => {
      const stageNames = pipeline.stages.map(s => s.name);
      expect(stageNames).toContain("explore");
      expect(stageNames).toContain("review");
      expect(stageNames).toContain("test");
    });

    it("should pass context between stages", () => {
      expect(pipeline.passContext).toBe(true);
    });

    it("should not halt on failure", () => {
      expect(pipeline.haltOnFailure).toBe(false);
    });
  });

  describe("bug-fix pipeline structure", () => {
    const pipeline = PREDEFINED_PIPELINES["bug-fix"];

    it("should have debug, fix, and verify stages", () => {
      const stageNames = pipeline.stages.map(s => s.name);
      expect(stageNames).toContain("debug");
      expect(stageNames).toContain("fix");
      expect(stageNames).toContain("verify");
    });

    it("should halt on failure", () => {
      expect(pipeline.haltOnFailure).toBe(true);
    });
  });
});

describe("PipelineStage Interface", () => {
  it("should define required properties", () => {
    const stage: PipelineStage = {
      name: "test-stage",
      agent: "explorer",
    };

    expect(stage.name).toBe("test-stage");
    expect(stage.agent).toBe("explorer");
  });

  it("should allow optional properties", () => {
    const stage: PipelineStage = {
      name: "full-stage",
      agent: "code-reviewer",
      inputTransform: "${task}",
      outputCapture: "result",
      timeout: 60000,
      retryOnFailure: true,
      maxRetries: 3,
      condition: "previousOutput.length > 0",
    };

    expect(stage.inputTransform).toBe("${task}");
    expect(stage.outputCapture).toBe("result");
    expect(stage.timeout).toBe(60000);
    expect(stage.retryOnFailure).toBe(true);
    expect(stage.maxRetries).toBe(3);
    expect(stage.condition).toBe("previousOutput.length > 0");
  });
});

describe("AgentPipeline Interface", () => {
  it("should define pipeline structure", () => {
    const pipeline: AgentPipeline = {
      name: "test-pipeline",
      description: "A test pipeline",
      stages: [
        { name: "stage1", agent: "explorer" },
        { name: "stage2", agent: "code-reviewer" },
      ],
      passContext: true,
      haltOnFailure: false,
    };

    expect(pipeline.name).toBe("test-pipeline");
    expect(pipeline.stages).toHaveLength(2);
    expect(pipeline.passContext).toBe(true);
    expect(pipeline.haltOnFailure).toBe(false);
  });

  it("should allow optional timeout and variables", () => {
    const pipeline: AgentPipeline = {
      name: "pipeline-with-options",
      description: "Pipeline with options",
      stages: [],
      passContext: false,
      haltOnFailure: true,
      timeout: 300000,
      variables: { env: "test", mode: "debug" },
    };

    expect(pipeline.timeout).toBe(300000);
    expect(pipeline.variables?.env).toBe("test");
  });
});

describe("StageResult Interface", () => {
  it("should define stage result structure", () => {
    const stageResult: StageResult = {
      stageName: "test-stage",
      agentType: "explorer",
      result: {
        success: true,
        output: "Stage completed",
        toolsUsed: ["bash", "view_file"],
        duration: 5000,
        rounds: 2,
      },
      duration: 5500,
      retries: 0,
    };

    expect(stageResult.stageName).toBe("test-stage");
    expect(stageResult.agentType).toBe("explorer");
    expect(stageResult.result.success).toBe(true);
    expect(stageResult.duration).toBe(5500);
    expect(stageResult.retries).toBe(0);
  });
});

describe("PipelineResult Interface", () => {
  it("should define successful result", () => {
    const result: PipelineResult = {
      success: true,
      pipelineName: "test-pipeline",
      stageResults: new Map(),
      capturedVariables: { output: "result" },
      totalDuration: 10000,
    };

    expect(result.success).toBe(true);
    expect(result.failedStage).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it("should define failed result", () => {
    const result: PipelineResult = {
      success: false,
      pipelineName: "test-pipeline",
      stageResults: new Map(),
      capturedVariables: {},
      totalDuration: 5000,
      failedStage: "stage2",
      error: "Stage timeout",
    };

    expect(result.success).toBe(false);
    expect(result.failedStage).toBe("stage2");
    expect(result.error).toBe("Stage timeout");
  });
});

describe("Singleton - getPipelineRunner", () => {
  it("should return PipelineRunner instance", () => {
    const runner = getPipelineRunner("test-api-key");
    expect(runner).toBeInstanceOf(PipelineRunner);
  });

  it("should return same instance on subsequent calls", () => {
    const runner1 = getPipelineRunner("test-api-key");
    const runner2 = getPipelineRunner("test-api-key");
    expect(runner1).toBe(runner2);
  });
});
