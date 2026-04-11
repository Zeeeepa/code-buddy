document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const messagesDiv = document.getElementById('messages');

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
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });

            if (!response.ok) {
                addMessage(`Error: HTTP ${response.status}`, 'bot');
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
                    const toolsSummary = currentTools.map(t => `[${t}]`).join(' ');
                    content += `🛠️ Tools used: ${toolsSummary}\n\n`;
                }
                if (finalText) {
                    content += finalText;
                } else {
                    content += '...';
                }
                if (usage) {
                    content += `\n\n📊 Tokens - Input: ${usage.inputTokens} | Output: ${usage.outputTokens}`;
                }
                botMessageElement.textContent = content;
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            };

            updateBotMessage(); // Initial state
            
            let buffer = '';
            let finalText = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');
                buffer = parts.pop();
                
                for (const chunk of parts) {
                    const eventMatch = chunk.match(/event: (.*?)\n/);
                    const dataMatch = chunk.match(/data: (.*)/);
                    
                    if (eventMatch && dataMatch) {
                        const event = eventMatch[1];
                        const data = JSON.parse(dataMatch[1]);
                        
                        if (event === 'tool_call') {
                            const statusEmoji = data.status === 'denied' ? '❌ ' : '';
                            currentTools.push(`${statusEmoji}${data.name}`);
                            updateBotMessage(finalText);
                        } else if (event === 'ask_approval') {
                            const approvalDiv = document.createElement('div');
                            approvalDiv.classList.add('message', 'bot', 'approval-box');
                            approvalDiv.innerHTML = `
                                <strong>⚠️ Approval Required</strong><br>
                                The agent wants to execute: <code>${data.name}</code><br>
                                <pre>${JSON.stringify(data.args, null, 2)}</pre>
                                <div style="margin-top: 10px;">
                                    <button class="approve-btn" data-id="${data.approvalId}" style="background-color: #4CAF50; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px; margin-right: 10px;">Allow</button>
                                    <button class="deny-btn" data-id="${data.approvalId}" style="background-color: #f44336; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;">Deny</button>
                                </div>
                            `;
                            messagesDiv.appendChild(approvalDiv);
                            messagesDiv.scrollTop = messagesDiv.scrollHeight;
                            
                            const handleApproval = async (approved) => {
                                approvalDiv.innerHTML = `<em>${approved ? '✅ Approved' : '❌ Denied'}</em>`;
                                await fetch('/api/approve', {
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
                        } else if (event === 'message') { // Fallback for older server versions
                            finalText = data.text;
                            updateBotMessage(finalText, data.usage);
                        } else if (event === 'error') {
                            updateBotMessage(`Error: ${data.message}\n${data.details || ''}`);
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