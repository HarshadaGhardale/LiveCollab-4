import mongoose, { Schema, Document } from "mongoose";
import type { User, Room, RoomState, Membership } from "@shared/schema";

// User Model
interface IUserDoc extends Omit<User, 'id'>, Document {
  _id: string;
}

const userSchema = new Schema<IUserDoc>({
  _id: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  avatarColor: { type: String, required: true },
  createdAt: { type: String, required: true },
});

export const UserModel = mongoose.model<IUserDoc>("User", userSchema);

// Room Model
interface IRoomDoc extends Omit<Room, 'id'>, Document {
  _id: string;
}

const roomSchema = new Schema<IRoomDoc>({
  _id: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, required: true },
  ownerId: { type: String, required: true },
  isPrivate: { type: Boolean, default: false },
  createdAt: { type: String, required: true },
  lastActiveAt: { type: String, required: true },
});

roomSchema.index({ slug: 1 });
export const RoomModel = mongoose.model<IRoomDoc>("Room", roomSchema);

// RoomState Model
interface IRoomStateDoc extends RoomState, Document {
  _id: string;
}

const roomStateSchema = new Schema<IRoomStateDoc>({
  _id: { type: String, required: true },
  roomId: { type: String, required: true, unique: true },
  whiteboardData: { type: String, default: "{}" },
  codeContent: { type: String, default: "// Start coding here...\n" },
  codeLanguage: { type: String, default: "javascript" },
  lastUpdatedAt: { type: String, required: true },
});

export const RoomStateModel = mongoose.model<IRoomStateDoc>("RoomState", roomStateSchema);

// Membership Model
interface IMembershipDoc extends Membership, Document {
  _id: string;
}

const membershipSchema = new Schema<IMembershipDoc>({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  roomId: { type: String, required: true },
  role: { type: String, enum: ["owner", "editor", "viewer"], required: true },
  joinedAt: { type: String, required: true },
});

membershipSchema.index({ userId: 1, roomId: 1 });
membershipSchema.index({ roomId: 1 });
export const MembershipModel = mongoose.model<IMembershipDoc>("Membership", membershipSchema);

// Refresh Token Model
interface IRefreshTokenDoc extends Document {
  _id: string;
  userId: string;
  token: string;
}

const refreshTokenSchema = new Schema<IRefreshTokenDoc>({
  _id: { type: String, required: true },
  userId: { type: String, required: true, unique: true },
  token: { type: String, required: true },
});

export const RefreshTokenModel = mongoose.model<IRefreshTokenDoc>("RefreshToken", refreshTokenSchema);

export async function connectMongoDB(): Promise<void> {
  const mongoUri = process.env.MONGODB_URL;
  if (!mongoUri) {
    throw new Error("MONGODB_URL environment variable is not set");
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}
