FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends wget && \
    rm -rf /var/lib/apt/lists/*

RUN wget -q https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/1.9.3/junit-platform-console-standalone-1.9.3.jar \
    -O /opt/junit-platform-console-standalone.jar

CMD ["bash"]
