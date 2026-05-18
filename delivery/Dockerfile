FROM eclipse-temurin:25-jre-alpine
ENV TZ=Asia/Ho_Chi_Minh
COPY target/ /app/
ENTRYPOINT ["sh", "-c", "java -Xmx256m -Xms256m -jar /app/*.jar"]
