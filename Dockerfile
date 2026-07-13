FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .

ENV NODE_ENV=production
ENV WRANGLER_WRITE_LOGS=false
ENV WRANGLER_LOG_PATH=/app/.wrangler/logs
ENV MINIFLARE_REGISTRY_PATH=/app/.wrangler/registry

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
