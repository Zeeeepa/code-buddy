import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { glob } from 'glob';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

const pendingApprovals = new Map();

app.post('/api/approve', (req, res) => {
    const { approvalId, approved } = req.body;
    if (pendingApprovals.has(approvalId)) {
        pendingApprovals.get(approvalId)(approved);
        pendingApprovals.delete(approvalId);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Approval request not found or already processed." });
    }
});

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('API_KEY is not set. Please set GOOGLE_API_KEY or GEMINI_API_KEY environment variable.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

const execAsync = promisify(exec);

let mcpClient = null;
let mcpTools = [];

async function setupMcpClient() {
  try {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["mcp_server.mjs"]
    });
    
    mcpClient = new Client({
      name: "gemini-chatbox-client",
      version: "1.0.0",
    }, {
      capabilities: {}
    });

    await mcpClient.connect(transport);
    console.log("Connected to MCP server.");

    const toolsList = await mcpClient.listTools();
    
    mcpTools = toolsList.tools.map(tool => ({
      name: tool.name,
      description: tool.description || "MCP Tool",
      parameters: {
        type: tool.inputSchema?.type || "object",
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || []
      }
    }));

    console.log(`Loaded ${mcpTools.length} MCP tools.`);
  } catch (error) {
    console.error("Failed to initialize MCP client:", error);
  }
}
setupMcpClient();

const tools = {
  run_shell_command: async ({ command }) => {
    try {
      const { stdout, stderr } = await execAsync(command);
      const limit = 4000;
      return { 
        stdout: stdout.length > limit ? stdout.slice(0, limit) + `\n...[Output truncated to ${limit} chars]...` : stdout, 
        stderr: stderr.length > limit ? stderr.slice(0, limit) + `\n...[Output truncated to ${limit} chars]...` : stderr
      };
    } catch (error) {
      const limit = 4000;
      return { 
        error: error.message, 
        stderr: error.stderr && error.stderr.length > limit ? error.stderr.slice(0, limit) + `\n...[Output truncated to ${limit} chars]...` : (error.stderr || '')
      };
    }
  },
  read_file: async ({ file_path }) => {
    try {
      const content = await fs.readFile(file_path, 'utf8');
      const limit = 10000;
      return { 
        content: content.length > limit ? content.slice(0, limit) + `\n\n...[File too large. Output truncated to ${limit} chars. Use grep_search or read a smaller file.]...` : content 
      };
    } catch (error) {
      return { error: error.message };
    }
  },
  write_file: async ({ file_path, content }) => {
    try {
      await fs.writeFile(file_path, content, 'utf8');
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  },
  glob_search: async ({ pattern }) => {
    try {
      const files = await glob(pattern, { nodir: true });
      return { files: files.slice(0, 100) };
    } catch (error) {
      return { error: error.message };
    }
  },
  grep_search: async ({ pattern, dir_path = '.' }) => {
    try {
      const isWin = process.platform === 'win32';
      // Escaping for cmd is tricky, we replace " with \" 
      const escapedPattern = pattern.replace(/"/g, '\\"');
      
      const cmd = isWin 
        ? `findstr /S /N /I /C:"${escapedPattern}" "${dir_path}\\*"` 
        : `grep -rnI "${escapedPattern}" "${dir_path}"`;
      
      const { stdout } = await execAsync(cmd, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 });
      const matches = stdout.split('\n').filter(l => l.trim()).slice(0, 200);
      return { matches: matches.length > 0 ? matches : ["No matches found."] };
    } catch (error) {
       // findstr/grep return exit code 1 if no matches, which throws an error in exec
       if (error.code === 1) {
           return { matches: ["No matches found."] };
       }
       return { error: error.message };
    }
  },
  edit_file_lines: async ({ file_path, start_line, end_line, new_content }) => {
    try {
      const content = await fs.readFile(file_path, 'utf8');
      const lines = content.split('\n');
      
      // 1-indexed handling
      if (start_line < 1 || start_line > lines.length || end_line < start_line) {
          return { error: "Invalid line numbers" };
      }
      
      const before = lines.slice(0, start_line - 1);
      const after = lines.slice(end_line);
      const updatedLines = [...before, new_content, ...after];
      
      await fs.writeFile(file_path, updatedLines.join('\n'), 'utf8');
      return { success: true };
    } catch (error) {
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

function getModel() {
  const combinedTools = [...functionDeclarations, ...mcpTools];
  const osInfo = process.platform;
  const currentDir = process.cwd();
  const currentDate = new Date().toLocaleString();

  const systemPrompt = `You are Code Buddy, an autonomous AI coding assistant. You have access to the file system and terminal. 
Use your tools to investigate and resolve the user's request. If you need to make changes to files, verify the changes. 
Always prefer using specific tools over shell commands where possible.

<environment_context>
Operating System: ${osInfo}
Current Working Directory: ${currentDir}
Current Date and Time: ${currentDate}
</environment_context>`;

  return genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: combinedTools }],
  });
}

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.post('/api/chat', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { message, history = [] } = req.body;
    if (!message) {
      sendEvent('error', { message: 'Message is required' });
      return res.end();
    }

    const chat = getModel().startChat({ history });
    let stepCount = 0;
    const MAX_STEPS = 10;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    let currentMessage = message;

    // Agentic Loop
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
        // Final text response is complete
        sendEvent('message_complete', { 
            usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
            history: await chat.getHistory()
        });
        break; // No more tool calls, exit loop
      }

      const functionResponses = [];
      for (const call of functionCalls) {
        const { name, args } = call;
        let functionResponseData;
        
        console.log(`[Agent Tool Call] ${name}(${JSON.stringify(args)})`);
        sendEvent('tool_call', { name, args });
        
        if (tools[name]) {
          functionResponseData = await tools[name](args);
        } else if (mcpTools.find(t => t.name === name) && mcpClient) {
          try {
            const mcpResult = await mcpClient.callTool({
                name,
                arguments: args
            });
            // Extract the text content from the MCP result
            functionResponseData = { 
                result: mcpResult.content.map(c => c.text).join('\n') 
            };
          } catch (mcpError) {
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

      // Prepare for the next turn
      currentMessage = functionResponses;
    }

    res.end();

  } catch (error) {
    console.error('Error during chat:', error);
    sendEvent('error', { message: 'Internal server error', details: error.message });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
