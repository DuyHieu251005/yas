#!/bin/bash
sudo kubectl exec -n yas-dev deployment/sampledata -c istio-proxy -- curl -v -X POST -H "Content-Type: application/json" -d '{"message":"import"}' http://localhost:80/sampledata/storefront/sampledata
