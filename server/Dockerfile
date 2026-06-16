FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache git

# Shared sources are needed at build (TS) time — copy first.
COPY shared/ /app/shared/
COPY server/package.json server/package-lock.json /app/server/
WORKDIR /app/server
RUN npm ci

COPY server/ /app/server/
RUN npm run build

FROM node:22-alpine
WORKDIR /app/server
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./package.json
COPY --from=build /app/shared /app/shared

ENV NODE_ENV=production
ENV PORT=2567
EXPOSE 2567

CMD ["node", "dist/server/src/index.js"]
