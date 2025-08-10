# Node runtime for building and serving the Vite app
FROM node:20-alpine

WORKDIR /app

# Install dependencies with cache-friendly layer
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application source
COPY . .

# Ensure non-root execution
RUN addgroup -g 1001 -S nodejs && \
    adduser -S node -u 1001 && \
    chown -R node:node /app
USER node

# Default port for vite preview (matches docker-compose mapping)
ENV PORT=5001
EXPOSE 5001

# Build at container startup to capture VITE_ env vars provided at runtime
# Then serve built assets via Vite preview
CMD ["npm", "run", "preview", "--", "--port", "5001", "--host", "0.0.0.0"]