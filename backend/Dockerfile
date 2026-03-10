FROM node:20-alpine AS base
WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ curl

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

RUN mkdir -p /app/data

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "src/index.js"]
