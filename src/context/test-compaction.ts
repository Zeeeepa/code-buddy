import { getSmartCompactionEngine, Message } from './smart-compaction.js';
import dotenv from 'dotenv';
dotenv.config();

async function testCompaction() {
  console.log("Testing Smart Context Compaction with LLM Summarization...");
  
  const engine = getSmartCompactionEngine({
    provider: 'gemini',
    channelType: 'cli',
    maxTokens: 50, // Force a very small token limit to trigger aggressive compaction
    targetTokens: 20
  });

  const mockMessages: Message[] = [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'I need a fast authentication system in Node.js.' },
    { role: 'assistant', content: 'Sure, we can use JSON Web Tokens (JWT) or session cookies. Which do you prefer?' },
    { role: 'user', content: 'Let us use JWT for stateless scalability. We will store it in a HttpOnly cookie.' },
    { role: 'assistant', content: 'Excellent choice. Storing JWTs in HttpOnly cookies prevents XSS attacks while remaining scalable.' },
    { role: 'user', content: 'Wait, no, actually I decided we should use Passport.js with Redis session store because our team knows it better.' },
    { role: 'assistant', content: 'Understood. We will pivot to Passport.js with a Redis-backed session store.' }
  ];

  console.log(`\nOriginal messages count: ${mockMessages.length}`);
  console.log("Compacting...");

  const { messages: compactedMessages, result } = await engine.compact(mockMessages);

  console.log(`\nCompaction successful: ${result.success}`);
  console.log(`Strategy used: ${result.strategy}`);
  console.log(`Tokens reduced from ${result.originalTokens} to ${result.compactedTokens}`);
  console.log(`Messages removed: ${result.messagesRemoved}`);
  
  console.log("\nFinal Message Array:");
  console.log(JSON.stringify(compactedMessages, null, 2));
}

testCompaction().catch(console.error);
