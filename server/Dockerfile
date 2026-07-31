FROM node:22-trixie-slim AS deps
WORKDIR /app

# Toolchain to compile better-sqlite3 from source against this image's glibc.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/protocol/package.json packages/protocol/package.json
COPY server/package.json server/package.json

RUN npm ci --workspace @cochart/server \
  && node -e "require('better-sqlite3'); console.log('better-sqlite3 loads OK')"

# ---- runtime ----
FROM node:22-trixie-slim AS runtime
ENV NODE_ENV=production \
  HOSTNAME=0.0.0.0 \
  PORT=4000 \
  ROOM_DB_PATH=/data/rooms.db
WORKDIR /app

RUN mkdir -p /data && chown -R node:node /data

# Bring over the installed dependency tree and the app source.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/protocol ./packages/protocol
COPY server ./server

RUN chown -R node:node /app
USER node

EXPOSE 4000

# `npm run start -w @cochart/server` -> cross-env NODE_ENV=production tsx src/index.ts
CMD ["npm", "run", "start", "--workspace", "@cochart/server"]
