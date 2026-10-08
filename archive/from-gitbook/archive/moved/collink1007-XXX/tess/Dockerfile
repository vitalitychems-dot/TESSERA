FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y \
  ffmpeg \
  flite \
  curl \
  git \
  python3 \
  python3-pip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY . .

RUN npm run build

RUN find . -name "*.test.*" -delete 2>/dev/null || true
RUN find . -name "*.spec.*" -delete 2>/dev/null || true
RUN rm -rf .git attached_assets .local .cache 2>/dev/null || true

FROM node:20-slim

RUN apt-get update && apt-get install -y \
  ffmpeg \
  flite \
  curl \
  ca-certificates \
  dumb-init \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd -r tesseract && useradd -r -g tesseract -m tesseract

WORKDIR /app

COPY --from=builder --chown=tesseract:tesseract /app/dist ./dist
COPY --from=builder --chown=tesseract:tesseract /app/node_modules ./node_modules
COPY --from=builder --chown=tesseract:tesseract /app/package.json ./
COPY --from=builder --chown=tesseract:tesseract /app/server ./server
COPY --from=builder --chown=tesseract:tesseract /app/shared ./shared

RUN mkdir -p /app/uploads /app/data && chown -R tesseract:tesseract /app

USER tesseract

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000
ENV MESH_ROLE=master
ENV NODE_OPTIONS="--max-old-space-size=4096"

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
