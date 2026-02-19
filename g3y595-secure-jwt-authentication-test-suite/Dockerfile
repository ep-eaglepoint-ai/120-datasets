FROM node:20-slim AS node-tests
WORKDIR /app/repository_after

COPY repository_after/package.json ./package.json
COPY repository_after/package-lock.json ./package-lock.json
RUN npm ci --no-audit --no-fund

WORKDIR /app
COPY repository_before ./repository_before
COPY repository_after ./repository_after
COPY tests ./tests
COPY evaluation ./evaluation

WORKDIR /app/repository_after
CMD ["npm", "test"]
