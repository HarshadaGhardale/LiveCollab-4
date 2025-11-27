import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { PublicUser } from "@shared/schema";

const JWT_SECRET = process.env.SESSION_SECRET || "collab-space-secret-key-2024";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export interface TokenPayload {
  userId: string;
  type: "access" | "refresh";
}

export interface AuthRequest extends Request {
  user?: PublicUser;
  userId?: string;
}

export function generateAccessToken(userId: string): string {
  return jwt.sign(
    { userId, type: "access" } as TokenPayload,
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: "refresh" } as TokenPayload,
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload || payload.type !== "access") {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  const user = await storage.getPublicUser(payload.userId);
  if (!user) {
    res.status(401).json({ message: "User not found" });
    return;
  }

  req.user = user;
  req.userId = payload.userId;
  next();
}

export function verifySocketToken(token: string): string | null {
  const payload = verifyToken(token);
  if (!payload || payload.type !== "access") {
    return null;
  }
  return payload.userId;
}
