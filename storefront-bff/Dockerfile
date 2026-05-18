FROM eclipse-temurin:25-jre-alpine
RUN apk add --no-cache bash
COPY wait-for-it.sh wait-for-it.sh
RUN chmod +x wait-for-it.sh
COPY target/ /app/
ENTRYPOINT ["java","-jar","/app.jar"]