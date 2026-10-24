/** The Anthropic client for the pipeline scripts, with .env loaded (ANTHROPIC_API_KEY). */
import Anthropic from "@anthropic-ai/sdk";

try {
  process.loadEnvFile(".env");
} catch {}

export const client = new Anthropic();
