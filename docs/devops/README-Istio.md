# Huong dan Trien khai Istio Service Mesh - Do an 2

**Sinh vien:** Kieu Duy Hieu - MSSV: 23127365  
**Mon hoc:** Nhap mon DevOps - 23MMT

Thu muc nay chua toan bo cau hinh Istio Service Mesh de dat **2 diem Nang cao - Service Mesh**.

---

## Danh sach file cau hinh

| File | Mo ta |
|---|---|
| `mtls.yaml` | PeerAuthentication STRICT cho toan bo namespace yas-app |
| `mtls-policy.yaml` | DestinationRule bat buoc ISTIO_MUTUAL cho tat ca services |
| `ui-mtls-permissive.yaml` | Ghi de PERMISSIVE cho UI services (storefront-ui, backoffice-ui, swagger-ui) |
| `auth-policy.yaml` | AuthorizationPolicy mau cho product service |
| `authorization-policy.yaml` | AuthorizationPolicy day du cho tat ca 8 backend services |
| `request-authentication.yaml` | RequestAuthentication xac thuc JWT Token tu Keycloak |
| `retry-policy.yaml` | VirtualService retry + timeout policies cho 6 backend services |

---

## Huong dan trien khai tung buoc

### Buoc 1: Cai dat Istio va Addons

```bash
# 1.1. Tai Istio
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# 1.2. Cai dat Istio voi profile demo (bao gom Kiali, Jaeger, Grafana)
istioctl install --set profile=demo -y

# 1.3. Bat auto-injection cho namespace yas-app
sudo kubectl label namespace yas-app istio-injection=enabled

# 1.4. Cai dat addons (Kiali, Prometheus, Grafana, Jaeger)
sudo kubectl apply -f samples/addons/kiali.yaml
sudo kubectl apply -f samples/addons/prometheus.yaml
sudo kubectl apply -f samples/addons/grafana.yaml
sudo kubectl apply -f samples/addons/jaeger.yaml

# 1.5. Doi service Kiali sang NodePort
sudo kubectl patch svc kiali -n istio-system \
  -p '{"spec": {"type": "NodePort"}}'
```

### Buoc 2: Bat mTLS (Mutual TLS)

```bash
# 2.1. PeerAuthentication STRICT cho toan bo namespace yas-app
sudo kubectl apply -f k8s/istio/mtls.yaml

# 2.2. PERMISSIVE cho UI services (browser khong co client cert)
sudo kubectl apply -f k8s/istio/ui-mtls-permissive.yaml

# 2.3. DestinationRule bat buoc ISTIO_MUTUAL
sudo kubectl apply -f k8s/istio/mtls-policy.yaml
```

**Ket qua sau khi apply:**
```
$ sudo kubectl get peerauthentication -n yas-app

NAME                        MODE         AGE
backoffice-bff-permissive   PERMISSIVE   24h
backoffice-ui-permissive    PERMISSIVE   3d7h
default                     STRICT       4d10h
storefront-bff-permissive   PERMISSIVE   24h
storefront-ui-permissive    PERMISSIVE   3d7h
swagger-ui-permissive       PERMISSIVE   3d7h
```

- `default` mode=STRICT: tat ca service-to-service traffic trong yas-app bat buoc dung mTLS
- UI services mode=PERMISSIVE: cho phep ca HTTP lan mTLS (browser khong ho tro client cert)

### Buoc 3: Cau hinh Authorization Policy

```bash
sudo kubectl apply -f k8s/istio/authorization-policy.yaml
```

**Ket qua sau khi apply:**
```
$ sudo kubectl get authorizationpolicy -n yas-app

NAME                         ACTION   AGE
allow-to-cart                ALLOW    4d
allow-to-customer            ALLOW    4d
allow-to-inventory           ALLOW    4d
allow-to-media               ALLOW    4d
allow-to-order               ALLOW    4d
allow-to-product             ALLOW    4d
allow-to-search              ALLOW    4d
allow-to-tax                 ALLOW    4d
require-jwt-storefront-bff   ALLOW    82m
```

Ma tran ket noi duoc phep:

| Service dich | Service duoc phep goi |
|---|---|
| search | storefront-bff |
| product | storefront-bff, backoffice-bff, order, cart, inventory |
| order | storefront-bff |
| cart | storefront-bff, order |
| customer | storefront-bff, backoffice-bff, order |
| inventory | order, backoffice-bff |
| media | storefront-bff, backoffice-bff, product |
| tax | order |

### Buoc 4: Cau hinh Retry Policy

```bash
sudo kubectl apply -f k8s/istio/retry-policy.yaml
```

**Ket qua sau khi apply:**
```
$ sudo kubectl get virtualservice -n yas-app \
    -o custom-columns='NAME:.metadata.name,HOSTS:.spec.hosts[0],ATTEMPTS:.spec.http[0].retries.attempts,RETRY_ON:.spec.http[0].retries.retryOn,TIMEOUT:.spec.http[0].timeout'

NAME           HOSTS       ATTEMPTS   RETRY_ON                                          TIMEOUT
cart-vs        cart        3          5xx,gateway-error,connect-failure,retriable-4xx   30s
inventory-vs   inventory   3          5xx,gateway-error,connect-failure,retriable-4xx   30s
order-vs       order       3          5xx,gateway-error,connect-failure,retriable-4xx   30s
product-vs     product     3          5xx,gateway-error,connect-failure,retriable-4xx   30s
search-vs      search      3          5xx,gateway-error,connect-failure,retriable-4xx   30s
tax-vs         tax         3          5xx,gateway-error,connect-failure,retriable-4xx   30s
```

- attempts: 3 - retry toi da 3 lan
- perTryTimeout: 10s - timeout moi lan thu
- retryOn: `5xx,gateway-error,connect-failure,retriable-4xx`
- timeout: 30s tong thoi gian toan bo request

### Xac nhan Retry Policy da duoc Envoy ap dung

Cach manh nhat de kiem tra retry co hoat dong la xem truc tiep cau hinh trong Envoy proxy
cua storefront-bff (service goi product):

```bash
sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml \
  istioctl proxy-config route deployment/storefront-bff.yas-app \
  --name 80 -o json \
  | python3 -c '
import sys, json
data = json.load(sys.stdin)
for vhost in data[0]["virtualHosts"]:
    if "product.yas-app" in vhost["name"]:
        print(json.dumps(vhost["routes"][0], indent=2))
'
```

Ket qua thuc te (lay truc tiep tu Envoy proxy trong cluster):
```json
{
  "match": { "prefix": "/" },
  "route": {
    "cluster": "outbound|80||product.yas-app.svc.cluster.local",
    "timeout": "30s",
    "retryPolicy": {
      "retryOn": "5xx,gateway-error,connect-failure,retriable-4xx",
      "numRetries": 3,
      "perTryTimeout": "10s",
      "retryHostPredicate": [
        {
          "name": "envoy.retry_host_predicates.previous_hosts"
        }
      ],
      "hostSelectionRetryMaxAttempts": "5"
    }
  },
  "metadata": {
    "filterMetadata": {
      "istio": {
        "config": "/apis/networking.istio.io/v1alpha3/namespaces/yas-app/virtual-service/product-vs"
      }
    }
  }
}
```

Giai thich:
- `numRetries: 3` - Envoy se thu lai toi da 3 lan khi gap loi
- `retryOn: 5xx,...` - Dieu kien kich hoat retry: HTTP 500/502/503/504, mat ket noi, loi gateway
- `perTryTimeout: 10s` - Moi lan thu toi da 10 giay
- `timeout: 30s` - Tong thoi gian cho ca request (bao gom tat ca lan retry)
- `retryHostPredicate: previous_hosts` - Khi retry, Envoy tranh goi vao cung mot pod da bi loi
- `metadata.istio.config` - Xac nhan policy nay duoc sinh ra tu VirtualService `product-vs`

Cac truong hop retry duoc kich hoat thuc te:
- Product pod bi crash/OOMKilled -> Kubernetes restart pod -> cac request trong thoi gian do se duoc retry sang pod khac
- Product tra HTTP 500 do loi database tam thoi -> Envoy retry 3 lan -> co the thanh cong o lan 2 hoac 3
- Ket noi bi mat (connect-failure) -> Envoy retry ngay lap tuc



## Ket qua kiem tra mTLS (istioctl describe)

**Pod search - xac nhan mTLS STRICT va RBAC policy:**
```
$ sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml istioctl x describe pod \
    search-86b9d9488d-g4vmr.yas-app

Pod: search-86b9d9488d-g4vmr.yas-app
   Pod Revision: default
   Pod Ports: 80 (search), 8090 (search), 15090 (istio-proxy)
--------------------
Service: search.yas-app
   Port: http 80/HTTP targets pod port 80
   Port: http-metric 8090/HTTP targets pod port 8090
80:
   VirtualService: search-vs.yas-app
      1 HTTP route(s)
8090:
   VirtualService: search-vs.yas-app
      1 HTTP route(s)
8090 RBAC policies: ns[yas-app]-policy[allow-to-search]-rule[0]
--------------------
Effective PeerAuthentication:
   Workload mTLS mode: STRICT
Applied PeerAuthentication:
   default.yas-app
```

**Pod product - xac nhan mTLS STRICT va RBAC policy:**
```
$ sudo KUBECONFIG=/etc/rancher/k3s/k3s.yaml istioctl x describe pod \
    product-6c9f5d649-n6frm.yas-app

Pod: product-6c9f5d649-n6frm.yas-app
   Pod Revision: default
   Pod Ports: 80 (product), 8090 (product), 15090 (istio-proxy)
--------------------
Service: product.yas-app
   Port: http 80/HTTP targets pod port 80
   Port: http-metric 8090/HTTP targets pod port 8090
80:
   VirtualService: product-vs.yas-app
      1 HTTP route(s)
8090:
   VirtualService: product-vs.yas-app
      1 HTTP route(s)
8090 RBAC policies: ns[yas-app]-policy[allow-to-product]-rule[0]
--------------------
Effective PeerAuthentication:
   Workload mTLS mode: STRICT
Applied PeerAuthentication:
   default.yas-app
```

**Ket luan:** ca 2 pod deu xac nhan `Workload mTLS mode: STRICT` va co RBAC policy dang hoat dong.

---

## Test Plan - Kiem tra Authorization Policy

### Thiet lap pod kiem tra

```bash
# Tao pod curl-test trong yas-app (khong co service account trong whitelist)
sudo kubectl run curl-test \
  --image=curlimages/curl:latest \
  -n yas-app \
  --restart=Never \
  --labels='app=curl-test' \
  -- sleep 600

# Kiem tra pod da chay voi Istio sidecar (2/2 container)
sudo kubectl get pod curl-test -n yas-app

# Ket qua:
# NAME        READY   STATUS    RESTARTS   AGE
# curl-test   2/2     Running   0          13s
```

### Test 1: Pod khong duoc phep -> search (DENY)

```bash
sudo kubectl exec -n yas-app curl-test -c curl-test -- \
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  http://search.yas-app.svc.cluster.local/storefront/catalog-search?keyword=test
```

Ket qua thuc te:
```
HTTP 403
```

Ly do: Service account cua `curl-test` khong nam trong danh sach cho phep cua `allow-to-search` policy. Istio RBAC tra ve 403 Forbidden.

---

### Test 2: Pod khong duoc phep -> product (DENY)

```bash
sudo kubectl exec -n yas-app curl-test -c curl-test -- \
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  http://product.yas-app.svc.cluster.local/storefront/products/featured
```

Ket qua thuc te:
```
HTTP 403
```

---

### Test 3: Pod khong duoc phep -> order (DENY)

```bash
sudo kubectl exec -n yas-app curl-test -c curl-test -- \
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  http://order.yas-app.svc.cluster.local/actuator/health
```

Ket qua thuc te:
```
HTTP 403
```

---

### Test 4: Pod khong duoc phep -> cart (DENY)

```bash
sudo kubectl exec -n yas-app curl-test -c curl-test -- \
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  http://cart.yas-app.svc.cluster.local/actuator/health
```

Ket qua thuc te:
```
HTTP 403
```

---

### Test 5: Pod khong duoc phep -> tax (DENY)

```bash
sudo kubectl exec -n yas-app curl-test -c curl-test -- \
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  http://tax.yas-app.svc.cluster.local/actuator/health
```

Ket qua thuc te:
```
HTTP 403
```

---

### Test 6: Pod khong duoc phep -> inventory (DENY)

```bash
sudo kubectl exec -n yas-app curl-test -c curl-test -- \
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  http://inventory.yas-app.svc.cluster.local/actuator/health
```

Ket qua thuc te:
```
HTTP 403
```

---

### Test 7: Pod khong duoc phep -> customer (DENY)

```bash
sudo kubectl exec -n yas-app curl-test -c curl-test -- \
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  http://customer.yas-app.svc.cluster.local/actuator/health
```

Ket qua thuc te:
```
HTTP 403
```

---

### Test 8: Pod khong duoc phep -> media (DENY)

```bash
sudo kubectl exec -n yas-app curl-test -c curl-test -- \
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  http://media.yas-app.svc.cluster.local/actuator/health
```

Ket qua thuc te:
```
HTTP 403
```

---

### Test 9: mTLS STRICT - Raw TCP connection bi reset

Thu goi truc tiep tu container khong qua Istio sidecar (khong co mTLS certificate):

```bash
sudo kubectl exec -n yas-app deployment/product -c istio-proxy -- \
  curl -s -o /dev/null -w 'HTTP %{http_code}\n' \
  http://search.yas-app.svc.cluster.local/storefront/catalog-search?keyword=test
```

Ket qua thuc te:
```
HTTP 000
command terminated with exit code 56 (Recv failure: Connection reset by peer)
```

Ly do: mTLS STRICT mode yeu cau certificate trao doi. Khi curl chay tu container (khong phai qua Envoy sidecar), khong co valid mTLS certificate nen server reset ket noi ngay o tang TLS.

---

### Test 10: Service duoc phep - Ket noi thanh cong (ALLOW)

Truy cap tu client ben ngoai qua Istio Ingress Gateway -> storefront-bff -> search:

```bash
curl -s 'http://storefront.yas.local.com:31184/api/search/storefront/catalog-search?keyword=iphone'
```

Ket qua thuc te (HTTP 200):
```json
{
  "products": [],
  "pageNo": 0,
  "pageSize": 12,
  "totalElements": 0,
  "totalPages": 0,
  "isLast": true,
  "aggregations": {
    "brands": {},
    "attributes": {},
    "categories": {}
  }
}
```

Ly do: `storefront-bff` co service account nam trong whitelist cua `allow-to-search` policy nen duoc phep goi `search`. Phan hoi HTTP 200 OK (khong phai 403).

---

### Tong ket ket qua test

| # | Caller | Target | Trang thai | HTTP Code | Ly do |
|---|--------|--------|:----------:|:---------:|-------|
| 1 | curl-test (unauthorized) | search | DENY | 403 | SA khong trong whitelist allow-to-search |
| 2 | curl-test (unauthorized) | product | DENY | 403 | SA khong trong whitelist allow-to-product |
| 3 | curl-test (unauthorized) | order | DENY | 403 | SA khong trong whitelist allow-to-order |
| 4 | curl-test (unauthorized) | cart | DENY | 403 | SA khong trong whitelist allow-to-cart |
| 5 | curl-test (unauthorized) | tax | DENY | 403 | SA khong trong whitelist allow-to-tax |
| 6 | curl-test (unauthorized) | inventory | DENY | 403 | SA khong trong whitelist allow-to-inventory |
| 7 | curl-test (unauthorized) | customer | DENY | 403 | SA khong trong whitelist allow-to-customer |
| 8 | curl-test (unauthorized) | media | DENY | 403 | SA khong trong whitelist allow-to-media |
| 9 | product (no mTLS cert) | search | DENY | 000 | mTLS STRICT: Connection reset by peer |
| 10 | storefront-bff (authorized) | search | ALLOW | 200 | SA nam trong whitelist |

---

## Xem Topology tren Kiali

Kiali dang chay tren cluster. De xem topology:

```bash
# Port-forward ve may local
sudo kubectl port-forward -n istio-system svc/kiali 20001:20001

# Hoac truy cap truc tiep qua NodePort (neu da expose)
# http://192.168.1.22:20001
```

Trong Kiali:
1. Chon tab Graph
2. Chon namespace: yas-app
3. Bat "Security" display de hien thi bieu tuong o khoa (mTLS)
4. Bat "Traffic Animation" de xem traffic flow theo thoi gian thuc

Bieu tuong o khoa tren moi edge = mTLS dang active giua 2 service do.
