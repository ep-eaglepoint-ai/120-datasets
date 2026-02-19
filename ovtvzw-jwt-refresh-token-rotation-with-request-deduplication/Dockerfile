FROM node:20-slim

RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY repository_after/backend/package*.json ./repository_after/backend/
COPY repository_after/frontend/package*.json ./repository_after/frontend/
COPY tests/package*.json ./tests/

RUN cd repository_after/backend && npm install
RUN cd repository_after/frontend && npm install
RUN cd tests && npm install

COPY . /app

ENV NODE_ENV=test

CMD ["python3", "evaluation/evaluation.py"]
