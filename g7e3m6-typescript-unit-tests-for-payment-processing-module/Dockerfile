FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git
COPY repository_after/package.json repository_after/package-lock.json ./repository_after/
WORKDIR /app/repository_after
RUN npm ci

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache git
ENV NODE_ENV=production
COPY --from=deps /app/repository_after/node_modules ./repository_after/node_modules
# Expose deps at root so npx jest / npm test resolve from /app (no global jest).
COPY --from=deps /app/repository_after/node_modules ./node_modules
# Root package.json required for npm test / npm run evaluate.
COPY package.json ./
COPY . .

# Run root-level meta tests via npm test (uses npx jest; never bare jest).
# REPO_PATH env controls which repo the meta tests inspect.
CMD ["npm", "test"]
