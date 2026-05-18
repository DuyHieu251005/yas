pipeline {
    agent any

    environment {
        // Tên đăng nhập Docker Hub sẽ tự động lấy từ Jenkins Credentials
        DOCKERHUB_USERNAME = 'duyhieu2005'
        DOCKER_CREDS = credentials('dockerhub-credentials') // Tên của credential tạo trên Jenkins
    }

    stages {
        stage('Checkout Code') {
            steps {
                checkout scm
                script {
                    // Lấy mã Commit ID ngắn (7 ký tự)
                    env.COMMIT_ID = sh(script: 'git rev-parse --short=7 HEAD', returnStdout: true).trim()
                    echo "Commit ID hiện tại: ${env.COMMIT_ID}"
                }
            }
        }

        stage('Detect Changes & Build Images') {
            steps {
                script {
                    // Xác định các service có code thay đổi so với commit trước đó
                    // Nếu là lần đầu tiên run, có thể không dùng HEAD~1 được, tuỳ setup Jenkins
                    def changedFiles = sh(script: "git diff-tree --no-commit-id --name-only -r HEAD", returnStdout: true).trim().split('\n')
                    
                    def allServices = [
                        'cart', 'customer', 'delivery', 'inventory', 'location', 
                        'media', 'order', 'payment', 'payment-paypal', 'product', 
                        'promotion', 'rating', 'recommendation', 'search', 'tax', 
                        'webhook', 'backoffice', 'storefront', 'storefront-bff', 'backoffice-bff'
                    ]
                    
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
                        
                        for (service in servicesToBuild) {
                            echo "--- Build & Push cho service: ${service} ---"
                            def imageName = "${env.DOCKERHUB_USERNAME}/yas-${service}"
                            
                            // Context lệnh build là thư mục gốc (.) để hỗ trợ Multi-module Maven (copy chung common-library)
                            sh "docker build -t ${imageName}:${env.COMMIT_ID} -t ${imageName}:latest -f ${service}/Dockerfile ."
                            
                            sh "docker push ${imageName}:${env.COMMIT_ID}"
                            sh "docker push ${imageName}:latest"
                        }
                    }
                }
            }
        }
    }
}
