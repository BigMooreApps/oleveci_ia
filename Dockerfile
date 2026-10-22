# Dockerfile for OleVeci v8 Production Deployment
FROM node:20-slim

WORKDIR /app

# Install system dependencies (python3, ffmpeg, curl, ca-certificates) for Linux video extraction
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install official standalone yt-dlp binary into system PATH
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Install build & runtime dependencies
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy full application source code
COPY . .

# Build Vite client and Express server bundle
RUN npm run build

# Configure runtime environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000 80

# Start production server
CMD ["node", "dist/server.cjs"]
