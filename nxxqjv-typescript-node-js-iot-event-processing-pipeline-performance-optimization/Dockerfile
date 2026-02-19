FROM node:20

WORKDIR /app

COPY package*.json ./

# Fail fast on slow network instead of hanging (e.g. in AWS)
ENV NPM_CONFIG_FETCH_TIMEOUT=120000
ENV NPM_CONFIG_FETCH_RETRIES=2

RUN npm install

COPY . .

ENV NODE_ENV=test
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV DB_HOST=postgres
ENV DB_PORT=5432
ENV DB_USER=postgres
ENV DB_PASSWORD=postgres
ENV DB_NAME=events

# Prevent runaway test/eval: max 10 min then exit (avoids build "hang" on AWS)
ENTRYPOINT ["timeout", "--signal=TERM", "600"]
CMD ["npm", "run", "test:before"]
