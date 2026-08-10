import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import Card from "../ui/Card";
import Message from "./Message";

/**
 * AI Insights chat window.
 * The backend does not expose a real chat/agent endpoint via Express yet.
 * This component clearly communicates that AI insights are per-batch only
 * and directs users to the Batch Details page for the actual /decision/agent call.
 *
 * No mock replies — no fabricated data.
 */
export default function ChatWindow() {
  const [messages, setMessages] = useState([
    {
      role: "agent",
      text: 'AI Insights are available on individual batch pages. Navigate to a batch and click "Get AI Insights" to get an explanation of the decision engine\'s recommendation.',
    },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send(text) {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      {
        role: "agent",
        text: 'AI batch insights are only available on the Batch Details page. Select a batch from the Batches list and click "Get AI Insights" to generate an explanation.',
      },
    ]);
    setInput("");
  }

  return (
    <Card className="flex flex-col h-[480px]" padded={false}>
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Sparkles size={16} className="text-brand-700" />
        <span className="text-sm font-semibold text-ink">AI Insights</span>
        <span className="text-xs text-muted ml-1">
          — explanation only, not source of truth
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Message role={m.role} text={m.text} />
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a batch…"
            className="flex-1 rounded-lg border border-border px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 transition-colors"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            className="w-10 h-10 rounded-lg bg-brand-700 text-white flex items-center justify-center hover:bg-brand-900 shrink-0"
          >
            <Send size={16} />
          </motion.button>
        </form>
      </div>
    </Card>
  );
}
