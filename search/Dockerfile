FROM eclipse-temurin:25-jre-alpine
RUN apk add --no-cache bash
COPY target/ /app/
COPY wait-for-it.sh wait-for-it.sh
RUN chmod +x wait-for-it.sh
ENTRYPOINT ["sh", "-c", "java -jar /app/*.jar"]