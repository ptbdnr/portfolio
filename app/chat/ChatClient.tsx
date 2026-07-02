"use client";

import { useState } from "react";

type Msg = { role: "you" | "bot"; text: string };

export default function ChatClient() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;

    setMessages((m) => [...m, { role: "you", text: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      const text = res.ok
        ? data.reply
        : (data.error ?? "Something went wrong");
      setMessages((m) => [...m, { role: "bot", text }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Network error" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ul className="mb-4 space-y-2 min-h-[120px]">
        {messages.map((m, i) => (
          <li key={i}>
            <span className="font-semibold mr-2">
              {m.role === "you" ? "You" : "Bot"}:
            </span>
            <span>{m.text}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
