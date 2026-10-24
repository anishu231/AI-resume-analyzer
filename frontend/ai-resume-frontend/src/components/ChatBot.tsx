// src/components/ChatBot.tsx
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Send, X, MessageCircle } from "lucide-react";

// In production the chat endpoint is served by the same Hugging Face Space.
// Keep VITE_API_URL for local development without baking it into the bundle.
const API_BASE: string = import.meta.env.PROD
  ? ""
  : import.meta.env.VITE_API_URL || "https://anish321-ats-resume-analyzer.hf.space";

type Action = { label: string; to: string };
type Msg = {
  id: number;
  role: "user" | "bot";
  text: string;
  actions?: Action[];
  isError?: boolean;
};

const MENU: string[] = [
  "What is this project for?",
  "How is my resume score calculated?",
  "How do I improve my ATS score?",
  "My upload is not working",
];

const QUICK_REPLIES = ["What does this project do?", "My upload is not working"];

const formatStamp = (d: Date) => {
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
  return `${date}. ${time}`;
};

const greetingFor = (name: string | null) =>
  `Hi${name ? ` ${name}` : ""}! 👋 Welcome to the AI Resume Screening System. ` +
  `I can explain what this project does, how scores are calculated, or help you fix any problem you run into. ` +
  `What would you like to know?`;

export default function ChatBot() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [startedAt] = useState(() => new Date());
  const [showQuick, setShowQuick] = useState(true);
  const [messages, setMessages] = useState<Msg[]>(() => {
    let name: string | null = null;
    try {
      name = localStorage.getItem("username");
    } catch {
      /* storage unavailable */
    }
    return [
      {
        id: 0,
        role: "bot",
        text: greetingFor(name),
        actions: [{ label: "Upload resume", to: "/upload" }],
      },
    ];
  });

  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Greet the visitor: open once per browser session, shortly after landing.
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("chat_greeted") === "1";
    } catch {
      /* ignore */
    }
    if (seen) return;
    const t = window.setTimeout(() => {
      setOpen(true);
      try {
        sessionStorage.setItem("chat_greeted", "1");
      } catch {
        /* ignore */
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = async (history: Msg[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 70000);

    try {
      const res = await fetch(`${API_BASE}/api/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          // the greeting is local-only; send real conversation
          messages: history
            .filter((m) => m.id !== 0 && !m.isError)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
      return { text: String(data.reply), isError: false };
    } catch (err: any) {
      const text =
        err?.name === "AbortError"
          ? "That took too long. The server may be waking up, please try again in a moment."
          : err?.message || "I couldn't reach the server. Please check your connection and try again.";
      return { text, isError: true };
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;

    setMenuOpen(false);
    setShowQuick(false);
    setInput("");

    const userMsg: Msg = { id: nextId.current++, role: "user", text };
    const history = [...messages, userMsg];
    setMessages(history);
    setTyping(true);

    const { text: reply, isError } = await ask(history);

    setMessages((m) => [...m, { id: nextId.current++, role: "bot", text: reply, isError }]);
    setTyping(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat assistant"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-white text-gray-800 shadow-xl ring-1 ring-gray-200 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-800"
        >
          <MessageCircle size={26} />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Resume ATS assistant"
          className="fixed inset-x-3 bottom-3 z-40 flex h-[min(34rem,calc(100vh-6rem))] flex-col overflow-hidden rounded-3xl bg-white text-gray-800 shadow-2xl ring-1 ring-gray-200 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[24rem]"
          style={{ fontFamily: "'Poppins', system-ui, sans-serif" }}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <span className="text-sm font-semibold">Resume ATS assistant</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-800"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
            <p className="pb-1 text-center text-xs text-gray-600">{formatStamp(startedAt)}</p>

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-[15px]">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <div
                    className={`max-w-[85%] rounded-xl border px-4 py-3 text-[15px] leading-snug ${
                      m.isError
                        ? "border-red-200 bg-red-50 text-red-900"
                        : "border-indigo-100 bg-[#f6f7fd]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    {m.actions && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.actions.map((a) => (
                          <button
                            key={a.label}
                            onClick={() => go(a.to)}
                            className="rounded-md border border-gray-600 bg-white px-4 py-1.5 text-sm text-gray-800 transition hover:bg-gray-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-800"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {showQuick && !typing && (
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-800"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {typing && (
              <div className="flex justify-start" aria-label="Assistant is typing">
                <div className="flex gap-1 rounded-xl border border-indigo-100 bg-[#f6f7fd] px-4 py-3">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {menuOpen && (
            <ul className="mx-4 mb-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
              {MENU.map((q) => (
                <li key={q}>
                  <button
                    onClick={() => send(q)}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={onSubmit}
            className="m-4 mt-1 flex items-center gap-3 rounded-full bg-white px-4 py-3 shadow-[0_2px_14px_rgba(0,0,0,0.14)]"
          >
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Show suggested questions"
              aria-expanded={menuOpen}
              className="text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-800"
            >
              <Menu size={22} />
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything"
              aria-label="Message"
              maxLength={1000}
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-gray-500"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              aria-label="Send message"
              className="text-gray-400 transition enabled:text-gray-700 enabled:hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-800"
            >
              <Send size={22} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
