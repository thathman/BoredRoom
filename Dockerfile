FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_TRANSPORT=colyseus
ARG VITE_COLYSEUS_URL=wss://colyseus.hendrix.com.ng
ENV VITE_TRANSPORT=${VITE_TRANSPORT}
ENV VITE_COLYSEUS_URL=${VITE_COLYSEUS_URL}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
