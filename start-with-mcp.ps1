# Set this to the absolute path of the GitNexus executable
$GITNEXUS_BIN = "C:\Users\patri\CascadeProjects\gitnexus-rs\target\release\gitnexus.exe"

if (-Not (Test-Path $GITNEXUS_BIN)) {
    Write-Host "GitNexus binary not found at $GITNEXUS_BIN. Please compile it first with 'cargo build --release'." -ForegroundColor Red
    exit 1
}

# Set MCP Environment Variables for Code Buddy
$env:CODEBUDDY_MCP_COMMAND = $GITNEXUS_BIN
$env:CODEBUDDY_MCP_ARGS = "mcp"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Code Buddy V2 + GitNexus MCP Integration       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "MCP Command: $env:CODEBUDDY_MCP_COMMAND" -ForegroundColor Yellow
Write-Host "MCP Args: $env:CODEBUDDY_MCP_ARGS" -ForegroundColor Yellow
Write-Host "Starting Code Buddy...`n" -ForegroundColor Green

# Launch Code Buddy (Assumes we are in the grok-cli directory)
npm start
