FROM node:22-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

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
