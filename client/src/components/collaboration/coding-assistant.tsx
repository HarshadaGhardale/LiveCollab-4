import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Minimize2, Maximize2, Send, Loader2, Code2, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isLoading?: boolean;
}

interface CodingAssistantProps {
  roomId?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CodingAssistant({ roomId, isOpen: controlledIsOpen, onOpenChange }: CodingAssistantProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setInternalIsOpen(open);
    }
  };
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from room state
  const { data: roomState } = useQuery({
    queryKey: [`/api/rooms/${roomId}/state`],
    enabled: !!roomId && isOpen,
    refetchOnWindowFocus: false,
  });

  // Initialize messages from room state or show welcome
  useEffect(() => {
    if (isOpen && roomState) {
      const chatbotMessages = (roomState as any)?.chatbotMessages;
      if (chatbotMessages && chatbotMessages.length > 0) {
        setMessages(chatbotMessages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })));
      } else {
        // Show welcome message only if no previous messages
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: "Hello! I'm your coding assistant. I can help you with:\n\n• Explaining code concepts\n• Fixing syntax errors\n• Debugging issues\n• Code optimization\n• Best practices\n\nWhat would you like help with?",
          timestamp: Date.now(),
        }]);
      }
    } else if (isOpen && !roomId) {
      // No roomId, show welcome
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Hello! I'm your coding assistant. I can help you with:\n\n• Explaining code concepts\n• Fixing syntax errors\n• Debugging issues\n• Code optimization\n• Best practices\n\nWhat would you like help with?",
        timestamp: Date.now(),
      }]);
    }
  }, [isOpen, roomState, roomId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    // Add loading message
    const loadingMessageId = `loading-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;
    
    setMessages((prev) => [
      ...prev,
      {
        id: loadingMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isLoading: true,
      },
    ]);

    try {
      // Get auth token
      const getAuthToken = (): string | null => {
        try {
          const authStorage = localStorage.getItem("auth-storage");
          if (authStorage) {
            const parsed = JSON.parse(authStorage);
            return parsed.state?.accessToken || null;
          }
        } catch {
          return null;
        }
        return null;
      };

      const token = getAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/chatbot/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: userMessage.content,
          roomId,
          conversationHistory: messages.slice(-10).map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      // Check if response is streaming (text/event-stream) or JSON
      const contentType = response.headers.get("content-type");
      
      if (contentType?.includes("text/event-stream")) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Remove loading message and add assistant message
        setMessages((prev) =>
          prev
            .filter((msg) => msg.id !== loadingMessageId)
            .concat({
              id: assistantMessageId,
              role: "assistant",
              content: "",
              timestamp: Date.now(),
            })
        );

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.error) {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: `Error: ${data.error}`, isLoading: false }
                          : msg
                      )
                    );
                    break;
                  }
                  
                  if (data.done) {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId ? { ...msg, isLoading: false } : msg
                      )
                    );
                    break;
                  }
                  
                  if (data.content) {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { ...msg, content: msg.content + data.content, isLoading: false }
                          : msg
                      )
                    );
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        }
      } else {
        // Handle non-streaming JSON response (fallback)
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
        }

        const data = await response.json();

        // Remove loading message and add response
        setMessages((prev) =>
          prev
            .filter((msg) => msg.id !== loadingMessageId)
            .concat({
              id: assistantMessageId,
              role: "assistant",
              content: data.response || "I apologize, but I couldn't generate a response. Please try again.",
              timestamp: Date.now(),
            })
        );
      }
    } catch (error: any) {
      console.error("Chatbot error:", error);
      
      // Remove loading message and add error
      let errorMessage = "I encountered an error. Please try again later.";
      let errorType = "unknown";
      
      if (error.message) {
        if (error.message.includes("<!DOCTYPE") || error.message.includes("Unexpected token")) {
          errorMessage = "The chatbot service is not available. Please make sure:\n\n1. The server is running\n2. OPENAI_API_KEY is set in .env file\n3. The server has been restarted after adding the key";
          errorType = "service_unavailable";
        } else if (error.message.includes("500")) {
          errorMessage = "Server error occurred. The AI service may be temporarily unavailable. Using fallback responses.";
          errorType = "server_error";
        } else {
          errorMessage = `Error: ${error.message}`;
          errorType = "api_error";
        }
      }

      setError(errorType);
      setMessages((prev) =>
        prev
          .filter((msg) => msg.id !== loadingMessageId)
          .concat({
            id: assistantMessageId,
            role: "assistant",
            content: errorMessage,
            timestamp: Date.now(),
          })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting for code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: (string | { type: "code"; language?: string; code: string } | { type: "inlineCode"; code: string })[] = [];
    let match;

    // Find all code blocks
    const codeBlocks: Array<{ start: number; end: number; language?: string; code: string }> = [];
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        start: match.index,
        end: match.index + match[0].length,
        language: match[1],
        code: match[2],
      });
    }

    // Process content
    let currentIndex = 0;
    for (const block of codeBlocks) {
      if (currentIndex < block.start) {
        // Add text before code block
        const text = content.slice(currentIndex, block.start);
        // Process inline code in this text
        const processedText = processInlineCode(text);
        parts.push(...processedText);
      }
      // Add code block
      parts.push({ type: "code", language: block.language, code: block.code });
      currentIndex = block.end;
    }
    if (currentIndex < content.length) {
      const text = content.slice(currentIndex);
      const processedText = processInlineCode(text);
      parts.push(...processedText);
    }

    // If no code blocks found, just process inline code
    if (parts.length === 0) {
      const processed = processInlineCode(content);
      return Array.isArray(processed) ? processed : [processed];
    }

    return parts;
  };

  const processInlineCode = (text: string): (string | { type: "inlineCode"; code: string })[] => {
    const parts: (string | { type: "inlineCode"; code: string })[] = [];
    const inlineCodeRegex = /`([^`]+)`/g;
    let lastIndex = 0;
    let match;

    while ((match = inlineCodeRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push({ type: "inlineCode", code: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  return (
    <>
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed bottom-6 right-6 z-50 bg-background border rounded-lg shadow-2xl flex flex-col",
              isMinimized ? "w-80 h-14" : "w-[420px] h-[600px]"
            )}
          >
            {/* Header */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-14 px-4 flex items-center justify-between border-b shrink-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3">
                <motion.div 
                  className="relative"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Avatar className="h-10 w-10 bg-gradient-to-br from-primary via-primary/80 to-primary/60 shadow-lg">
                    <AvatarFallback className="bg-transparent">
                      <Bot className="h-18 w-18 text-primary-foreground"/>
                    </AvatarFallback>
                  </Avatar>
                  <motion.div 
                    className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-background"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                      Coding Assistant
                    </span>
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </motion.div>
                  </div>
                  <span className="text-xs text-muted-foreground">AI-powered help</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {error && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-1 text-xs text-amber-500"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Fallback</span>
                  </motion.div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted/50"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  {isMinimized ? (
                    <Maximize2 className="h-4 w-4" />
                  ) : (
                    <Minimize2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-muted/50"
                  onClick={() => {
                    setIsOpen(false);
                    setIsMinimized(false);
                    setError(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>

            {/* Messages */}
            {!isMinimized && (
              <>
                <ScrollArea className="flex-1 p-4 bg-gradient-to-b from-background to-muted/20">
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {messages.map((msg, index) => {
                        const formatted = formatMessage(msg.content);
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ 
                              type: "spring", 
                              damping: 25, 
                              stiffness: 300,
                              delay: index === messages.length - 1 ? 0.1 : 0
                            }}
                            className={cn(
                              "flex gap-3",
                              msg.role === "user" ? "justify-end" : "justify-start"
                            )}
                          >
                          {msg.role === "assistant" && (
                            <Avatar className="h-7 w-7 shrink-0 mt-1 bg-gradient-to-br from-primary to-primary/70">
                              <AvatarFallback className="bg-transparent">
                                <Bot className="h-4 w-4 text-primary-foreground" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <motion.div
                            className={cn(
                              "rounded-lg px-4 py-2.5 max-w-[85%] text-sm shadow-sm",
                              msg.role === "user"
                                ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground"
                                : "bg-muted/80 backdrop-blur-sm border border-border/50"
                            )}
                            whileHover={{ scale: 1.02 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            {msg.isLoading ? (
                              <motion.div 
                                className="flex items-center gap-2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                              >
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-muted-foreground">Thinking...</span>
                              </motion.div>
                            ) : (
                              <div className="space-y-2">
                                {formatted.map((part, idx) => {
                                  if (typeof part === "string") {
                                    return (
                                      <p key={idx} className="leading-relaxed whitespace-pre-wrap break-words">
                                        {part}
                                      </p>
                                    );
                                  } else if (part.type === "code") {
                                    return (
                                      <motion.pre
                                        key={idx}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-background/90 border border-border/50 rounded-md p-3 overflow-x-auto text-xs font-mono shadow-inner"
                                      >
                                        {part.language && (
                                          <div className="text-xs text-muted-foreground mb-2 font-sans">
                                            {part.language}
                                          </div>
                                        )}
                                        <code className="text-foreground/90">{part.code}</code>
                                      </motion.pre>
                                    );
                                  } else if (part.type === "inlineCode") {
                                    return (
                                      <code
                                        key={idx}
                                        className="bg-background/80 px-1.5 py-0.5 rounded text-xs font-mono"
                                      >
                                        {part.code}
                                      </code>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            )}
                            <p
                              className={cn(
                                "text-[10px] mt-2",
                                msg.role === "user"
                                  ? "text-primary-foreground/70"
                                  : "text-muted-foreground"
                              )}
                            >
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </motion.div>
                          {msg.role === "user" && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", delay: 0.1 }}
                            >
                              <Avatar className="h-7 w-7 shrink-0 mt-1 ring-2 ring-primary/20">
                                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                                  <Code2 className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                {/* Input */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 border-t bg-background/95 backdrop-blur-sm"
                >
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mb-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-md flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400"
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Using fallback responses. AI service may be unavailable.</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 ml-auto text-xs"
                        onClick={() => setError(null)}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  )}
                  <div className="flex gap-2 items-end">
                    <Textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about code, syntax, debugging..."
                      className="min-h-[44px] max-h-[120px] resize-none border-border/50 focus:border-primary/50 transition-colors"
                      rows={1}
                      disabled={isLoading}
                    />
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isLoading}
                        className="h-11 w-11 shrink-0 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </motion.div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                    <span>Press Enter to send, Shift+Enter for new line</span>
                    {messages.length > 1 && (
                      <span className="text-muted-foreground/60">
                        • {messages.filter(m => m.role === "user").length} messages
                      </span>
                    )}
                  </p>
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

