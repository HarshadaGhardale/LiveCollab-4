# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install build tools
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

# Install ALL code-execution runtimes so every language works in production:
#   Java, GCC/G++ (C / C++), Python 3
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    default-jdk \
    gcc \
    g++ \
    python3 \
    python3-pip \
 && rm -rf /var/lib/apt/lists/*

# Copy built output from build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production

EXPOSE 5001

CMD ["node", "dist/index.cjs"]
