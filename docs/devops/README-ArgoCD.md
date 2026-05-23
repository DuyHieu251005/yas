# ArgoCD cho Dev & Staging - Đồ án Nâng Cao

Thư mục này chứa cấu hình ArgoCD Application để tự động deploy vào 2 môi trường:

## Kiến trúc

| Môi trường | Namespace | Trigger | Sync Mode |
|---|---|---|---|
| **Dev** | `yas-dev` | Main branch thay đổi → auto deploy | `automated` (tự động) |
| **Staging** | `yas-staging` | Tag release (vd: `v1.2.3`) → deploy | `manual` (thủ công) |

## Cách sử dụng

### 1. Apply ArgoCD Applications
```bash
kubectl apply -f k8s/argocd/app-dev.yaml
kubectl apply -f k8s/argocd/app-staging.yaml
```

### 2. Truy cập ArgoCD UI
- URL: `http://192.168.1.22:31060`
- Username: `admin`
- Password: Lấy bằng lệnh:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### 3. Workflow Dev
- Developer push code lên nhánh `main`
- ArgoCD phát hiện thay đổi → tự động sync vào namespace `yas-dev`

### 4. Workflow Staging
- Tạo tag release trên nhánh `main`:
```bash
git tag v1.2.3
git push origin v1.2.3
```
- Vào ArgoCD UI → chọn app `yas-staging` → đổi `targetRevision` thành `v1.2.3` → bấm Sync
