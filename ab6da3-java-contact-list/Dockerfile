FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# (Java-only) No Python runtime or pytest in this task.

# Copy all task files (repositories + runners)
COPY . /app

# Compile Java runners once inside the image.
RUN mkdir -p /app/bin \
  && javac -d /app/bin tests/RunTests.java evaluation/Evaluation.java

# Default command runs evaluation (before+after+report)
CMD ["java", "-cp", "/app/bin", "Evaluation"]
