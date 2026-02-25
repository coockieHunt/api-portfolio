# NODE STAGE (build)
FROM node:24-bookworm-slim AS build


RUN apt update && apt upgrade -y \
    && npm install -g npm@latest

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# NODE STAGE (runtime)
FROM node:24-bookworm-slim AS runtime

RUN apt update && apt upgrade -y \
    && npm install -g npm@latest

WORKDIR /app
RUN mkdir -p /app/data

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/app.js"]