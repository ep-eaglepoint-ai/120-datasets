FROM maven:3.9.6-eclipse-temurin-17

WORKDIR /app

COPY pom.xml /app/pom.xml
COPY repository_after /app/repository_after
COPY tests /app/tests
COPY evaluation /app/evaluation

RUN mvn -q -DskipTests package

ENTRYPOINT ["sh", "-lc", "if [ \"${1-}\" = test ]; then shift; wd=\"$(mktemp -d)\"; trap 'rm -rf \"$wd\"' EXIT; cp -r /app/pom.xml /app/repository_after /app/tests \"$wd\"; cd \"$wd\"; exec mvn -B test \"$@\"; fi; exec \"$@\"", "--"]
CMD ["test"]
