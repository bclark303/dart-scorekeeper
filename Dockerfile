FROM node:22-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# The unified build step is intentionally idempotent and currently uses a
# small Python helper. Install Python only so self-hosted/Docker builds follow
# the same build path as Vercel and CI.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 \
  && ln -s /usr/bin/python3 /usr/local/bin/python \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# Apply committed migrations before starting the self-hosted application.
# The /data path is expected to be a persistent Docker volume when using a
# local `file:` database.
CMD ["sh", "-c", "npm run db:migrate && node .next/standalone/server.js"]
