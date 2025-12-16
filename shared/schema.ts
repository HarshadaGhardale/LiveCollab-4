import { z } from "zod";

// User Schema
export const userSchema = z.object({
  id: z.string(),
  username: z.string().min(3).max(30),
  email: z.string().email(),
  passwordHash: z.string(),
  avatarColor: z.string(),
  createdAt: z.string(),
  resetToken: z.string().optional(),
  resetTokenExpiry: z.number().optional(),
});

export const insertUserSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;

// Public user info (without sensitive data)
export type PublicUser = Omit<User, "passwordHash">;

// Room Schema
export const roomSchema = z.object({
  id: z.string(),
  slug: z.string().min(3).max(50),
  name: z.string().min(1).max(100),
  ownerId: z.string(),
  type: z.enum(["standard", "web"]).default("standard"),
  isPrivate: z.boolean().default(false),
  createdAt: z.string(),
  lastActiveAt: z.string(),
});

export const insertRoomSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(3).max(50).optional(),
  type: z.enum(["standard", "web"]).default("standard"),
  isPrivate: z.boolean().default(false),
});

export type Room = z.infer<typeof roomSchema>;
export type InsertRoom = z.infer<typeof insertRoomSchema>;

// Room State Schema (for whiteboard and code)
export const roomStateSchema = z.object({
  roomId: z.string(),
  whiteboardData: z.string().default("{}"),
  codeContent: z.string().default("// Start coding here...\n"),
  codeLanguage: z.string().default("javascript"),
  webFiles: z.record(z.string()).optional(),
  lastUpdatedAt: z.string(),
});

export type RoomState = z.infer<typeof roomStateSchema>;

// Membership Schema
export const membershipSchema = z.object({
  id: z.string(),
  userId: z.string(),
  roomId: z.string(),
  role: z.enum(["owner", "editor", "viewer"]),
  joinedAt: z.string(),
});

export type Membership = z.infer<typeof membershipSchema>;

// Presence Schema (for live cursors)
export const presenceSchema = z.object({
  oderId: z.string(),
  username: z.string(),
  avatarColor: z.string(),
  cursorX: z.number().optional(),
  cursorY: z.number().optional(),
  activePanel: z.enum(["whiteboard", "editor"]).optional(),
  lastSeen: z.number(),
});

export type Presence = z.infer<typeof presenceSchema>;

// WebRTC Signaling
export const signalingSchema = z.object({
  type: z.enum(["offer", "answer", "ice-candidate"]),
  from: z.string(),
  to: z.string(),
  payload: z.any(),
});

export type SignalingMessage = z.infer<typeof signalingSchema>;

// Socket Events
export type WhiteboardEvent = {
  type: "draw" | "clear" | "undo" | "redo" | "object-added" | "object-modified" | "object-removed";
  data: any;
  userId: string;
};

export type CodeEvent = {
  type: "change" | "cursor" | "selection";
  data: any;
  userId: string;
};

export type PresenceEvent = {
  type: "join" | "leave" | "cursor-move";
  userId: string;
  data: Presence;
};

// Auth Response
export type AuthResponse = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

// Room with member count
export type RoomWithMemberCount = Room & {
  memberCount: number;
  isOwner: boolean;
};

// Avatar colors for users
export const AVATAR_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
] as const;

// Drawing tools
export const DRAWING_TOOLS = [
  { id: "select", name: "Select", icon: "MousePointer2" },
  { id: "pen", name: "Pen", icon: "Pencil" },
  { id: "eraser", name: "Eraser", icon: "Eraser" },
  { id: "rectangle", name: "Rectangle", icon: "Square" },
  { id: "circle", name: "Circle", icon: "Circle" },
  { id: "line", name: "Line", icon: "Minus" },
  { id: "text", name: "Text", icon: "Type" },
] as const;

export type DrawingTool = typeof DRAWING_TOOLS[number]["id"];

// Color palette for drawing
export const COLOR_PALETTE = [
  "#000000", "#FFFFFF", "#EF4444", "#F97316",
  "#EAB308", "#22C55E", "#3B82F6", "#8B5CF6",
  "#EC4899", "#6B7280", "#78716C", "#0EA5E9",
] as const;

// Code languages
export const CODE_LANGUAGES = [
  { id: "javascript", name: "JavaScript" },
  { id: "python", name: "Python" },
  { id: "java", name: "Java" },
  { id: "c", name: "C" },
  { id: "cpp", name: "C++" },
] as const;

export const inviteUserSchema = z.object({
  username: z.string().min(1),
});

export type InviteUser = z.infer<typeof inviteUserSchema>;
