FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application files
COPY index.js ./
COPY backup.js ./
COPY restore.js ./
COPY .env* ./

# Create backups directory
RUN mkdir -p backups && chown node:node backups

# Run as non-root user for security
USER node

# The MCP server runs on stdio, no port exposure needed
CMD ["node", "index.js"]
