# Architecture Diagrams

This document contains Mermaid diagrams visualizing the Code Buddy architecture.

## System Overview

```mermaid
flowchart TB
    subgraph User["User Interface"]
        CLI[CLI Entry Point]
        TUI[Terminal UI<br/>React/Ink]
    end

    subgraph Core["Core Engine"]
        Agent[CodeBuddy Agent]
        Client[Grok API Client]
        Context[Context Manager]
    end

    subgraph Tools["Tool System"]
        FileOps[File Operations]
        Shell[Shell Executor]
        Search[Search Engine]
        Web[Web Tools]
    end

    subgraph External["External Services"]
        GrokAPI[Grok API]
        FS[File System]
        Git[Git Repository]
    end

    CLI --> TUI
    TUI --> Agent
    Agent --> Client
    Agent --> Context
    Agent --> FileOps
    Agent --> Shell
    Agent --> Search
    Agent --> Web
    Client --> GrokAPI
    FileOps --> FS
    Shell --> FS
    Search --> Git
```

## Agentic Loop

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Chat Interface
    participant A as Agent
    participant API as Grok API
    participant T as Tools
    participant FS as File System

    U->>UI: Send message
    UI->>A: processMessage()

    loop Agentic Loop (max 50 rounds)
        A->>API: streamChat()
        API-->>A: Response + Tool Calls

        alt Has Tool Calls
            loop For each tool call
                A->>T: executeTool()
                T->>FS: Perform operation
                FS-->>T: Result
                T-->>A: ToolResult
            end
            A->>API: Send tool results
        else No Tool Calls
            A-->>UI: Final response
        end
    end

    UI-->>U: Display response
```

## Message Flow

```mermaid
flowchart LR
    subgraph Input
        UserMsg[User Message]
        Context[Context<br/>Files, History]
    end

    subgraph Processing
        Tokenize[Token<br/>Counting]
        Compress[Context<br/>Compression]
        Select[Tool<br/>Selection]
    end

    subgraph API
        Request[API Request]
        Stream[Streaming<br/>Response]
    end

    subgraph Output
        Parse[Parse<br/>Response]
        Render[Render<br/>Markdown]
        Tools[Execute<br/>Tools]
    end

    UserMsg --> Tokenize
    Context --> Tokenize
    Tokenize --> Compress
    Compress --> Select
    Select --> Request
    Request --> Stream
    Stream --> Parse
    Parse --> Render
    Parse --> Tools
    Tools --> Request
```

## Tool Execution Flow

```mermaid
flowchart TD
    Start[Tool Call Received] --> Validate{Validate<br/>Arguments}

    Validate -->|Invalid| Error[Return Error]
    Validate -->|Valid| CheckType{Check Tool<br/>Type}

    CheckType -->|File Read| Read[Read File]
    CheckType -->|File Write| Confirm1{Requires<br/>Confirmation?}
    CheckType -->|Shell| Confirm2{Requires<br/>Confirmation?}
    CheckType -->|Search| Search[Execute Search]

    Confirm1 -->|Yes| Dialog1[Show Dialog]
    Confirm1 -->|No| Write[Write File]

    Dialog1 -->|Approved| Checkpoint[Create<br/>Checkpoint]
    Dialog1 -->|Rejected| Cancel1[Return Cancelled]

    Checkpoint --> Write

    Confirm2 -->|Yes| Dialog2[Show Dialog]
    Confirm2 -->|No| Execute[Execute Command]

    Dialog2 -->|Approved| Execute
    Dialog2 -->|Rejected| Cancel2[Return Cancelled]

    Read --> Result[Return Result]
    Write --> Result
    Search --> Result
    Execute --> Result
```

## Component Dependencies

```mermaid
graph TD
    subgraph Presentation
        index[index.ts]
        ChatInterface[ChatInterface]
        ChatHistory[ChatHistory]
        ChatInput[ChatInput]
        Dialogs[Dialogs]
    end

    subgraph Application
        Agent[CodeBuddyAgent]
        Tools[Tool Executor]
    end

    subgraph Services
        Client[GrokClient]
        Confirm[ConfirmationService]
        Context[ContextManager]
    end

    subgraph Utilities
        PathVal[PathValidator]
        CmdVal[CommandValidator]
        TokenCount[TokenCounter]
    end

    index --> ChatInterface
    ChatInterface --> ChatHistory
    ChatInterface --> ChatInput
    ChatInterface --> Dialogs
    ChatInterface --> Agent

    Agent --> Client
    Agent --> Tools
    Agent --> Context

    Tools --> Confirm
    Tools --> PathVal
    Tools --> CmdVal

    Context --> TokenCount
```

## Data Storage

```mermaid
erDiagram
    SESSION ||--o{ MESSAGE : contains
    SESSION ||--o{ CHECKPOINT : has
    SESSION {
        string id
        datetime startTime
        datetime endTime
        int tokensUsed
        float cost
    }
    MESSAGE {
        string id
        string role
        text content
        datetime timestamp
    }
    CHECKPOINT {
        string id
        string filePath
        text content
        datetime createdAt
    }

    TOOL_CALL }|--|| MESSAGE : "belongs to"
    TOOL_CALL {
        string id
        string name
        json arguments
        json result
        int duration
    }
```

## Security Layers

```mermaid
flowchart TB
    subgraph Layer1["Layer 1: Input Validation"]
        PathCheck[Path Traversal<br/>Detection]
        CmdCheck[Command<br/>Blacklist]
        ArgSanitize[Argument<br/>Sanitization]
    end

    subgraph Layer2["Layer 2: Confirmation"]
        Preview[Operation<br/>Preview]
        UserApproval[User<br/>Approval]
        SessionFlags[Session<br/>Permissions]
    end

    subgraph Layer3["Layer 3: Sandboxing"]
        WorkDir[Working Directory<br/>Restriction]
        FileBlacklist[Sensitive File<br/>Blacklist]
        Timeout[Command<br/>Timeout]
    end

    subgraph Layer4["Layer 4: Monitoring"]
        AuditLog[Operation<br/>Audit Log]
        ErrorCapture[Error<br/>Capture]
        CostTrack[Cost<br/>Tracking]
    end

    Input[User Input] --> Layer1
    Layer1 --> Layer2
    Layer2 --> Layer3
    Layer3 --> Execute[Execute Operation]
    Execute --> Layer4
```

## Analytics Pipeline

```mermaid
flowchart LR
    subgraph Collection
        Sessions[Session<br/>Events]
        Tools[Tool<br/>Metrics]
        API[API<br/>Usage]
    end

    subgraph Storage
        SQLite[(SQLite<br/>Database)]
        JSON[(JSON<br/>Files)]
    end

    subgraph Analysis
        ROI[ROI<br/>Calculator]
        Heatmap[Codebase<br/>Heatmap]
        Evolution[Code<br/>Evolution]
    end

    subgraph Export
        Dashboard[Local<br/>Dashboard]
        Prometheus[Prometheus<br/>Metrics]
        Webhook[Webhook<br/>Events]
    end

    Sessions --> SQLite
    Tools --> SQLite
    API --> JSON

    SQLite --> ROI
    SQLite --> Heatmap
    JSON --> Evolution

    ROI --> Dashboard
    Heatmap --> Dashboard
    Evolution --> Dashboard

    SQLite --> Prometheus
    SQLite --> Webhook
```

## Multi-Agent Coordination

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant PA as Plan Agent
    participant CA as Code Agent
    participant RA as Review Agent

    O->>PA: "Plan implementation"
    PA-->>O: Implementation Plan

    loop For each task
        O->>CA: Execute task
        CA-->>O: Code changes

        O->>RA: Review changes
        RA-->>O: Review feedback

        alt Issues found
            O->>CA: Fix issues
            CA-->>O: Updated code
        end
    end

    O-->>User: Complete
```

## Context Compression

```mermaid
flowchart TD
    Start[New Message] --> Count[Count Total Tokens]

    Count --> Check{Exceeds<br/>Limit?}

    Check -->|No| Send[Send to API]
    Check -->|Yes| Strategy{Select<br/>Strategy}

    Strategy --> Summarize[Summarize<br/>Old Messages]
    Strategy --> Truncate[Truncate<br/>Tool Results]
    Strategy --> Drop[Drop Least<br/>Important]

    Summarize --> Recount[Recount Tokens]
    Truncate --> Recount
    Drop --> Recount

    Recount --> Check2{Still<br/>Exceeds?}

    Check2 -->|No| Send
    Check2 -->|Yes| Strategy
```

## State Machine: Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Initializing

    Initializing --> Ready: API Key Valid
    Initializing --> Error: API Key Invalid

    Ready --> Processing: User Message

    Processing --> ToolExecution: Tool Call
    Processing --> Streaming: Text Response
    Processing --> Error: API Error

    ToolExecution --> AwaitConfirm: Needs Confirm
    ToolExecution --> Processing: Auto-approved

    AwaitConfirm --> ToolExecution: Approved
    AwaitConfirm --> Processing: Rejected

    Streaming --> Ready: Complete

    Error --> Ready: Retry
    Error --> [*]: Fatal

    Ready --> [*]: Exit
```

## Deployment Architecture

```mermaid
flowchart TB
    subgraph Local["Local Installation"]
        CLI[Code Buddy CLI]
        Config[~/.codebuddy/]
        Cache[Response Cache]
    end

    subgraph Cloud["Cloud Services"]
        GrokAPI[Grok API<br/>api.x.ai]
        Ollama[Ollama<br/>localhost:11434]
        LMStudio[LM Studio<br/>localhost:1234]
    end

    subgraph Optional["Optional Integrations"]
        Prometheus[Prometheus<br/>:9090]
        Webhooks[Webhook<br/>Endpoints]
        REST[REST API<br/>:3000]
    end

    CLI --> GrokAPI
    CLI --> Ollama
    CLI --> LMStudio
    CLI --> Config
    CLI --> Cache

    CLI --> Prometheus
    CLI --> Webhooks
    CLI --> REST
```

---

## Rendering Diagrams

These diagrams use [Mermaid](https://mermaid.js.org/) syntax and can be rendered:

1. **GitHub**: Automatically renders in markdown files
2. **VS Code**: Install "Markdown Preview Mermaid Support" extension
3. **CLI**: Use `mmdc` (mermaid-cli) to generate SVG/PNG
4. **Web**: Paste into [Mermaid Live Editor](https://mermaid.live/)

```bash
# Install mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Generate PNG from this file
mmdc -i docs/architecture/diagrams.md -o diagrams.png
```
