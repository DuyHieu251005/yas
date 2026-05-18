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

                    // Các service Java đơn giản: Maven build từ root, Docker COPY jar
                    def javaServices = [
                        'cart', 'customer', 'inventory', 'location',
                        'media', 'order', 'payment', 'payment-paypal', 'product',
                        'promotion', 'rating', 'recommendation', 'search', 'tax',
                        'webhook', 'backoffice-bff', 'storefront-bff', 'sampledata'
                    ]

                    // Các service Node.js: Docker multi-stage tự build (không cần Maven)
                    def nodeServices = ['storefront', 'backoffice']

                    // Service có Dockerfile multi-stage Maven (context = root)
                    def multiStageServices = ['delivery']

                    def allServices = javaServices + nodeServices + multiStageServices

                    def servicesToBuild = []
                    for (file in changedFiles) {
                        def topDir = file.split('/')[0]
                        if (allServices.contains(topDir) && !servicesToBuild.contains(topDir)) {
                            servicesToBuild.add(topDir)
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
                            echo "=> Đang compile các Java service bằng Maven..."
                            sh "mvn clean package -DskipTests -Xmx512m"
                        }

                        // === BƯỚC 2: Build & Push Docker image cho từng service ===
                        for (service in servicesToBuild) {
                            echo "--- Build & Push cho service: ${service} ---"
                            def imageName = "${env.DOCKERHUB_USERNAME}/yas-${service}"

                            if (multiStageServices.contains(service)) {
                                // delivery/automation-ui: Dockerfile multi-stage, context = root (.)
                                sh "docker build -t ${imageName}:${env.COMMIT_ID} -t ${imageName}:latest -f ${service}/Dockerfile ."
                            } else {
                                // Java đơn giản + Node.js: context = thư mục service
                                sh "docker build -t ${imageName}:${env.COMMIT_ID} -t ${imageName}:latest -f ${service}/Dockerfile ${service}"
                            }

                            sh "docker push ${imageName}:${env.COMMIT_ID}"
                            sh "docker push ${imageName}:latest"
                        }
                    }
                }
            }
        }
    }
}
