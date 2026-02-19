FROM node:18-alpine

WORKDIR /app

COPY repository_before/package*.json ./

RUN npm install

COPY repository_before/ .

CMD ["npm", "start"]

