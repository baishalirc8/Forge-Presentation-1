import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, Zap, X, RotateCcw, Sparkles, StopCircle, MessageCircle } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIChatPanelProps {
  title: string;
  subtitle: string;
  welcomeHeading: string;
  welcomeDescription: string;
  placeholder: string;
  presetQuestions: string[];
  endpoint: string;
  extraPayload?: Record<string, unknown>;
  open: boolean;
  onClose: () => void;
}

export function AIChatPanel({
  title,
  subtitle,
  welcomeHeading,
  welcomeDescription,
  placeholder,
  presetQuestions,
  endpoint,
  extraPayload,
  open,
  onClose,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: content.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsStreaming(true);

    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages([...updatedMessages, assistantMsg]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content.trim(),
          history: messages,
          ...extraPayload,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error("Request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              fullContent += event.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullContent };
                return updated;
              });
            }
            if (event.error) {
              fullContent += `\n\n_Error: ${event.error}_`;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullContent };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Unable to reach the assistant. Please try again.",
          };
          return updated;
        });
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, [messages, isStreaming, endpoint, extraPayload]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="absolute inset-0 z-[100] bg-black/40" onClick={onClose} data-testid="chat-backdrop" />
      <div className="absolute inset-y-0 right-0 w-full sm:w-[420px] z-[101] flex flex-col bg-background border-l border-border/60 shadow-2xl" data-testid="ai-chat-panel">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-muted/20">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            <p className="text-[10px] text-muted-foreground truncate">{subtitle}</p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setMessages([])}
                disabled={isStreaming}
                data-testid="button-chat-reset"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} data-testid="button-chat-close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/8 mb-4">
                <Sparkles className="h-7 w-7 text-primary/70" />
              </div>
              <h4 className="text-sm font-semibold mb-1">{welcomeHeading}</h4>
              <p className="text-sm text-muted-foreground mb-6 max-w-[280px] leading-relaxed">
                {welcomeDescription}
              </p>
              <div className="space-y-2 w-full">
                {presetQuestions.map((prompt, i) => (
                  <button
                    key={i}
                    className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground"
                    onClick={() => sendMessage(prompt)}
                    disabled={isStreaming}
                    data-testid={`button-preset-${i}`}
                  >
                    <Zap className="h-3 w-3 inline mr-2 text-primary/60" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="flex items-start shrink-0 mt-0.5">
                    <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-foreground"
                  }`}
                  data-testid={`chat-msg-${msg.role}-${i}`}
                >
                  {msg.role === "assistant" ? (
                    <div className="whitespace-pre-wrap prose prose-sm prose-invert max-w-none [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>p]:mb-2 [&>ul]:mb-2 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mb-1">
                      {msg.content || (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Thinking...
                        </span>
                      )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-border/50 bg-muted/10">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
              disabled={isStreaming}
              data-testid="input-chat-message"
            />
            {isStreaming ? (
              <Button
                size="icon"
                variant="destructive"
                className="h-10 w-10 shrink-0"
                onClick={stopStreaming}
                data-testid="button-chat-stop"
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                data-testid="button-chat-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function ChatFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-6 right-6 z-[100] h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90"
      data-testid="button-chat-fab"
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  );
}
