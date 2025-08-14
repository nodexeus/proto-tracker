# # Multi-stage build for production-ready React/Vite app with Caddy

# # Stage 1: Build the application
# FROM node:20-alpine AS build

# # Set working directory
# WORKDIR /app

# # Copy package files
# COPY package*.json ./

# # Install dependencies with optimizations
# RUN --mount=type=cache,target=/root/.npm \
#     npm ci --only=production=false --no-audit --no-fund

# # Copy source code
# COPY . .

# # Build the application (skip TypeScript checking for production builds)
# RUN npm run build:production

# # Stage 2: Production runtime with Caddy
# FROM caddy:alpine AS production

# # Create Caddyfile for serving SPA
# COPY <<EOF /etc/caddy/Caddyfile
# {
#     # Global options
#     admin off
#     auto_https off
# }

# :80 {
#     # Serve static files from /srv
#     root * /srv

#     # Enable compression
#     encode gzip

#     # Security headers
#     header {
#         # Prevent clickjacking
#         X-Frame-Options DENY
#         # Prevent MIME type sniffing
#         X-Content-Type-Options nosniff
#         # XSS protection
#         X-XSS-Protection "1; mode=block"
#         # Referrer policy
#         Referrer-Policy "strict-origin-when-cross-origin"
#         # Remove server information
#         -Server
#     }

#     # Cache static assets
#     @static {
#         file
#         path *.js *.css *.png *.jpg *.jpeg *.gif *.ico *.svg *.woff *.woff2 *.ttf *.eot
#     }
#     header @static {
#         Cache-Control "public, max-age=31536000, immutable"
#     }

#     # Health check endpoint
#     respond /health "healthy" 200

#     # Handle client-side routing (SPA fallback)
#     try_files {path} /index.html

#     # Prevent caching of index.html
#     @html {
#         path /index.html
#     }
#     header @html {
#         Cache-Control "no-cache, no-store, must-revalidate"
#         Pragma "no-cache"
#         Expires "0"
#     }

#     # Logging (optional, can be removed for production)
#     log {
#         output stdout
#         format console
#     }
# }
# EOF

# # Copy built application from build stage
# COPY --from=build /app/dist /srv

# # Create non-root user and set permissions
# RUN addgroup -g 1001 -S caddy && \
#     adduser -S caddy -u 1001 -G caddy && \
#     chown -R caddy:caddy /srv

# # Switch to non-root user
# USER caddy

# # Expose port
# EXPOSE 80

# # Health check
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#     CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# # Start Caddy
# CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]

FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_API_URL
ARG VITE_GOOGLE_REDIRECT_URI
COPY package*.json ./
RUN npm ci
COPY . .

RUN npm run build:production



# Using 'serve' (smallest/simple)
FROM node:22-alpine
WORKDIR /app
RUN npm i -D serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npx", "serve", "-s", "dist", "-l", "3000"]