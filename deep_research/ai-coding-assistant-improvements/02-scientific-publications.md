# Scientific Publications: AI-Assisted Software Development

This document summarizes recent research (2023-2025) on AI-assisted software development, code generation, and related techniques that could inform CodeBuddy improvements.

---

## 1. Code Generation with LLMs

### Comprehensive Surveys

**"A Survey on Large Language Models for Code Generation"** (arXiv, June 2024)
- Source: [arxiv.org/abs/2406.00515](https://arxiv.org/abs/2406.00515)
- Introduces taxonomy for LLM code generation developments
- Covers: data curation, latest advances, performance evaluation, ethical implications
- Benchmarks: HumanEval, MBPP, BigCodeBench
- Key finding: 80%+ of developers now regularly use AI assistants

**"A Survey on Code Generation with LLM-based Agents"** (arXiv, July 2025)
- Source: [arxiv.org/html/2508.00083v1](https://arxiv.org/html/2508.00083v1)
- Three core characteristics of code generation agents:
  1. **Autonomy**: Manage entire workflows from decomposition to debugging
  2. **Expanded task scope**: Beyond snippets to full SDLC
  3. **Agent coordination**: Multiple specialized agents working together

### Key Insights for CodeBuddy
- Full software development lifecycle support is the new frontier
- Agent autonomy with proper guardrails is critical
- Multi-step reasoning with verification improves quality

---

## 2. Multi-Agent Systems for Software Engineering

### Literature Review: LLM-Based Multi-Agent Systems (ACM TOSEM, 2024)

- Source: [dl.acm.org/doi/10.1145/3712003](https://dl.acm.org/doi/10.1145/3712003)
- Analyzed 41 primary studies on multi-agent systems for SE
- Search conducted November 14, 2024

### Notable Multi-Agent Frameworks

| Framework | Architecture | Key Innovation | Performance |
|-----------|--------------|----------------|-------------|
| **ChatDev** | Role-based teams (programmers, testers) | Phase-based: design, code, test, docs | <7 min, <$1 per app |
| **MetaGPT** | SOP-embedded workflow | Product Manager, Architect, QA Engineer roles | Full company workflow |
| **MapCoder** | Retrieval + Planning + Coding + Debugging | Confidence-guided tree traversal | SOTA on competitive programming |
| **ComplexAgents** | Waterfall model integration | Complex code decomposition | Better on large tasks |

### Findings on Agent Collaboration

**Efficiency vs Complexity Trade-off:**
- Simple tasks: Average 76 seconds, $0.019 per attempt
- Complex tasks (e.g., Tetris): 10+ attempts needed, core functionality still missing
- Limitation: Deep logical reasoning and abstraction still challenging

**Human-AI Collaboration:**
- Humans: Creativity, critical thinking, ethical judgment, domain knowledge
- LLM agents: Rapid processing, repetitive tasks, pattern detection
- Optimal approach: Complementary collaboration, not replacement

### Implications for CodeBuddy
1. Consider more specialized agent roles (beyond current 4 modes)
2. Implement SOP-style workflows for complex tasks
3. Add confidence-based decision making for code generation paths

---

## 3. Benchmarks and Evaluation

### SWE-bench: Real-World Software Engineering

- Source: [github.com/SWE-bench/SWE-bench](https://github.com/SWE-bench/SWE-bench)
- ICLR 2024 Oral Presentation
- Task: Generate patches to resolve real GitHub issues

**Performance Progress:**
| Date | Best Score (SWE-bench) | Best Score (Verified) |
|------|------------------------|----------------------|
| Aug 2024 | 20% | 43% (SWE-bench Lite) |
| Apr 2025 | 33.83% (full) | 70%+ (Verified) |

**Key Benchmark Variants:**
- **SWE-bench Verified**: 500 human-verified solvable problems (Aug 2024)
- **SWE-bench+**: Issues after LLM training cutoff (prevent data leakage)
- **SWE-rebench**: Continuously updated, decontaminated benchmark

### Concerns Raised
- Memorization vs. true reasoning
- Static benchmarks lose relevance quickly
- Need for ongoing evaluation methodology

### Implications for CodeBuddy
- Consider internal benchmarking suite
- Track real-world task completion rates
- Implement decontamination strategies for evaluation

---

## 4. Retrieval-Augmented Generation (RAG) for Code

### Comprehensive Survey (arXiv, October 2024)
- Source: [arxiv.org/abs/2410.12837](https://arxiv.org/abs/2410.12837)
- RAG addresses key LLM limitations through retrieval + generation

### Code-Specific RAG Research

**CodeRAG Framework:**
- Source: [arxiv.org/html/2504.10046v1](https://arxiv.org/html/2504.10046v1)
- Bigraph-based retrieval for repo-level code generation
- **Results**: Pass@1 increased from 18.57% to 54.41% (+35.57 points)

**RAG for Test Generation:**
- Source: [researchgate.net/publication/384155461](https://www.researchgate.net/publication/384155461_Retrieval-Augmented_Test_Generation_How_Far_Are_We)
- RAG improves line coverage by 6.5% on average
- GitHub issues provide best edge case coverage
- **Detected 28 bugs**, 10 confirmed by developers

### RAG Paradigms for Code

| Approach | Description | Advantages |
|----------|-------------|------------|
| **Non-graph-based** | Lexical/semantic similarity via embeddings | Simple, fast |
| **Graph-based** | AST, call graphs, dependency graphs | Better structure awareness |
| **Hybrid** | Combine both with contextual signals | Best performance |

### Advanced RAG Techniques (2024)
- **Self-RAG**: Model decides when/how much to retrieve
- **SAM-RAG**: Dynamic filtering with evidence verification
- **Ragnarok**: End-to-end industrial framework

### Implications for CodeBuddy
1. Enhance existing RAG-based tool selection with graph-based methods
2. Consider bigraph structures for repo-level understanding
3. Use GitHub issues as context for edge case coverage

---

## 5. Test-Driven Development with LLMs

### Key Research Papers

**"Test-Driven Development for Code Generation"** (arXiv, Feb 2024)
- Source: [arxiv.org/abs/2402.13521](https://arxiv.org/abs/2402.13521)
- TDD enables verification of generated code against predefined tests
- Including test cases leads to higher success in programming challenges
- TDD is a promising paradigm for ensuring LLM code captures requirements

**"LLM-Based Test-Driven Interactive Code Generation"** (ICSE 2024)
- Source: [dl.acm.org/doi/10.1145/3639478.3643525](https://dl.acm.org/doi/10.1145/3639478.3643525)
- **45.97% improvement** in pass@1 accuracy with TDD workflow
- Participants more likely to correctly evaluate AI-generated code
- Significantly less cognitive load reported

**"Tests as Instructions" Benchmark** (OpenReview, Oct 2024)
- Source: [openreview.net/forum?id=sqciWyTm70](https://openreview.net/forum?id=sqciWyTm70)
- Test cases as both instruction and verification
- Critical abilities: instruction following, in-context learning
- **Main bottleneck**: Input context length affects success rate

### Practical Insights

**T.B.L.D. (Test-driven Brute-force-based LLM-assisted Development):**
- Define behavior with tests
- Feed test/compilation errors back to LLM
- Iterate until code passes all tests
- **Best with strongly-typed languages** (Go recommended): Clear signals about API hallucinations

### Implications for CodeBuddy
1. Implement TDD-first mode for code generation
2. Auto-generate tests before implementation
3. Feed test failures back into generation loop
4. Prioritize strongly-typed language support

---

## 6. Speculative Decoding for Faster Inference

### Overview
- Source: [arxiv.org/abs/2402.01528](https://arxiv.org/abs/2402.01528)
- Small draft model generates speculative tokens
- Target LLM verifies draft tokens
- **Speed improvement: 2-3x without accuracy loss**

### Techniques (2024-2025)

| Technique | Approach | Performance |
|-----------|----------|-------------|
| **EAGLE-3** | Lightweight prediction head, no separate draft model | Improved acceptance on NVIDIA GPUs |
| **EESD** | Early-exiting with self-distillation | Reduced training costs |
| **PIA** | Trie structure for context management | Tree-based parallel verification |
| **SAM** | Suffix automaton for history | Linear speculative decoding |

### Industry Adoption
- Google: Powers AI Overviews in Search
- Snowflake/vLLM: 2-4x speedups on Llama 3.1
- IBM Granite 3.0: Halved latency, 4x throughput
- AWS Inferentia2: Hardware-optimized support

### Performance Factors
- Draft model choice critical (capability doesn't correlate with performance)
- Acceptance rate varies by task and decoding strategy
- Effective on HumanEval code generation benchmark

### Implications for CodeBuddy
1. Consider implementing speculative decoding for supported providers
2. Use smaller draft models for initial generations
3. Evaluate acceptance rates by task type

---

## 7. Code Understanding and Navigation

### AST-T5: Structure-Aware Pretraining (2024)
- Source: [arxiv.org/abs/2401.03003](https://arxiv.org/abs/2401.03003)
- Leverages Abstract Syntax Tree for enhanced code understanding
- **AST-Aware Segmentation**: Retains code structure via dynamic programming
- **AST-Aware Span Corruption**: Reconstructs various code structures
- **Results**: +2 points on Bugs2Fix, +3 points on Java-C# Transpilation

### LLM Static Analysis Capabilities (2025)
- Source: [arxiv.org/html/2505.12118v1](https://arxiv.org/html/2505.12118v1)
- Tasks: Callgraph generation, AST generation, dataflow generation
- **Finding**: LLMs show poor performance on static analysis tasks
- Pretraining on static analysis doesn't improve code intelligence tasks
- LLMs susceptible to hallucinations on semantic structures

### Tools for Code Structure

**tree-sitter Integration:**
- Used by Aider for "repository map"
- Enables AST parsing across multiple languages
- Salesforce CodeTF: Pre-built libraries for code attribute extraction

**Annotated AST for LLM:**
- Source: [github.com/cameronking4/Annotated-AST-For-LLM](https://github.com/cameronking4/Annotated-AST-For-LLM)
- Custom AST for JavaScript/TypeScript repos
- Pre-processing for full repository context
- Supports static analysis for quality/security

### Implications for CodeBuddy
1. Integrate tree-sitter for repository mapping (like Aider)
2. Don't rely on LLMs for static analysis - use dedicated tools
3. Combine AST structure with semantic embeddings
4. Consider AST-aware context preparation

---

## 8. Semantic Code Search

### Research Approaches

**Neural Code Search:**
- CodeTransformer: Joint vector space for queries and code
- Combines BM25 with neural reranking (CodeBERT)
- Bridges semantic gap between NL and programming languages

**Repository-Level Code Search:**
- Source: [arxiv.org/html/2502.07067](https://arxiv.org/html/2502.07067)
- Significant improvements over BM25 baseline
- Uses commit messages and code change relevance

### Implementation Approaches

| Method | Technique | Use Case |
|--------|-----------|----------|
| **Embedding similarity** | Sentence transformers | Local/private search |
| **Sparse retrieval (BM25)** | Keyword matching | Fast initial filtering |
| **Dense retrieval** | Neural embeddings | Semantic understanding |
| **Hybrid** | Sparse + Dense + Reranking | Best quality |

**Local Tool: semantic-code-search**
- Source: [github.com/sturdy-dev/semantic-code-search](https://github.com/sturdy-dev/semantic-code-search)
- CLI for natural language codebase search
- No data leaves computer
- Uses sentence transformer architecture

### Implications for CodeBuddy
1. Implement hybrid search (BM25 + embeddings)
2. Use sentence transformers for method/function embeddings
3. Consider commit message context for relevance
4. Enable fully local semantic search option

---

## 9. Security Considerations

### Key Findings

**Security Degradation in Iterative AI Code Generation:**
- Source: [arxiv.org/pdf/2506.11022](https://arxiv.org/pdf/2506.11022)
- Iterative code generation can introduce security vulnerabilities
- Need for security-aware generation pipelines

**Developer False Confidence:**
- Participants using AI wrote "significantly less secure code"
- Exhibited "false sense of security"
- Need for security verification in workflows

### Implications for CodeBuddy
1. Add security scanning to generation pipeline
2. Warn users about potential security issues
3. Consider security-focused verification step
4. Don't auto-approve security-sensitive code

---

## 10. Summary: Research-Backed Improvement Priorities

### High-Impact Techniques from Research

| Technique | Research Support | Improvement Potential |
|-----------|------------------|----------------------|
| **TDD Integration** | 45.97% accuracy improvement | High |
| **Graph-based RAG** | +35.57 points Pass@1 | High |
| **Multi-agent Specialization** | ChatDev, MetaGPT success | Medium-High |
| **AST-based Context** | +2-3 points various tasks | Medium |
| **Speculative Decoding** | 2-4x speed improvement | Medium |
| **Semantic Code Search** | Better relevance | Medium |
| **Security Verification** | Addresses real risks | Medium |

### Research Gaps to Monitor
- True reasoning vs memorization in benchmarks
- Complex task completion (30k+ LOC)
- Long-context handling for TDD
- Security in iterative generation
