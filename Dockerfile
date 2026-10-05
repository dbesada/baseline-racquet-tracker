FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm_config_jobs=1 npm_config_maxsockets=1 npm ci --no-audit --no-fund --foreground-scripts
COPY . .
# Run as the image's unprivileged "node" user (uid 1000). The app writes only
# to these folders. On TrueNAS, .data and .wrangler are host folders that
# uid 1000 must own; wrangler keeps its local D1 state and temporary files in
# dist/server/.wrangler, inside the container.
RUN mkdir -p .data .wrangler dist/server/.wrangler \
  && chown node:node .data .wrangler dist/server/.wrangler
USER node

ENV NODE_ENV=production
ENV WRANGLER_WRITE_LOGS=false
ENV WRANGLER_LOG_PATH=/app/.wrangler/logs
ENV MINIFLARE_REGISTRY_PATH=/app/.wrangler/registry

EXPOSE 3000
CMD ["npm", "run", "start", "--", "--port", "3000"]
