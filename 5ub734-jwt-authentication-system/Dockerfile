FROM node:18-alpine

WORKDIR /app/tests

COPY tests/package.json ./

RUN npm install

ENV NODE_PATH=/app/tests/node_modules

CMD ["npm", "test"]