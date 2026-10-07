# RUN2구룡포 web — portable Node image (GCP VM, any Docker host).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 PGLITE_DIR=/data/pglite
COPY --from=build /app/.output ./.output
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 3000
USER node
CMD ["node", ".output/server/index.mjs"]
