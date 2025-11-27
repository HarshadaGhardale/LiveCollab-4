import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { z } from "zod";
import { storage } from "./storage";
import {
  authMiddleware,
  generateAccessToken,
  generateRefreshToken,
  validatePassword,
  verifyToken,
  verifySocketToken,
  type AuthRequest,
} from "./auth";
import {
  insertUserSchema,
  loginSchema,
  insertRoomSchema,
} from "@shared/schema";

// Socket.IO types
interface SocketData {
  userId: string;
  username: string;
  avatarColor: string;
  roomId?: string;
}

interface RoomPresence {
  oderId: string;
  username: string;
  avatarColor: string;
  cursorX?: number;
  cursorY?: number;
  activePanel?: "whiteboard" | "editor";
  lastSeen: number;
}

// Store active room presence
const roomPresence = new Map<string, Map<string, RoomPresence>>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket"],
  });

  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    const userId = verifySocketToken(token);
    if (!userId) {
      return next(new Error("Invalid token"));
    }

    const user = await storage.getPublicUser(userId);
    if (!user) {
      return next(new Error("User not found"));
    }

    (socket.data as SocketData) = {
      userId: user.id,
      username: user.username,
      avatarColor: user.avatarColor,
    };

    next();
  });

  // Socket.IO connection handler
  io.on("connection", (socket: Socket) => {
    const userData = socket.data as SocketData;
    console.log(`User connected: ${userData.username} (${userData.userId})`);

    // Join room
    socket.on("room:join", async ({ roomId }) => {
      const room = await storage.getRoom(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      // Check/create membership
      let membership = await storage.getMembership(userData.userId, roomId);
      if (!membership) {
        membership = await storage.createMembership(userData.userId, roomId, "editor");
      }

      // Leave previous room if any
      if (userData.roomId) {
        socket.leave(userData.roomId);
        removePresence(userData.roomId, userData.userId);
        io.to(userData.roomId).emit("user:left", { userId: userData.userId });
      }

      // Join new room
      socket.join(roomId);
      userData.roomId = roomId;

      // Update presence
      const presence: RoomPresence = {
        oderId: userData.userId,
        username: userData.username,
        avatarColor: userData.avatarColor,
        lastSeen: Date.now(),
      };
      updatePresence(roomId, userData.userId, presence);

      // Get room state
      const roomState = await storage.getRoomState(roomId);

      // Send room state to user
      socket.emit("room:state", roomState);

      // Send current presence to the joining user
      const currentPresence = roomPresence.get(roomId);
      if (currentPresence) {
        currentPresence.forEach((p, id) => {
          if (id !== userData.userId) {
            socket.emit("presence:update", { userId: id, data: p });
          }
        });
      }

      // Notify others in the room
      socket.to(roomId).emit("user:joined", {
        userId: userData.userId,
        username: userData.username,
        avatarColor: userData.avatarColor,
      });

      console.log(`User ${userData.username} joined room ${room.name}`);
    });

    // Leave room
    socket.on("room:leave", ({ roomId }) => {
      socket.leave(roomId);
      removePresence(roomId, userData.userId);
      io.to(roomId).emit("user:left", { userId: userData.userId });
      userData.roomId = undefined;
    });

    // Whiteboard events
    socket.on("whiteboard:event", async ({ roomId, event }) => {
      if (!roomId || userData.roomId !== roomId) return;

      // Broadcast to others in room
      socket.to(roomId).emit("whiteboard:event", event);

      // Save state if it's a significant change
      if (event.type === "object-modified" || event.type === "object-added" || event.type === "clear") {
        try {
          await storage.updateRoomState(roomId, {
            whiteboardData: event.data,
          });
        } catch (error) {
          console.error("Failed to save whiteboard state:", error);
        }
      }
    });

    // Code editor events
    socket.on("code:event", async ({ roomId, event }) => {
      if (!roomId || userData.roomId !== roomId) return;

      // Broadcast to others in room
      socket.to(roomId).emit("code:event", event);

      // Save code content
      if (event.type === "change") {
        try {
          await storage.updateRoomState(roomId, {
            codeContent: event.data,
          });
        } catch (error) {
          console.error("Failed to save code state:", error);
        }
      }
    });

    // Presence updates
    socket.on("presence:update", ({ roomId, event }) => {
      if (!roomId || userData.roomId !== roomId) return;

      const presence = roomPresence.get(roomId)?.get(userData.userId);
      if (presence) {
        const updatedPresence: RoomPresence = {
          ...presence,
          ...event,
          lastSeen: Date.now(),
        };
        updatePresence(roomId, userData.userId, updatedPresence);

        // Broadcast to others in room
        socket.to(roomId).emit("presence:update", {
          userId: userData.userId,
          data: updatedPresence,
        });
      }
    });

    // WebRTC signaling
    socket.on("webrtc:signal", ({ type, from, to, payload }) => {
      // Forward signal to specific user
      const targetSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => (s.data as SocketData).userId === to
      );

      if (targetSocket) {
        targetSocket.emit("webrtc:signal", { type, from: userData.userId, to, payload });
      }
    });

    // Disconnect handler
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${userData.username}`);
      
      if (userData.roomId) {
        removePresence(userData.roomId, userData.userId);
        io.to(userData.roomId).emit("user:left", { userId: userData.userId });
      }
    });
  });

  // Helper functions for presence
  function updatePresence(roomId: string, oderId: string, presence: RoomPresence) {
    if (!roomPresence.has(roomId)) {
      roomPresence.set(roomId, new Map());
    }
    roomPresence.get(roomId)!.set(oderId, presence);
  }

  function removePresence(roomId: string, oderId: string) {
    roomPresence.get(roomId)?.delete(oderId);
    if (roomPresence.get(roomId)?.size === 0) {
      roomPresence.delete(roomId);
    }
  }

  // ==================== AUTH ROUTES ====================

  // Register
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const data = insertUserSchema.parse(req.body);

      // Check if email or username exists
      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        res.status(400).json({ message: "Email already in use" });
        return;
      }

      const existingUsername = await storage.getUserByUsername(data.username);
      if (existingUsername) {
        res.status(400).json({ message: "Username already taken" });
        return;
      }

      // Create user
      const user = await storage.createUser(data);
      const publicUser = await storage.getPublicUser(user.id);

      // Generate tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);
      await storage.saveRefreshToken(user.id, refreshToken);

      res.status(201).json({
        user: publicUser,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
        return;
      }
      console.error("Register error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const data = loginSchema.parse(req.body);

      // Find user
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }

      // Validate password
      const isValid = await validatePassword(data.password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ message: "Invalid email or password" });
        return;
      }

      const publicUser = await storage.getPublicUser(user.id);

      // Generate tokens
      const accessToken = generateAccessToken(user.id);
      const refreshToken = generateRefreshToken(user.id);
      await storage.saveRefreshToken(user.id, refreshToken);

      res.json({
        user: publicUser,
        accessToken,
        refreshToken,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
        return;
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Refresh token
  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ message: "Refresh token required" });
        return;
      }

      const payload = verifyToken(refreshToken);
      if (!payload || payload.type !== "refresh") {
        res.status(401).json({ message: "Invalid refresh token" });
        return;
      }

      // Verify stored token matches
      const storedToken = await storage.getRefreshToken(payload.userId);
      if (storedToken !== refreshToken) {
        res.status(401).json({ message: "Refresh token revoked" });
        return;
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(payload.userId);
      const newRefreshToken = generateRefreshToken(payload.userId);
      await storage.saveRefreshToken(payload.userId, newRefreshToken);

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error("Refresh error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout
  app.post("/api/auth/logout", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      if (req.userId) {
        await storage.deleteRefreshToken(req.userId);
      }
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // ==================== ROOM ROUTES ====================

  // Get user's rooms
  app.get("/api/rooms", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const rooms = await storage.getRoomsForUser(req.userId!);
      res.json(rooms);
    } catch (error) {
      console.error("Get rooms error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get room by slug
  app.get("/api/rooms/:slug", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { slug } = req.params;
      const room = await storage.getRoomBySlug(slug);

      if (!room) {
        res.status(404).json({ message: "Room not found" });
        return;
      }

      // Check/create membership for the user
      let membership = await storage.getMembership(req.userId!, room.id);
      if (!membership && !room.isPrivate) {
        // Auto-join public rooms
        membership = await storage.createMembership(req.userId!, room.id, "editor");
      }

      if (!membership) {
        res.status(403).json({ message: "Access denied" });
        return;
      }

      const memberCount = await storage.getMemberCount(room.id);
      res.json({
        ...room,
        memberCount,
        isOwner: room.ownerId === req.userId,
      });
    } catch (error) {
      console.error("Get room error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create room
  app.post("/api/rooms", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const data = insertRoomSchema.parse(req.body);

      // Check if slug is taken
      if (data.slug) {
        const existing = await storage.getRoomBySlug(data.slug);
        if (existing) {
          res.status(400).json({ message: "Room URL already taken" });
          return;
        }
      }

      const room = await storage.createRoom(data, req.userId!);
      const memberCount = await storage.getMemberCount(room.id);

      res.status(201).json({
        ...room,
        memberCount,
        isOwner: true,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
        return;
      }
      console.error("Create room error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update room
  app.patch("/api/rooms/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const room = await storage.getRoom(id);

      if (!room) {
        res.status(404).json({ message: "Room not found" });
        return;
      }

      if (room.ownerId !== req.userId) {
        res.status(403).json({ message: "Only room owner can update" });
        return;
      }

      const { name, isPrivate } = req.body;
      const updated = await storage.updateRoom(id, {
        name: name || room.name,
        isPrivate: isPrivate !== undefined ? isPrivate : room.isPrivate,
      });

      res.json(updated);
    } catch (error) {
      console.error("Update room error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete room
  app.delete("/api/rooms/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const room = await storage.getRoom(id);

      if (!room) {
        res.status(404).json({ message: "Room not found" });
        return;
      }

      if (room.ownerId !== req.userId) {
        res.status(403).json({ message: "Only room owner can delete" });
        return;
      }

      await storage.deleteRoom(id);
      res.json({ message: "Room deleted" });
    } catch (error) {
      console.error("Delete room error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get room state
  app.get("/api/rooms/:id/state", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const membership = await storage.getMembership(req.userId!, id);

      if (!membership) {
        res.status(403).json({ message: "Not a member of this room" });
        return;
      }

      const state = await storage.getRoomState(id);
      res.json(state);
    } catch (error) {
      console.error("Get room state error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update room state
  app.patch("/api/rooms/:id/state", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const membership = await storage.getMembership(req.userId!, id);

      if (!membership) {
        res.status(403).json({ message: "Not a member of this room" });
        return;
      }

      if (membership.role === "viewer") {
        res.status(403).json({ message: "Viewers cannot edit" });
        return;
      }

      const { whiteboardData, codeContent, codeLanguage } = req.body;
      const state = await storage.updateRoomState(id, {
        whiteboardData,
        codeContent,
        codeLanguage,
      });

      res.json(state);
    } catch (error) {
      console.error("Update room state error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get room members
  app.get("/api/rooms/:id/members", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const memberships = await storage.getMembershipsForRoom(id);

      const members = await Promise.all(
        memberships.map(async (m) => {
          const user = await storage.getPublicUser(m.userId);
          return {
            ...m,
            user,
          };
        })
      );

      res.json(members);
    } catch (error) {
      console.error("Get members error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
