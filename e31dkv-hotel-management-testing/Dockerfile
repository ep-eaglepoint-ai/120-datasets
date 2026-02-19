FROM eclipse-temurin:17-jdk

WORKDIR /app

# Install Maven and Python
RUN apt-get update && \
    apt-get install -y maven python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

COPY . /app

# Create SEPARATE build directories (not inside repository_after)
RUN mkdir -p /build/primary-tests/src/test/java/hotelmanagement && \
    mkdir -p /build/meta-tests/src/test/java

# Copy test files to build directories
RUN cp /app/repository_after/test/hotelmanagement/HotelManagementTest.java /build/primary-tests/src/test/java/hotelmanagement/ 2>/dev/null || true
RUN cp /app/tests/MetaTest.java /build/meta-tests/src/test/java/ 2>/dev/null || true

# Copy pom.xml files from repository to build directories
RUN cp /app/repository_after/pom.xml /build/primary-tests/pom.xml
RUN cp /app/tests/pom.xml /build/meta-tests/pom.xml

# Pre-download Maven dependencies
RUN cd /build/primary-tests && mvn dependency:resolve -q || true
RUN cd /build/meta-tests && mvn dependency:resolve -q || true

CMD ["/bin/bash"]
