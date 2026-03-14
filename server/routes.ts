import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";

// Read API key from environment variable
// Set OPENAI_API_KEY in .env locally or in Vercel dashboard for production
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const CHAT_SYSTEM_PROMPT = `You are MemoryForge, a friendly AI assistant that helps people build a personal memory/context file they can use with any AI system (Claude, ChatGPT, Perplexity, etc.).

Your goal is to have a natural conversation that gathers key facts about the user across these categories:
- Identity: name, role, profession, company, industry
- Expertise: skills, years of experience, what they're known for
- Current projects: what they're actively working on
- Goals: short and long-term goals, what they want AI help with  
- Working style: communication preference, detail level, tone
- Tools & stack: software and tools they use daily
- Key people: team members, clients, important relationships
- Personal context: location, timezone, relevant personal facts

Rules:
- Ask 1-2 questions at a time, never more
- Keep responses concise and conversational
- Follow up naturally based on answers ("That's interesting — tell me more about X")
- When you have enough info in a category, naturally move to the next
- After covering all 8 categories (or ~15-20 exchanges), say you have enough to generate their memory file and ask if they're ready
- When user confirms ready, respond with exactly: GENERATE_MEMORY_FILE followed by a JSON block with all collected data organized by category

Never break character. Be warm, curious, and professional.`;

const MEMORY_SYSTEM_PROMPT = `Based on this conversation, generate a beautifully formatted personal AI memory file. Format each fact as 'Remember that I...' organized into sections: Identity, Work & Expertise, Current Projects, Goals, Working Style, Tools & Stack, Key People, Personal Context. Start with a 2-3 sentence Quick Summary paragraph. Make it ready to paste into any AI system.`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // POST /api/chat — conversational endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, collectedData } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ message: "messages array is required" });
      }

      // Build the messages array for OpenAI
      const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        [
          { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
          ...messages.map(
            (m: { role: string; content: string }) =>
              ({
                role: m.role as "user" | "assistant",
                content: m.content,
              }) as OpenAI.Chat.Completions.ChatCompletionMessageParam
          ),
        ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 1024,
      });

      const responseContent =
        completion.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

      const isComplete = responseContent.includes("GENERATE_MEMORY_FILE");

      return res.json({
        message: responseContent,
        isComplete,
      });
    } catch (error: any) {
      console.error("OpenAI API error:", error?.message || error);
      return res
        .status(500)
        .json({ message: "Failed to get AI response. Please try again." });
    }
  });

  // POST /api/generate-memory — generate the memory file
  app.post("/api/generate-memory", async (req, res) => {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ memoryFile: "messages array is required" });
      }

      // Build conversation context for the memory generation
      const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        [
          { role: "system" as const, content: MEMORY_SYSTEM_PROMPT },
          ...messages.map(
            (m: { role: string; content: string }) =>
              ({
                role: m.role as "user" | "assistant",
                content: m.content,
              }) as OpenAI.Chat.Completions.ChatCompletionMessageParam
          ),
          {
            role: "user" as const,
            content:
              "Please generate my personal AI memory file now based on our conversation above.",
          },
        ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        temperature: 0.5,
        max_tokens: 2048,
      });

      const memoryFile =
        completion.choices[0]?.message?.content || "Failed to generate memory file.";

      return res.json({ memoryFile });
    } catch (error: any) {
      console.error("OpenAI API error:", error?.message || error);
      return res
        .status(500)
        .json({ memoryFile: "Failed to generate memory file. Please try again." });
    }
  });

  return httpServer;
}
