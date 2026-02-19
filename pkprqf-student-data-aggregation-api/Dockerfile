FROM maven:3.9-eclipse-temurin-17

WORKDIR /app

COPY . .

# Install repository_after so tests can depend on it (no main sources in tests)
RUN cd repository_after && mvn install -q

# Tests use dependency only; ensure no in-tree main (avoids stale/copied code)
RUN rm -rf /app/tests/src/main

RUN cd tests && mvn compile test-compile -q

RUN cd evaluation && mvn compile -q

CMD ["sh", "-c", "cd /app/evaluation && mvn compile exec:java -e"]
