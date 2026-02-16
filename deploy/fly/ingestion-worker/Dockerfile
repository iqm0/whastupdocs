FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/ingestion-worker/package.json services/ingestion-worker/package.json
RUN npm ci

COPY . .
RUN npm run build --workspace @wiud/ingestion-worker

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY services/ingestion-worker/package.json services/ingestion-worker/package.json
RUN npm ci --omit=dev --workspace @wiud/ingestion-worker --include-workspace-root=false

COPY --from=build /app/services/ingestion-worker/dist /app/services/ingestion-worker/dist
COPY --from=build /app/config /app/config

CMD ["node", "services/ingestion-worker/dist/worker.js"]
