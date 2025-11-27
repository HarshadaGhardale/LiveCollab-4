import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicUser, Presence, DrawingTool, RoomWithMemberCount } from "@shared/schema";

// Auth Store
interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: PublicUser, accessToken: string, refreshToken: string) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      updateTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: "auth-storage",
    }
  )
);

// Room Store
interface RoomState {
  currentRoom: RoomWithMemberCount | null;
  presence: Map<string, Presence>;
  setCurrentRoom: (room: RoomWithMemberCount | null) => void;
  updatePresence: (userId: string, presence: Presence) => void;
  removePresence: (userId: string) => void;
  clearPresence: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  currentRoom: null,
  presence: new Map(),
  setCurrentRoom: (room) => set({ currentRoom: room }),
  updatePresence: (userId, presence) =>
    set((state) => {
      const newPresence = new Map(state.presence);
      newPresence.set(userId, presence);
      return { presence: newPresence };
    }),
  removePresence: (userId) =>
    set((state) => {
      const newPresence = new Map(state.presence);
      newPresence.delete(userId);
      return { presence: newPresence };
    }),
  clearPresence: () => set({ presence: new Map() }),
}));

// Whiteboard Store
interface WhiteboardState {
  activeTool: DrawingTool;
  activeColor: string;
  brushSize: number;
  canUndo: boolean;
  canRedo: boolean;
  setActiveTool: (tool: DrawingTool) => void;
  setActiveColor: (color: string) => void;
  setBrushSize: (size: number) => void;
  setUndoRedo: (canUndo: boolean, canRedo: boolean) => void;
}

export const useWhiteboardStore = create<WhiteboardState>((set) => ({
  activeTool: "pen",
  activeColor: "#000000",
  brushSize: 3,
  canUndo: false,
  canRedo: false,
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveColor: (color) => set({ activeColor: color }),
  setBrushSize: (size) => set({ brushSize: size }),
  setUndoRedo: (canUndo, canRedo) => set({ canUndo, canRedo }),
}));

// Editor Store
interface EditorState {
  language: string;
  fontSize: number;
  setLanguage: (language: string) => void;
  setFontSize: (size: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  language: "javascript",
  fontSize: 14,
  setLanguage: (language) => set({ language }),
  setFontSize: (size) => set({ fontSize: size }),
}));

// UI Store
interface UIState {
  sidebarExpanded: boolean;
  videoBarVisible: boolean;
  activePanel: "whiteboard" | "editor" | "both";
  toggleSidebar: () => void;
  toggleVideoBar: () => void;
  setActivePanel: (panel: "whiteboard" | "editor" | "both") => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarExpanded: true,
  videoBarVisible: true,
  activePanel: "both",
  toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),
  toggleVideoBar: () => set((state) => ({ videoBarVisible: !state.videoBarVisible })),
  setActivePanel: (panel) => set({ activePanel: panel }),
}));

// Theme Store
interface ThemeState {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
    }),
    {
      name: "theme-storage",
    }
  )
);
