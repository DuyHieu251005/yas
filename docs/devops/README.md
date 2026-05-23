# Do an 2 - Xay dung He thong CD

**Sinh vien:** Kieu Duy Hieu - MSSV: 23127365
**Mon hoc:** Nhap mon DevOps - 23MMT

---

## Danh sach tai lieu

| File | Mo ta |
|------|-------|
| [README-DEPLOYMENT.md](./README-DEPLOYMENT.md) | Huong dan trien khai toan bo he thong (K3s, Jenkins, ArgoCD, Istio, Observability) |
| [README-Istio.md](./README-Istio.md) | Cau hinh Service Mesh: mTLS, Authorization Policy, Retry, Test plan va ket qua |
| [README-ArgoCD.md](./README-ArgoCD.md) | Cau hinh ArgoCD cho moi truong dev va staging |

## Cau truc file cau hinh

```
k8s/
  istio/                    # Cau hinh Istio Service Mesh
    mtls.yaml               # PeerAuthentication STRICT
    mtls-policy.yaml        # DestinationRule ISTIO_MUTUAL
    ui-mtls-permissive.yaml # PERMISSIVE cho UI services
    authorization-policy.yaml # 8 AuthorizationPolicies
    retry-policy.yaml       # 6 VirtualService retry policies
    request-authentication.yaml # JWT via Keycloak
  argocd/                   # Cau hinh ArgoCD
    yas-dev-appset.yaml     # ApplicationSet cho dev (auto-sync)
    yas-staging-appset.yaml # ApplicationSet cho staging (manual)
  deploy/                   # Helm charts va scripts deploy
  charts/                   # Helm chart templates

Jenkinsfile                 # CI: build image theo commit ID
Jenkinsfile-CD              # CD: developer_build job
Jenkinsfile-Dev             # Auto deploy vao yas-dev
Jenkinsfile-Staging         # Deploy vao yas-staging
Jenkinsfile-Cleanup         # Xoa deployment cu
```

## Cac dich vu truy cap

| Dich vu | URL | Port |
|---------|-----|------|
| Storefront | http://storefront.yas.local.com:31184 | 31184 |
| Backoffice | http://backoffice.yas.local.com:30559 | 30559 |
| Jenkins | http://192.168.1.22:8080 | 8080 |
| ArgoCD | https://192.168.1.22:31972 | 31972 |
| Kiali | http://192.168.1.22:20001 | 20001 |
| Grafana | http://192.168.1.22:30030 | 30030 |
| Prometheus | http://192.168.1.22:30090 | 30090 |

## Hosts file can them

```
192.168.1.22  storefront.yas.local.com
192.168.1.22  backoffice.yas.local.com
192.168.1.22  identity.yas.local.com
```
