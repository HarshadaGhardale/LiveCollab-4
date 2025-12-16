import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type SimplePeer from "simple-peer";

// Access global SimplePeer from CDN to avoid bundler polyfill issues
const SimplePeerConstructor = (window as any).SimplePeer;
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
  connectionStatus?: "connecting" | "connected" | "failed";
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
  isVideoOff = false,
  connectionStatus = "connected"
}: {
  participant: { id: string; username: string; avatarColor: string };
  stream?: MediaStream;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  connectionStatus?: "connecting" | "connected" | "failed";
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
      {/* Always render video for audio playback */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${!isVideoOff ? "block" : "hidden"}`}
        />
      )}

      {/* Show Avatar if video is off or no stream */}
      {(!stream || isVideoOff) && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-muted">
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

      {/* Connection Status Overlay */}
      {connectionStatus !== "connected" && !isLocal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="bg-background/80 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2">
            {connectionStatus === "connecting" && (
              <>
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                Connecting...
              </>
            )}
            {connectionStatus === "failed" && (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                Connection Failed
              </>
            )}
          </div>
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

  // State refs to avoid re-binding listeners
  const isJoinedRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const userRef = useRef(user);
  const participantsRef = useRef(participants);

  // Sync refs
  useEffect(() => {
    isJoinedRef.current = isJoined;
  }, [isJoined]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const startLocalStream = useCallback(async () => {
    try {
      console.log("Starting local stream...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      console.log("Got local stream:", stream.id);
      setLocalStream(stream);
      setIsJoined(true);

      // Notify others that we joined video chat
      console.log("Emitting webrtc:join");
      getSocket().emit("webrtc:join", { roomId });

      return stream;
    } catch (error) {
      console.error("Failed to get media devices:", error);
      // Try audio only
      try {
        console.log("Retrying with audio only...");
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        setLocalStream(audioStream);
        setIsVideoOn(false);
        setIsJoined(true);

        // Notify others that we joined video chat
        console.log("Emitting webrtc:join (audio only)");
        getSocket().emit("webrtc:join", { roomId });

        return audioStream;
      } catch (audioError) {
        console.error("Failed to get audio:", audioError);
        return null;
      }
    }
  }, [roomId]);

  const stopLocalStream = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Notify others that we left video chat
    if (isJoined) {
      getSocket().emit("webrtc:leave", { roomId });
    }

    peersRef.current.forEach((peer) => peer.peer.destroy());
    peersRef.current.clear();
    setPeers(new Map());
    setIsJoined(false);
  }, [localStream, isJoined, roomId]);

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
    // Only attach listeners once to avoid missing events during re-renders
    const socket = getSocket();
    console.log("Attaching WebRTC socket listeners for user:", user?.id);

    const handleWebrtcJoin = ({ userId, username, avatarColor }: any) => {
      console.log(`Received webrtc:join from ${username} (${userId})`);

      if (!isJoinedRef.current) {
        console.log("Ignoring webrtc:join - local user not joined video yet");
        return;
      }
      if (!localStreamRef.current) {
        console.log("Ignoring webrtc:join - no local stream available");
        return;
      }
      if (userId === userRef.current?.id) return;

      console.log(`Initiating connection to ${username}`);
      console.log(`Initiating connection to ${username}`);
      let peer: SimplePeer.Instance;
      try {
        peer = new SimplePeerConstructor({
          initiator: true,
          trickle: true,
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun2.l.google.com:19302" },
              { urls: "stun:stun3.l.google.com:19302" },
              { urls: "stun:stun4.l.google.com:19302" },
              { urls: "stun:global.stun.twilio.com:3478" },
            ],
          },
          stream: localStreamRef.current,
        });
      } catch (err) {
        console.error("Failed to create SimplePeer:", err);
        return;
      }

      // Initial status
      const peerData: Peer = {
        id: userId,
        username,
        avatarColor,
        peer,
        connectionStatus: "connecting"
      };
      peersRef.current.set(userId, peerData);
      setPeers((prev) => new Map(prev).set(userId, peerData));

      peer.on("signal", (signal) => {
        // console.log("Generated signal (offer side) type:", signal.type);
        emitSignaling({
          type: signal.type || "ice-candidate",
          from: userRef.current?.id,
          to: userId,
          payload: signal,
        });
      });

      // Log ICE state changes
      // @ts-ignore - access internal peer connection for debugging
      if (peer._pc) {
        // @ts-ignore
        peer._pc.oniceconnectionstatechange = () => {
          // @ts-ignore
          console.log(`[ICE State] ${username}: ${(peer._pc as RTCPeerConnection).iceConnectionState}`);
        };
      }

      peer.on("connect", () => {
        console.log(`Connected to peer: ${username}`);
        setPeers((prev) => {
          const newPeers = new Map(prev);
          const existingPeer = newPeers.get(userId);
          if (existingPeer) {
            newPeers.set(userId, { ...existingPeer, connectionStatus: "connected" });
          }
          return newPeers;
        });
      });

      peer.on("stream", (stream) => {
        console.log(`Received stream from: ${username}`);
        setPeers((prev) => {
          const newPeers = new Map(prev);
          const existingPeer = newPeers.get(userId);
          if (existingPeer) {
            newPeers.set(userId, { ...existingPeer, stream });
          }
          return newPeers;
        });
      });

      peer.on("error", (err) => {
        console.error(`Peer error with ${username}:`, err);
        setPeers((prev) => {
          const newPeers = new Map(prev);
          const existingPeer = newPeers.get(userId);
          if (existingPeer) {
            newPeers.set(userId, { ...existingPeer, connectionStatus: "failed" });
          }
          return newPeers;
        });
      });

      peer.on("close", () => {
        console.log(`Connection closed with: ${username}`);
        peersRef.current.delete(userId);
        setPeers((prev) => {
          const newPeers = new Map(prev);
          newPeers.delete(userId);
          return newPeers;
        });
      });

      // Removed initial setPeers here as it's done at creation time above with 'connecting' status
      // const peerData = { id: userId, username, avatarColor, peer };
      // peersRef.current.set(userId, peerData);
      // setPeers((prev) => new Map(prev).set(userId, peerData));
    };

    const handleSignal = ({ type, from, payload }: any) => {
      // console.log(`Received signal (${type}) from: ${from}`);

      if (!isJoinedRef.current || !localStreamRef.current) {
        // Optionally queue this signal? 
        // For now, ignoring signals if we aren't in video mode is correct.
        return;
      }

      if (type === "offer") {
        const participant = participantsRef.current.find((p) => p.id === from);
        const username = participant?.username || "Unknown User";
        const avatarColor = participant?.avatarColor || "#000000";

        console.log(`Accepting offer from: ${username} (${from})`);

        // If we already have a peer for this user, destroy it?
        // simple-peer doesn't support re-negotiation easily if we just overwrite.
        // But for a fresh "offer", we should typically create a new peer.
        if (peersRef.current.has(from)) {
          console.warn(`Peer ALREADY exists for ${username}. Overwriting...`);
          peersRef.current.get(from)?.peer.destroy();
        }

        let peer: SimplePeer.Instance;
        try {
          peer = new SimplePeerConstructor({
            initiator: false,
            trickle: true,
            config: {
              iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:global.stun.twilio.com:3478" },
              ],
            },
            stream: localStreamRef.current,
          });
        } catch (err) {
          console.error("Failed to create responder peer:", err);
          return;
        }

        // Initial status for answer side
        const peerData: Peer = {
          id: from,
          username,
          avatarColor,
          peer,
          connectionStatus: "connecting"
        };
        peersRef.current.set(from, peerData);
        setPeers((prev) => new Map(prev).set(from, peerData));

        peer.on("signal", (signal) => {
          // console.log("Generated signal (answer side) type:", signal.type);
          emitSignaling({
            type: signal.type || "ice-candidate",
            from: userRef.current?.id,
            to: from,
            payload: signal,
          });
        });

        // Log ICE state changes
        // @ts-ignore
        if (peer._pc) {
          // @ts-ignore
          peer._pc.oniceconnectionstatechange = () => {
            // @ts-ignore
            console.log(`[ICE State] ${username}: ${(peer._pc as RTCPeerConnection).iceConnectionState}`);
          };
        }

        peer.on("connect", () => {
          console.log(`Connected to peer (via offer): ${username}`);
          setPeers((prev) => {
            const newPeers = new Map(prev);
            const existingPeer = newPeers.get(from);
            if (existingPeer) {
              newPeers.set(from, { ...existingPeer, connectionStatus: "connected" });
            }
            return newPeers;
          });
        });

        peer.on("stream", (stream) => {
          console.log(`Received stream from (via offer): ${username}`);
          setPeers((prev) => {
            const newPeers = new Map(prev);
            const existingPeer = newPeers.get(from);
            if (existingPeer) {
              newPeers.set(from, { ...existingPeer, stream });
            }
            return newPeers;
          });
        });

        peer.on("error", (err) => {
          console.error(`Peer error with ${username}:`, err);
          setPeers((prev) => {
            const newPeers = new Map(prev);
            const existingPeer = newPeers.get(from);
            if (existingPeer) {
              newPeers.set(from, { ...existingPeer, connectionStatus: "failed" });
            }
            return newPeers;
          });
        });

        peer.on("close", () => {
          console.log(`Connection closed with: ${username}`);
          peersRef.current.delete(from);
          setPeers((prev) => {
            const newPeers = new Map(prev);
            newPeers.delete(from);
            return newPeers;
          });
        });

        peer.signal(payload);

        // Removed redundant setPeers here
        // const peerData = {
        //   id: from,
        //   username,
        //   avatarColor,
        //   peer
        // };
        // peersRef.current.set(from, peerData);
        // setPeers((prev) => new Map(prev).set(from, peerData));
      } else if (type === "answer") {
        console.log(`Received answer from ${from}`);
        const existingPeer = peersRef.current.get(from);
        if (existingPeer) {
          existingPeer.peer.signal(payload);
        } else {
          console.warn(`Received answer from ${from} but no peer found!`);
        }
      } else if (type === "ice-candidate") {
        const existingPeer = peersRef.current.get(from);
        if (existingPeer) {
          existingPeer.peer.signal(payload);
        }
      }
    };

    const handleWebrtcLeave = ({ userId }: any) => {
      console.log("Peer left:", userId);
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

    socket.on("webrtc:join", handleWebrtcJoin);
    socket.on("webrtc:signal", handleSignal);
    socket.on("webrtc:leave", handleWebrtcLeave);

    return () => {
      console.log("Detaching WebRTC listeners");
      socket.off("webrtc:join", handleWebrtcJoin);
      socket.off("webrtc:signal", handleSignal);
      socket.off("webrtc:leave", handleWebrtcLeave);
    };
  }, []); // NO DEPENDENCIES - Listeners persist forever while component is mounted

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
                        connectionStatus={peer.connectionStatus}
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
