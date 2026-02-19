FROM maven:3.9-eclipse-temurin-17
WORKDIR /app

# Copy project files
COPY . .

# Setup directories
RUN mkdir -p src/main/java/com/example/counter \
             src/test/java/com/example/counter \
             src/test/java/evaluation

# Copy test files
COPY tests/CounterControllerTest.java src/test/java/com/example/counter/
COPY evaluation/Evaluation.java src/test/java/evaluation/

# Setup default source (repository_after) and compile to download dependencies
RUN cp repository_after/*.java src/main/java/com/example/counter/ && \
    mvn test-compile -q -DskipTests

# Default command
CMD ["mvn", "test", "-Dtest=CounterControllerTest"]
