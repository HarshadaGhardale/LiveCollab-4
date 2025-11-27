import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SimplePeer from "simple-peer";
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff,
  Maximize2,
  Minimize2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthStore, useUIStore } from "@/lib/stores";
import { getSocket, emitSignaling } from "@/lib/socket";

interface Peer {
  id: string;
  username: string;
  avatarColor: string;
  peer: SimplePeer.Instance;
  stream?: MediaStream;
}

interface VideoChatProps {
  roomId: string;
  participants: Array<{ id: string; username: string; avatarColor: string }>;
}

function ParticipantVideo({ 
  participant, 
  stream, 
  isLocal = false,
  isMuted = false,
  isVideoOff = false
}: { 
  participant: { id: string; username: string; avatarColor: string };
  stream?: MediaStream;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative aspect-video bg-muted rounded-md overflow-hidden group"
      data-testid={`video-participant-${participant.id}`}
    >
      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Avatar className="h-12 w-12">
            <AvatarFallback 
              style={{ backgroundColor: participant.avatarColor }}
              className="text-white text-lg font-medium"
            >
              {participant.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Name overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white font-medium truncate">
            {participant.username}
            {isLocal && " (You)"}
          </span>
          {isMuted && (
            <MicOff className="h-3 w-3 text-red-400" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function VideoChat({ roomId, participants }: VideoChatProps) {
  const { user } = useAuthStore();
  const { videoBarVisible, toggleVideoBar } = useUIStore();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const peersRef = useRef<Map<string, Peer>>(new Map());

  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      setIsJoined(true);
      return stream;
    } catch (error) {
      console.error("Failed to get media devices:", error);
      // Try audio only
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        setLocalStream(audioStream);
        setIsVideoOn(false);
        setIsJoined(true);
        return audioStream;
      } catch (audioError) {
        console.error("Failed to get audio:", audioError);
        return null;
      }
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    peersRef.current.forEach((peer) => peer.peer.destroy());
    peersRef.current.clear();
    setPeers(new Map());
    setIsJoined(false);
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOn(videoTrack.enabled);
      }
    }
  }, [localStream]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioOn(audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Handle WebRTC signaling
  useEffect(() => {
    if (!isJoined || !localStream || !user) return;

    const socket = getSocket();

    const handleUserJoined = ({ userId, username, avatarColor }: any) => {
      if (userId === user.id) return;

      const peer = new SimplePeer({
        initiator: true,
        trickle: true,
        stream: localStream,
      });

      peer.on("signal", (signal) => {
        emitSignaling({
          type: "offer",
          from: user.id,
          to: userId,
          payload: signal,
        });
      });

      peer.on("stream", (stream) => {
        setPeers((prev) => {
          const newPeers = new Map(prev);
          const existingPeer = newPeers.get(userId);
          if (existingPeer) {
            newPeers.set(userId, { ...existingPeer, stream });
          }
          return newPeers;
        });
      });

      peer.on("close", () => {
        peersRef.current.delete(userId);
        setPeers((prev) => {
          const newPeers = new Map(prev);
          newPeers.delete(userId);
          return newPeers;
        });
      });

      const peerData = { id: userId, username, avatarColor, peer };
      peersRef.current.set(userId, peerData);
      setPeers((prev) => new Map(prev).set(userId, peerData));
    };

    const handleSignal = ({ type, from, payload }: any) => {
      if (type === "offer") {
        const participant = participants.find((p) => p.id === from);
        if (!participant) return;

        const peer = new SimplePeer({
          initiator: false,
          trickle: true,
          stream: localStream,
        });

        peer.on("signal", (signal) => {
          emitSignaling({
            type: "answer",
            from: user.id,
            to: from,
            payload: signal,
          });
        });

        peer.on("stream", (stream) => {
          setPeers((prev) => {
            const newPeers = new Map(prev);
            const existingPeer = newPeers.get(from);
            if (existingPeer) {
              newPeers.set(from, { ...existingPeer, stream });
            }
            return newPeers;
          });
        });

        peer.on("close", () => {
          peersRef.current.delete(from);
          setPeers((prev) => {
            const newPeers = new Map(prev);
            newPeers.delete(from);
            return newPeers;
          });
        });

        peer.signal(payload);

        const peerData = { 
          id: from, 
          username: participant.username, 
          avatarColor: participant.avatarColor, 
          peer 
        };
        peersRef.current.set(from, peerData);
        setPeers((prev) => new Map(prev).set(from, peerData));
      } else if (type === "answer") {
        const existingPeer = peersRef.current.get(from);
        if (existingPeer) {
          existingPeer.peer.signal(payload);
        }
      } else if (type === "ice-candidate") {
        const existingPeer = peersRef.current.get(from);
        if (existingPeer) {
          existingPeer.peer.signal(payload);
        }
      }
    };

    const handleUserLeft = ({ userId }: any) => {
      const peer = peersRef.current.get(userId);
      if (peer) {
        peer.peer.destroy();
        peersRef.current.delete(userId);
        setPeers((prev) => {
          const newPeers = new Map(prev);
          newPeers.delete(userId);
          return newPeers;
        });
      }
    };

    socket.on("user:joined", handleUserJoined);
    socket.on("webrtc:signal", handleSignal);
    socket.on("user:left", handleUserLeft);

    return () => {
      socket.off("user:joined", handleUserJoined);
      socket.off("webrtc:signal", handleSignal);
      socket.off("user:left", handleUserLeft);
    };
  }, [isJoined, localStream, user, participants]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLocalStream();
    };
  }, []);

  if (!videoBarVisible) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
        onClick={toggleVideoBar}
        data-testid="button-show-video-bar"
      >
        <Video className="h-4 w-4 mr-2" />
        Show Video
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border-t bg-card ${isExpanded ? "h-64" : "h-32"} transition-all duration-200`}
    >
      <div className="h-full flex">
        {/* Video grid */}
        <div className="flex-1 p-2 overflow-x-auto">
          <div className="flex gap-2 h-full">
            <AnimatePresence mode="popLayout">
              {/* Join button if not joined */}
              {!isJoined ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center w-full"
                >
                  <Button
                    onClick={startLocalStream}
                    className="gap-2"
                    data-testid="button-join-video"
                  >
                    <Video className="h-4 w-4" />
                    Join Video Chat
                  </Button>
                </motion.div>
              ) : (
                <>
                  {/* Local video */}
                  {user && (
                    <div className="h-full aspect-video shrink-0">
                      <ParticipantVideo
                        participant={{
                          id: user.id,
                          username: user.username,
                          avatarColor: user.avatarColor,
                        }}
                        stream={localStream || undefined}
                        isLocal
                        isMuted={!isAudioOn}
                        isVideoOff={!isVideoOn}
                      />
                    </div>
                  )}

                  {/* Remote videos */}
                  {Array.from(peers.values()).map((peer) => (
                    <div key={peer.id} className="h-full aspect-video shrink-0">
                      <ParticipantVideo
                        participant={{
                          id: peer.id,
                          username: peer.username,
                          avatarColor: peer.avatarColor,
                        }}
                        stream={peer.stream}
                      />
                    </div>
                  ))}
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls */}
        <div className="w-fit px-3 flex items-center gap-2 border-l shrink-0">
          {isJoined && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isVideoOn ? "secondary" : "destructive"}
                    size="icon"
                    onClick={toggleVideo}
                    data-testid="button-toggle-video"
                  >
                    {isVideoOn ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <VideoOff className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isVideoOn ? "Turn off camera" : "Turn on camera"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isAudioOn ? "secondary" : "destructive"}
                    size="icon"
                    onClick={toggleAudio}
                    data-testid="button-toggle-audio"
                  >
                    {isAudioOn ? (
                      <Mic className="h-4 w-4" />
                    ) : (
                      <MicOff className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isAudioOn ? "Mute" : "Unmute"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={stopLocalStream}
                    data-testid="button-leave-video"
                  >
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Leave call</TooltipContent>
              </Tooltip>
            </>
          )}
          <div className="w-px h-6 bg-border mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(!isExpanded)}
                data-testid="button-expand-video"
              >
                {isExpanded ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isExpanded ? "Collapse" : "Expand"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleVideoBar}
                data-testid="button-hide-video"
              >
                <Users className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hide video bar</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
}
