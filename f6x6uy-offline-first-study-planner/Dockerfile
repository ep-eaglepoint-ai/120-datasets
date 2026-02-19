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
ENV DB_NAME=study_planner_test

CMD ["sh", "-c", "npm test && npx ts-node evaluation/evaluation.ts"]
