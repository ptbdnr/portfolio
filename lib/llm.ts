import "server-only";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { requireEnv, optionalEnv } from "./env";
import { search } from "./search";
import { getById } from "./posts";
import { BIO } from "./bio";

// Provider-agnostic chat via LangChain. The provider is chosen at runtime by
// LLM_PROVIDER (anthropic | openai); only the chosen provider's key is needed.
// Keys are read here (server-only) and never reach the browser.

export type ChatRole = "user" | "assistant";
export interface ChatTurn {
  role: ChatRole;
  content: string;
}

function makeModel(): BaseChatModel {
  const provider = optionalEnv("LLM_PROVIDER", "anthropic").toLowerCase();
  const temperature = 0.3;
  if (provider === "openai") {
    return new ChatOpenAI({
      apiKey: requireEnv("OPENAI_API_KEY"),
      model: optionalEnv("LLM_MODEL", "gpt-4o-mini"),
      temperature,
    });
  }
  return new ChatAnthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    model: optionalEnv("LLM_MODEL", "claude-sonnet-4-6"),
    temperature,
  });
}

// Retrieve relevant published posts for the user's question (RAG-lite) — reuses
// the same SearchProvider that powers /search.
async function buildContext(query: string): Promise<string> {
  if (!query.trim()) return "";
  const hits = await search(query, { limit: 3 });
  if (hits.length === 0) return "";
  return hits
    .map((h) => {
      const post = getById(h.post.id);
      const body = post ? post.body.slice(0, 1500) : h.snippet ?? "";
      return `### ${h.post.title}  (/blog/${h.post.slug})\n${body}`;
    })
    .join("\n\n");
}

function systemPrompt(context: string): string {
  return `You are a helpful assistant embedded on Peter Bodnar's portfolio website.
Answer visitors' questions about Peter — his experience, skills, projects, and
writing — concisely, accurately, and in a friendly, professional tone. Prefer the
facts in the bio and blog excerpts below. If something isn't covered, say you're
not sure and point them to the relevant page or to contacting Peter. Never invent
facts. Keep answers brief (a few sentences) unless asked for detail.

## About Peter
${BIO}

## Relevant blog excerpts
${context || "(no specific posts matched this question)"}`;
}

function chunkText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) =>
        typeof c === "string"
          ? c
          : c && typeof c === "object" && "text" in c
          ? String((c as { text?: unknown }).text ?? "")
          : ""
      )
      .join("");
  }
  return "";
}

// Stream a grounded assistant reply for the given conversation as UTF-8 text.
export async function streamChat(
  history: ChatTurn[]
): Promise<ReadableStream<Uint8Array>> {
  const model = makeModel(); // throws (caught by caller) if the key is missing
  const lastUser =
    [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const context = await buildContext(lastUser);

  const messages: BaseMessage[] = [new SystemMessage(systemPrompt(context))];
  for (const t of history) {
    messages.push(
      t.role === "user" ? new HumanMessage(t.content) : new AIMessage(t.content)
    );
  }

  const llmStream = await model.stream(messages);
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of llmStream) {
          const text = chunkText(chunk.content);
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch {
        controller.enqueue(
          encoder.encode("\n\n[Sorry — the response was interrupted.]")
        );
      } finally {
        controller.close();
      }
    },
  });
}
