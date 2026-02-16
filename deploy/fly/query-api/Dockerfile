FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/query-api/package.json services/query-api/package.json
RUN npm ci

COPY . .
RUN npm run build --workspace @wiud/query-api

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY services/query-api/package.json services/query-api/package.json
RUN npm ci --omit=dev --workspace @wiud/query-api --include-workspace-root=false

COPY --from=build /app/services/query-api/dist /app/services/query-api/dist
COPY --from=build /app/services/query-api/scripts /app/services/query-api/scripts
COPY --from=build /app/db /app/db

EXPOSE 8080
CMD ["node", "services/query-api/dist/server.js"]
