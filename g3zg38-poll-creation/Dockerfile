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
ENV MONGODB_URI=mongodb://mongodb:27017
ENV DB_NAME=poll_creation_test

# Default: run Jest tests. Override with: docker compose run app npx ts-node evaluation/evaluation.ts
CMD ["npm", "test"]
