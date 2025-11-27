# Real-Time Collaboration Platform

A production-ready MERN application featuring real-time collaboration tools including shared whiteboard, code editor, video chat, and live presence tracking.

## Features

✨ **Core Features**
- 🔐 User authentication with JWT & refresh tokens
- 🎨 Real-time shared whiteboard with Fabric.js
- 💻 Synchronized code editor with Monaco
- 📹 WebRTC video chat with Socket.IO signaling
- 👥 Live presence system with cursor tracking
- 🚪 Room management with public/private access
- 🌙 Light/dark mode support

## Quick Start

### Local Development Setup

**See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for detailed instructions.**

**TL;DR:**

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Edit .env with your MongoDB connection string and JWT secrets

# 3. Run dev server
npm run dev
```

Open http://localhost:5000 in your browser.

### Production Build

```bash
npm run build
npm start
```

## Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS + ShadCN UI
- **State Management**: Zustand
- **Real-time Communication**: Socket.IO client
- **Real-time Collaboration**: Fabric.js + Monaco Editor
- **Video Chat**: Simple Peer (WebRTC)
- **Routing**: Wouter
- **Forms**: React Hook Form + Zod validation

### Backend
- **Runtime**: Node.js with Express
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.IO + WebSocket
- **Validation**: Zod schemas
- **Hashing**: bcryptjs

### Key Technologies
- **Fabric.js 6** - Whiteboard drawing
- **Monaco Editor** - Code editing with syntax highlighting
- **Simple Peer** - WebRTC peer connections
- **Framer Motion** - Animations & micro-interactions
- **TanStack Query** - Server state management

## Project Structure

```
├── client/src/
│   ├── pages/              # Page components (auth, dashboard, room)
│   ├── components/         # Reusable UI & collaboration components
│   ├── lib/                # Utilities (socket, stores, queryClient)
│   └── index.tsx           # React entry point
├── server/
│   ├── index.ts            # Express server & HTTP setup
│   ├── routes.ts           # API routes & Socket.IO handlers
│   ├── auth.ts             # JWT & password authentication
│   ├── storage.ts          # Database interface & implementations
│   └── mongodb.ts          # Mongoose models
├── shared/
│   └── schema.ts           # Zod schemas & shared types
└── package.json            # Dependencies
```

## Environment Variables

Create a `.env` file based on `.env.example`:

```
MONGODB_URL=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
NODE_ENV=development
PORT=5000
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh tokens
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Rooms
- `GET /api/rooms` - Get user's rooms
- `GET /api/rooms/:slug` - Get room by slug
- `POST /api/rooms` - Create new room
- `PATCH /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room (owner only)

### Code Execution
- `POST /api/execute-code` - Execute JavaScript code

## Socket.IO Events

### Room Management
- `room:join` - Join a room
- `room:leave` - Leave a room
- `room:state` - Receive room state

### Collaboration
- `whiteboard:event` - Whiteboard drawing events
- `code:event` - Code editor changes
- `presence:update` - User presence/cursor updates
- `webrtc:signal` - WebRTC signaling (offer/answer/ICE)

### User Management
- `user:joined` - User joined room
- `user:left` - User left room

## Running Tests

```bash
npm run check   # Type checking
npm run build   # Build & validate
```

## Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Update `JWT_SECRET` with a strong random string
- [ ] Update `SESSION_SECRET` with a strong random string
- [ ] Use production MongoDB database
- [ ] Set proper CORS origins
- [ ] Enable HTTPS in production
- [ ] Set up database backups
- [ ] Monitor error logs

### Hosting Options
- **Heroku**: See deployment guide
- **Vercel**: Frontend only (use separate backend)
- **AWS**: EC2, ECS, Lambda
- **DigitalOcean**: App Platform or VPS
- **Railway**: Simple Node.js deployment

## Database Setup

This project uses MongoDB. For local development:

1. Create free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster
3. Add your IP to IP whitelist (or use 0.0.0.0/0 for development)
4. Copy connection string
5. Add to `.env` as `MONGODB_URL`

## Troubleshooting

### "Invalid or expired token" errors
- Ensure `.env` file exists with `JWT_SECRET` and `SESSION_SECRET`
- Clear browser localStorage and login again

### MongoDB connection fails
- Check `MONGODB_URL` in `.env`
- Verify IP is whitelisted in MongoDB Atlas
- Ensure database name is correct

### Port already in use
- Change `PORT` in `.env`
- Or kill process: `lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill -9`

### Whiteboard/Code sync not working
- Check WebSocket connection in browser DevTools
- Verify Socket.IO is running on correct port
- Refresh page and rejoin room

## Performance Optimization

- Code splitting via Vite
- Image lazy loading
- WebSocket for real-time sync (no polling)
- Server-side state persistence in MongoDB
- Client-side caching with React Query

## License

MIT

## Support

For issues or questions:
1. Check [LOCAL_SETUP.md](./LOCAL_SETUP.md)
2. Review logs in console
3. Check browser Network tab for API errors
4. Verify MongoDB connection
