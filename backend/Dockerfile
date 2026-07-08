# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install all deps (incl. dev) for the TypeScript build.
COPY package.json package-lock.json* ./
RUN npm install

# Compile TypeScript -> dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Production dependencies only.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Compiled output from the build stage.
COPY --from=build /app/dist ./dist

# Drop root.
USER node

EXPOSE 4000
CMD ["node", "dist/index.js"]
