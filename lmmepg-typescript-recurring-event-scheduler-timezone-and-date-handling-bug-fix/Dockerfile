FROM node:20-slim

WORKDIR /app

# Copy generic files
COPY package*.json ./

# Copy source directories
COPY repository_before ./repository_before
COPY repository_after ./repository_after
COPY tests ./tests
COPY evaluation ./evaluation

# Install dependencies (if any root ones needed, though we seem to rely on minimal deps)
# We need typescript/ts-node likely inside the repos or root.
# The previous steps used npx, so we should ensure npx works or install global deps.
# Let's check root package.json if it exists, otherwise just rely on npx.
# User environment seemed to have npm/npx.

# To be safe, install typescript globally or ensure it's available.
RUN npm install -g typescript ts-node

# Init repository_after build
WORKDIR /app/repository_after
RUN npm install && npm run build

# Init repository_before build logic (though it fails validation, it might need install)
WORKDIR /app/repository_before
RUN npm install || true
# Legacy repo might fail install or build, we continue anyway to show failure in tests
RUN npm run build || true
# Fix ESM module resolution for legacy code by adding .js extensions to imports
RUN sed -i "s/from '\.\/recurrence'/from '\.\/recurrence.js'/g" dist/scheduler.js 2>/dev/null || true
RUN sed -i "s/from '\.\/types'/from '\.\/types.js'/g" dist/recurrence.js 2>/dev/null || true
RUN echo '{"type":"module"}' > dist/package.json 2>/dev/null || true

WORKDIR /app

CMD ["npm", "run", "evaluate"]
