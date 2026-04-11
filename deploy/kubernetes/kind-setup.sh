#!/bin/bash
# Kind local development setup for Code Buddy
set -euo pipefail

CLUSTER_NAME="${1:-codebuddy-dev}"

# Create Kind cluster
kind create cluster --name "$CLUSTER_NAME" --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 8080
    protocol: TCP
  - containerPort: 443
    hostPort: 8443
    protocol: TCP
EOF

# Install NGINX Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=90s

# Apply manifests
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
kubectl apply -f "$SCRIPT_DIR/configmap.yaml"
kubectl apply -f "$SCRIPT_DIR/secret.yaml"
kubectl apply -f "$SCRIPT_DIR/rbac.yaml"
kubectl apply -f "$SCRIPT_DIR/deployment.yaml"
kubectl apply -f "$SCRIPT_DIR/service.yaml"
kubectl apply -f "$SCRIPT_DIR/ingress.yaml"

echo "Cluster '$CLUSTER_NAME' ready. Access at http://localhost:8080"
