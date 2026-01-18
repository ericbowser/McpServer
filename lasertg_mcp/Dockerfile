FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application files
COPY index.js ./
COPY .env* ./

# Run as non-root user for security
USER node

# The MCP server runs on stdio, no port exposure needed
CMD ["node", "index.js"]
