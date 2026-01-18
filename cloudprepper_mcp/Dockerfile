# Multi-stage build for CloudPrepper MCP Server

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy .env file if exists (optional, can be overridden by docker-compose)
COPY .env* ./

# Run as non-root user for security
USER node

# The MCP server runs on stdio, no port exposure needed
# CMD will be set in docker-compose or can be overridden
CMD ["node", "dist/index.js"]
