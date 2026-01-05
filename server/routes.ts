import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { z } from "zod";
import { storage } from "./storage";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import OpenAI from "openai";
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
import { sendPasswordResetEmail } from "./email";
import { executeCode } from "./execution";
import { generateChatbotResponse } from "./chatbot-fallback";

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

      // Broadcast to all users in room (including sender)
      io.to(roomId).emit("whiteboard:event", event);

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

      // Broadcast to all users in room EXCEPT sender
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

    // Chat events
    socket.on("chat:message", ({ roomId, message }) => {
      if (!roomId || userData.roomId !== roomId) return;

      // Broadcast to all users in room (including sender)
      io.to(roomId).emit("chat:message", message);
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
      console.log(`[Server] webrtc:signal (${type}) from ${userData.username} to ${to}`);
      // Forward signal to specific user
      const targetSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => (s.data as SocketData).userId === to
      );

      if (targetSocket) {
        console.log(`[Server] Forwarding signal from ${userData.username} to ${to}`);
        targetSocket.emit("webrtc:signal", { type, from: userData.userId, to, payload });
      } else {
        console.warn(`[Server] Target user ${to} not found for signal from ${userData.username}`);
      }
    });

    socket.on("webrtc:join", ({ roomId }) => {
      console.log(`[Server] webrtc:join from ${userData.username} for room ${roomId}`);
      console.log(`[Server] userData.roomId: ${userData.roomId}`);

      if (!roomId || userData.roomId !== roomId) {
        console.warn(`[Server] Room mismatch or invalid! request=${roomId}, user=${userData.roomId}`);
        return;
      }

      console.log(`[Server] Broadcasting webrtc:join to room ${roomId}`);
      socket.to(roomId).emit("webrtc:join", {
        userId: userData.userId,
        username: userData.username,
        avatarColor: userData.avatarColor,
      });
    });

    socket.on("webrtc:leave", ({ roomId }) => {
      if (!roomId || userData.roomId !== roomId) return;

      socket.to(roomId).emit("webrtc:leave", {
        userId: userData.userId,
      });
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

  // Forgot password
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ message: "Email is required" });
        return;
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Return success even if user not found to prevent enumeration
        res.json({ message: "If an account exists, a reset link has been sent." });
        return;
      }

      const token = randomBytes(32).toString("hex");
      const expiry = Date.now() + 3600000; // 1 hour

      await storage.setUserResetToken(user.id, token, expiry);

      // MOCK EMAIL: Log token to console
      await storage.setUserResetToken(user.id, token, expiry);

      // Send reset email
      const emailSent = await sendPasswordResetEmail(email, token);

      if (emailSent) {
        res.json({ message: "If an account exists, a reset link has been sent." });
      } else {
        // If email fails, we log it but still return generic success or 500?
        // Usually better to return 500 or verify configuration if email is critical.
        // For now, let's return 500 so they know it failed.
        console.error("Failed to send reset email");
        res.status(500).json({ message: "Failed to send reset email. Please try again later." });
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Reset password
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        res.status(400).json({ message: "Token and new password are required" });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ message: "Password must be at least 6 characters" });
        return;
      }

      const user = await storage.getUserByResetToken(token);
      if (!user) {
        res.status(400).json({ message: "Invalid or expired token" });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, passwordHash);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== PROFILE MANAGEMENT ROUTES ====================

  // Update username
  app.patch("/api/user/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { username } = req.body;

      if (!username || username.trim().length < 3) {
        res.status(400).json({ message: "Username must be at least 3 characters" });
        return;
      }

      // Check if username is taken
      const existing = await storage.getUserByUsername(username);
      if (existing && existing.id !== req.userId) {
        res.status(400).json({ message: "Username already taken" });
        return;
      }

      await storage.updateUsername(req.userId!, username);
      const updatedUser = await storage.getPublicUser(req.userId!);

      res.json({ user: updatedUser, message: "Username updated successfully" });
    } catch (error) {
      console.error("Update username error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Change password
  app.patch("/api/user/password", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ message: "Current and new password are required" });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ message: "New password must be at least 6 characters" });
        return;
      }

      // Verify current password
      const user = await storage.getUser(req.userId!);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const isValid = await validatePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ message: "Current password is incorrect" });
        return;
      }

      // Update password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(req.userId!, newPasswordHash);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete account
  app.delete("/api/user/account", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { password } = req.body;

      if (!password) {
        res.status(400).json({ message: "Password is required to delete account" });
        return;
      }

      // Verify password
      const user = await storage.getUser(req.userId!);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const isValid = await validatePassword(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ message: "Incorrect password" });
        return;
      }

      // Delete user and all associated data
      await storage.deleteUser(req.userId!);

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
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

      const { whiteboardData, codeContent, codeLanguage, webFiles, chatbotMessages } = req.body;
      const state = await storage.updateRoomState(id, {
        whiteboardData,
        codeContent,
        codeLanguage,
        webFiles,
        chatbotMessages,
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

  // Invite user to room
  app.post("/api/rooms/:id/invite", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { username } = req.body;

      if (!username) {
        res.status(400).json({ message: "Username is required" });
        return;
      }

      const room = await storage.getRoom(id);
      if (!room) {
        res.status(404).json({ message: "Room not found" });
        return;
      }

      // Only owner can invite
      if (room.ownerId !== req.userId) {
        res.status(403).json({ message: "Only room owner can invite users" });
        return;
      }

      const targetUser = await storage.getUserByUsername(username);
      if (!targetUser) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Check if already a member
      const existingMembership = await storage.getMembership(targetUser.id, id);
      if (existingMembership) {
        res.status(400).json({ message: "User is already a member" });
        return;
      }

      // Create membership
      await storage.createMembership(targetUser.id, id, "editor");

      // Notify user via socket if connected
      const targetSocket = Array.from(io.sockets.sockets.values()).find(
        (s) => (s.data as SocketData).userId === targetUser.id
      );

      if (targetSocket) {
        targetSocket.emit("room:invite", {
          roomId: room.id,
          roomName: room.name,
          slug: room.slug,
          inviterName: req.user?.username || "Someone",
        });
      }

      res.json({ message: "Invitation sent" });
    } catch (error) {
      console.error("Invite error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Execute code
  app.post("/api/execute-code", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { code, language } = req.body;

      if (!code) {
        res.status(400).json({ message: "Code is required" });
        return;
      }

      // Map language aliases
      let lang = language;
      if (lang === "js") lang = "javascript";
      if (lang === "cpp") lang = "c++";
      if (lang === "py") lang = "python";

      const result = await executeCode(code, lang);

      res.json({
        success: result.success,
        output: result.output,
        errors: result.error,
      });
    } catch (error) {
      console.error("Execute code error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== CHATBOT ROUTES ====================

  // Chatbot chat endpoint with streaming
  app.post("/api/chatbot/chat", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { message, roomId, conversationHistory } = req.body;

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        res.status(400).json({ message: "Message is required" });
        return;
      }

      // Check if OpenAI API key is configured
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        console.log("[Chatbot] OpenAI API key not found, using fallback");
        // Fallback to comprehensive Q&A system
        const response = await generateChatbotResponse(
          "",
          message,
          conversationHistory || []
        );
        
        // Save to room state if roomId provided
        if (roomId) {
          try {
            const roomState = await storage.getRoomState(roomId);
            const existingMessages = roomState?.chatbotMessages || [];
            const newMessages = [
              ...existingMessages,
              { id: Date.now().toString(), role: "user" as const, content: message, timestamp: Date.now() },
              { id: (Date.now() + 1).toString(), role: "assistant" as const, content: response, timestamp: Date.now() },
            ];
            await storage.updateRoomState(roomId, {
              chatbotMessages: newMessages.slice(-50),
            });
          } catch (error) {
            console.error("[Chatbot] Failed to save messages:", error);
          }
        }
        
        res.json({ response });
        return;
      }

      console.log("[Chatbot] OpenAI API key found, initializing client...");

      // Initialize OpenAI client
      // The OpenAI SDK automatically adds "Authorization: Bearer <apiKey>" header to all requests
      let openai: OpenAI;
      try {
        openai = new OpenAI({
          apiKey: openaiApiKey,
          // The SDK automatically sets: Authorization: Bearer ${apiKey}
        });
        console.log("[Chatbot] OpenAI client initialized successfully");
        console.log("[Chatbot] Authorization header will be set automatically by SDK");
      } catch (error: any) {
        console.error("[Chatbot] Failed to initialize OpenAI client:", error);
        res.status(500).json({ message: "Failed to initialize AI service", error: error.message });
        return;
      }

      // Get room context if roomId is provided
      let roomContext = "";
      if (roomId) {
        try {
          const room = await storage.getRoom(roomId);
          if (room) {
            roomContext = `You are helping in a coding room named "${room.name}". `;
          }
        } catch (error) {
          // Room not found or access denied, continue without context
        }
      }

      // Build conversation context
      const systemPrompt = `${roomContext}You are an expert coding assistant helping developers with:
- Explaining programming concepts and terms
- Fixing syntax errors
- Debugging code issues
- Code optimization suggestions
- Best practices and patterns
- Code reviews

Provide clear, concise, and helpful responses. Format code blocks with proper syntax highlighting using markdown code blocks with language tags.`;

      // Build messages array for OpenAI
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      // Add conversation history
      if (conversationHistory && Array.isArray(conversationHistory)) {
        conversationHistory.forEach((msg: { role: string; content: string }) => {
          if (msg.role === "user" || msg.role === "assistant") {
            messages.push({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            });
          }
        });
      }

      // Add current message
      messages.push({ role: "user", content: message });

      // Set up streaming response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable buffering for nginx

      // Create streaming completion
      let stream: any;
      try {
        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
        console.log("[Chatbot] Creating OpenAI completion with model:", model);
        
        // Some newer models (like gpt-5-nano) have different parameter requirements
        const isNewerModel = model.includes("gpt-5") || model.includes("o3");
        const completionParams: any = {
          model: model,
          messages: messages as any,
          stream: true,
        };
        
        // Newer models don't support custom temperature (only default 1)
        // and use max_completion_tokens instead of max_tokens
        if (isNewerModel) {
          completionParams.max_completion_tokens = 2000;
          // Don't set temperature for newer models - they only support default (1)
        } else {
          completionParams.temperature = 0.7;
          completionParams.max_tokens = 2000;
        }
        
        stream = await openai.chat.completions.create(completionParams);
        console.log("[Chatbot] Stream created successfully");
      } catch (error: any) {
        console.error("[Chatbot] OpenAI API error:", error);
        console.error("[Chatbot] Error details:", {
          message: error.message,
          status: error.status,
          response: error.response?.data
        });
        
        // Fallback to static Q&A on error
        if (!res.headersSent) {
          console.log("[Chatbot] Falling back to static Q&A system");
          const fallbackResponse = await generateChatbotResponse("", message, conversationHistory || []);
          
          // Save to room state
          if (roomId) {
            try {
              const roomState = await storage.getRoomState(roomId);
              const existingMessages = roomState?.chatbotMessages || [];
              const newMessages = [
                ...existingMessages,
                { id: Date.now().toString(), role: "user" as const, content: message, timestamp: Date.now() },
                { id: (Date.now() + 1).toString(), role: "assistant" as const, content: fallbackResponse, timestamp: Date.now() },
              ];
              await storage.updateRoomState(roomId, {
                chatbotMessages: newMessages.slice(-50),
              });
            } catch (saveError) {
              console.error("[Chatbot] Failed to save fallback messages:", saveError);
            }
          }
          
          res.json({ 
            response: fallbackResponse,
            fallback: true,
            error: "AI service temporarily unavailable, using fallback responses"
          });
        } else {
          res.write(`data: ${JSON.stringify({ error: "AI service error, please try again" })}\n\n`);
          res.end();
        }
        return;
      }

      // Stream the response
      let fullResponse = "";
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        }

        // Send completion signal
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();

        // Save messages to room state if roomId is provided
        if (roomId && fullResponse) {
          try {
            const roomState = await storage.getRoomState(roomId);
            const existingMessages = roomState?.chatbotMessages || [];
            const newMessages = [
              ...existingMessages,
              { id: Date.now().toString(), role: "user" as const, content: message, timestamp: Date.now() },
              { id: (Date.now() + 1).toString(), role: "assistant" as const, content: fullResponse, timestamp: Date.now() },
            ];
            // Keep only last 50 messages to prevent storage bloat
            await storage.updateRoomState(roomId, {
              chatbotMessages: newMessages.slice(-50),
            });
          } catch (error) {
            console.error("[Chatbot] Failed to save messages to room state:", error);
          }
        }
      } catch (streamError: any) {
        console.error("Streaming error:", streamError);
        if (!res.headersSent) {
          res.status(500).json({ message: "Streaming error occurred" });
        } else {
          res.write(`data: ${JSON.stringify({ error: "Streaming interrupted" })}\n\n`);
          res.end();
        }
      }
    } catch (error: any) {
      console.error("Chatbot error:", error);
      console.error("Error stack:", error.stack);
      
      // If streaming already started, send error as data
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: error.message || "Failed to generate response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ 
          message: error.message || "Failed to generate response",
          details: process.env.NODE_ENV === "development" ? error.stack : undefined
        });
      }
    }
  });

  // Get chatbot messages for a room
  app.get("/api/rooms/:id/chatbot-messages", authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const membership = await storage.getMembership(req.userId!, id);

      if (!membership) {
        res.status(403).json({ message: "Not a member of this room" });
        return;
      }

      const roomState = await storage.getRoomState(id);
      res.json({ messages: roomState?.chatbotMessages || [] });
    } catch (error) {
      console.error("Get chatbot messages error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}

// Chatbot response generation - moved to chatbot-fallback.ts
// Keeping this for backward compatibility, but using imported version
async function generateChatbotResponseOld(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  // For now, return a helpful response based on common patterns
  // In production, replace this with actual AI API calls
  
  const lowerMessage = userMessage.toLowerCase();
  
  // Python-specific help
  if (lowerMessage.includes("python") || lowerMessage.includes("py")) {
    if (lowerMessage.includes("error") || lowerMessage.includes("exception")) {
      return `I can help you with Python errors! Common Python errors include:

1. **IndentationError**: Python uses indentation to define code blocks. Make sure your indentation is consistent (use 4 spaces or tabs, but not both).

2. **SyntaxError**: Check for:
   - Missing colons (:) after if/for/while/def statements
   - Unmatched parentheses, brackets, or quotes
   - Incorrect indentation

3. **NameError**: Variable or function name not defined. Check for typos or if the variable is defined before use.

4. **TypeError**: Usually means you're using the wrong data type (e.g., trying to add a string to an integer).

5. **IndexError**: Trying to access a list/string index that doesn't exist.

6. **KeyError**: Trying to access a dictionary key that doesn't exist.

Share the specific error message and I can help you fix it! For example:
\`\`\`python
# Your code here
\`\`\``;
    }
    
    return `I can help with Python! Common Python issues:

• **Syntax errors**: Missing colons, incorrect indentation, unmatched brackets
• **Indentation**: Python requires consistent indentation (4 spaces recommended)
• **Import errors**: Module not found - check if it's installed
• **Type errors**: Wrong data type being used
• **Logic errors**: Code runs but doesn't produce expected results

Share your code or error message and I'll help you debug it!`;
  }
  
  // Simple pattern matching for common questions
  if (lowerMessage.includes("syntax error") || lowerMessage.includes("syntax")) {
    return `I can help you fix syntax errors! Here are common issues to check:

1. **Missing brackets/parentheses**: Ensure all opening brackets have matching closing ones
2. **Semicolons**: Some languages require semicolons at the end of statements
3. **Quotes**: Make sure strings are properly quoted (single or double quotes)
4. **Indentation**: Python and some languages are sensitive to indentation
5. **Variable names**: Check for typos in variable and function names

If you share the specific error message or code snippet, I can provide more targeted help!`;
  }

  if (lowerMessage.includes("debug") || lowerMessage.includes("error")) {
    return `To debug effectively, try these steps:

1. **Read the error message carefully**: It usually tells you the file, line number, and type of error
2. **Check the stack trace**: It shows the sequence of function calls leading to the error
3. **Use console.log/print statements**: Add logging to track variable values
4. **Use a debugger**: Set breakpoints and step through your code
5. **Isolate the problem**: Comment out sections to find the problematic code

Share your error message or code, and I'll help you debug it!`;
  }

  if (lowerMessage.includes("explain") || lowerMessage.includes("what is") || lowerMessage.includes("how does")) {
    return `I'd be happy to explain! Could you provide more context about what you'd like me to explain? For example:

- A specific programming concept
- A code snippet you're working with
- A term or technology you're unfamiliar with
- How a particular feature or function works

The more details you share, the better I can help!`;
  }

  if (lowerMessage.includes("optimize") || lowerMessage.includes("performance")) {
    return `Here are general optimization strategies:

1. **Algorithm complexity**: Use efficient algorithms (O(n log n) vs O(n²))
2. **Avoid unnecessary loops**: Combine operations when possible
3. **Cache results**: Store computed values that don't change
4. **Use appropriate data structures**: Arrays vs Hash Maps vs Sets
5. **Lazy loading**: Load data only when needed
6. **Database queries**: Optimize queries, use indexes, avoid N+1 queries

Share your code and I can provide specific optimization suggestions!`;
  }

  // Default helpful response
  return `I'm here to help with your coding questions! I can assist with:

• **Code explanations**: Understanding how code works
• **Syntax errors**: Finding and fixing syntax issues
• **Debugging**: Identifying and resolving bugs
• **Optimization**: Improving code performance
• **Best practices**: Following coding standards

Feel free to ask me about:
- Specific error messages you're seeing
- Code snippets you'd like explained
- Programming concepts you're learning
- How to implement a feature

What would you like help with?`;
}
