pipeline {
    agent any

    environment {
        DOCKERHUB_USERNAME = 'duyhieu2005'
        DOCKER_CREDS = credentials('dockerhub-credentials')
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
                script {
                    env.COMMIT_ID = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
                    echo "Commit ID hiện tại: ${env.COMMIT_ID}"
                }
            }
        }

        stage('Detect Changes & Build Images') {
            steps {
                script {
                    def changedFiles = sh(script: "git diff-tree --no-commit-id --name-only -r HEAD", returnStdout: true).trim().split('\n')

                    // Các service Java: Maven build từ root, Docker COPY jar từ target/
                    def javaServices = [
                        'cart', 'customer', 'inventory', 'location',
                        'media', 'order', 'payment', 'payment-paypal', 'product',
                        'promotion', 'rating', 'recommendation', 'search', 'tax',
                        'webhook', 'backoffice-bff', 'storefront-bff', 'sampledata',
                        'delivery'
                    ]

                    // Các service Node.js: Docker multi-stage tự build (không cần Maven)
                    def nodeServices = ['storefront', 'backoffice']

                    // Không còn service nào dùng multi-stage Maven trong Docker
                    def multiStageServices = []

                    def allServices = javaServices + nodeServices + multiStageServices

                    def servicesToBuild = []

                    // Nếu .build-trigger thay đổi → build toàn bộ services
                    def triggerAll = changedFiles.any { it.contains('.build-trigger') }
                    if (triggerAll) {
                        servicesToBuild = allServices.collect { it }
                        echo "=> .build-trigger detected, building ALL services..."
                    } else {
                        for (file in changedFiles) {
                            def topDir = file.split('/')[0]
                            if (allServices.contains(topDir) && !servicesToBuild.contains(topDir)) {
                                servicesToBuild.add(topDir)
                            }
                        }
                    }

                    if (servicesToBuild.isEmpty()) {
                        echo "=> Không phát hiện thay đổi ở các folder service, bỏ qua bước build."
                    } else {
                        echo "=> Cần build các service sau: ${servicesToBuild.join(', ')}"

                        echo "=> Đăng nhập DockerHub..."
                        sh "echo ${DOCKER_CREDS_PSW} | docker login -u ${DOCKER_CREDS_USR} --password-stdin"

                        // === BƯỚC 1: Build Maven cho các service Java (nếu có) ===
                        def javaServicesToBuild = servicesToBuild.findAll { javaServices.contains(it) }
                        if (!javaServicesToBuild.isEmpty()) {
                            echo "=> Đang compile các Java service bằng Maven (Java 25)..."
                            withEnv([
                                'JAVA_HOME=/usr/lib/jvm/temurin-25-jdk-amd64',
                                'PATH=/usr/lib/jvm/temurin-25-jdk-amd64/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                                'MAVEN_OPTS=-Xmx512m'
                            ]) {
                                sh "java -version && mvn clean package -DskipTests"
                            }
                        }

                        // === BƯỚC 2: Build & Push Docker image cho từng service ===
                        for (service in servicesToBuild) {
                            echo "--- Build & Push cho service: ${service} ---"
                            def imageName = "${env.DOCKERHUB_USERNAME}/yas-${service}"

                            // Tất cả service (Java + Node.js): context = thư mục service
                            sh "docker build -t ${imageName}:${env.COMMIT_ID} -t ${imageName}:latest -f ${service}/Dockerfile ${service}"

                            sh "docker push ${imageName}:${env.COMMIT_ID}"
                            sh "docker push ${imageName}:latest"
                        }
                    }
                }
            }
        }
    }
}
