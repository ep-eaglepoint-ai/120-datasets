FROM rust:1.80
WORKDIR /usr/src/app
COPY . .
ARG REPO_NAME
# Set default working directory if provided
WORKDIR /usr/src/app/${REPO_NAME:-.}
CMD ["cargo", "test", "--test", "lib_test"]
