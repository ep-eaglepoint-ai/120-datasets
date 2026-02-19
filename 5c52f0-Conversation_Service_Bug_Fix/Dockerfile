FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma and Git
RUN apt-get update -y && apt-get install -y openssl ca-certificates git

# Initialize a minimal package environment and install dependencies
RUN npm init -y
RUN npm pkg set scripts.eval="ts-node evaluation/evaluation.ts"
RUN npm install typescript ts-node @types/node jest ts-jest @types/jest prisma@5 @prisma/client@5 express zod @types/express --save-dev

# Generate a basic tsconfig.json
RUN echo '{"compilerOptions": {"target": "ES2020", "module": "commonjs", "strict": true, "esModuleInterop": true, "skipLibCheck": true, "forceConsistentCasingInFileNames": true}}' > tsconfig.json

# Generate a basic jest.config.js
RUN echo 'module.exports = { preset: "ts-jest", testEnvironment: "node", testMatch: ["**/*.test.ts"], transform: { "^.+\\.tsx?$": "ts-jest" } };' > jest.config.js

# Copy all repositories and tests
# We use COPY here to populate the image, but volumes will override in dev
COPY repository_before ./repository_before
COPY repository_after ./repository_after
COPY tests ./tests
COPY evaluation ./evaluation

# Generate Prisma Client (Assuming repository_before has the schema)
# We need to run this against the schema.
# Schema is likely in repository_before/prisma/schema.prisma
# Create entrypoint script to handle Prisma generation
RUN echo '#!/bin/sh\n\
    npx prisma generate --schema=./repository_after/prisma/schema.prisma\n\
    npx prisma db push --schema=./repository_after/prisma/schema.prisma\n\
    exec "$@"' > /entrypoint.sh && chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npx", "jest"]
