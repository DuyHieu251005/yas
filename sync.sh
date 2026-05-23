#!/bin/bash
echo "=== Syncing OutOfSync yas-dev applications ==="
apps=$(sudo kubectl get applications -n argocd -o jsonpath='{.items[?(@.status.sync.status=="OutOfSync")].metadata.name}')
for app in $apps; do
  # Skip staging apps
  if [[ "$app" == *staging* ]]; then
    continue
  fi
  echo "Syncing $app..."
  sudo kubectl patch app "$app" -n argocd --type merge -p '{"operation": {"sync": {"prune": true}}}'
done
echo "=== Done ==="
