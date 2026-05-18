FROM eclipse-temurin:25-jre-alpine

COPY target/ /app/
ENTRYPOINT ["sh", "-c", "java -jar /app/*.jar"]