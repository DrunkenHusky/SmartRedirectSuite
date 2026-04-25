# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.18.0
FROM node:${NODE_VERSION}-slim

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"
ENV npm_config_build_from_source=sqlite3

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

# Start the server by default, this can be overwritten at runtime
EXPOSE 5000
CMD [ "npm", "run", "start" ]
