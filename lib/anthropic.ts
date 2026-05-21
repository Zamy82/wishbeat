import Anthropic from "@anthropic-ai/sdk";

// Liest ANTHROPIC_API_KEY aus den Umgebungsvariablen automatisch.
// Wir teilen einen Client zwischen Anfragen, weil der HTTP-Client gepoolt wird.
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable not set");
  }
  if (!client) {
    client = new Anthropic();
  }
  return client;
}
