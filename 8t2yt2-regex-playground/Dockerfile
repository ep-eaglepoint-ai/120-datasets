FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV NODE_ENV=test

CMD ["sh", "-c", "npm test && npx ts-node evaluation/evaluation.ts"]
