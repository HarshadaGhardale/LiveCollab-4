import { useEffect, useRef, useCallback, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
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
  Brush
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore, useRoomStore, useUIStore } from "@/lib/stores";
import { ThemeToggle } from "@/components/theme-toggle";
import { Whiteboard } from "@/components/collaboration/whiteboard";
import { CodeEditor } from "@/components/collaboration/code-editor";
import { VideoChat } from "@/components/collaboration/video-chat";
import { ActiveUsersList, PresenceOverlay } from "@/components/collaboration/presence-overlay";
import { 
  getSocket, 
  connectSocket, 
  disconnectSocket, 
  joinRoom, 
  leaveRoom,
  emitPresenceEvent 
} from "@/lib/socket";
import type { RoomWithMemberCount, RoomState } from "@shared/schema";

export default function Room() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const { currentRoom, setCurrentRoom, presence, updatePresence, removePresence, clearPresence } = useRoomStore();
  const { activePanel, setActivePanel } = useUIStore();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

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
      <header className="h-14 px-4 flex items-center justify-between gap-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Link 
            href="/dashboard" 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg truncate max-w-[200px]">
              {room.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ActiveUsersList presence={presence} currentUserId={user?.id || ""} />
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2"
                data-testid="button-copy-link"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Share</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy room link</TooltipContent>
          </Tooltip>
          <ThemeToggle />
        </div>
      </header>

      {/* Panel toggle */}
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

      {/* Main workspace */}
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
          ) : activePanel === "editor" ? (
            <div className="h-full">
              <CodeEditor 
                roomId={room.id}
                initialContent={roomState?.codeContent}
              />
            </div>
          ) : (
            <div className="h-full">
              <Whiteboard 
                roomId={room.id}
                initialData={roomState?.whiteboardData}
              />
            </div>
          )}
        </motion.div>
      </main>

      {/* Video chat */}
      <VideoChat roomId={room.id} participants={participants} />
    </div>
  );
}
