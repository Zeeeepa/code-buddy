# Agentic Coding Assistants Research (2024-2025)

## Overview

AI agentic programming represents a paradigm shift from earlier automation. Modern agentic systems actively participate in software development, enabling intelligent code assistance, autonomous debugging, automated maintenance, and potentially self-improving software systems.

## Key Research Findings

### Survey: AI Agentic Programming (arXiv 2025)

The paradigm of software development is changing rapidly with large language models that:
- Generate code
- Understand task requirements
- Interact with development tools
- Iteratively refine outputs

This marks a departure from:
- Rules-based automation
- Classical machine learning
- One-shot LLM calling

### Productivity Research

#### SSRN Study: AI Agents and Higher-Order Thinking (November 2025)
Studies how agentic AI systems affect:
- Productivity metrics
- Cognitive experience of work
- Developer satisfaction

#### Becker et al. Findings (Early 2025)
Controlled experiments showed that early-2025 AI tools (including Cursor) **do not help experienced open-source developers solve real day-to-day tasks faster**.

**Identified Slowdown Mechanisms**:
- Developer over-optimism about AI capabilities
- Low AI reliability on complex tasks
- High task complexity exceeding AI capabilities

This contradicts prior literature on earlier-generation AI coding assistants.

### Autonomous Task Completion

Graham Neubig's NeurIPS 2024 observation:
> "30 to 40 percent of the things that I want an agent to solve on my own repos, it just solves without any human intervention."

In software development with clear goals and validation, agents can **autonomously complete 30.4% of complex tasks**.

## Notable Systems

### Cursor Agent Mode
Capabilities:
- Autonomous, goal-directed behavior
- Navigating entire codebases
- Understanding project architecture across multiple files
- Making multi-file edits
- Running terminal commands
- Executing tests
- Iteratively debugging with minimal human supervision

### ACE: Agentic Code Explorer
- Prototype for sensemaking tasks in large code repositories
- Helps developers understand and ask questions about source code
- Designed for planning and implementing code changes

### DeepCode (University of Hong Kong)
"Open Agentic Coding" paradigm:
- Multi-agent AI systems
- Processes research papers, technical documents, plain language specifications
- Automates from paper interpretation to production-ready codebases

## Vision: Autonomous Software Development

Research from Springer (2025) explores:
- LLMs reshaping Software Engineering
- Automation of entire Software Development Life Cycle (SDLC)
- Remarkable efficiency gains
- Significantly reduced development time

### SDLC Automation Stages
| Stage | Automation Capability | Maturity |
|-------|----------------------|----------|
| Requirements | Partially automated | Medium |
| Design | Assisted | Medium |
| Implementation | Highly automated | High |
| Testing | Highly automated | High |
| Debugging | Automated | High |
| Documentation | Automated | High |
| Deployment | Assisted | Medium |

## Research Gaps Identified

### Lack of Rigorous Studies
- Significant lack of comparative studies analyzing LLM coding assistant performance
- Unclear if tools are interchangeable or embody different design philosophies
- Need for software engineering perspective evaluations

### Abstention Capabilities
- Most models fail to abstain from underspecified inputs
- Fail to flag incorrect outputs
- Significant room for improvement before LLMs can be trusted in real-world SE workflows

### Reliability Concerns
- AI reliability remains a challenge for complex tasks
- Developer over-trust can lead to subtle bugs
- Need for better uncertainty quantification

## Practical Recommendations for CLI Assistants

### 1. Task Complexity Assessment
Before attempting autonomous execution:
- Assess task complexity
- Determine if task is within reliable automation scope
- Default to interactive mode for complex tasks

### 2. Verification Integration
- Integrate automated testing in agentic loops
- Require test passage before completing tasks
- Use iterative repair for failed attempts

### 3. Human-in-the-Loop Design
For tasks outside the ~30% autonomous success range:
- Request clarification at decision points
- Present options for user selection
- Explain reasoning for transparency

### 4. Sensemaking Support
Following ACE research:
- Help developers understand code before modifying
- Provide architecture summaries
- Explain dependencies and impact

### 5. Appropriate Expectations
- Be transparent about capability limitations
- Set realistic expectations for complex tasks
- Guide users toward tasks with high success probability

## Implementation Patterns

### Iterative Repair Loop (ChatRepair-inspired)
```
1. Attempt task
2. Run verification (tests, linting)
3. If failure:
   a. Analyze error
   b. Generate fix
   c. Return to step 2 (max N iterations)
4. If success: report completion
5. If max iterations: request human assistance
```

### Autonomous Task Scoring
```javascript
function shouldAttemptAutonomous(task) {
  const factors = {
    hasTests: 0.3,        // Clear validation criteria
    scopeKnown: 0.25,     // Well-defined scope
    filesLimited: 0.2,    // Limited file changes
    patternKnown: 0.15,   // Similar to past successes
    userExpertise: 0.1    // User can verify
  };

  const score = computeScore(task, factors);
  return score > 0.7; // High confidence threshold
}
```

## Sources

- [AI Agentic Programming: A Survey of Techniques, Challenges, and Opportunities](https://arxiv.org/html/2508.11126v1)
- [AI Agents, Productivity, and Higher-Order Thinking - SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5713646)
- [ACE: Moving toward Co-Investigation with the Agentic Code Explorer](https://hai-gen.github.io/2025/papers/P3-HAI-GEN-2025%20Silva%20Moran%20et%20al.pdf)
- [Autonomous Agents in Software Development: A Vision Paper - Springer](https://link.springer.com/chapter/10.1007/978-3-031-72781-8_2)
