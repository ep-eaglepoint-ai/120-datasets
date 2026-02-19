FROM node:20-alpine

WORKDIR /app

COPY repository_before/package*.json ./
COPY repository_before/ .

RUN npm install && npx tsc --noEmit

CMD ["sh", "-c", "echo 'Build successful. Run npm test to execute tests.'"]
