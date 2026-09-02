FROM node:22-alpine AS builder
WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install all dependencies for build step
RUN npm ci

# Copy Prisma schema and Prisma config
COPY prisma ./prisma/
COPY prisma.config.ts ./
COPY databaseConnection.ts ./
RUN npx prisma generate

# Copy source code and build
COPY . .
RUN npm run build

# Runtime container
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# A bare container defaults to loopback. Docker Compose or a public platform
# must explicitly opt into the container interface and its matching safeguards.
ENV HOST=127.0.0.1
ENV CONTAINERIZED=true
ENV LOCAL_ONLY_MODE=true
# The entrypoint runs `npx prisma migrate deploy` as a non-root user; give it a
# writable HOME/cache. Audit logs are written to /app/logs (chowned below).
ENV HOME=/app

# Run as non-root (least privilege).
RUN addgroup -S leadforge && adduser -S leadforge -G leadforge

# Copy package manifests and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Install the Prisma CLI into the runtime image (not saved to manifests) so the
# entrypoint can apply migrations at boot without the devDependency tree.
RUN npm install --no-save prisma@7.10.0

# Copy built server bundle and static assets
COPY --from=builder /app/dist ./dist
# Prisma 7 generates the client into the build tree (bundled into dist/server.mjs),
# so there is no node_modules/.prisma to copy. The runtime only needs the
# @prisma/* packages that npm ci --omit=dev already installed above.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/databaseConnection.ts ./

# Deployment entrypoint (applies schema migrations, then starts the server).
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Normalize Windows checkouts before Linux execution. Keep application files
# root-owned and make only the runtime directories writable by the service user.
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh \
    && mkdir -p /app/logs /app/.runtime/duckdb_extensions /app/.runtime/geonames \
    && chown -R leadforge:leadforge /app/logs /app/.runtime \
    && chown leadforge:leadforge /app \
    && chmod +x /app/docker-entrypoint.sh

USER leadforge

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health/live || exit 1
# Serve the bundled production server, not the TypeScript source.
ENTRYPOINT ["/app/docker-entrypoint.sh"]