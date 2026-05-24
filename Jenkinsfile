pipeline {
    agent any

    environment {
        DOCKERHUB_USERNAME = 'duyhieu2005'
        DOCKER_CREDS = credentials('dockerhub-credentials')
    }

    triggers {
        pollSCM('* * * * *')
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
                script {
                    env.COMMIT_ID = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
                    echo "Commit ID hiện tại: ${env.COMMIT_ID}"

                    // Kiểm tra xem commit hiện tại có tag release không (dạng vX.Y.Z)
                    // Dùng cho staging deployment
                    def rawTag = sh(
                        script: "git tag --points-at HEAD | grep -E '^v[0-9]+\\.[0-9]+\\.[0-9]+\$' | head -1 || true",
                        returnStdout: true
                    ).trim()
                    env.RELEASE_TAG = rawTag ?: ''
                    if (env.RELEASE_TAG) {
                        echo "==> Phát hiện Release Tag: ${env.RELEASE_TAG} — Sẽ build image staging!"
                    } else {
                        echo "==> Không có release tag. Build image theo commit ID bình thường."
                    }
                }
            }
        }

        stage('Detect Changes & Build Images') {
            steps {
                script {
                    def changedFilesRaw = sh(script: "git diff-tree --no-commit-id --name-only -r HEAD", returnStdout: true).trim()
                    def changedFiles = changedFilesRaw ? changedFilesRaw.split('\n') as List : []

                    // 🟢 Chỉ build các services có Dockerfile (12 service image + build hỗ trợ)
                    // Các service Java: Maven build từ root, Docker COPY jar từ target/
                    def javaServices = [
                        'cart', 'customer', 'inventory',
                        'media', 'order', 'product',
                        'search', 'tax',
                        'backoffice-bff', 'storefront-bff'
                    ]

                    // Các service Node.js: Docker multi-stage tự build (không cần Maven)
                    def nodeServices = ['storefront', 'backoffice']

                    def allServices = javaServices + nodeServices

                    def servicesToBuild = []

                    // Nếu có Release Tag → build toàn bộ (cho staging)
                    // Nếu .build-trigger thay đổi → build toàn bộ services
                    def triggerAll = env.RELEASE_TAG ||
                                     changedFiles.any { it.contains('.build-trigger') }
                    if (triggerAll) {
                        servicesToBuild = allServices.collect { it }
                        if (env.RELEASE_TAG) {
                            echo "=> Release Tag ${env.RELEASE_TAG} detected, building ALL services for staging..."
                        } else {
                            echo "=> .build-trigger detected, building ALL services..."
                        }
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
                            echo "=> Đang compile các Java service bằng Maven..."
                            withEnv([
                                'JAVA_HOME=/usr/lib/jvm/temurin-25-jdk-amd64',
                                'PATH=/usr/lib/jvm/temurin-25-jdk-amd64/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                                'MAVEN_OPTS=-Xmx512m'
                            ]) {
                                sh "java -version && mvn -B clean package -DskipTests"
                            }
                        }

                        // === BƯỚC 2: Build & Push Docker image cho từng service ===
                        for (service in servicesToBuild) {
                            echo "--- Build & Push cho service: ${service} ---"
                            def imageName = "${env.DOCKERHUB_USERNAME}/yas-${service}"

                            // Build với tag commit_id (cho dev)
                            sh "docker build -t ${imageName}:${env.COMMIT_ID} -t ${imageName}:latest -f ${service}/Dockerfile ${service}"
                            sh "docker push ${imageName}:${env.COMMIT_ID}"
                            sh "docker push ${imageName}:latest"

                            // Nếu có Release Tag → push thêm tag vX.Y.Z (cho staging)
                            if (env.RELEASE_TAG) {
                                sh "docker tag ${imageName}:${env.COMMIT_ID} ${imageName}:${env.RELEASE_TAG}"
                                sh "docker push ${imageName}:${env.RELEASE_TAG}"
                                echo "=> Pushed staging image: ${imageName}:${env.RELEASE_TAG}"
                            }
                        }
                    }
                }
            }
        }

        stage('Update GitOps Configuration') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: 'github-token', usernameVariable: 'GIT_USER', passwordVariable: 'GIT_PASS')]) {
                        if (env.RELEASE_TAG) {
                            echo "=> Cập nhật GitOps cho Staging và Dev..."
                            sh """
                            git config user.email "jenkins@yas.local"
                            git config user.name "Jenkins CI"
                            
                            sed -i '/name: backend.image.tag/{n;s/value: .*/value: ${env.COMMIT_ID}/}' k8s/argocd/yas-dev-appset.yaml
                            sed -i '/name: ui.image.tag/{n;s/value: .*/value: ${env.COMMIT_ID}/}' k8s/argocd/yas-dev-appset.yaml
                            
                            sed -i '/name: backend.image.tag/{n;s/value: .*/value: ${env.RELEASE_TAG}/}' k8s/argocd/yas-staging-appset.yaml
                            sed -i '/name: ui.image.tag/{n;s/value: .*/value: ${env.RELEASE_TAG}/}' k8s/argocd/yas-staging-appset.yaml
                            
                            git add k8s/argocd/yas-dev-appset.yaml k8s/argocd/yas-staging-appset.yaml
                            git commit -m "chore(gitops): release ${env.RELEASE_TAG} (dev: ${env.COMMIT_ID}) [skip ci]" || echo "No changes to commit"
                            
                            git push https://\${GIT_USER}:\${GIT_PASS}@github.com/DuyHieu251005/yas.git HEAD:main
                            """
                        } else {
                            echo "=> Cập nhật GitOps cho Dev..."
                            sh """
                            git config user.email "jenkins@yas.local"
                            git config user.name "Jenkins CI"
                            
                            sed -i '/name: backend.image.tag/{n;s/value: .*/value: ${env.COMMIT_ID}/}' k8s/argocd/yas-dev-appset.yaml
                            sed -i '/name: ui.image.tag/{n;s/value: .*/value: ${env.COMMIT_ID}/}' k8s/argocd/yas-dev-appset.yaml
                            
                            git add k8s/argocd/yas-dev-appset.yaml
                            git commit -m "chore(gitops): update dev to ${env.COMMIT_ID} [skip ci]" || echo "No changes to commit"
                            
                            git push https://\${GIT_USER}:\${GIT_PASS}@github.com/DuyHieu251005/yas.git HEAD:main
                            """
                        }
                    }
                }
            }
        }

        stage('Notify') {
            steps {
                script {
                    echo "============== BUILD SUMMARY =============="
                    echo "Commit ID : ${env.COMMIT_ID}"
                    if (env.RELEASE_TAG) {
                        echo "Release Tag: ${env.RELEASE_TAG} → Images pushed for STAGING"
                        echo "ArgoCD staging sẽ tự detect và deploy vào namespace yas-staging"
                    }
                    echo "DockerHub  : https://hub.docker.com/u/${env.DOCKERHUB_USERNAME}"
                    echo "=========================================="
                }
            }
        }
    }
}
