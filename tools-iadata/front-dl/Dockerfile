FROM node:20.10-alpine
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Start command (can be overridden by docker-compose)
CMD ["npm", "run", "dev"]
