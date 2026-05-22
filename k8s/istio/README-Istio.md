# 🔒 Hướng dẫn Triển khai Istio Service Mesh - Đồ án 2

**Sinh viên:** Kiều Duy Hiếu - MSSV: 23127365

Thư mục này chứa toàn bộ cấu hình Istio Service Mesh để đạt **2 điểm Nâng cao - Service Mesh**.

---

## 📋 Danh sách file cấu hình

| File | Mô tả |
|---|---|
| `mtls.yaml` | PeerAuthentication STRICT cho toàn bộ namespace yas-app |
| `mtls-policy.yaml` | Cấu hình bổ sung mTLS policy |
| `ui-mtls-permissive.yaml` | Ghi đè PERMISSIVE cho UI services (storefront-ui, backoffice-ui, swagger-ui) |
| `auth-policy.yaml` | AuthorizationPolicy mẫu cho product service |
| `authorization-policy.yaml` | AuthorizationPolicy đầy đủ cho tất cả 8 services |
| `retry-policy.yaml` | VirtualService retry policies cho 6 backend services |
| `README-Istio.md` | File hướng dẫn này |

---

## 🛠️ Hướng dẫn triển khai từng bước

### Bước 1: Cài đặt Istio và Addons

```bash
# 1.1. Tải Istio
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# 1.2. Cài Istio với profile demo
istioctl install --set profile=demo -y

# 1.3. Bật auto sidecar injection cho namespace yas-app
kubectl label namespace yas-app istio-injection=enabled

# 1.4. Cài đặt Addons (Kiali, Prometheus, Grafana, Jaeger)
kubectl apply -f samples/addons/kiali.yaml
kubectl apply -f samples/addons/prometheus.yaml
kubectl apply -f samples/addons/grafana.yaml
kubectl apply -f samples/addons/jaeger.yaml

# 1.5. Đợi pods sẵn sàng
kubectl rollout status deployment/kiali -n istio-system
kubectl rollout status deployment/grafana -n istio-system

# 1.6. Expose Kiali và Grafana qua NodePort
kubectl patch svc kiali -n istio-system -p '{"spec": {"type": "NodePort"}}'
kubectl patch svc grafana -n istio-system -p '{"spec": {"type": "NodePort"}}'
```

### Bước 2: Bật mTLS (Mutual TLS) toàn bộ namespace

```bash
# Apply PeerAuthentication STRICT mode
kubectl apply -f k8s/istio/mtls.yaml
```

**Nội dung file `mtls.yaml`:**
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

**Giải thích:** `mode: STRICT` ép buộc tất cả các service trong namespace `yas-app` phải giao tiếp qua mTLS. Envoy sidecar proxy (được tự động inject vào mỗi pod) sẽ xử lý:
- **Mã hóa** tất cả traffic giữa các service
- **Xác thực danh tính** (identity authentication) bằng certificate X.509
- **Từ chối** mọi kết nối plaintext HTTP

### Bước 3: Ghi đè PERMISSIVE cho UI services

UI services cần nhận traffic HTTP không mã hóa từ browser bên ngoài cluster:

```bash
kubectl apply -f k8s/istio/ui-mtls-permissive.yaml
```

**Nội dung file `ui-mtls-permissive.yaml`:**
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

**Kiểm tra:**
```bash
kubectl get peerauthentication -n yas-app
# NAMESPACE   NAME                       MODE
# yas-app     default                    STRICT
# yas-app     backoffice-ui-permissive   PERMISSIVE
# yas-app     storefront-ui-permissive   PERMISSIVE
# yas-app     swagger-ui-permissive      PERMISSIVE
```

### Bước 4: Cấu hình Authorization Policy

Authorization Policy giới hạn service-to-service access:

```bash
kubectl apply -f k8s/istio/authorization-policy.yaml
```

**Bảng ma trận quyền truy cập:**

| Service đích | Service ĐƯỢC PHÉP gọi | Service BỊ CHẶN |
|---|---|---|
| product | storefront-bff, backoffice-bff | cart, order, tax, ... |
| cart | storefront-bff | product, order, ... |
| customer | storefront-bff, backoffice-bff | cart, tax, ... |
| inventory | order, backoffice-bff | cart, product, ... |
| media | backoffice-bff, storefront-bff | cart, order, ... |
| order | storefront-bff | product, cart, ... |
| search | storefront-bff | cart, order, ... |
| tax | order | cart, product, ... |

### Bước 5: Cấu hình Retry Policy

```bash
kubectl apply -f k8s/istio/retry-policy.yaml
```

**Cấu hình retry cho 6 backend services:**
- **attempts:** 3 (retry tối đa 3 lần)
- **perTryTimeout:** 10s (timeout mỗi lần thử)
- **retryOn:** `5xx,gateway-error,connect-failure`

**Kiểm tra:**
```bash
kubectl get virtualservice -n yas-app
# NAME           HOSTS           AGE
# cart-vs        ["cart"]        2d
# inventory-vs   ["inventory"]   2d
# order-vs       ["order"]       2d
# product-vs     ["product"]     2d
# search-vs      ["search"]      2d
# tax-vs         ["tax"]         2d
```

### Bước 6: Xem Topology bằng Kiali

```bash
# Cách 1: Truy cập qua NodePort
# Mở browser: http://<VM_IP>:30020

# Cách 2: Port-forward
kubectl port-forward svc/kiali -n istio-system 20001:20001 &
# Mở browser: http://localhost:20001
```

**Hướng dẫn sử dụng Kiali:**
1. Chọn tab **Graph** ở menu trái
2. Chọn namespace: `yas-dev`
3. Chọn **Display**: bật **Traffic Animation** và **Security** (hiện biểu tượng ổ khóa mTLS)
4. Chụp ảnh topology này cho báo cáo

---

## 🧪 Kịch bản kiểm thử (Test Plan)

### Test 1: mTLS hoạt động

**Mục tiêu:** Xác nhận traffic giữa các service được mã hóa.

**Phương pháp:** Quan sát biểu tượng ổ khóa (🔒) trên Kiali topology.

**Kết quả mong đợi:** Tất cả kết nối giữa backend services hiện biểu tượng ổ khóa.

### Test 2: Authorization Policy - Truy cập ĐƯỢC PHÉP

**Mục tiêu:** Xác nhận service được phép gọi service đích thành công.

```bash
# Từ storefront-bff gọi product (ĐƯỢC PHÉP)
SFBFF_POD=$(kubectl get pod -n yas-dev -l app.kubernetes.io/name=storefront-bff -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n yas-dev $SFBFF_POD -c storefront-bff -- wget -qO- http://product:80/actuator/health
```

**Kết quả mong đợi:** `{"status":"UP"}` (HTTP 200 OK)

### Test 3: Authorization Policy - Truy cập BỊ CHẶN

**Mục tiêu:** Xác nhận service KHÔNG được phép bị Envoy proxy chặn.

```bash
# Từ cart gọi product (BỊ CHẶN)
CART_POD=$(kubectl get pod -n yas-dev -l app.kubernetes.io/name=cart -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n yas-dev $CART_POD -c cart -- wget -qO- http://product:80/actuator/health
```

**Kết quả mong đợi:** `RBAC: access denied` (HTTP 403 Forbidden)

### Test 4: Retry Policy

**Mục tiêu:** Xác nhận Istio tự động retry khi service trả lỗi 5xx.

**Phương pháp:** Quan sát trên Kiali hoặc Grafana khi service restart/unavailable - traffic sẽ tự động được retry thay vì báo lỗi ngay.

---

## 📝 Deliverables

Theo yêu cầu đồ án, thư mục này cung cấp:

- ✅ **YAML manifest** cấu hình mTLS: `mtls.yaml`, `ui-mtls-permissive.yaml`
- ✅ **YAML manifest** authorization policy: `authorization-policy.yaml`, `auth-policy.yaml`
- ✅ **YAML manifest** retry policy: `retry-policy.yaml`
- ✅ **Screenshot Kiali topology** (trong báo cáo 23127365.docx)
- ✅ **Test plan + logs** (trong README này và báo cáo)
- ✅ **README hướng dẫn triển khai** (file này)

---

**© 2026 - Nguyễn Duy Hiệu (23127365) - Nhập môn DevOps 23MMT**
