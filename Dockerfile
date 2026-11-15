# syntax=docker/dockerfile:1

# ---- build the frontend: on the machine doing the build (the result is the same for any CPU) ----
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: Node runs the TypeScript server directly (type stripping) ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data \
    CONTENT_DIR=/content
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
# The blog is read live from CONTENT_DIR (posts in blog/, pictures in media/). These turn its Markdown
# into pages, keep location data out of its photos, and are the posts it starts with if it's empty.
COPY scripts ./scripts
COPY src/lib ./src/lib
COPY src/content ./src/content
RUN mkdir -p /data /content && chown node:node /data /content
USER node
VOLUME ["/data", "/content"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:8787/api/health || exit 1
CMD ["node", "server/index.ts"]
