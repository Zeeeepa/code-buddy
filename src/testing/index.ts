/**
 * Testing module - AI integration tests and automation
 *
 * Features:
 * - AI integration tests
 * - Auto-lint integration (ESLint, Prettier, Ruff, etc.)
 * - Auto-test integration (Jest, pytest, cargo test, etc.)
 * - TDD mode (test-first development)
 */

export * from "./ai-integration-tests.js";

// Auto-lint integration
export {
  AutoLintManager,
  getAutoLintManager,
  initializeAutoLint,
  BUILTIN_LINTERS,
  DEFAULT_AUTOLINT_CONFIG,
  type LintError,
  type LintResult,
  type LinterConfig,
  type AutoLintConfig,
} from "./auto-lint.js";

// Auto-test integration
export {
  AutoTestManager,
  getAutoTestManager,
  initializeAutoTest,
  BUILTIN_FRAMEWORKS,
  DEFAULT_AUTOTEST_CONFIG,
  type TestCase,
  type TestResult,
  type CoverageResult,
  type TestFrameworkConfig,
  type AutoTestConfig,
} from "./auto-test.js";

// TDD mode
export {
  TDDModeManager,
  getTDDManager,
  initializeTDD,
  TEST_TEMPLATES,
  DEFAULT_TDD_CONFIG,
  type TDDState,
  type TDDCycleResult,
  type TDDConfig,
  type TestTemplate,
} from "./tdd-mode.js";
