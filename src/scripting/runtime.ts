/**
 * Unified Script Runtime
 *
 * Based on FCS runtime (class/test/assert/dict/lambda/interpolation/pipeline/ternary/index)
 * with Buddy Script additions:
 * - Async/await native support
 * - ForCStyle statement execution
 * - AwaitExpression handling
 * - Export statement handling
 * - Timeout enforcement per-statement
 * - ScriptResult with testResults tracking
 *
 * Extensions: .bs (primary), .fcs (backward-compatible alias)
 */

import {
  AstNode,
  Program,
  TokenType,
  RuntimeContext,
  CodeBuddyValue,
  CodeBuddyFunction,
  ScriptResult,
  CodeBuddyScriptConfig,
  DEFAULT_SCRIPT_CONFIG,
  LiteralExpr,
  IdentifierExpr,
  BinaryExpr,
  UnaryExpr,
  AssignmentExpr,
  CallExpr,
  MemberExpr,
  IndexExpr,
  ArrayExpr,
  DictExpr,
  LambdaExpr,
  InterpolationExpr,
  TernaryExpr,
  AwaitExpr,
  BlockStmt,
  ExpressionStmt,
  VarDeclaration,
  FunctionDeclaration,
  ClassDeclaration,
  IfStmt,
  WhileStmt,
  ForStmt,
  ForCStyleStmt,
  ReturnStmt,
  TryStmt,
  ThrowStmt,
  ImportStmt,
  ExportStmt,
  TestDeclaration,
  AssertStmt,
} from './types.js';
import { createBuiltins } from './builtins.js';
import { createGrokBindings } from './codebuddy-bindings.js';

// Control flow signals
class ReturnSignal {
  constructor(public value: CodeBuddyValue) {}
}

class BreakSignal {}
class ContinueSignal {}

export class FCSRuntime {
  private config: CodeBuddyScriptConfig;
  private globalContext: RuntimeContext;
  private output: string[] = [];
  private startTime = 0;
  private testResults: { name: string; passed: boolean; error?: string }[] = [];

  constructor(config: Partial<CodeBuddyScriptConfig> = {}) {
    this.config = { ...DEFAULT_SCRIPT_CONFIG, ...config };
    this.globalContext = {
      variables: new Map(),
      functions: new Map(),
    };

    this.initializeBuiltins();
  }

  private initializeBuiltins(): void {
    const printFn = (msg: string) => {
      this.output.push(msg);
    };

    // Load unified builtins (merged FCS + BS)
    const builtins = createBuiltins(this.config, printFn);

    for (const [name, value] of Object.entries(builtins)) {
      this.globalContext.variables.set(name, value as CodeBuddyValue);
      if (typeof value === 'function') {
        this.globalContext.functions.set(name, value as CodeBuddyFunction);
      }
    }

    // Load codebuddy bindings (grok.*, tool.*, context.*, agent.*, mcp.*, git.*, session.*)
    const grokBindings = createGrokBindings(this.config as any, printFn);
    for (const [name, value] of Object.entries(grokBindings)) {
      this.globalContext.variables.set(name, value as CodeBuddyValue);
    }

    // Inject user variables
    if (this.config.variables) {
      for (const [name, value] of Object.entries(this.config.variables)) {
        this.globalContext.variables.set(name, value);
      }
    }
  }

  async execute(program: Program): Promise<ScriptResult> {
    this.startTime = Date.now();
    this.output = [];
    this.testResults = [];

    let returnValue: CodeBuddyValue = null;
    let error: string | undefined;

    try {
      for (const statement of program.statements) {
        const result = await this.executeNode(statement, this.globalContext);
        if (result instanceof ReturnSignal) {
          returnValue = result.value;
          break;
        }
      }
    } catch (err) {
      if (err instanceof ReturnSignal) {
        returnValue = err.value;
      } else {
        error = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      success: !error,
      output: this.output,
      error,
      returnValue,
      duration: Date.now() - this.startTime,
      testResults: this.testResults.length > 0 ? this.testResults : undefined,
    };
  }

  async executeNode(
    node: AstNode,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue | ReturnSignal | BreakSignal | ContinueSignal> {
    // Check timeout
    if (Date.now() - this.startTime > this.config.timeout) {
      throw new Error(`Script timeout after ${this.config.timeout}ms`);
    }

    switch (node.type) {
      // Declarations
      case 'VarDeclaration':
        return this.executeVarDeclaration(node as VarDeclaration, ctx);

      case 'FunctionDeclaration':
        return this.executeFunctionDeclaration(node as FunctionDeclaration, ctx);

      case 'ClassDeclaration':
        return this.executeClassDeclaration(node as ClassDeclaration, ctx);

      case 'TestDeclaration':
        return this.executeTestDeclaration(node as TestDeclaration, ctx);

      // Statements
      case 'Block':
        return this.executeBlock(node as BlockStmt, ctx);

      case 'ExpressionStmt':
        return this.evaluate((node as ExpressionStmt).expression, ctx);

      case 'If':
        return this.executeIfStatement(node as IfStmt, ctx);

      case 'While':
        return this.executeWhileStatement(node as WhileStmt, ctx);

      case 'For':
        return this.executeForStatement(node as ForStmt, ctx);

      case 'ForCStyle':
        return this.executeForCStyleStatement(node as ForCStyleStmt, ctx);

      case 'Return':
        return this.executeReturnStatement(node as ReturnStmt, ctx);

      case 'Break':
        return new BreakSignal();

      case 'Continue':
        return new ContinueSignal();

      case 'Try':
        return this.executeTryStatement(node as TryStmt, ctx);

      case 'Throw':
        return this.executeThrowStatement(node as ThrowStmt, ctx);

      case 'Import':
        return this.executeImportStatement(node as ImportStmt, ctx);

      case 'Export':
        return this.executeExportStatement(node as ExportStmt, ctx);

      case 'Assert':
        return this.executeAssertStatement(node as AssertStmt, ctx);

      // Expressions (delegated to evaluate)
      default:
        return this.evaluate(node, ctx);
    }
  }

  // ============================================
  // Statement Execution
  // ============================================

  private async executeVarDeclaration(
    node: VarDeclaration,
    ctx: RuntimeContext
  ): Promise<null> {
    const value = node.initializer
      ? await this.evaluate(node.initializer, ctx)
      : null;
    ctx.variables.set(node.name, value);
    return null;
  }

  private async executeFunctionDeclaration(
    node: FunctionDeclaration,
    ctx: RuntimeContext
  ): Promise<null> {
    const fn: CodeBuddyFunction = async (...args: CodeBuddyValue[]) => {
      const localCtx: RuntimeContext = {
        variables: new Map(),
        functions: new Map(ctx.functions),
        parent: ctx,
      };

      // Bind parameters (with named args support)
      const lastArg = args.length > 0 ? args[args.length - 1] : null;
      const hasNamedArgs = lastArg !== null && typeof lastArg === 'object' && lastArg !== null && '__namedArgs' in (lastArg as object);
      const namedArgs = hasNamedArgs
        ? (args.pop() as { __namedArgs: Record<string, CodeBuddyValue> }).__namedArgs
        : {};

      for (let i = 0; i < node.parameters.length; i++) {
        const param = node.parameters[i];
        let value: CodeBuddyValue;

        if (namedArgs[param.name] !== undefined) {
          value = namedArgs[param.name];
        } else if (args[i] !== undefined) {
          value = args[i];
        } else if (param.defaultValue) {
          value = await this.evaluate(param.defaultValue, ctx);
        } else {
          value = null;
        }

        localCtx.variables.set(param.name, value);
      }

      try {
        const result = await this.executeBlock(node.body, localCtx);
        if (result instanceof ReturnSignal) {
          return result.value;
        }
        return null;
      } catch (err) {
        if (err instanceof ReturnSignal) {
          return err.value;
        }
        throw err;
      }
    };

    ctx.functions.set(node.name, fn);
    ctx.variables.set(node.name, fn);
    return null;
  }

  private async executeClassDeclaration(
    node: ClassDeclaration,
    ctx: RuntimeContext
  ): Promise<null> {
    const classConstructor: CodeBuddyFunction = async (...args: CodeBuddyValue[]) => {
      const instance: Record<string, CodeBuddyValue> = {};

      for (const member of node.members) {
        if (member.type === 'VarDeclaration') {
          const varDecl = member as VarDeclaration;
          instance[varDecl.name] = varDecl.initializer
            ? await this.evaluate(varDecl.initializer, ctx)
            : null;
        } else if (member.type === 'FunctionDeclaration') {
          const fnDecl = member as FunctionDeclaration;
          instance[fnDecl.name] = async (...methodArgs: CodeBuddyValue[]) => {
            const methodCtx: RuntimeContext = {
              variables: new Map([['this', instance]]),
              functions: new Map(ctx.functions),
              parent: ctx,
            };

            for (let i = 0; i < fnDecl.parameters.length; i++) {
              methodCtx.variables.set(fnDecl.parameters[i].name, methodArgs[i]);
            }

            const result = await this.executeBlock(fnDecl.body, methodCtx);
            if (result instanceof ReturnSignal) {
              return result.value;
            }
            return null;
          };
        }
      }

      if (instance.constructor && typeof instance.constructor === 'function') {
        await instance.constructor(...args);
      }

      return instance;
    };

    ctx.variables.set(node.name, classConstructor);
    return null;
  }

  private async executeTestDeclaration(
    node: TestDeclaration,
    ctx: RuntimeContext
  ): Promise<null> {
    if (!this.config.verbose) {
      return null;
    }

    try {
      await this.executeBlock(node.body, ctx);
      this.testResults.push({ name: node.name, passed: true });
      this.output.push(`✓ ${node.name}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.testResults.push({ name: node.name, passed: false, error: errorMsg });
      this.output.push(`✗ ${node.name}: ${errorMsg}`);
    }

    return null;
  }

  private async executeBlock(
    node: BlockStmt,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue | ReturnSignal | BreakSignal | ContinueSignal> {
    for (const stmt of node.statements) {
      const result = await this.executeNode(stmt, ctx);
      if (
        result instanceof ReturnSignal ||
        result instanceof BreakSignal ||
        result instanceof ContinueSignal
      ) {
        return result;
      }
    }
    return null;
  }

  private async executeIfStatement(
    node: IfStmt,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue | ReturnSignal | BreakSignal | ContinueSignal> {
    const condition = await this.evaluate(node.condition, ctx);

    if (this.isTruthy(condition)) {
      return this.executeNode(node.thenBranch, ctx);
    } else if (node.elseBranch) {
      return this.executeNode(node.elseBranch, ctx);
    }

    return null;
  }

  private async executeWhileStatement(
    node: WhileStmt,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue | ReturnSignal> {
    while (this.isTruthy(await this.evaluate(node.condition, ctx))) {
      const result = await this.executeNode(node.body, ctx);
      if (result instanceof ReturnSignal) return result;
      if (result instanceof BreakSignal) break;
      if (result instanceof ContinueSignal) continue;
    }
    return null;
  }

  private async executeForStatement(
    node: ForStmt,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue | ReturnSignal> {
    const iterable = await this.evaluate(node.iterable, ctx);

    if (!Array.isArray(iterable) && typeof iterable !== 'object') {
      throw new Error('for-in requires an iterable (array or object)');
    }

    const items = Array.isArray(iterable)
      ? iterable
      : Object.entries(iterable as Record<string, CodeBuddyValue>);

    const localCtx: RuntimeContext = {
      variables: new Map(),
      functions: ctx.functions,
      parent: ctx,
    };

    for (const item of items) {
      localCtx.variables.set(node.variable, item);

      const result = await this.executeNode(node.body, localCtx);
      if (result instanceof ReturnSignal) return result;
      if (result instanceof BreakSignal) break;
      if (result instanceof ContinueSignal) continue;
    }

    return null;
  }

  private async executeForCStyleStatement(
    node: ForCStyleStmt,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue | ReturnSignal> {
    const localCtx: RuntimeContext = {
      variables: new Map(),
      functions: ctx.functions,
      parent: ctx,
    };

    // Execute init
    if (node.init) {
      if (node.init.type === 'VarDeclaration') {
        await this.executeVarDeclaration(node.init as VarDeclaration, localCtx);
      } else {
        await this.evaluate(node.init, localCtx);
      }
    }

    // Loop while test is true
    while (node.test === null || this.isTruthy(await this.evaluate(node.test, localCtx))) {
      const result = await this.executeNode(node.body, localCtx);
      if (result instanceof ReturnSignal) return result;
      if (result instanceof BreakSignal) break;
      if (result instanceof ContinueSignal) {
        if (node.update) {
          await this.evaluate(node.update, localCtx);
        }
        continue;
      }

      if (node.update) {
        await this.evaluate(node.update, localCtx);
      }
    }

    return null;
  }

  private async executeReturnStatement(
    node: ReturnStmt,
    ctx: RuntimeContext
  ): Promise<ReturnSignal> {
    const value = node.value ? await this.evaluate(node.value, ctx) : null;
    return new ReturnSignal(value);
  }

  private async executeTryStatement(
    node: TryStmt,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue | ReturnSignal> {
    try {
      return await this.executeBlock(node.tryBlock, ctx);
    } catch (err) {
      for (const clause of node.catchClauses) {
        const localCtx: RuntimeContext = {
          variables: new Map(ctx.variables),
          functions: ctx.functions,
          parent: ctx,
        };

        if (clause.variable) {
          const errorValue =
            err instanceof Error
              ? { message: err.message, stack: err.stack }
              : err;
          localCtx.variables.set(clause.variable, errorValue as CodeBuddyValue);
        }

        return this.executeBlock(clause.body, localCtx);
      }
      throw err;
    } finally {
      if (node.finallyBlock) {
        await this.executeBlock(node.finallyBlock, ctx);
      }
    }
  }

  private async executeThrowStatement(
    node: ThrowStmt,
    ctx: RuntimeContext
  ): Promise<never> {
    const value = await this.evaluate(node.expression, ctx);
    if (typeof value === 'string') {
      throw new Error(value);
    }
    throw value;
  }

  private async executeImportStatement(
    _node: ImportStmt,
    _ctx: RuntimeContext
  ): Promise<null> {
    // Imports are handled at initialization or by module system
    return null;
  }

  private async executeExportStatement(
    node: ExportStmt,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue | ReturnSignal | BreakSignal | ContinueSignal> {
    // Execute the declaration normally - exports don't change runtime behavior
    return this.executeNode(node.declaration, ctx);
  }

  private async executeAssertStatement(
    node: AssertStmt,
    ctx: RuntimeContext
  ): Promise<null> {
    const condition = await this.evaluate(node.condition, ctx);

    if (!this.isTruthy(condition)) {
      const message = node.message || 'Assertion failed';
      throw new Error(message);
    }

    return null;
  }

  // ============================================
  // Expression Evaluation
  // ============================================

  private async evaluate(node: AstNode, ctx: RuntimeContext): Promise<CodeBuddyValue> {
    switch (node.type) {
      case 'Literal':
        return (node as LiteralExpr).value as CodeBuddyValue;

      case 'Identifier':
        return this.lookupVariable((node as IdentifierExpr).name, ctx);

      case 'Binary':
        return this.evaluateBinary(node as BinaryExpr, ctx);

      case 'Unary':
        return this.evaluateUnary(node as UnaryExpr, ctx);

      case 'Assignment':
        return this.evaluateAssignment(node as AssignmentExpr, ctx);

      case 'Call':
        return this.evaluateCall(node as CallExpr, ctx);

      case 'Member':
        return this.evaluateMember(node as MemberExpr, ctx);

      case 'Index':
        return this.evaluateIndex(node as IndexExpr, ctx);

      case 'Array':
        return this.evaluateArray(node as ArrayExpr, ctx);

      case 'Dict':
        return this.evaluateDict(node as DictExpr, ctx);

      case 'Lambda':
        return this.evaluateLambda(node as LambdaExpr, ctx);

      case 'Interpolation':
        return this.evaluateInterpolation(node as InterpolationExpr, ctx);

      case 'Ternary':
        return this.evaluateTernary(node as TernaryExpr, ctx);

      case 'Await':
        // Await just evaluates the argument (our runtime is already async)
        return this.evaluate((node as AwaitExpr).argument, ctx);

      default:
        throw new Error(`Unknown expression type: ${node.type}`);
    }
  }

  private lookupVariable(name: string, ctx: RuntimeContext): CodeBuddyValue {
    if (ctx.variables.has(name)) {
      return ctx.variables.get(name)!;
    }
    if (ctx.functions.has(name)) {
      return ctx.functions.get(name)!;
    }
    if (ctx.parent) {
      return this.lookupVariable(name, ctx.parent);
    }
    throw new Error(`Undefined variable: ${name}`);
  }

  private setVariable(name: string, value: CodeBuddyValue, ctx: RuntimeContext): void {
    let current: RuntimeContext | undefined = ctx;
    while (current) {
      if (current.variables.has(name)) {
        current.variables.set(name, value);
        return;
      }
      current = current.parent;
    }
    ctx.variables.set(name, value);
  }

  private async evaluateBinary(
    node: BinaryExpr,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue> {
    const left = await this.evaluate(node.left, ctx);
    const right = await this.evaluate(node.right, ctx);

    switch (node.operator) {
      case TokenType.Plus:
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        return (left as number) + (right as number);

      case TokenType.Minus:
        return (left as number) - (right as number);

      case TokenType.Multiply:
        if (typeof left === 'string' && typeof right === 'number') {
          return left.repeat(right);
        }
        return (left as number) * (right as number);

      case TokenType.Divide:
        return (left as number) / (right as number);

      case TokenType.Modulo:
        return (left as number) % (right as number);

      case TokenType.Power:
        return Math.pow(left as number, right as number);

      case TokenType.Equal:
        return left === right;

      case TokenType.NotEqual:
        return left !== right;

      case TokenType.Less:
        return (left as number) < (right as number);

      case TokenType.LessEqual:
        return (left as number) <= (right as number);

      case TokenType.Greater:
        return (left as number) > (right as number);

      case TokenType.GreaterEqual:
        return (left as number) >= (right as number);

      case TokenType.And:
        return this.isTruthy(left) && this.isTruthy(right);

      case TokenType.Or:
        return this.isTruthy(left) || this.isTruthy(right);

      default:
        throw new Error(`Unknown binary operator: ${node.operator}`);
    }
  }

  private async evaluateUnary(
    node: UnaryExpr,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue> {
    const operand = await this.evaluate(node.operand, ctx);

    switch (node.operator) {
      case TokenType.Minus:
        return -(operand as number);

      case TokenType.Not:
        return !this.isTruthy(operand);

      default:
        throw new Error(`Unknown unary operator: ${node.operator}`);
    }
  }

  private async evaluateAssignment(
    node: AssignmentExpr,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue> {
    let value = await this.evaluate(node.value, ctx);

    if (node.operator !== TokenType.Assign) {
      const current = await this.evaluate(node.target, ctx);

      switch (node.operator) {
        case TokenType.PlusAssign:
          if (typeof current === 'string' || typeof value === 'string') {
            value = String(current) + String(value);
          } else {
            value = (current as number) + (value as number);
          }
          break;

        case TokenType.MinusAssign:
          value = (current as number) - (value as number);
          break;

        case TokenType.MultiplyAssign:
          value = (current as number) * (value as number);
          break;

        case TokenType.DivideAssign:
          value = (current as number) / (value as number);
          break;
      }
    }

    if (node.target.type === 'Identifier') {
      this.setVariable((node.target as IdentifierExpr).name, value, ctx);
    } else if (node.target.type === 'Member') {
      const member = node.target as MemberExpr;
      const object = await this.evaluate(member.object, ctx);
      (object as Record<string, CodeBuddyValue>)[member.member] = value;
    } else if (node.target.type === 'Index') {
      const index = node.target as IndexExpr;
      const object = await this.evaluate(index.object, ctx);
      const key = await this.evaluate(index.index, ctx);
      (object as Record<string, CodeBuddyValue>)[key as string | number] = value;
    }

    return value;
  }

  private async evaluateCall(
    node: CallExpr,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue> {
    const callee = await this.evaluate(node.callee, ctx);

    if (typeof callee !== 'function') {
      throw new Error(`${JSON.stringify(callee)} is not a function`);
    }

    const args: CodeBuddyValue[] = [];
    for (const arg of node.arguments) {
      args.push(await this.evaluate(arg, ctx));
    }

    // Handle named arguments
    if (node.namedArgs && Object.keys(node.namedArgs).length > 0) {
      const namedValues: Record<string, CodeBuddyValue> = {};
      for (const [name, expr] of Object.entries(node.namedArgs)) {
        namedValues[name] = await this.evaluate(expr, ctx);
      }
      args.push({ __namedArgs: namedValues } as CodeBuddyValue);
    }

    const result = callee(...args);
    return result instanceof Promise ? await result : result;
  }

  private async evaluateMember(
    node: MemberExpr,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue> {
    const object = await this.evaluate(node.object, ctx);

    if (object === null || object === undefined) {
      throw new Error('Cannot read property of null or undefined');
    }

    const obj = object as Record<string, CodeBuddyValue>;
    const value = obj[node.member];

    if (typeof value === 'function') {
      return value.bind(obj);
    }

    return value;
  }

  private async evaluateIndex(
    node: IndexExpr,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue> {
    const object = await this.evaluate(node.object, ctx);
    const index = await this.evaluate(node.index, ctx);

    if (object === null || object === undefined) {
      throw new Error('Cannot index null or undefined');
    }

    return (object as Record<string | number, CodeBuddyValue>)[index as string | number];
  }

  private async evaluateArray(
    node: ArrayExpr,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue[]> {
    const elements: CodeBuddyValue[] = [];
    for (const element of node.elements) {
      elements.push(await this.evaluate(element, ctx));
    }
    return elements;
  }

  private async evaluateDict(
    node: DictExpr,
    ctx: RuntimeContext
  ): Promise<Record<string, CodeBuddyValue>> {
    const dict: Record<string, CodeBuddyValue> = {};
    for (const [key, valueNode] of node.elements) {
      dict[key] = await this.evaluate(valueNode, ctx);
    }
    return dict;
  }

  private evaluateLambda(node: LambdaExpr, ctx: RuntimeContext): CodeBuddyFunction {
    return async (...args: CodeBuddyValue[]): Promise<CodeBuddyValue> => {
      const localCtx: RuntimeContext = {
        variables: new Map(),
        functions: ctx.functions,
        parent: ctx,
      };

      for (let i = 0; i < node.parameters.length; i++) {
        localCtx.variables.set(node.parameters[i], args[i]);
      }

      if (node.body.type === 'Block') {
        const result = await this.executeBlock(node.body as BlockStmt, localCtx);
        if (result instanceof ReturnSignal) {
          return result.value;
        }
        return null;
      }

      return this.evaluate(node.body, localCtx);
    };
  }

  private async evaluateInterpolation(
    node: InterpolationExpr,
    ctx: RuntimeContext
  ): Promise<string> {
    let result = '';

    for (const part of node.parts) {
      const value = await this.evaluate(part, ctx);
      result += String(value);
    }

    return result;
  }

  private async evaluateTernary(
    node: TernaryExpr,
    ctx: RuntimeContext
  ): Promise<CodeBuddyValue> {
    const condition = await this.evaluate(node.condition, ctx);

    if (this.isTruthy(condition)) {
      return this.evaluate(node.consequent, ctx);
    }

    return this.evaluate(node.alternate, ctx);
  }

  // ============================================
  // Helpers
  // ============================================

  private isTruthy(value: CodeBuddyValue): boolean {
    if (value === null || value === undefined || value === false || value === 0 || value === '') {
      return false;
    }
    return true;
  }

  getTestResults(): { name: string; passed: boolean; error?: string }[] {
    return this.testResults;
  }

  getOutput(): string[] {
    return this.output;
  }
}

/** @deprecated Use FCSRuntime instead */
export const Runtime = FCSRuntime;

export function createRuntime(config: Partial<CodeBuddyScriptConfig> = {}): FCSRuntime {
  return new FCSRuntime(config);
}
