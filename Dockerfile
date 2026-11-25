FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html ./
COPY src/ ./src/
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/server.mjs ./
COPY --from=frontend /build/dist/ ./public/
USER node
EXPOSE 3001
CMD ["node", "server.mjs"]
