FROM node:20-bookworm-slim AS deps
WORKDIR /usr/src/app
COPY package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates make \
  && npm install \
  && rm -rf /var/lib/apt/lists/*

FROM deps AS build
WORKDIR /usr/src/app
COPY . .
RUN npx prisma generate

FROM node:20-bookworm-slim AS runtime
WORKDIR /usr/src/app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    bash \
    gcc \
    make \
    php-cli \
    openjdk-17-jdk-headless \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node tests/smoke.js || exit 1
CMD ["npm", "run", "start"]
