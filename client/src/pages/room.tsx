import { useEffect, useRef, useCallback, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Split from "react-split";
import {
  Users,
  ArrowLeft,
  Settings,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  PanelLeft,
  Code2,
  Brush,
  Menu,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore, useRoomStore, useUIStore } from "@/lib/stores";
import { ThemeToggle } from "@/components/theme-toggle";
import { Whiteboard } from "@/components/collaboration/whiteboard";
import { CodeEditor } from "@/components/collaboration/code-editor";
import { WebEditor } from "@/components/collaboration/web-editor";
import { VideoChat } from "@/components/collaboration/video-chat";
import { ActiveUsersList, PresenceOverlay } from "@/components/collaboration/presence-overlay";
import { MembersPanel } from "@/components/collaboration/members-panel";
import { Chat, type Message } from "@/components/collaboration/chat";
import {
  getSocket,
  connectSocket,
  disconnectSocket,
  joinRoom,
  leaveRoom,
  emitPresenceEvent
} from "@/lib/socket";
import type { RoomWithMemberCount, RoomState } from "@shared/schema";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";

function RoomSettingsDialog({ room }: { room: RoomWithMemberCount }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const { toast } = useToast();
  const [isPrivate, setIsPrivate] = useState(room.isPrivate);

  const handleInvite = async () => {
    if (!username.trim()) return;

    try {
      await apiRequest("POST", `/api/rooms/${room.id}/invite`, { username: username.trim() });
      toast({
        title: "Invitation sent",
        description: `Invited ${username} to the room`,
      });
      setUsername("");
    } catch (error: any) {
      toast({
        title: "Failed to invite",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePrivacyChange = async (checked: boolean) => {
    try {
      await apiRequest("PATCH", `/api/rooms/${room.id}`, { isPrivate: checked });
      setIsPrivate(checked);
      queryClient.invalidateQueries({ queryKey: [`/api/rooms/${room.slug}`] });
      toast({
        title: "Settings updated",
        description: `Room is now ${checked ? "private" : "public"}`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to update",
        description: error.message,
        variant: "destructive",
      });
      setIsPrivate(!checked); // Revert
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Room Settings</DialogTitle>
          <DialogDescription>
            Manage access and invitations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between space-x-2">
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium">Private Room</span>
              <span className="text-xs text-muted-foreground">Only invited users can join</span>
            </div>
            <Switch
              checked={isPrivate}
              onCheckedChange={handlePrivacyChange}
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Invite User</span>
            <div className="flex gap-2">
              <Input
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
              <Button onClick={handleInvite} disabled={!username.trim()}>
                Invite
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Room() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const { currentRoom, setCurrentRoom, presence, updatePresence, removePresence, clearPresence } = useRoomStore();
  const { activePanel, setActivePanel } = useUIStore();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const showChatRef = useRef(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Sync ref with state
  useEffect(() => {
    showChatRef.current = showChat;
    if (showChat) {
      setUnreadCount(0);
    }
  }, [showChat]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  // Fetch room data
  const { data: room, isLoading, error } = useQuery<RoomWithMemberCount>({
    queryKey: [`/api/rooms/${slug}`],
    enabled: !!slug && isAuthenticated,
  });

  // Set current room
  useEffect(() => {
    if (room) {
      setCurrentRoom(room);
    }
    return () => setCurrentRoom(null);
  }, [room, setCurrentRoom]);

  // Connect socket and join room
  useEffect(() => {
    if (!room || !user) return;

    connectSocket();
    const socket = getSocket();

    // Join room
    socket.on("connect", () => {
      joinRoom(room.id);
    });

    if (socket.connected) {
      joinRoom(room.id);
    }

    // Handle room state
    socket.on("room:state", (state: RoomState) => {
      setRoomState(state);
    });

    // Handle presence updates
    socket.on("presence:update", ({ userId, data }) => {
      updatePresence(userId, data);
    });

    socket.on("user:joined", ({ userId, username, avatarColor }) => {
      updatePresence(userId, {
        oderId: userId,
        username,
        avatarColor,
        lastSeen: Date.now(),
      });

      // Add system message
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userId: "system",
          username: "System",
          avatarColor: "#000000",
          content: `${username} joined the room`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);
    });

    socket.on("user:left", ({ userId }) => {
      removePresence(userId);
    });

    // Handle whiteboard events from other users
    socket.on("whiteboard:event", (event) => {
      // The whiteboard component handles its own updates
    });

    // Handle code events from other users
    socket.on("code:event", (event) => {
      if (event.userId !== user.id && event.type === "change") {
        setRoomState((prev) => prev ? { ...prev, codeContent: event.data } : null);
      }
    });

    // Handle chat messages
    socket.on("chat:message", (message: Message) => {
      setMessages((prev) => [...prev, message]);
      if (!showChatRef.current) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    // Cleanup
    return () => {
      leaveRoom(room.id);
      socket.off("connect");
      socket.off("room:state");
      socket.off("presence:update");
      socket.off("user:joined");
      socket.off("user:left");
      socket.off("whiteboard:event");
      socket.off("code:event");
      socket.off("chat:message");
      clearPresence();
    };
  }, [room, user, updatePresence, removePresence, clearPresence]);

  // Track mouse movement for presence
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!workspaceRef.current || !room || !user) return;

    const rect = workspaceRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    emitPresenceEvent(room.id, {
      cursorX: x,
      cursorY: y,
      activePanel,
    });
  }, [room, user, activePanel]);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/room/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link copied!",
      description: "Share this link to invite others",
    });
  }, [slug, toast]);

  const handleSendMessage = useCallback((content: string) => {
    if (!room || !user) return;

    const message: Message = {
      id: Date.now().toString(),
      userId: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
      content,
      timestamp: Date.now(),
    };

    // Optimistic update handled by socket event (since we emit to self too)
    // But if we want instant feedback we can add it here. 
    // The server implementation broadcasts to everyone including sender.
    // So we rely on the socket event to avoid duplication.

    getSocket().emit("chat:message", { roomId: room.id, message });
  }, [room, user]);

  // Get participants for video chat
  const participants = Array.from(presence.values()).map((p) => ({
    id: p.oderId,
    username: p.username,
    avatarColor: p.avatarColor,
  }));

  if (!isAuthenticated) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="h-14 px-4 flex items-center justify-between border-b">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-8 w-24" />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="h-14 px-4 flex items-center justify-between border-b">
          <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Room not found</h1>
            <p className="text-muted-foreground mb-6">
              The room you're looking for doesn't exist or you don't have access.
            </p>
            <Button onClick={() => setLocation("/dashboard")} data-testid="button-go-dashboard">
              Go to Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 px-4 flex items-center justify-between gap-4 border-b shrink-0 glass z-20 mb-2">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-md"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <span className="font-semibold text-lg truncate max-w-[200px]">
              {room.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ActiveUsersList presence={presence} currentUserId={user?.id || ""} />
        </div>

        <div className="flex items-center gap-2">
          {room.isOwner && (
            <RoomSettingsDialog room={room} />
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showMembers ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowMembers(!showMembers)}
                className="gap-2 h-9"
                data-testid="button-show-members"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">{Array.from(presence.values()).length}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Show members</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2 h-9"
                data-testid="button-copy-link"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                <span className="hidden sm:inline font-medium">Share</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy room link</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showChat ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowChat(!showChat)}
                className="gap-2 h-9 relative"
                data-testid="button-toggle-chat"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline font-medium">Chat</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle chat</TooltipContent>
          </Tooltip>
          <div className="w-px h-6 bg-border mx-1" />
          <ThemeToggle />
        </div>
      </header>

      {/* Panel toggle */}
      {room.type !== "web" && (
        <div className="h-10 px-4 flex items-center justify-center gap-1 border-b shrink-0 bg-card">
          <Button
            variant={activePanel === "editor" || activePanel === "both" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setActivePanel(activePanel === "editor" ? "both" : "editor")}
            data-testid="button-panel-editor"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span className="text-xs">Code</span>
          </Button>
          <Button
            variant={activePanel === "both" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setActivePanel("both")}
            data-testid="button-panel-both"
          >
            <PanelLeft className="h-3.5 w-3.5" />
            <span className="text-xs">Split</span>
          </Button>
          <Button
            variant={activePanel === "whiteboard" || activePanel === "both" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setActivePanel(activePanel === "whiteboard" ? "both" : "whiteboard")}
            data-testid="button-panel-whiteboard"
          >
            <Brush className="h-3.5 w-3.5" />
            <span className="text-xs">Whiteboard</span>
          </Button>
        </div>
      )}

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        <main
          ref={workspaceRef}
          className="flex-1 relative overflow-hidden"
          onMouseMove={handleMouseMove}
        >
          {/* Presence overlay */}
          <PresenceOverlay
            presence={presence}
            currentUserId={user?.id || ""}
            containerRef={workspaceRef}
          />

          {/* Split view */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full p-2"
          >
            {activePanel === "both" ? (
              room.type === "web" ? (
                <WebEditor
                  roomId={room.id}
                  initialFiles={roomState?.webFiles}
                />
              ) : (
                <Split
                  className="flex h-full"
                  sizes={[50, 50]}
                  minSize={200}
                  gutterSize={8}
                  gutterAlign="center"
                  cursor="col-resize"
                >
                  <div className="h-full overflow-hidden">
                    <CodeEditor
                      roomId={room.id}
                      initialContent={roomState?.codeContent}
                    />
                  </div>
                  <div className="h-full overflow-hidden">
                    <Whiteboard
                      roomId={room.id}
                      initialData={roomState?.whiteboardData}
                    />
                  </div>
                </Split>
              )
            ) : activePanel === "editor" ? (
              room.type === "web" ? (
                <WebEditor
                  roomId={room.id}
                  initialFiles={roomState?.webFiles}
                />
              ) : (
                <div className="h-full">
                  <CodeEditor
                    roomId={room.id}
                    initialContent={roomState?.codeContent}
                  />
                </div>
              )
            ) : (
              // Whiteboard panel - only for standard rooms
              room.type === "web" ? (
                <WebEditor
                  roomId={room.id}
                  initialFiles={roomState?.webFiles}
                />
              ) : (
                <div className="h-full">
                  <Whiteboard
                    roomId={room.id}
                    initialData={roomState?.whiteboardData}
                  />
                </div>
              )
            )}
          </motion.div>
        </main>

        {/* Members Panel */}
        {showMembers && (
          <MembersPanel
            members={[
              {
                oderId: user?.id || "",
                username: user?.username || "",
                avatarColor: user?.avatarColor || "",
                lastSeen: Date.now(),
              },
              ...Array.from(presence.values())
            ]}
            currentUserId={user?.id || ""}
            roomOwnerId={room?.ownerId}
            onClose={() => setShowMembers(false)}
          />
        )}

        {/* Chat Panel */}
        <AnimatePresence>
          {showChat && (
            <Chat
              roomId={room.id}
              messages={messages}
              onSendMessage={handleSendMessage}
              onClose={() => setShowChat(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Video chat */}
      <VideoChat roomId={room.id} participants={participants} />
    </div>
  );
}
