"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { FaMicrophone } from "react-icons/fa";
import { styles } from "@/styles/common";
import { useSpeechRecognition } from "@/lib/useSpeechRecognition";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What does Peter do?",
  "Tell me about his work at Amazon",
  "What's his experience with RAG and LLMs?",
];

function updateLast(msgs: Msg[], content: string): Msg[] {
  const copy = msgs.slice();
  copy[copy.length - 1] = { role: "assistant", content };
  return copy;
}

export default function Chat({ authed }: { authed: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [needAuth, setNeedAuth] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { supported: micSupported, listening, start, stop } =
    useSpeechRecognition(setInput);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    // Chat costs money — require a signed-in user (bot filter). The server
    // enforces this too; this is the friendly client-side prompt.
    if (!authed) {
      setNeedAuth(true);
      return;
    }
    const history = [...messages, { role: "user", content: q } as Msg];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "");
        if (res.status === 401) setNeedAuth(true);
        setMessages((m) =>
          updateLast(m, err || "Sorry — the assistant is unavailable right now.")
        );
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => updateLast(m, acc));
      }
    } catch {
      setMessages((m) => updateLast(m, "Sorry — something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="chat" className="mb-16">
      <h2 className={styles.sectionTitle}>Ask me anything</h2>
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
        <div
          ref={scrollRef}
          className="max-h-80 min-h-[8rem] overflow-y-auto p-4 space-y-3"
        >
          {messages.length === 0 ? (
            <div className="text-sm text-gray-500">
              <p className="mb-3">
                Hi! I&apos;m an AI assistant trained on Peter&apos;s background.
                Ask me about his experience, skills, or writing.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "text-right" : "text-left"}
              >
                <div
                  className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {m.content || (busy ? "…" : "")}
                </div>
              </div>
            ))
          )}
        </div>

        {needAuth && (
          <div className="flex flex-wrap items-center gap-2 border-t border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm">
            <span className="text-amber-800 dark:text-amber-300">
              Please sign in to chat — this keeps bots out.
            </span>
            <Link
              href="/login"
              className="font-medium text-blue-600 hover:underline"
            >
              Sign in with Google →
            </Link>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 border-t border-gray-200 dark:border-gray-800 p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Peter's experience…"
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 outline-none focus:border-blue-500"
          />
          {micSupported && (
            <button
              type="button"
              onClick={() => (listening ? stop() : start())}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              aria-pressed={listening}
              title="Voice input"
              className={`rounded-lg border px-3 ${
                listening
                  ? "border-red-500 text-red-500 animate-pulse"
                  : "border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <FaMicrophone />
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "…" : "Send"}
          </button>
        </form>
      </div>
    </section>
  );
}
