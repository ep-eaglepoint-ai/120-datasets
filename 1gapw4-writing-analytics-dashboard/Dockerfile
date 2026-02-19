FROM node:20-slim
WORKDIR /app
COPY repository_after/package.json repository_after/package-lock.json* ./repository_after/
RUN cd repository_after && npm install
COPY . /app
CMD ["node", "evaluation/evaluate.js"]
