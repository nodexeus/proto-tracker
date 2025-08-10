# Proto Tracker Web - Docker Setup

This is a production-ready Docker setup for the Proto Tracker web frontend using Caddy as a web server.

## Features

- **Multi-stage build**: Optimized for production with minimal image size
- **Caddy web server**: Lightweight, secure, and performant
- **Security headers**: XSS protection, frame options, content-type sniffing protection
- **Compression**: Gzip compression enabled for better performance
- **Caching**: Proper caching headers for static assets
- **SPA routing**: Client-side routing support with fallback to index.html
- **Health checks**: Built-in health check endpoint at `/health`
- **Non-root user**: Runs as non-root for security

## Quick Start

### Build and run locally:

```bash
# Build the image
docker build -t proto-tracker-web .

# Run the container
docker run -d -p 80:80 --name proto-tracker-web proto-tracker-web

# Check health
curl http://localhost/health
```

### Using docker-compose:

```bash
# Start the service
docker-compose up -d

# Check logs
docker-compose logs -f web

# Stop the service
docker-compose down
```

## Configuration

### Environment Variables

- `NODE_ENV`: Set to `production` (automatically set in Dockerfile)

### Ports

- **80**: HTTP port (default)

### Health Check

The container includes a health check endpoint at `/health` that returns a 200 status when healthy.

### Security

- Runs as non-root user (caddy:caddy, uid:1001, gid:1001)
- Security headers enabled (X-Frame-Options, X-Content-Type-Options, etc.)
- Server tokens hidden

## Production Deployment

For production deployment, you may want to:

1. **Use HTTPS**: Configure TLS certificates
2. **Set custom domain**: Update docker-compose.yml with your domain
3. **Configure reverse proxy**: Use with Traefik, nginx, or similar
4. **Set resource limits**: Add memory and CPU limits
5. **Configure logging**: Set up log aggregation

### Example with custom domain and SSL:

```yaml
version: '3.8'
services:
  web:
    build: .
    environment:
      - NODE_ENV=production
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.proto-tracker.rule=Host(\`your-domain.com\`)"
      - "traefik.http.routers.proto-tracker.entrypoints=websecure"
      - "traefik.http.routers.proto-tracker.tls.certresolver=letsencrypt"
```

## Build Optimization

The build process:

1. **Build stage**: Installs dependencies and builds the React app with Vite
2. **Production stage**: Uses Caddy to serve the built static files
3. **Optimizations**: npm cache mounting, production-only build script

Final image size is approximately 50-70MB (much smaller than nginx alternatives).

## Troubleshooting

### Container won't start
```bash
docker logs proto-tracker-web
```

### Health check failing
```bash
docker exec proto-tracker-web wget -qO- http://localhost/health
```

### Build failing
Make sure you have the latest version of your source code and try:
```bash
docker build --no-cache -t proto-tracker-web .
```