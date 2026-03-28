FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --no-audit

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build 2>/dev/null || echo "Build step not needed"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error('Health check failed')})"

# Expose ports
EXPOSE 8080 9090

# Run with proper signals
STOPSIGNAL SIGTERM

CMD ["node", "--enable-source-maps", "-r", "ts-node/register", "scripts/launch.ts"]
