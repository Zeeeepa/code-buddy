# Error Boundaries

Specialized error boundary components for the React/Ink terminal UI. These components provide robust error handling for different failure scenarios with automatic recovery options.

## Components

### ToolErrorBoundary

Catches and handles tool execution errors with retry capabilities.

**Features:**
- Detects error types (execution failed, timeout, permission denied, etc.)
- Automatic retry with exponential backoff
- Detailed error logging
- Visual feedback for retry attempts

**Usage:**
```tsx
import { ToolErrorBoundary } from './error-boundaries';

<ToolErrorBoundary
  toolName="bash"
  onRetry={() => retryToolExecution()}
  maxRetries={3}
  showDetails={true}
>
  <BashToolComponent />
</ToolErrorBoundary>
```

### NetworkErrorBoundary

Catches and handles API and network errors with connection status and retry logic.

**Features:**
- Connection status monitoring (online, offline, degraded)
- Exponential backoff with jitter
- Countdown timer for auto-retry
- Offline mode option
- Handles various network errors (timeout, DNS, SSL, rate limit, etc.)

**Usage:**
```tsx
import { NetworkErrorBoundary } from './error-boundaries';

<NetworkErrorBoundary
  apiEndpoint="https://api.x.ai/v1"
  onRetry={() => retryApiCall()}
  onOfflineMode={() => switchToOfflineMode()}
  maxRetries={5}
  showDetails={true}
>
  <ApiComponent />
</NetworkErrorBoundary>
```

### FileErrorBoundary

Catches and handles file system errors with recovery actions.

**Features:**
- Detects file system error types (not found, permission denied, disk full, etc.)
- Auto-creates missing directories
- Suggests recovery actions
- Permission error handling
- Visual feedback with error-specific icons

**Usage:**
```tsx
import { FileErrorBoundary } from './error-boundaries';

<FileErrorBoundary
  filePath="/path/to/file.txt"
  onRetry={() => retryFileOperation()}
  onCreateDirectory={(dir) => console.log(`Created ${dir}`)}
  autoCreateDirectories={true}
  showDetails={true}
>
  <FileComponent />
</FileErrorBoundary>
```

### CompositeErrorBoundary

Combines all specialized error boundaries in a single wrapper.

**Usage:**
```tsx
import { CompositeErrorBoundary } from './error-boundaries';

<CompositeErrorBoundary
  toolName="file-editor"
  apiEndpoint="https://api.x.ai/v1"
  filePath="/path/to/file.txt"
  showDetails={true}
  onError={(error, source) => console.log(`Error from ${source}:`, error)}
>
  <ComplexComponent />
</CompositeErrorBoundary>
```

## Higher-Order Components

Each error boundary also has a HOC wrapper:

```tsx
import { withToolErrorBoundary } from './error-boundaries';

const SafeBashTool = withToolErrorBoundary(BashToolComponent, {
  toolName: 'bash',
  maxRetries: 3,
  showDetails: true,
});
```

## Utility Functions

### createErrorBoundary

Factory function to create error boundaries:

```tsx
import { createErrorBoundary } from './error-boundaries';

const ErrorBoundary = createErrorBoundary('network');
```

### detectErrorBoundaryType

Automatically detect which error boundary to use:

```tsx
import { detectErrorBoundaryType } from './error-boundaries';

try {
  // some operation
} catch (error) {
  const type = detectErrorBoundaryType(error);
  console.log(`Use ${type} error boundary`);
}
```

## Error Types

### ToolErrorType
- `EXECUTION_FAILED`
- `INVALID_PARAMETERS`
- `TIMEOUT`
- `PERMISSION_DENIED`
- `RESOURCE_NOT_FOUND`
- `UNKNOWN`

### NetworkErrorType
- `CONNECTION_REFUSED`
- `TIMEOUT`
- `DNS_FAILURE`
- `SSL_ERROR`
- `RATE_LIMIT`
- `SERVER_ERROR`
- `CLIENT_ERROR`
- `NETWORK_UNREACHABLE`
- `UNKNOWN`

### FileErrorType
- `NOT_FOUND`
- `PERMISSION_DENIED`
- `ALREADY_EXISTS`
- `IS_DIRECTORY`
- `NOT_DIRECTORY`
- `DISK_FULL`
- `READ_ONLY`
- `INVALID_PATH`
- `SYMLINK_LOOP`
- `TOO_MANY_OPEN`
- `UNKNOWN`

## Best Practices

1. **Use specific boundaries** for known error types
2. **Enable showDetails** during development
3. **Provide retry callbacks** for recoverable errors
4. **Use CompositeErrorBoundary** for complex components
5. **Log errors** in production for monitoring
6. **Set appropriate maxRetries** based on operation type

## Examples

### Basic Tool Error Handling
```tsx
<ToolErrorBoundary toolName="grep" maxRetries={2}>
  <GrepTool pattern="error" files={['*.log']} />
</ToolErrorBoundary>
```

### Network Error with Offline Fallback
```tsx
<NetworkErrorBoundary
  apiEndpoint="https://api.x.ai/v1"
  onOfflineMode={() => setOffline(true)}
>
  <ChatInterface />
</NetworkErrorBoundary>
```

### File Error with Auto-Recovery
```tsx
<FileErrorBoundary
  filePath={outputPath}
  autoCreateDirectories={true}
  onCreateDirectory={(dir) => logger.info(`Created ${dir}`)}
>
  <FileWriter path={outputPath} content={content} />
</FileErrorBoundary>
```

### Full Protection Stack
```tsx
<CompositeErrorBoundary
  toolName="file-analyzer"
  apiEndpoint="https://api.x.ai/v1"
  filePath="/path/to/analyze"
  showDetails={process.env.NODE_ENV === 'development'}
>
  <FileAnalyzer />
</CompositeErrorBoundary>
```
