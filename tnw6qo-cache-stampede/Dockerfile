# Dockerfile for Cache Stampede Prevention evaluation
FROM maven:3.9-eclipse-temurin-17

WORKDIR /app

# Copy all project files
COPY . .

# Build the solution and install so tests can depend on it
RUN cd repository_after && mvn install -q

# Build the tests (import cache classes from dependency, no copy)
RUN cd tests && mvn compile test-compile -q

# Build the evaluation
RUN cd evaluation && mvn compile -q
