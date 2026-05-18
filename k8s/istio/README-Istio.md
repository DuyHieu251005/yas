# Hướng dẫn Kịch bản Test Service Mesh (Istio) - Đồ án 2

Thư mục này chứa các cấu hình để đạt 2 điểm Nâng cao Service Mesh.

## Bước 1: Cài đặt Istio và Kiali
Chạy các lệnh sau trên K8s node:
```bash
# Cài Istio
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH
istioctl install --set profile=demo -y

# Bật tính năng tự động nhúng sidecar cho namespace yas-app
kubectl label namespace yas-app istio-injection=enabled

# Cài đặt Kiali (để xem flow chart/Topology)
kubectl apply -f samples/addons/kiali.yaml
kubectl apply -f samples/addons/prometheus.yaml
```

## Bước 2: Bật mTLS toàn bộ Namespace
Chạy file cấu hình đã tạo sẵn:
```bash
kubectl apply -f k8s/istio/mtls.yaml
```
**Giải thích:** `PeerAuthentication` với `mode: STRICT` sẽ ép toàn bộ các service trong namespace `yas-app` phải giao tiếp bằng HTTPs mã hoá (mTLS).

## Bước 3: Cấu hình Authorization Policy (Chính sách kết nối)
```bash
kubectl apply -f k8s/istio/auth-policy.yaml
```
**Giải thích kịch bản Test:** 
Chính sách này chỉ định RẰNG service `product` chỉ cho phép truy cập từ `storefront-bff` (hoặc các pod có quyền mặc định chung namespace). Các kết nối từ pod nằm ngoài namespace hoặc không có quyền sẽ bị báo lỗi `RBAC: access denied`.

**Lệnh Test (nộp minh chứng):**
Vào một pod bất kỳ (ví dụ pod cart):
```bash
kubectl exec -it <tên-pod-cart> -n yas-app -- curl -v http://product.yas-app:8080/products
```

## Bước 4: Cấu hình Retry Policy
```bash
kubectl apply -f k8s/istio/retry-policy.yaml
```
**Giải thích:**
Khi service `product` bị quá tải hoặc lỗi trả về HTTP 500, Envoy proxy của Istio sẽ tự động thử gọi lại (retry) tối đa 3 lần, mỗi lần cách nhau 2 giây, trước khi thực sự báo lỗi về cho người dùng.

## Bước 5: Xem Topology bằng Kiali
```bash
istioctl dashboard kiali
```
Mở trình duyệt, Kiali sẽ vẽ ra biểu đồ kết nối hình mạng nhện cực kỳ đẹp mắt. Hãy chụp ảnh biểu đồ này (chọn tab Graph, bật chức năng hiển thị Traffic Animation và mTLS Security) để đưa vào file báo cáo `.docx`.
