FROM maven:3.9.6-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
COPY common-library ./common-library
COPY payment-paypal ./payment-paypal
RUN mvn -pl payment-paypal -am clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
ENV TZ=Asia/Ho_Chi_Minh
WORKDIR /app
COPY --from=builder /app/payment-paypal/target/*.jar app.jar
ENTRYPOINT ["java", "-Xmx256m", "-Xms256m", "-jar", "app.jar"]
