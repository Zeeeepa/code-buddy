/**
 * Gemini Agent V2 Routes
 *
 * Serves the native implementation of the gemini-chatbox-codebuddy-v2 PoC.
 * This runs an autonomous agentic loop with SSE streaming, MCP tools, and Human-in-the-loop approvals.
 */

import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { glob } from 'fast-glob'; // Use fast-glob which is already in Code Buddy
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { logger } from '../../utils/logger.js';

const execAsync = promisify(exec);
const router = Router();

const pendingApprovals = new Map();
let mcpClient: any = null;
let mcpTools: any[] = [];

// Initialize MCP (Optional/Stub for now or connects to local MCP)
async function setupMcpClient() {
  try {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["-e", "console.log('MCP Placeholder')"] // Replace with actual MCP server later if needed
    });
    
    mcpClient = new Client({
      name: "codebuddy-native-client",
      version: "1.0.0",
    }, {
      capabilities: {}
    });

    // Don't await connect here to avoid blocking server start if MCP fails
    mcpClient.connect(transport).then(async () => {
      try {
        const toolsList = await mcpClient.listTools();
        mcpTools = toolsList.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description || "MCP Tool",
          parameters: {
            type: tool.inputSchema?.type || "object",
            properties: tool.inputSchema?.properties || {},
            required: tool.inputSchema?.required || []
          }
        }));
        logger.info(`Loaded ${mcpTools.length} MCP tools natively.`);
      } catch (e) {}
    }).catch(() => {});
  } catch (error: any) {
    logger.error("Failed to initialize MCP client:", error instanceof Error ? error : new Error(String(error)));
  }
}
setupMcpClient();

const tools: Record<string, Function> = {
  run_shell_command: async ({ command }: { command: string }) => {
    try {
      const { stdout, stderr } = await execAsync(command);
      const limit = 4000;
      return { 
        stdout: stdout.length > limit ? stdout.slice(0, limit) + `\n...[Output truncated to ${limit} chars]...` : stdout, 
        stderr: stderr.length > limit ? stderr.slice(0, limit) + `\n...[Output truncated to ${limit} chars]...` : stderr
      };
    } catch (error: any) {
      const limit = 4000;
      return { 
        error: error.message, 
        stderr: error.stderr && error.stderr.length > limit ? error.stderr.slice(0, limit) + `\n...[Output truncated to ${limit} chars]...` : (error.stderr || '')
      };
    }
  },
  read_file: async ({ file_path }: { file_path: string }) => {
    try {
      const content = await fs.readFile(file_path, 'utf8');
      const limit = 10000;
      return { 
        content: content.length > limit ? content.slice(0, limit) + `\n\n...[File too large. Output truncated to ${limit} chars. Use grep_search or read a smaller file.]...` : content 
      };
    } catch (error: any) {
      return { error: error.message };
    }
  },
  write_file: async ({ file_path, content }: { file_path: string, content: string }) => {
    try {
      await fs.writeFile(file_path, content, 'utf8');
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  },
  glob_search: async ({ pattern }: { pattern: string }) => {
    try {
      const files = await glob(pattern, { onlyFiles: true });
      return { files: files.slice(0, 100) };
    } catch (error: any) {
      return { error: error.message };
    }
  },
  grep_search: async ({ pattern, dir_path = '.' }: { pattern: string, dir_path?: string }) => {
    try {
      const isWin = process.platform === 'win32';
      const escapedPattern = pattern.replace(/"/g, '\\"');
      
      const cmd = isWin 
        ? `findstr /S /N /I /C:"${escapedPattern}" "${dir_path}\\*"` 
        : `grep -rnI "${escapedPattern}" "${dir_path}"`;
      
      const { stdout } = await execAsync(cmd, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 });
      const matches = stdout.split('\n').filter(l => l.trim()).slice(0, 200);
      return { matches: matches.length > 0 ? matches : ["No matches found."] };
    } catch (error: any) {
       if (error.code === 1) {
           return { matches: ["No matches found."] };
       }
       return { error: error.message };
    }
  },
  edit_file_lines: async ({ file_path, start_line, end_line, new_content }: { file_path: string, start_line: number, end_line: number, new_content: string }) => {
    try {
      const content = await fs.readFile(file_path, 'utf8');
      const lines = content.split('\n');
      
      if (start_line < 1 || start_line > lines.length || end_line < start_line) {
          return { error: "Invalid line numbers" };
      }
      
      const before = lines.slice(0, start_line - 1);
      const after = lines.slice(end_line);
      const updatedLines = [...before, new_content, ...after];
      
      await fs.writeFile(file_path, updatedLines.join('\n'), 'utf8');
      return { success: true };
    } catch (error: any) {
      return { error: error.message };
    }
  }
};

const functionDeclarations = [
  {
    name: "run_shell_command",
    description: "Executes a given shell command and returns the output.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Exact command to execute" }
      },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Reads the content of a file.",
    parameters: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path to the file to read" }
      },
      required: ["file_path"],
    },
  },
  {
    name: "write_file",
    description: "Writes content to a file.",
    parameters: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path to the file to write" },
        content: { type: "string", description: "Content to write to the file" }
      },
      required: ["file_path", "content"],
    },
  },
  {
    name: "glob_search",
    description: "Search for files using a glob pattern (e.g., '**/*.js'). Returns up to 100 file paths.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "The glob pattern to match" }
      },
      required: ["pattern"],
    },
  },
  {
    name: "grep_search",
    description: "Search for a specific string pattern within files in a directory.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "The literal string to search for" },
        dir_path: { type: "string", description: "The directory to search in. Defaults to '.'" }
      },
      required: ["pattern"],
    },
  },
  {
    name: "edit_file_lines",
    description: "Replaces specific lines within a file with new content. Use this to safely edit files.",
    parameters: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "The path to the file to modify." },
        start_line: { type: "number", description: "The 1-indexed starting line number to replace." },
        end_line: { type: "number", description: "The 1-indexed ending line number to replace (inclusive)." },
        new_content: { type: "string", description: "The new content to insert in place of the removed lines." }
      },
      required: ["file_path", "start_line", "end_line", "new_content"],
    },
  }
];

function getModel(specialty?: string) {
  const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
  const genAI = new GoogleGenerativeAI(API_KEY);
  
  // For specialized planning models, only provide read-only tools
  let allowedTools = [...functionDeclarations, ...mcpTools];
  if (specialty) {
    allowedTools = allowedTools.filter(t => !['run_shell_command', 'write_file', 'edit_file_lines'].includes(t.name));
  }

  const osInfo = process.platform;
  const currentDir = process.cwd();
  const currentDate = new Date().toLocaleString();

  let specialtyFocus = "";
  if (specialty === "performance") specialtyFocus = "Your exclusive focus is highly optimized PERFORMANCE. Architecture must be blazingly fast and scalable.";
  if (specialty === "security") specialtyFocus = "Your exclusive focus is military-grade SECURITY. Architecture must be bulletproof against all attack vectors.";
  if (specialty === "simplicity") specialtyFocus = "Your exclusive focus is extreme SIMPLICITY. Architecture must be minimal, readable, and elegant.";

  const systemPrompt = `You are Code Buddy, an autonomous AI coding assistant. You have access to the file system and terminal. 
Use your tools to investigate and resolve the user's request. If you need to make changes to files, verify the changes. 
Always prefer using specific tools over shell commands where possible.
${specialtyFocus}

<environment_context>
Operating System: ${osInfo}
Current Working Directory: ${currentDir}
Current Date and Time: ${currentDate}
</environment_context>`;

  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: allowedTools }] as any,
  });
}

// ----------------------------------------------------------------------------
// API Routes
// ----------------------------------------------------------------------------

router.post('/api/approve', (req: Request, res: Response) => {
    const { approvalId, approved } = req.body;
    if (pendingApprovals.has(approvalId)) {
        pendingApprovals.get(approvalId)(approved);
        pendingApprovals.delete(approvalId);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Approval request not found or already processed." });
    }
});

router.post('/api/chat', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { message, history = [] } = req.body;
    if (!message) {
      sendEvent('error', { message: 'Message is required' });
      return res.end();
    }

    if (message.startsWith('/ultraplan')) {
        const prompt = message.replace('/ultraplan', '').trim();
        sendEvent('text_chunk', { text: "🚀 **Starting Ultraplan (Parallel Best-of-N Execution)**\n\nSpawning 3 specialized sub-agents (Performance, Security, Simplicity) to explore the codebase in parallel...\n\n" });
        
        const specialties = ['performance', 'security', 'simplicity'];
        const parallelPromises = specialties.map(async (specialty) => {
            const chat = getModel(specialty).startChat({ history });
            // Let them explore for max 3 steps to build their plan
            let step = 0;
            let currentMsg = prompt + "\nCreate a detailed execution plan. You can use read-only tools to explore the codebase first.";
            let finalPlan = "";
            while (step < 3) {
                step++;
                const result = await chat.sendMessage(currentMsg);
                const calls = result.response.functionCalls();
                if (!calls || calls.length === 0) {
                    finalPlan = result.response.text();
                    break;
                }
                const responses = [];
                for (const call of calls) {
                    if (tools[call.name]) {
                        responses.push({ functionResponse: { name: call.name, response: await tools[call.name](call.args as any) } });
                    } else {
                        responses.push({ functionResponse: { name: call.name, response: { error: "Tool not found" } } });
                    }
                }
                currentMsg = responses as any;
            }
            if (!finalPlan) finalPlan = "Plan exploration timed out.";
            sendEvent('text_chunk', { text: `✅ Agent **${specialty}** completed its plan.\n` });
            return { specialty, plan: finalPlan };
        });

        const plans = await Promise.all(parallelPromises);
        
        sendEvent('text_chunk', { text: "\n⚖️ **All plans generated. The Judge model is evaluating the best path...**\n\n" });
        
        const judgePrompt = `The user requested: "${prompt}".\n\nHere are 3 potential implementation plans generated by specialized sub-agents:\n\n${plans.map(p => `### Plan (${p.specialty.toUpperCase()}):\n${p.plan}\n`).join('\n')}\n\nPlease synthesize these into the single ultimate, safest, and most robust execution plan.`;
        
        const judgeStream = await getModel().generateContentStream(judgePrompt);
        let finalText = "";
        for await (const chunk of judgeStream.stream) {
            const text = chunk.text();
            if (text) {
                finalText += text;
                sendEvent('text_chunk', { text });
            }
        }
        
        sendEvent('message_complete', { 
            usage: { inputTokens: 0, outputTokens: 0 },
            history: [...history, { role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text: finalText }] }]
        });
        res.end();
        return;
    }

    const chat = getModel().startChat({ history });
    let stepCount = 0;
    const MAX_STEPS = 10;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    let currentMessage = message;

    while (stepCount < MAX_STEPS) {
      stepCount++;
      
      const streamResult = await chat.sendMessageStream(currentMessage);
      let hasFunctionCalls = false;

      for await (const chunk of streamResult.stream) {
        const calls = chunk.functionCalls();
        if (calls && calls.length > 0) {
            hasFunctionCalls = true;
        } else if (!hasFunctionCalls && chunk.text) {
            try {
                const textChunk = chunk.text();
                if (textChunk) {
                    sendEvent('text_chunk', { text: textChunk });
                }
            } catch(e) {}
        }
      }

      const response = await streamResult.response;
      
      if (response.usageMetadata) {
        totalInputTokens += response.usageMetadata.promptTokenCount || 0;
        totalOutputTokens += response.usageMetadata.candidatesTokenCount || 0;
      }
      
      const functionCalls = response.functionCalls();
      if (!functionCalls || functionCalls.length === 0) {
        sendEvent('message_complete', { 
            usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
            history: await chat.getHistory()
        });
        break;
      }

      const functionResponses = [];
      for (const call of functionCalls) {
        const { name, args } = call;
        let functionResponseData;
        
        logger.info(`[Native Agent Tool Call] ${name}(${JSON.stringify(args)})`);
        
        const isDangerous = ['run_shell_command', 'write_file', 'edit_file_lines'].includes(name);
        
        if (isDangerous) {
            const approvalId = Math.random().toString(36).substring(7);
            sendEvent('ask_approval', { approvalId, name, args });
            
            const approved = await new Promise(resolve => {
                pendingApprovals.set(approvalId, resolve);
            });
            
            if (!approved) {
                logger.info(`[Native Agent Tool Call] Denied: ${name}`);
                sendEvent('tool_call', { name, args, status: 'denied' });
                functionResponses.push({
                  functionResponse: {
                    name,
                    response: { error: "User denied the operation." }
                  }
                });
                continue;
            }
        }

        sendEvent('tool_call', { name, args, status: 'approved' });
        
        if (tools[name]) {
          functionResponseData = await tools[name](args as any);
        } else if (mcpTools.find(t => t.name === name) && mcpClient) {
          try {
            const mcpResult = await mcpClient.callTool({
                name,
                arguments: args
            });
            functionResponseData = { 
                result: mcpResult.content.map((c: any) => c.text).join('\n') 
            };
          } catch (mcpError: any) {
            functionResponseData = { error: mcpError.message };
          }
        } else {
          functionResponseData = { error: `Tool ${name} not found.` };
        }
        
        functionResponses.push({
          functionResponse: {
            name,
            response: functionResponseData
          }
        });
      }
      currentMessage = functionResponses as any;
    }

    res.end();
    res.end();
    return;

    } catch (error: any) {
    logger.error('Error during native agent chat:', error);
    sendEvent('error', { message: 'Internal server error', details: error.message });
    res.end();
    return;
    }
    });

// ----------------------------------------------------------------------------
// Web UI (Self-contained HTML/JS)
// ----------------------------------------------------------------------------

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Native Code Buddy V2</title>
    <style>
        body {
            font-family: sans-serif;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            background-color: #f4f4f4;
        }
        .chat-container {
            width: 100%;
            max-width: 800px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            height: 90vh;
        }
        .header {
            background-color: #24292e;
            color: white;
            padding: 15px;
            text-align: center;
            font-weight: bold;
        }
        .messages {
            flex-grow: 1;
            padding: 20px;
            overflow-y: auto;
            border-bottom: 1px solid #eee;
        }
        .message {
            margin-bottom: 10px;
            padding: 8px 12px;
            border-radius: 4px;
            max-width: 90%;
            white-space: pre-wrap;
        }
        .message.user {
            background-color: #e0f7fa;
            align-self: flex-end;
            margin-left: auto;
        }
        .message.bot {
            background-color: #f1f8e9;
            align-self: flex-start;
            margin-right: auto;
            font-family: monospace;
        }
        .message.bot.approval-box {
            background-color: #fff3cd;
            border: 1px solid #ffeeba;
        }
        .input-area {
            display: flex;
            padding: 20px;
            background-color: #fafafa;
        }
        .input-area input {
            flex-grow: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-right: 10px;
            font-size: 16px;
        }
        .input-area button {
            padding: 10px 20px;
            background-color: #2ea44f;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }
        .input-area button:hover {
            background-color: #2c974b;
        }
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="header">Code Buddy Native V2 (Agentic Loop)</div>
        <div class="messages" id="messages"></div>
        <div class="input-area">
            <input type="text" id="messageInput" placeholder="Ask Code Buddy to do something...">
            <button id="sendButton">Send</button>
        </div>
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const messageInput = document.getElementById('messageInput');
            const sendButton = document.getElementById('sendButton');
            const messagesDiv = document.getElementById('messages');
            let chatHistory = [];

            const addMessage = (text, sender) => {
                const messageElement = document.createElement('div');
                messageElement.classList.add('message', sender);
                messageElement.textContent = text;
                messagesDiv.appendChild(messageElement);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            };

            const sendMessage = async () => {
                const message = messageInput.value.trim();
                if (message === '') return;

                addMessage(message, 'user');
                messageInput.value = '';

                try {
                    const response = await fetch('/__codebuddy__/agent-v2/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ message, history: chatHistory }),
                    });

                    if (!response.ok) {
                        addMessage(\`Error: HTTP \${response.status}\`, 'bot');
                        return;
                    }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder('utf-8');
                    let botMessageElement = null;
                    let currentTools = [];

                    const updateBotMessage = (finalText = null, usage = null) => {
                        if (!botMessageElement) {
                            botMessageElement = document.createElement('div');
                            botMessageElement.classList.add('message', 'bot');
                            messagesDiv.appendChild(botMessageElement);
                        }
                        
                        let content = '';
                        if (currentTools.length > 0) {
                            const toolsSummary = currentTools.map(t => \`[\${t}]\`).join(' ');
                            content += \`🛠️ Tools used: \${toolsSummary}\\n\\n\`;
                        }
                        if (finalText) {
                            content += finalText;
                        } else {
                            content += '...';
                        }
                        if (usage) {
                            content += \`\\n\\n📊 Tokens - Input: \${usage.inputTokens} | Output: \${usage.outputTokens}\`;
                        }
                        botMessageElement.textContent = content;
                        messagesDiv.scrollTop = messagesDiv.scrollHeight;
                    };

                    updateBotMessage();
                    
                    let buffer = '';
                    let finalText = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        buffer += decoder.decode(value, { stream: true });
                        const parts = buffer.split('\\n\\n');
                        buffer = parts.pop();
                        
                        for (const chunk of parts) {
                            const eventMatch = chunk.match(/event: (.*?)\\n/);
                            const dataMatch = chunk.match(/data: (.*)/);
                            
                            if (eventMatch && dataMatch) {
                                const event = eventMatch[1];
                                const data = JSON.parse(dataMatch[1]);
                                
                                if (event === 'tool_call') {
                                    const statusEmoji = data.status === 'denied' ? '❌ ' : '';
                                    currentTools.push(\`\${statusEmoji}\${data.name}\`);
                                    updateBotMessage(finalText);
                                } else if (event === 'ask_approval') {
                                    const approvalDiv = document.createElement('div');
                                    approvalDiv.classList.add('message', 'bot', 'approval-box');
                                    approvalDiv.innerHTML = \`
                                        <strong>⚠️ Approval Required</strong><br>
                                        The agent wants to execute: <code>\${data.name}</code><br>
                                        <pre>\${JSON.stringify(data.args, null, 2)}</pre>
                                        <div style="margin-top: 10px;">
                                            <button class="approve-btn" data-id="\${data.approvalId}" style="background-color: #4CAF50; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px; margin-right: 10px;">Allow</button>
                                            <button class="deny-btn" data-id="\${data.approvalId}" style="background-color: #f44336; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">Deny</button>
                                        </div>
                                    \`;
                                    messagesDiv.appendChild(approvalDiv);
                                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                                    
                                    const handleApproval = async (approved) => {
                                        approvalDiv.innerHTML = \`<em>\${approved ? '✅ Approved' : '❌ Denied'}</em>\`;
                                        await fetch('/__codebuddy__/agent-v2/api/approve', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ approvalId: data.approvalId, approved })
                                        });
                                    };

                                    approvalDiv.querySelector('.approve-btn').addEventListener('click', () => handleApproval(true));
                                    approvalDiv.querySelector('.deny-btn').addEventListener('click', () => handleApproval(false));

                                } else if (event === 'text_chunk') {
                                    finalText += data.text;
                                    updateBotMessage(finalText);
                                } else if (event === 'message_complete') {
                                    if (data.history) chatHistory = data.history;
                                    updateBotMessage(finalText, data.usage);
                                } else if (event === 'error') {
                                    updateBotMessage(\`Error: \${data.message}\\n\${data.details || ''}\`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error sending message:', error);
                    addMessage('Error: Could not connect to the server.', 'bot');
                }
            };

            sendButton.addEventListener('click', sendMessage);
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        });
    </script>
</body>
</html>`;

router.get('/', (req: Request, res: Response) => {
  res.send(DASHBOARD_HTML);
});

export function createGeminiAgentRouter(): Router {
  return router;
}
