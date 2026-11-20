FROM node:22-slim AS base
WORKDIR /app

# Install production and build dependencies
COPY package.json ./
RUN npm install

# Copy application source
COPY . .

# Build frontend production bundle
RUN npm run build

# Ensure private archive directory exists with restricted permissions
RUN mkdir -p /app/.clubpulse-storage && chmod 700 /app/.clubpulse-storage

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "start"]
