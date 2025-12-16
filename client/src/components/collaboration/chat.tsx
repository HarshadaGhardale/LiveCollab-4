import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/lib/stores";
import { getSocket } from "@/lib/socket";

export interface Message {
    id: string;
    userId: string;
    username: string;
    avatarColor: string;
    content: string;
    timestamp: number;
    isSystem?: boolean;
}

interface ChatProps {
    roomId: string;
    messages: Message[];
    onSendMessage: (content: string) => void;
    onClose: () => void;
}

export function Chat({ roomId, messages, onSendMessage, onClose }: ChatProps) {
    const { user } = useAuthStore();
    const [inputValue, setInputValue] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim() || !user) return;

        onSendMessage(inputValue.trim());
        setInputValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-14 right-0 bottom-0 w-80 bg-background border-l shadow-lg z-40 flex flex-col"
        >
            {/* Header */}
            <div className="h-10 px-4 flex items-center justify-between border-b shrink-0 bg-muted/30">
                <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="font-medium text-sm">Chat</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${msg.isSystem ? "items-center" : msg.userId === user?.id ? "items-end" : "items-start"
                                }`}
                        >
                            {msg.isSystem ? (
                                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                                    {msg.content}
                                </span>
                            ) : (
                                <div
                                    className={`flex gap-2 max-w-[85%] ${msg.userId === user?.id ? "flex-row-reverse" : "flex-row"
                                        }`}
                                >
                                    <Avatar className="h-6 w-6 mt-1 shrink-0">
                                        <AvatarFallback
                                            style={{ backgroundColor: msg.avatarColor }}
                                            className="text-[10px] text-white"
                                        >
                                            {msg.username.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div
                                        className={`rounded-lg px-3 py-2 text-sm ${msg.userId === user?.id
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted"
                                            }`}
                                    >
                                        {!msg.isSystem && msg.userId !== user?.id && (
                                            <p className="text-[10px] font-medium opacity-70 mb-0.5">
                                                {msg.username}
                                            </p>
                                        )}
                                        <p className="leading-relaxed break-words">{msg.content}</p>
                                        <p
                                            className={`text-[10px] mt-1 text-right ${msg.userId === user?.id
                                                ? "text-primary-foreground/70"
                                                : "text-muted-foreground"
                                                }`}
                                        >
                                            {new Date(msg.timestamp).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 border-t bg-background">
                <div className="flex gap-2">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        className="flex-1"
                    />
                    <Button size="icon" onClick={handleSend} disabled={!inputValue.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
