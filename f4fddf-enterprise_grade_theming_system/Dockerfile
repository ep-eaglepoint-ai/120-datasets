FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS tests-before
COPY repository_before/package.json repository_before/bun.lock* ./
RUN bun install
COPY repository_before/ .
ENV CI=true
CMD ["bun", "run", "test"]

FROM base AS tests-after
COPY repository_after/package.json repository_after/bun.lock* ./
RUN bun install
COPY repository_after/ .
ENV CI=true
CMD ["bun", "run", "test"]

FROM base AS evaluation
ENV RUNNING_IN_DOCKER=true
COPY . .
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN cd repository_before && bun install
RUN cd repository_after && bun install
CMD ["bun", "run", "evaluation/evaluation.js"]
