FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_BASE=/api
ARG VITE_APP_NAME="AI Gateway Hub"

ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_APP_NAME=$VITE_APP_NAME

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production stage ──
FROM nginx:1.25-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
