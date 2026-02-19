FROM node:22

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=test
ENV DATABASE_URL=postgresql://postgres:postgres@postgres:5432/raffle_test
ENV ADMIN_SECRET=test-admin-secret

# Run all tests then generate evaluation report
CMD ["sh", "-c", "npm test && npm run evaluate"]
