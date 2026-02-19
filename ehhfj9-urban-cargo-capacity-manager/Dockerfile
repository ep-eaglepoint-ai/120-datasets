FROM node:20-slim
WORKDIR /app

ENV PRISMA_HIDE_UPDATE_MESSAGE=1

RUN apt-get update -y \
	&& apt-get install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* /app/
COPY repository_after/package.json /app/repository_after/package.json

RUN npm ci

COPY . /app
CMD ["npm", "test"]
