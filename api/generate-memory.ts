import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const MEMORY_SYSTEM_PROMPT = `Based on this conversation, generate a beautifully formatted personal AI memory file. Format each fact as 'Remember that I...' organized into sections: Identity, Work & Expertise, Current Projects, Goals, Working Style, Tools & Stack, Key People, Personal Context. Start with a 2-3 sentence Quick Summary paragraph. Make it ready to paste into any AI system.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ memoryFile: "Method not allowed" });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ memoryFile: "messages array is required" });
    }

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
      completion.choices[0]?.message?.content ||
      "Failed to generate memory file.";

    return res.json({ memoryFile });
  } catch (error: any) {
    console.error("OpenAI API error:", error?.message || error);
    return res
      .status(500)
      .json({
        memoryFile: "Failed to generate memory file. Please try again.",
      });
  }
}
