# Hướng dẫn Triển khai Hệ thống CD cho YAS Microservices

**Sinh viên:** Kiều Duy Hiếu - MSSV: 23127365  
**Môn học:** Nhập môn DevOps - 23MMT  
**Đồ án 2:** Xây dựng hệ thống CD

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Yêu cầu phần cứng và phần mềm](#2-yêu-cầu-phần-cứng-và-phần-mềm)
3. [Bước 1: Cài đặt VM và K3s Cluster](#3-bước-1-cài-đặt-vm-và-k3s-cluster)
4. [Bước 2: Cài đặt Infrastructure Services](#4-bước-2-cài-đặt-infrastructure-services)
5. [Bước 3: Cài đặt Jenkins CI/CD](#5-bước-3-cài-đặt-jenkins-cicd)
6. [Bước 4: Cấu hình ArgoCD (Nâng cao)](#6-bước-4-cấu-hình-argocd-nâng-cao)
7. [Bước 5: Cấu hình Istio Service Mesh (Nâng cao)](#7-bước-5-cấu-hình-istio-service-mesh-nâng-cao)
8. [Bước 6: Cấu hình Observability](#8-bước-6-cấu-hình-observability)
9. [Bước 7: Triển khai ứng dụng YAS](#9-bước-7-triển-khai-ứng-dụng-yas)
10. [Hướng dẫn sử dụng Jenkins Jobs](#10-hướng-dẫn-sử-dụng-jenkins-jobs)
11. [Cấu hình Domain Name và Hosts File](#11-cấu-hình-domain-name-và-hosts-file)
12. [Kiểm tra và Xác minh](#12-kiểm-tra-và-xác-minh)
13. [Xử lý sự cố](#13-xử-lý-sự-cố)

---

## 1. Tổng quan hệ thống

### Kiến trúc tổng quan

Hệ thống YAS (Yet Another Shop) được triển khai trên cụm Kubernetes (K3s) với kiến trúc microservices bao gồm:

- **13 microservices:** product, cart, customer, order, inventory, media, search, tax, storefront-bff, backoffice-bff, storefront-ui, backoffice-ui, swagger-ui
- **CI/CD Pipeline:** Jenkins (Docker container) + ArgoCD
- **Service Mesh:** Istio + Kiali (mTLS, Authorization Policy, Retry Policy)
- **Observability:** Prometheus + Grafana + Loki (Logging) + Tempo (Tracing)
- **Infrastructure:** PostgreSQL, Redis, Kafka, Elasticsearch, Keycloak

### Sơ đồ CI/CD Pipeline

```
Developer Push Code → Jenkins CI Build → Docker Image (tag: commit-id)
                                              ↓
                                        Push to Docker Hub
                                              ↓
                         ArgoCD Auto-Sync → K8s Deployment (yas-dev)
                         ArgoCD Manual-Sync → K8s Deployment (yas-staging)
```

---

## 2. Yêu cầu phần cứng và phần mềm

### Phần cứng (VM VirtualBox)
| Thành phần | Yêu cầu tối thiểu | Khuyến nghị |
|---|---|---|
| CPU | 4 cores | 6 cores |
| RAM | 12 GB | 16 GB |
| Disk | 40 GB (SSD) | 60 GB (SSD) |
| Network | NAT + Bridged Adapter | Bridged Adapter |

### Phần mềm
| Phần mềm | Phiên bản |
|---|---|
| Ubuntu Server | 26.04 LTS |
| K3s | v1.35.4+k3s1 |
| Docker | Latest (cho Jenkins) |
| Jenkins | LTS (Docker container) |
| Istio | Latest |
| ArgoCD | Latest |
| Helm | v3.x |

### Cấu hình VirtualBox
- **PAE/NX:** Bật (bắt buộc cho Ubuntu 64-bit)
- **Nested VT-x/AMD-v:** Không cần (K3s dùng container, không cần ảo hóa lồng nhau)
- **Solid-state Drive:** Bật (nếu máy host dùng SSD)
- **Network Adapter:** Bridged Adapter (để máy host truy cập VM)

---

## 3. Bước 1: Cài đặt VM và K3s Cluster

### 3.1. Cài đặt Ubuntu Server trên VirtualBox

```bash
# Tải Ubuntu Server 26.04 LTS ISO
# Tạo VM với cấu hình ở mục 2
# Cài đặt Ubuntu với các tùy chọn mặc định
# Cấu hình network: Bridged Adapter
```

### 3.2. Cài đặt K3s (Lightweight Kubernetes)

```bash
# Cài đặt K3s với quyền ghi kubeconfig
curl -sfL https://get.k3s.io | sh -s - --write-kubeconfig-mode 644

# Kiểm tra trạng thái K3s
sudo systemctl status k3s

# Kiểm tra node
sudo kubectl get nodes
```

**Kết quả mong đợi:**
```
NAME              STATUS   ROLES           AGE    VERSION
hieu-virtualbox   Ready    control-plane   3d     v1.35.4+k3s1
```

### 3.3. Cài đặt Helm

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

### 3.4. Cài đặt Docker (cho Jenkins)

```bash
# Cài đặt Docker
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker

# Thêm user vào group docker
sudo usermod -aG docker $USER
```

---

## 4. Bước 2: Cài đặt Infrastructure Services

### 4.1. Tạo Namespaces

```bash
sudo kubectl create namespace postgres
sudo kubectl create namespace keycloak
sudo kubectl create namespace redis
sudo kubectl create namespace elasticsearch
sudo kubectl create namespace kafka
sudo kubectl create namespace yas-dev
sudo kubectl create namespace yas-staging
sudo kubectl create namespace argocd
sudo kubectl create namespace monitoring
```

### 4.2. Cài đặt PostgreSQL

```bash
cd k8s/deploy
./setup-cluster.sh
```

### 4.3. Cài đặt Keycloak

```bash
./setup-keycloak.sh
```

**Lấy mật khẩu admin Keycloak:**
```bash
sudo kubectl get secret keycloak-credentials -n keycloak \
  -o jsonpath="{.data.password}" | base64 --decode
```

### 4.4. Cài đặt Redis

```bash
./setup-redis.sh
```

### 4.5. Kiểm tra Infrastructure

```bash
# Kiểm tra tất cả namespaces
sudo kubectl get namespaces

# Kiểm tra pods trong các namespace
sudo kubectl get pods -n postgres
sudo kubectl get pods -n keycloak
sudo kubectl get pods -n redis
sudo kubectl get pods -n elasticsearch
sudo kubectl get pods -n kafka
```

---

## 5. Bước 3: Cài đặt Jenkins CI/CD

### 5.1. Chạy Jenkins trên Docker

```bash
# Tạo volume cho Jenkins data
docker volume create jenkins_home

# Chạy Jenkins container
docker run -d \
  --name jenkins \
  --restart=always \
  -p 8080:8080 \
  -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /usr/bin/docker:/usr/bin/docker \
  jenkins/jenkins:lts
```

### 5.2. Cấu hình ban đầu

1. Truy cập Jenkins tại: `http://<VM_IP>:8080`
2. Lấy mật khẩu ban đầu:
   ```bash
   docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   ```
3. Cài đặt các plugin đề xuất (Install suggested plugins)
4. Tạo tài khoản admin

### 5.3. Cài đặt Plugin cần thiết

Vào **Manage Jenkins → Plugins → Available plugins**, cài đặt:
- **Pipeline** (Pipeline: API, Groovy, Job, etc.)
- **Git** 
- **Docker Pipeline**
- **Kubernetes CLI**
- **Active Choices** (cho tham số động)

### 5.4. Cấu hình Credentials

Vào **Manage Jenkins → Credentials**, thêm:

| ID | Loại | Mô tả |
|---|---|---|
| `dockerhub-credentials` | Username with password | Tài khoản Docker Hub |
| `github-credentials` | Username with password | Tài khoản GitHub |
| `kubeconfig` | Secret file | File kubeconfig từ K3s |

**Lấy kubeconfig từ K3s:**
```bash
sudo cat /etc/rancher/k3s/k3s.yaml
# Sao chép nội dung, đổi server address từ 127.0.0.1 thành IP VM
```

### 5.5. Tạo Jenkins Pipeline Jobs

#### Job 1: CI_Build (Jenkinsfile)
- **New Item → Pipeline**
- Pipeline definition: Pipeline script from SCM
- SCM: Git → Repository URL: `https://github.com/DuyHieu251005/yas`
- Script Path: `Jenkinsfile`
- Trigger: Poll SCM hoặc GitHub webhook

#### Job 2: developer_build (Jenkinsfile-CD)
- **New Item → Pipeline**
- Pipeline definition: Pipeline script from SCM
- Script Path: `Jenkinsfile-CD`
- **This project is parameterized** (cho phép input branch)

#### Job 3: Delete_Deployment (Jenkinsfile-Cleanup)
- **New Item → Pipeline**
- Pipeline definition: Pipeline script from SCM
- Script Path: `Jenkinsfile-Cleanup`

#### Job 4: Auto Deploy Dev (Jenkinsfile-Dev)
- Script Path: `Jenkinsfile-Dev`

#### Job 5: Deploy Staging (Jenkinsfile-Staging)
- Script Path: `Jenkinsfile-Staging`

### 5.6. Cơ chế CI Build

Khi developer commit code, Jenkins sẽ:
1. **Checkout Code** từ repository (branch hiện tại)
2. **Build Docker Image** với tag = `commit ID cuối cùng`
3. **Push Image** lên Docker Hub
4. **Thông báo** kết quả build

```
Image tag format: <dockerhub-user>/yas-<service-name>:<commit-id>
Ví dụ: duyhieu251005/yas-product:24fb02d4
```

---

## 6. Bước 4: Cấu hình ArgoCD (Nâng cao - 2đ)

### 6.1. Cài đặt ArgoCD

```bash
# Cài đặt ArgoCD vào namespace argocd
sudo kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Đổi service type sang NodePort để truy cập từ bên ngoài
sudo kubectl patch svc argocd-server -n argocd \
  -p '{"spec": {"type": "NodePort"}}'
```

### 6.2. Lấy mật khẩu admin

```bash
sudo kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

### 6.3. Truy cập ArgoCD UI

- URL: `https://<VM_IP>:31972`
- Username: `admin`
- Password: Lấy từ lệnh ở bước 6.2

### 6.4. Cấu hình ApplicationSet

ArgoCD sử dụng ApplicationSet để quản lý nhiều môi trường cùng lúc.

#### ApplicationSet cho Dev (Auto-Sync)
```bash
sudo kubectl apply -f k8s/argocd/yas-dev-appset.yaml
```

File `yas-dev-appset.yaml` sẽ tự động tạo Application cho mỗi service trong danh sách, với sync policy `automated`.

#### ApplicationSet cho Staging (Manual-Sync)
```bash
sudo kubectl apply -f k8s/argocd/yas-staging-appset.yaml
```

Staging sử dụng sync policy `manual` - cần vào ArgoCD UI bấm Sync thủ công.

### 6.5. Kiểm tra ArgoCD Applications

```bash
# Liệt kê tất cả Applications
sudo kubectl get applications -n argocd

# Kiểm tra ApplicationSets
sudo kubectl get applicationset -n argocd
```

**Kết quả:**
- 14 applications cho dev (auto-sync)
- 14 applications cho staging (manual-sync)
- 2 ApplicationSets

| Môi trường | Namespace | Sync Mode | Trigger |
|---|---|---|---|
| Dev | `yas-dev` | `automated` | Push lên main |
| Staging | `yas-staging` | `manual` | Tag release |

---

## 7. Bước 5: Cấu hình Istio Service Mesh (Nâng cao - 2đ)

### 7.1. Cài đặt Istio

```bash
# Tải và cài đặt Istio
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# Cài đặt với profile demo (bao gồm Kiali, Prometheus, Grafana)
istioctl install --set profile=demo -y

# Bật auto-injection cho namespace yas-app
sudo kubectl label namespace yas-app istio-injection=enabled

# Cài đặt Kiali, Prometheus, Grafana, Jaeger (addons)
sudo kubectl apply -f samples/addons/kiali.yaml
sudo kubectl apply -f samples/addons/prometheus.yaml
sudo kubectl apply -f samples/addons/grafana.yaml
sudo kubectl apply -f samples/addons/jaeger.yaml
```

### 7.2. Expose Kiali, Grafana qua NodePort

```bash
# Kiali
sudo kubectl patch svc kiali -n istio-system \
  -p '{"spec": {"type": "NodePort"}}'

# Grafana (Istio)
sudo kubectl patch svc grafana -n istio-system \
  -p '{"spec": {"type": "NodePort"}}'
```

### 7.3. Bật mTLS (Mutual TLS)

#### Bước 1: Tạo PeerAuthentication STRICT cho toàn bộ namespace

File `k8s/istio/mtls.yaml`:
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: yas-app
spec:
  mtls:
    mode: STRICT
```

```bash
sudo kubectl apply -f k8s/istio/mtls.yaml
```

**Giải thích:** `mode: STRICT` ép buộc tất cả các service trong namespace `yas-app` phải giao tiếp qua mTLS (mã hóa TLS hai chiều). Envoy sidecar proxy tự động xử lý mã hóa/giải mã.

#### Bước 2: Ghi đè PERMISSIVE cho UI services

Các service UI (storefront-ui, backoffice-ui, swagger-ui) cần nhận traffic HTTP từ bên ngoài (browser), nên cần chế độ PERMISSIVE:

File `k8s/istio/ui-mtls-permissive.yaml`:
```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: storefront-ui-permissive
  namespace: yas-app
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: storefront-ui
  mtls:
    mode: PERMISSIVE
---
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: backoffice-ui-permissive
  namespace: yas-app
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: backoffice-ui
  mtls:
    mode: PERMISSIVE
---
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: swagger-ui-permissive
  namespace: yas-app
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: swagger-ui
  mtls:
    mode: PERMISSIVE
```

```bash
sudo kubectl apply -f k8s/istio/ui-mtls-permissive.yaml
```

#### Kiểm tra mTLS

```bash
# Xem tất cả PeerAuthentication policies
sudo kubectl get peerauthentication -n yas-app

# Kết quả:
# NAME                       MODE         AGE
# backoffice-ui-permissive   PERMISSIVE   2d
# default                    STRICT       3d
# storefront-ui-permissive   PERMISSIVE   2d
# swagger-ui-permissive      PERMISSIVE   2d
```

### 7.4. Cấu hình Authorization Policy

Authorization Policy giới hạn service nào được phép giao tiếp với service nào (service-to-service access control).

File `k8s/istio/authorization-policy.yaml`:
```yaml
# Ví dụ: Chỉ storefront-bff và backoffice-bff mới được gọi product
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-to-product
  namespace: yas-app
spec:
  selector:
    matchLabels:
      app: product
  action: ALLOW
  rules:
  - from:
    - source:
        namespaces: ["yas-app"]
        principals:
        - cluster.local/ns/yas-app/sa/storefront-bff
        - cluster.local/ns/yas-app/sa/backoffice-bff
---
# Ví dụ: Chỉ storefront-bff mới được gọi cart
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-to-cart
  namespace: yas-app
spec:
  selector:
    matchLabels:
      app: cart
  action: ALLOW
  rules:
  - from:
    - source:
        namespaces: ["yas-app"]
        principals:
        - cluster.local/ns/yas-app/sa/storefront-bff
```

```bash
sudo kubectl apply -f k8s/istio/authorization-policy.yaml
```

#### Danh sách Authorization Policies đã cấu hình

| Policy | Service đích | Service được phép gọi |
|---|---|---|
| allow-to-product | product | storefront-bff, backoffice-bff |
| allow-to-cart | cart | storefront-bff |
| allow-to-customer | customer | storefront-bff, backoffice-bff |
| allow-to-inventory | inventory | order, backoffice-bff |
| allow-to-media | media | backoffice-bff, storefront-bff |
| allow-to-order | order | storefront-bff |
| allow-to-search | search | storefront-bff |
| allow-to-tax | tax | order |

#### Kiểm thử Authorization Policy

```bash
# Test 1: Truy cập ĐƯỢC PHÉP (storefront-bff → product)
sudo kubectl exec <storefront-bff-pod> -c storefront-bff -n yas-dev \
  -- wget -qO- http://product:80/actuator/health
# Kết quả: {"status":"UP"} (HTTP 200)

# Test 2: Truy cập BỊ CHẶN (cart → product)
sudo kubectl exec <cart-pod> -c cart -n yas-dev \
  -- wget -qO- http://product:80/actuator/health
# Kết quả: RBAC: access denied (HTTP 403)
```

### 7.5. Cấu hình Retry Policy

VirtualService retry policy tự động retry khi service trả lỗi 5xx.

File `k8s/istio/retry-policy.yaml`:
```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: product-vs
  namespace: yas-app
spec:
  hosts:
  - product
  http:
  - retries:
      attempts: 3
      perTryTimeout: 10s
      retryOn: "5xx,gateway-error,connect-failure"
    route:
    - destination:
        host: product
        port:
          number: 80
```

```bash
sudo kubectl apply -f k8s/istio/retry-policy.yaml
```

#### Danh sách VirtualService Retry Policies

```bash
sudo kubectl get virtualservice -n yas-app

# NAME           HOSTS           AGE
# cart-vs        ["cart"]        2d
# inventory-vs   ["inventory"]   2d
# order-vs       ["order"]       2d
# product-vs     ["product"]     2d
# search-vs      ["search"]      2d
# tax-vs         ["tax"]         2d
```

Mỗi VirtualService cấu hình:
- **attempts:** 3 (retry tối đa 3 lần)
- **perTryTimeout:** 10s (timeout mỗi lần thử)
- **retryOn:** `5xx,gateway-error,connect-failure` (retry khi gặp lỗi 5xx, gateway error, hoặc lỗi kết nối)

### 7.6. Xem Topology bằng Kiali

1. Truy cập Kiali: `http://<VM_IP>:30020`
2. Chọn tab **Graph**
3. Chọn namespace: `yas-dev` hoặc `yas-app`
4. Bật **Traffic Animation** và **Security** (biểu tượng ổ khóa mTLS)

Kiali sẽ hiển thị sơ đồ topology các service với:
- Các đường kết nối giữa service
- Biểu tượng ổ khóa (🔒) cho kết nối mTLS
- Mũi tên chỉ hướng traffic flow

---

## 8. Bước 6: Cấu hình Observability

### 8.1. Cài đặt Prometheus + Grafana (Monitoring)

```bash
# Tạo namespace monitoring
sudo kubectl create namespace monitoring

# Deploy Prometheus
sudo kubectl apply -f k8s/deploy/observability/

# Expose Grafana qua NodePort
sudo kubectl patch svc grafana -n monitoring \
  -p '{"spec": {"type": "NodePort"}}'
```

### 8.2. Truy cập các công cụ giám sát

| Công cụ | URL | Mô tả |
|---|---|---|
| Grafana (Monitoring) | `http://<VM_IP>:30030` | Dashboard giám sát hệ thống |
| Grafana (Istio) | `http://<VM_IP>:30300` | Dashboard giám sát Service Mesh |
| Prometheus | `http://<VM_IP>:30090` | Metrics collection |
| Kiali | `http://<VM_IP>:30020` | Service Mesh Topology |

### 8.3. Xem logs trên Grafana

1. Mở Grafana → menu trái → chọn **Explore**
2. Chọn datasource **Loki**
3. Chọn Label filters:
   - `namespace`: yas-dev
   - `container`: tên service (product, cart, ...)

### 8.4. Xem Tracing trên Grafana

1. Mở Grafana → chọn datasource **Tempo**
2. Chọn **Node Graph** để xem tracing request
3. Trace ID cho phép theo dõi request xuyên suốt các microservices

---

## 9. Bước 7: Triển khai ứng dụng YAS

### 9.1. Deploy tất cả services

```bash
cd k8s/deploy
./deploy-yas-applications.sh
```

### 9.2. Kiểm tra pods

```bash
sudo kubectl get pods -n yas-dev
```

**Kết quả mong đợi (13 services + reloader, tất cả 2/2 Running với Istio sidecar):**
```
NAME                                  READY   STATUS    RESTARTS   AGE
backoffice-bff-849d5c7757-xm952       2/2     Running   0          2d
backoffice-ui-7b4544d6c8-czn8v        2/2     Running   0          26h
cart-57bb7c798-jzk8s                  2/2     Running   0          2d
customer-7966664dc-nhnb2              2/2     Running   0          2d
inventory-86f577cf9c-sj9hc            2/2     Running   0          2d
media-596d7557b8-rjts8                2/2     Running   0          2d
order-648895b97b-cfwjn                2/2     Running   0          2d
product-58ff79fb97-gx5hg              2/2     Running   0          2d
search-5dc845587f-hcn86               2/2     Running   0          2d
storefront-bff-56d6bf7c77-vsgd7       2/2     Running   0          2d
storefront-ui-5db7959894-mq9ll        2/2     Running   0          26h
tax-5788bf7698-vtkk7                  2/2     Running   0          2d
yas-dev-swagger-ui-76dc67dd48-wgcbs   2/2     Running   0          2d
yas-reloader-554cfbf658-v422z         2/2     Running   0          2d
```

> **Lưu ý:** Cột READY hiển thị `2/2` nghĩa là mỗi pod có 2 container: 1 container ứng dụng + 1 Istio sidecar (Envoy proxy).

---

## 10. Hướng dẫn sử dụng Jenkins Jobs

### 10.1. Job CI_Build

**Mục đích:** Build Docker image cho service khi có commit mới.

**Cơ chế:**
1. Checkout code từ repository
2. Xác định service nào thay đổi
3. Build Docker image với tag = `commit ID`
4. Push image lên Docker Hub

### 10.2. Job developer_build

**Mục đích:** Cho developer deploy branch riêng để test.

**Cách sử dụng:**
1. Vào Jenkins → chọn `developer_build`
2. Click **Build with Parameters**
3. Nhập branch name cho service muốn test:
   - Ví dụ: `tax-service` parameter = `dev_tax_service`
   - Các service còn lại giữ mặc định `main`
4. Click **Build**

**Sau khi deploy xong**, developer truy cập service qua NodePort:
- Storefront: `http://storefront.yas.local.com:31991`
- Backoffice: `http://backoffice.yas.local.com:30559`

### 10.3. Job Delete_Deployment

**Mục đích:** Xóa deployment đã tạo bởi developer_build.

**Cách sử dụng:**
1. Vào Jenkins → chọn `Delete_Deployment`
2. Click **Build with Parameters**
3. Chọn deployment cần xóa
4. Click **Build**

> **Lưu ý:** Job này chỉ xóa các resources thuộc `yas-app` (developer deployment). Namespace `yas-dev` (auto-deploy bởi ArgoCD) vẫn luôn hoạt động.

---

## 11. Cấu hình Domain Name và Hosts File

### 11.1. Trên máy Windows (Developer)

Mở file `C:\Windows\System32\drivers\etc\hosts` với quyền Administrator, thêm:

```
192.168.1.22  storefront.yas.local.com
192.168.1.22  backoffice.yas.local.com
192.168.1.22  identity.yas.local.com
192.168.1.22  grafana.yas.local.com
192.168.1.22  pgadmin.yas.local.com
```

> **Lưu ý:** Thay `192.168.1.22` bằng IP thực tế của VM.

### 11.2. Danh sách Service NodePort

| Service | Type | Port(s) | URL truy cập |
|---|---|---|---|
| storefront-ui | NodePort | 3000:31991 | http://storefront.yas.local.com:31991 |
| backoffice-ui | NodePort | 3000:30559 | http://backoffice.yas.local.com:30559 |
| product | NodePort | 80:30593, 8090:30261 | http://192.168.1.22:30593 |
| cart | NodePort | 80:30253, 8090:30786 | http://192.168.1.22:30253 |
| customer | NodePort | 80:31067, 8090:30181 | http://192.168.1.22:31067 |
| order | NodePort | 80:30787, 8090:32695 | http://192.168.1.22:30787 |
| inventory | NodePort | 80:30880, 8090:30537 | http://192.168.1.22:30880 |
| media | NodePort | 80:31485, 8090:31735 | http://192.168.1.22:31485 |
| search | NodePort | 80:30360, 8090:30177 | http://192.168.1.22:30360 |
| tax | NodePort | 80:31018, 8090:30322 | http://192.168.1.22:31018 |

### 11.3. Danh sách Tool quản trị

| Tool | Port | URL |
|---|---|---|
| Jenkins | 8080 | http://192.168.1.22:8080 |
| ArgoCD | 31972 (HTTPS) | https://192.168.1.22:31972 |
| Kiali | 30020 | http://192.168.1.22:30020 |
| Grafana (Istio) | 30300 | http://192.168.1.22:30300 |
| Grafana (Monitoring) | 30030 | http://192.168.1.22:30030 |
| Prometheus | 30090 | http://192.168.1.22:30090 |

---

## 12. Kiểm tra và Xác minh

### 12.1. Kiểm tra Kubernetes Cluster

```bash
# Kiểm tra nodes
sudo kubectl get nodes -o wide

# Kiểm tra tất cả namespaces
sudo kubectl get namespaces

# Kiểm tra pods trong yas-dev
sudo kubectl get pods -n yas-dev

# Kiểm tra services
sudo kubectl get svc -n yas-dev
```

### 12.2. Kiểm tra ArgoCD

```bash
# Liệt kê Applications
sudo kubectl get applications -n argocd

# Liệt kê ApplicationSets
sudo kubectl get applicationset -n argocd
```

### 12.3. Kiểm tra Istio Service Mesh

```bash
# PeerAuthentication (mTLS)
sudo kubectl get peerauthentication -A

# Authorization Policies
sudo kubectl get authorizationpolicy -n yas-app

# VirtualService (Retry Policies)
sudo kubectl get virtualservice -n yas-app
```

### 12.4. Test Authorization Policy

```bash
# Test ALLOWED: storefront-bff → product
sudo kubectl exec <storefront-bff-pod> -c storefront-bff -n yas-dev \
  -- wget -qO- http://product:80/actuator/health
# Expected: {"status":"UP"}

# Test DENIED: từ pod không được phép
sudo kubectl exec <other-pod> -n yas-dev \
  -- wget -qO- http://product:80/actuator/health
# Expected: RBAC: access denied
```

### 12.5. Kiểm tra Observability

1. Mở Grafana: `http://192.168.1.22:30030`
2. Kiểm tra Prometheus targets: `http://192.168.1.22:30090/targets`
3. Kiểm tra Kiali topology: `http://192.168.1.22:30020`

---

## 13. Xử lý sự cố

### Pod không khởi động (CrashLoopBackOff)

```bash
# Xem logs của pod
sudo kubectl logs <pod-name> -n yas-dev

# Xem events
sudo kubectl describe pod <pod-name> -n yas-dev
```

### Service không truy cập được từ bên ngoài

```bash
# Kiểm tra service type phải là NodePort
sudo kubectl get svc -n yas-dev

# Kiểm tra firewall trên VM
sudo ufw status
```

### ArgoCD sync lỗi

```bash
# Kiểm tra trạng thái app
sudo kubectl get application <app-name> -n argocd -o yaml

# Force sync
sudo kubectl patch application <app-name> -n argocd \
  --type merge -p '{"operation":{"sync":{"prune":true}}}'
```

### Jenkins build lỗi

1. Kiểm tra Console Output của build
2. Kiểm tra credentials Docker Hub / GitHub
3. Kiểm tra kết nối mạng từ Jenkins container

---

## 📎 Cấu trúc thư mục dự án

```
yas/
├── Jenkinsfile              # CI Pipeline
├── Jenkinsfile-CD           # CD Pipeline (developer_build)
├── Jenkinsfile-Cleanup      # Delete Deployment
├── Jenkinsfile-Dev          # Auto deploy yas-dev
├── Jenkinsfile-Staging      # Deploy yas-staging
├── k8s/
│   ├── argocd/
│   │   ├── README-ArgoCD.md
│   │   ├── yas-dev-appset.yaml
│   │   └── yas-staging-appset.yaml
│   ├── charts/              # Helm charts cho các services
│   ├── deploy/
│   │   ├── README.md
│   │   ├── setup-cluster.sh
│   │   ├── setup-keycloak.sh
│   │   ├── setup-redis.sh
│   │   └── deploy-yas-applications.sh
│   ├── istio/
│   │   ├── README-Istio.md
│   │   ├── mtls.yaml                  # PeerAuthentication STRICT
│   │   ├── ui-mtls-permissive.yaml    # PERMISSIVE cho UI services
│   │   ├── authorization-policy.yaml  # AuthorizationPolicy
│   │   ├── retry-policy.yaml          # VirtualService retry
│   │   └── auth-policy.yaml
│   └── observability/       # Prometheus, Grafana, Loki configs
├── screenshots/             # Ảnh chụp màn hình thực tế
└── README-DEPLOYMENT.md     # File này
```

---

**© 2026 - Nguyễn Duy Hiệu (23127365) - Nhập môn DevOps 23MMT**
