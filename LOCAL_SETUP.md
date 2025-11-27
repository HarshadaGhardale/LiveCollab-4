# Running the Project Locally

## Prerequisites
- **Node.js** (v18+) - [Download](https://nodejs.org/)
- **MongoDB Atlas Account** - [Sign up free](https://www.mongodb.com/cloud/atlas)
- **Git** - [Download](https://git-scm.com/)

## Step 1: Clone or Download the Project

```bash
# Clone from your repository (if using git)
git clone <your-repo-url>
cd <project-folder>

# Or download and extract the project manually
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Set Up Environment Variables

1. Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

2. Update `.env` with your own values:

```
MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-12345
SESSION_SECRET=your-super-secret-session-key-67890
NODE_ENV=development
PORT=5000
```

### Getting MongoDB Connection String:

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Click "Connect" → "Drivers" → Select Node.js
4. Copy the connection string
5. Replace `<password>` and `<dbname>` with your actual credentials

## Step 4: Run the Development Server

```bash
npm run dev
```

The app will start on `http://localhost:5000`

- **Frontend**: http://localhost:5000
- **Backend API**: http://localhost:5000/api
- **Socket.IO**: ws://localhost:5000/socket.io

## Step 5: Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
├── client/                    # React frontend
│   └── src/
│       ├── pages/            # Page components
│       ├── components/       # Reusable components
│       └── lib/              # Utilities & hooks
├── server/                    # Express backend
│   ├── index.ts              # Server entry point
│   ├── routes.ts             # API routes & Socket.IO
│   ├── auth.ts               # JWT & auth logic
│   ├── storage.ts            # Database interface
│   └── mongodb.ts            # MongoDB models
├── shared/                    # Shared types
│   └── schema.ts             # Zod schemas
└── package.json              # Dependencies
```

## Key Differences from Replit

### Environment Variables
- **Replit**: Uses GUI for secrets management
- **Local**: Use `.env` file (add to `.gitignore` to keep secrets safe)

### Database
- **Replit**: Auto-managed Postgres (optional)
- **Local**: You must set up MongoDB Atlas manually

### Port Binding
- **Replit**: Automatically binds to 0.0.0.0:5000
- **Local**: Runs on localhost:5000 by default

### Hot Reload
- **Replit**: Automatic
- **Local**: Works via Vite (auto-restarts on file changes)

## Troubleshooting

### Port Already in Use
```bash
# Change port in .env
PORT=3000
```

### MongoDB Connection Error
- Check `.env` has correct `MONGODB_URL`
- Verify IP whitelist in MongoDB Atlas (allow 0.0.0.0/0 for development)
- Check password doesn't contain special characters (if it does, URL-encode them)

### Module Not Found Errors
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### Token Errors
- Make sure `JWT_SECRET` and `SESSION_SECRET` are set in `.env`
- These can be any random string for local development

## Testing Features

1. **Create Room**: Dashboard → "Create Room"
2. **Join Room**: Share the room link with another user
3. **Whiteboard**: Draw in real-time
4. **Code Editor**: Type code and see changes sync
5. **Video Chat**: Click "Join Video Chat" (requires webcam permission)
6. **Members Panel**: Click members count to see who's online

## Production Deployment

When ready to deploy:

1. Update `NODE_ENV=production`
2. Use strong `JWT_SECRET` and `SESSION_SECRET` values
3. Set `MONGODB_URL` to your production database
4. Run `npm run build && npm start`
5. Deploy to Heroku, Vercel, AWS, etc.

## Need Help?

- Check logs: `npm run dev` shows errors in console
- Common issues usually relate to MongoDB connection or missing env vars
- Ensure Node.js version is 18 or higher: `node --version`
