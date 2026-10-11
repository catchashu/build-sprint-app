import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { generateText } from "ai";
import { convexGateway } from "@convex-dev/ai-sdk-provider";

export const check = internalAction({
  args: {},
  returns: v.string(),
  handler: async () => {
    try {
      const result = await generateText({
        model: convexGateway("openai/gpt-4.1-mini"),
        prompt: "Reply with OK only. This is a connection check, not research.",
        maxOutputTokens: 10,
        maxRetries: 0,
      });
      return result.text;
    } catch (error) {
      // Never return a provider request, headers, or credentials.
      return `AI gateway unavailable (${error instanceof Error ? error.message.slice(0, 350) : "unknown error"}).`;
    }
  },
});
