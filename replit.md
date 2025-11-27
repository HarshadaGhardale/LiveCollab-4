# CollabSpace - Real-Time Collaboration Platform

## Overview

CollabSpace is a real-time collaboration platform that combines a shared whiteboard, collaborative code editor, and peer-to-peer video chat. Users can create rooms with unique slugs, collaborate on visual and code content simultaneously, and communicate via video while working together. The platform emphasizes productivity with a clean, Linear/VS Code-inspired design system focused on information density and minimal visual noise.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server with HMR (Hot Module Replacement)
- Wouter for client-side routing (lightweight alternative to React Router)
- TanStack Query for server state management and API caching

**UI Component System:**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui component library (New York style variant)
- Tailwind CSS for utility-first styling with custom design tokens
- Class Variance Authority (CVA) for component variant management
- Framer Motion for animations and transitions

**State Management:**
- Zustand with persistence middleware for client-side state (auth, room, UI, whiteboard, editor)
- TanStack Query for server-state caching and synchronization
- Local state via React hooks for component-level concerns

**Real-time Collaboration Features:**
- **Whiteboard:** Fabric.js canvas library for drawing, shapes, text, and collaborative editing
- **Code Editor:** Monaco Editor (VS Code engine) with syntax highlighting and multi-language support
- **Video Chat:** SimplePeer for WebRTC peer-to-peer video/audio connections
- **Live Presence:** Real-time cursor tracking and user presence indicators

**Design System:**
- Typography: Inter for UI, JetBrains Mono for code
- Spacing: Consistent Tailwind scale (2, 3, 4, 6, 8, 12)
- Layout: CSS Grid for main application structure, Split.js for resizable panels
- Theme: Light/dark mode support with CSS custom properties

### Backend Architecture

**Server Framework:**
- Express.js HTTP server with TypeScript
- Node.js HTTP server wrapped by Socket.IO for WebSocket support
- Development: tsx for TypeScript execution
- Production: esbuild bundling with selective dependency bundling (allowlist-based)

**Authentication & Authorization:**
- JWT-based authentication with access tokens (15min expiry) and refresh tokens (7day expiry)
- bcryptjs for password hashing
- Custom middleware for route protection and token verification
- Session management with in-memory token storage

**Real-time Communication:**
- Socket.IO for WebSocket connections with automatic fallback
- JWT authentication on socket connections
- Room-based event namespacing for isolated collaboration contexts
- Event types: whiteboard drawing, code changes, cursor positions, video signaling

**API Design:**
- RESTful endpoints for CRUD operations (users, rooms, memberships)
- JSON request/response format
- Authorization middleware for protected routes
- Error handling with descriptive messages

**Data Storage Strategy:**
- In-memory storage implementation (MemStorage class) using JavaScript Maps
- Interface-based storage abstraction (IStorage) for future database migration
- Entities: Users, Rooms, RoomState, Memberships, RefreshTokens
- Room state includes whiteboard data and code editor content as JSON strings

### External Dependencies

**Database:**
- Currently: In-memory storage with Maps (development/prototype)
- Configured for: PostgreSQL via Neon serverless driver (@neondatabase/serverless)
- ORM: Drizzle ORM with type-safe schema definitions
- Migration tool: drizzle-kit for schema management
- Note: Database schema is defined but storage uses in-memory implementation

**Authentication:**
- jsonwebtoken (JWT) for token generation and verification
- bcryptjs for password hashing (salt rounds: 10)

**WebRTC & Real-time:**
- Socket.IO (server + client) for WebSocket communication
- simple-peer for WebRTC peer connection abstraction
- Auto-negotiation for ICE candidates and media streams

**Code Editor:**
- @monaco-editor/react wrapper for Monaco Editor
- Language support: JavaScript, TypeScript, Python, Java, C++, HTML, CSS, JSON, Markdown
- Theme: Syncs with application light/dark mode

**Canvas/Whiteboard:**
- fabric.js for canvas manipulation and object management
- Support for: pen, eraser, shapes (rectangle, circle, line), text
- Color palette with predefined options
- Export functionality to PNG/JSON

**UI Libraries:**
- @radix-ui/* primitives for 20+ accessible components
- framer-motion for declarative animations
- lucide-react for icon system
- react-hook-form + @hookform/resolvers for form validation
- zod for runtime schema validation

**Development Tools:**
- Replit-specific plugins (@replit/vite-plugin-*) for development environment integration
- TypeScript with strict mode enabled
- Path aliases (@/, @shared, @assets) for clean imports

**Build & Deployment:**
- Vite for client bundling (outputs to dist/public)
- esbuild for server bundling (outputs to dist/index.cjs)
- Selective dependency bundling to reduce cold start times
- Static file serving in production from dist/public

**Environment Configuration:**
- DATABASE_URL environment variable for PostgreSQL connection (not currently used)
- SESSION_SECRET for JWT signing (defaults to "collab-space-secret-key-2024")
- NODE_ENV for environment detection