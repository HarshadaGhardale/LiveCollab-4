import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { 
  User, 
  InsertUser, 
  Room, 
  InsertRoom, 
  RoomState, 
  Membership,
  PublicUser,
  RoomWithMemberCount
} from "@shared/schema";
import { AVATAR_COLORS } from "@shared/schema";
import { UserModel, RoomModel, RoomStateModel, MembershipModel, RefreshTokenModel } from "./mongodb";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getPublicUser(id: string): Promise<PublicUser | undefined>;

  // Room operations
  getRoom(id: string): Promise<Room | undefined>;
  getRoomBySlug(slug: string): Promise<Room | undefined>;
  createRoom(room: InsertRoom, ownerId: string): Promise<Room>;
  updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<boolean>;
  getRoomsForUser(userId: string): Promise<RoomWithMemberCount[]>;

  // Room state operations
  getRoomState(roomId: string): Promise<RoomState | undefined>;
  updateRoomState(roomId: string, updates: Partial<RoomState>): Promise<RoomState>;

  // Membership operations
  getMembership(userId: string, roomId: string): Promise<Membership | undefined>;
  getMembershipsForRoom(roomId: string): Promise<Membership[]>;
  getMembershipsForUser(userId: string): Promise<Membership[]>;
  createMembership(userId: string, roomId: string, role: "owner" | "editor" | "viewer"): Promise<Membership>;
  deleteMembership(userId: string, roomId: string): Promise<boolean>;
  getMemberCount(roomId: string): Promise<number>;

  // Refresh token operations
  saveRefreshToken(userId: string, token: string): Promise<void>;
  getRefreshToken(userId: string): Promise<string | undefined>;
  deleteRefreshToken(userId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private rooms: Map<string, Room>;
  private roomStates: Map<string, RoomState>;
  private memberships: Map<string, Membership>;
  private refreshTokens: Map<string, string>;

  constructor() {
    this.users = new Map();
    this.rooms = new Map();
    this.roomStates = new Map();
    this.memberships = new Map();
    this.refreshTokens = new Map();
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(insertUser.password, 10);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    
    const user: User = {
      id,
      username: insertUser.username,
      email: insertUser.email,
      passwordHash,
      avatarColor,
      createdAt: new Date().toISOString(),
    };
    
    this.users.set(id, user);
    return user;
  }

  async getPublicUser(id: string): Promise<PublicUser | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const { passwordHash, ...publicUser } = user;
    return publicUser;
  }

  // Room operations
  async getRoom(id: string): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async getRoomBySlug(slug: string): Promise<Room | undefined> {
    return Array.from(this.rooms.values()).find(
      (room) => room.slug.toLowerCase() === slug.toLowerCase()
    );
  }

  async createRoom(insertRoom: InsertRoom, ownerId: string): Promise<Room> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    // Generate slug if not provided
    const slug = insertRoom.slug || this.generateSlug(insertRoom.name);
    
    const room: Room = {
      id,
      name: insertRoom.name,
      slug,
      ownerId,
      isPrivate: insertRoom.isPrivate || false,
      createdAt: now,
      lastActiveAt: now,
    };
    
    this.rooms.set(id, room);
    
    // Create initial room state
    const roomState: RoomState = {
      roomId: id,
      whiteboardData: "{}",
      codeContent: "// Start coding here...\n",
      codeLanguage: "javascript",
      lastUpdatedAt: now,
    };
    this.roomStates.set(id, roomState);
    
    // Create owner membership
    await this.createMembership(ownerId, id, "owner");
    
    return room;
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined> {
    const room = this.rooms.get(id);
    if (!room) return undefined;
    
    const updatedRoom = { ...room, ...updates };
    this.rooms.set(id, updatedRoom);
    return updatedRoom;
  }

  async deleteRoom(id: string): Promise<boolean> {
    const room = this.rooms.get(id);
    if (!room) return false;
    
    this.rooms.delete(id);
    this.roomStates.delete(id);
    
    // Delete all memberships for this room
    const membershipKeys = Array.from(this.memberships.keys()).filter(
      (key) => key.endsWith(`-${id}`)
    );
    membershipKeys.forEach((key) => this.memberships.delete(key));
    
    return true;
  }

  async getRoomsForUser(userId: string): Promise<RoomWithMemberCount[]> {
    const memberships = await this.getMembershipsForUser(userId);
    const rooms: RoomWithMemberCount[] = [];
    
    for (const membership of memberships) {
      const room = this.rooms.get(membership.roomId);
      if (room) {
        const memberCount = await this.getMemberCount(room.id);
        rooms.push({
          ...room,
          memberCount,
          isOwner: room.ownerId === userId,
        });
      }
    }
    
    // Sort by last active
    rooms.sort((a, b) => 
      new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
    
    return rooms;
  }

  // Room state operations
  async getRoomState(roomId: string): Promise<RoomState | undefined> {
    return this.roomStates.get(roomId);
  }

  async updateRoomState(roomId: string, updates: Partial<RoomState>): Promise<RoomState> {
    const existingState = this.roomStates.get(roomId);
    const now = new Date().toISOString();
    
    const roomState: RoomState = {
      roomId,
      whiteboardData: updates.whiteboardData || existingState?.whiteboardData || "{}",
      codeContent: updates.codeContent || existingState?.codeContent || "// Start coding here...\n",
      codeLanguage: updates.codeLanguage || existingState?.codeLanguage || "javascript",
      lastUpdatedAt: now,
    };
    
    this.roomStates.set(roomId, roomState);
    
    // Update room last active
    const room = this.rooms.get(roomId);
    if (room) {
      room.lastActiveAt = now;
      this.rooms.set(roomId, room);
    }
    
    return roomState;
  }

  // Membership operations
  async getMembership(userId: string, roomId: string): Promise<Membership | undefined> {
    return this.memberships.get(`${userId}-${roomId}`);
  }

  async getMembershipsForRoom(roomId: string): Promise<Membership[]> {
    return Array.from(this.memberships.values()).filter(
      (m) => m.roomId === roomId
    );
  }

  async getMembershipsForUser(userId: string): Promise<Membership[]> {
    return Array.from(this.memberships.values()).filter(
      (m) => m.userId === userId
    );
  }

  async createMembership(
    userId: string, 
    roomId: string, 
    role: "owner" | "editor" | "viewer"
  ): Promise<Membership> {
    const id = randomUUID();
    const membership: Membership = {
      id,
      userId,
      roomId,
      role,
      joinedAt: new Date().toISOString(),
    };
    
    this.memberships.set(`${userId}-${roomId}`, membership);
    return membership;
  }

  async deleteMembership(userId: string, roomId: string): Promise<boolean> {
    return this.memberships.delete(`${userId}-${roomId}`);
  }

  async getMemberCount(roomId: string): Promise<number> {
    const memberships = await this.getMembershipsForRoom(roomId);
    return memberships.length;
  }

  // Refresh token operations
  async saveRefreshToken(userId: string, token: string): Promise<void> {
    this.refreshTokens.set(userId, token);
  }

  async getRefreshToken(userId: string): Promise<string | undefined> {
    return this.refreshTokens.get(userId);
  }

  async deleteRefreshToken(userId: string): Promise<void> {
    this.refreshTokens.delete(userId);
  }

  // Helper methods
  private generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    
    // Check if slug exists
    const existingRoom = Array.from(this.rooms.values()).find(
      (room) => room.slug === baseSlug
    );
    
    if (!existingRoom) return baseSlug;
    
    // Add random suffix if slug exists
    return `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
  }
}

// MongoDB Storage Implementation
export class MongoDBStorage implements IStorage {
  private generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return baseSlug;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const user = await UserModel.findById(id).lean();
    if (!user) return undefined;
    return { id: user._id as string, ...user };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    if (!user) return undefined;
    return { id: user._id as string, ...user };
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ username: username.toLowerCase() }).lean();
    if (!user) return undefined;
    return { id: user._id as string, ...user };
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const passwordHash = await bcrypt.hash(insertUser.password, 10);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    
    const user = await UserModel.create({
      _id: id,
      username: insertUser.username.toLowerCase(),
      email: insertUser.email.toLowerCase(),
      passwordHash,
      avatarColor,
      createdAt: new Date().toISOString(),
    });

    return { id: user._id as string, username: user.username, email: user.email, passwordHash: user.passwordHash, avatarColor: user.avatarColor, createdAt: user.createdAt };
  }

  async getPublicUser(id: string): Promise<PublicUser | undefined> {
    const user = await UserModel.findById(id).lean();
    if (!user) return undefined;
    const { passwordHash, ...publicUser } = user;
    return { id: user._id as string, ...publicUser };
  }

  // Room operations
  async getRoom(id: string): Promise<Room | undefined> {
    const room = await RoomModel.findById(id).lean();
    if (!room) return undefined;
    return { id: room._id as string, slug: room.slug, name: room.name, ownerId: room.ownerId, isPrivate: room.isPrivate, createdAt: room.createdAt, lastActiveAt: room.lastActiveAt };
  }

  async getRoomBySlug(slug: string): Promise<Room | undefined> {
    const room = await RoomModel.findOne({ slug: slug.toLowerCase() }).lean();
    if (!room) return undefined;
    return { id: room._id as string, slug: room.slug, name: room.name, ownerId: room.ownerId, isPrivate: room.isPrivate, createdAt: room.createdAt, lastActiveAt: room.lastActiveAt };
  }

  async createRoom(insertRoom: InsertRoom, ownerId: string): Promise<Room> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const slug = insertRoom.slug || this.generateSlug(insertRoom.name);

    const room = await RoomModel.create({
      _id: id,
      slug: slug.toLowerCase(),
      name: insertRoom.name,
      ownerId,
      isPrivate: insertRoom.isPrivate || false,
      createdAt: now,
      lastActiveAt: now,
    });

    await RoomStateModel.create({
      _id: randomUUID(),
      roomId: id,
      whiteboardData: "{}",
      codeContent: "// Start coding here...\n",
      codeLanguage: "javascript",
      lastUpdatedAt: now,
    });

    await this.createMembership(ownerId, id, "owner");

    return { id: room._id as string, slug: room.slug, name: room.name, ownerId: room.ownerId, isPrivate: room.isPrivate, createdAt: room.createdAt, lastActiveAt: room.lastActiveAt };
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined> {
    const room = await RoomModel.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!room) return undefined;
    return { id: room._id as string, slug: room.slug, name: room.name, ownerId: room.ownerId, isPrivate: room.isPrivate, createdAt: room.createdAt, lastActiveAt: room.lastActiveAt };
  }

  async deleteRoom(id: string): Promise<boolean> {
    const room = await RoomModel.findByIdAndDelete(id);
    if (!room) return false;
    await RoomStateModel.deleteOne({ roomId: id });
    await MembershipModel.deleteMany({ roomId: id });
    return true;
  }

  async getRoomsForUser(userId: string): Promise<RoomWithMemberCount[]> {
    const memberships = await MembershipModel.find({ userId }).lean();
    const rooms: RoomWithMemberCount[] = [];

    for (const membership of memberships) {
      const room = await RoomModel.findById(membership.roomId).lean();
      if (room) {
        const memberCount = await MembershipModel.countDocuments({ roomId: room._id });
        rooms.push({
          id: room._id as string,
          slug: room.slug,
          name: room.name,
          ownerId: room.ownerId,
          isPrivate: room.isPrivate,
          createdAt: room.createdAt,
          lastActiveAt: room.lastActiveAt,
          memberCount,
          isOwner: room.ownerId === userId,
        });
      }
    }

    rooms.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
    return rooms;
  }

  // Room state operations
  async getRoomState(roomId: string): Promise<RoomState | undefined> {
    const state = await RoomStateModel.findOne({ roomId }).lean();
    if (!state) return undefined;
    return { roomId: state.roomId, whiteboardData: state.whiteboardData, codeContent: state.codeContent, codeLanguage: state.codeLanguage, lastUpdatedAt: state.lastUpdatedAt };
  }

  async updateRoomState(roomId: string, updates: Partial<RoomState>): Promise<RoomState> {
    const now = new Date().toISOString();
    const existing = await RoomStateModel.findOne({ roomId }).lean();

    const state = await RoomStateModel.findOneAndUpdate(
      { roomId },
      {
        whiteboardData: updates.whiteboardData || existing?.whiteboardData || "{}",
        codeContent: updates.codeContent || existing?.codeContent || "// Start coding here...\n",
        codeLanguage: updates.codeLanguage || existing?.codeLanguage || "javascript",
        lastUpdatedAt: now,
      },
      { new: true, upsert: true }
    ).lean();

    await RoomModel.findByIdAndUpdate(roomId, { lastActiveAt: now });

    return { roomId: state!.roomId, whiteboardData: state!.whiteboardData, codeContent: state!.codeContent, codeLanguage: state!.codeLanguage, lastUpdatedAt: state!.lastUpdatedAt };
  }

  // Membership operations
  async getMembership(userId: string, roomId: string): Promise<Membership | undefined> {
    const membership = await MembershipModel.findOne({ userId, roomId }).lean();
    if (!membership) return undefined;
    return { id: membership._id as string, userId: membership.userId, roomId: membership.roomId, role: membership.role, joinedAt: membership.joinedAt };
  }

  async getMembershipsForRoom(roomId: string): Promise<Membership[]> {
    const memberships = await MembershipModel.find({ roomId }).lean();
    return memberships.map((m) => ({ id: m._id as string, userId: m.userId, roomId: m.roomId, role: m.role, joinedAt: m.joinedAt }));
  }

  async getMembershipsForUser(userId: string): Promise<Membership[]> {
    const memberships = await MembershipModel.find({ userId }).lean();
    return memberships.map((m) => ({ id: m._id as string, userId: m.userId, roomId: m.roomId, role: m.role, joinedAt: m.joinedAt }));
  }

  async createMembership(userId: string, roomId: string, role: "owner" | "editor" | "viewer"): Promise<Membership> {
    const id = randomUUID();
    const membership = await MembershipModel.create({
      _id: id,
      userId,
      roomId,
      role,
      joinedAt: new Date().toISOString(),
    });

    return { id: membership._id as string, userId: membership.userId, roomId: membership.roomId, role: membership.role, joinedAt: membership.joinedAt };
  }

  async deleteMembership(userId: string, roomId: string): Promise<boolean> {
    const result = await MembershipModel.deleteOne({ userId, roomId });
    return result.deletedCount > 0;
  }

  async getMemberCount(roomId: string): Promise<number> {
    return await MembershipModel.countDocuments({ roomId });
  }

  // Refresh token operations
  async saveRefreshToken(userId: string, token: string): Promise<void> {
    await RefreshTokenModel.updateOne({ userId }, { _id: randomUUID(), userId, token }, { upsert: true });
  }

  async getRefreshToken(userId: string): Promise<string | undefined> {
    const doc = await RefreshTokenModel.findOne({ userId }).lean();
    return doc?.token;
  }

  async deleteRefreshToken(userId: string): Promise<void> {
    await RefreshTokenModel.deleteOne({ userId });
  }
}

// Create storage instance based on environment
let storage: IStorage;
if (process.env.MONGODB_URL) {
  storage = new MongoDBStorage();
} else {
  storage = new MemStorage();
}

export { storage };
