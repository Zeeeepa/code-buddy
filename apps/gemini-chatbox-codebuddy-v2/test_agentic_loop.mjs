import http from 'http';
import { exec } from 'child_process';

const serverProcess = exec('npm start');

let testPassed = false;

serverProcess.stdout.on('data', (data) => {
  console.log(`Server: ${data}`);
  if (data.includes('Server is running')) {
    setTimeout(() => {
      const postData = JSON.stringify({ message: "Use the `hello_mcp` tool to say hello to 'CodeBuddy'." });
      
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        let toolsUsed = 0;
        res.setEncoding('utf8');
        res.on('data', (chunk) => { 
            responseData += chunk; 
            if (chunk.includes('event: tool_call')) {
                toolsUsed++;
            }
            
            // Auto-approve test
            if (chunk.includes('event: ask_approval')) {
                try {
                    const dataMatch = chunk.match(/data: (.*)/);
                    if (dataMatch) {
                        const data = JSON.parse(dataMatch[1]);
                        if (data.approvalId) {
                            console.log(`Auto-approving tool: ${data.name}`);
                            const approveData = JSON.stringify({ approvalId: data.approvalId, approved: true });
                            const approveReq = http.request({
                                hostname: 'localhost',
                                port: 3000,
                                path: '/api/approve',
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Content-Length': Buffer.byteLength(approveData)
                                }
                            });
                            approveReq.write(approveData);
                            approveReq.end();
                        }
                    }
                } catch(e) {}
            }
        });
        res.on('end', () => {
          console.log(`Chat Response Stream:\n${responseData}`);
          if (toolsUsed > 0) {
              console.log("Agentic loop successfully tested (SSE Stream mode)!");
              testPassed = true;
          } else {
              console.log("No tools used in response. Response might not have triggered loop properly.");
          }
          serverProcess.kill();
          process.exit(testPassed ? 0 : 1);
        });
      });

      req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
        serverProcess.kill();
        process.exit(1);
      });

      req.write(postData);
      req.end();
    }, 2000); // Give server 2 seconds to start
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error(`Server Error: ${data}`);
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  if (!testPassed) process.exit(1);
});
