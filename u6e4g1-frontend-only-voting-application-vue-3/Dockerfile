FROM node:20-alpine

WORKDIR /app

# Install frontend deps + build
COPY repository_after/package.json /app/repository_after/package.json
COPY repository_after/package-lock.json /app/repository_after/package-lock.json
COPY repository_after/tsconfig.json /app/repository_after/tsconfig.json
COPY repository_after/tsconfig.node.json /app/repository_after/tsconfig.node.json
COPY repository_after/vite.config.ts /app/repository_after/vite.config.ts
RUN cd /app/repository_after && npm ci

# Copy the rest and run tests
COPY . /app

RUN cd /app/repository_after && npm run build

CMD ["npm", "test"]
