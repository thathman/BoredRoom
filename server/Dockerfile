FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache git

# Shared sources are needed at build (TS) time — copy first.
COPY shared/ /app/shared/
COPY server/package.json server/package-lock.json /app/server/
WORKDIR /app/server
RUN npm ci
# shared/*.ts import 'zod' and resolve node_modules by walking up to /app, not
# /app/server. Hoist zod to /app/node_modules so both tsc (build) and node
# (runtime) resolve it from the shared/ sources.
RUN mkdir -p /app/node_modules && cp -r /app/server/node_modules/zod /app/node_modules/zod

COPY server/ /app/server/
RUN npm run build

FROM node:22-alpine
WORKDIR /app/server
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/shared /app/shared

ENV NODE_ENV=production
ENV PORT=2567
EXPOSE 2567

CMD ["node", "dist/server/src/index.js"]
