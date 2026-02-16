FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY services/mcp-server/package.json services/mcp-server/package.json
RUN npm ci

COPY . .
RUN npm run build --workspace @wiud/mcp-server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY services/mcp-server/package.json services/mcp-server/package.json
RUN npm ci --omit=dev --workspace @wiud/mcp-server --include-workspace-root=false

COPY --from=build /app/services/mcp-server/dist /app/services/mcp-server/dist

EXPOSE 3001
CMD ["node", "services/mcp-server/dist/index.js"]
