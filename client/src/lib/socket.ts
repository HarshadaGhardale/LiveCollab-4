import { io, Socket } from "socket.io-client";
import { useAuthStore } from "./stores";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;
    
    socket = io(wsUrl, {
      autoConnect: false,
      auth: {
        token: useAuthStore.getState().accessToken,
      },
      transports: ["websocket"],
    });
  }
  return socket;
}

export function connectSocket(): void {
  const s = getSocket();
  if (!s.connected) {
    s.auth = { token: useAuthStore.getState().accessToken };
    s.connect();
  }
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function joinRoom(roomId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("room:join", { roomId });
  }
}

export function leaveRoom(roomId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("room:leave", { roomId });
  }
}

// Whiteboard events
export function emitWhiteboardEvent(roomId: string, event: any): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("whiteboard:event", { roomId, event });
  }
}

// Code editor events
export function emitCodeEvent(roomId: string, event: any): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("code:event", { roomId, event });
  }
}

// Presence events
export function emitPresenceEvent(roomId: string, event: any): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("presence:update", { roomId, event });
  }
}

// WebRTC signaling
export function emitSignaling(data: any): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("webrtc:signal", data);
  }
}
