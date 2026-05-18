FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
COPY common-library ./common-library
COPY order ./order
RUN mvn -pl order -am clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
ENV TZ=Asia/Ho_Chi_Minh
WORKDIR /app
COPY --from=builder /app/order/target/*.jar app.jar
ENTRYPOINT ["java", "-Xmx256m", "-Xms256m", "-jar", "app.jar"]
