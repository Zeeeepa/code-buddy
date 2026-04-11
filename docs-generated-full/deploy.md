---
title: "deploy"
module: "deploy"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.058Z"
---
# deploy

The `deploy` module is responsible for defining and orchestrating the deployment of the Code Buddy application onto a Kubernetes cluster. It provides a set of declarative Kubernetes manifests and a convenience script for setting up a local development environment using Kind.

This module focuses on the infrastructure layer, ensuring Code Buddy can be reliably deployed, configured, and accessed.

## Module Overview

The `deploy` module consists of:

1.  **Kubernetes Manifests**: YAML files that define the various Kubernetes resources required to run Code Buddy (e.g., Deployments, Services, ConfigMaps, Secrets, Ingress).
2.  **Kind Setup Script**: A shell script (`kind-setup.sh`) to automate the creation of a local Kubernetes cluster and the deployment of Code Buddy within it, including an NGINX Ingress controller.

Since this module primarily contains declarative configuration files and a shell script, traditional code call graphs and execution flows are not applicable. The execution flow is driven by `kubectl apply -f` commands and the Kubernetes control plane.

## Kubernetes Deployment Architecture

Code Buddy is deployed as a single container within a Kubernetes Pod, managed by a `Deployment`. Configuration is externalized into `ConfigMap` and `Secret` resources. Network access is managed by a `Service` and an `Ingress`.

```mermaid
graph TD
    subgraph External Access
        User[User/Browser] --> Ingress[Ingress: codebuddy.local]
    end

    subgraph Kubernetes Cluster
        Ingress --> Service[Service: codebuddy (Port 80)]
        Service --> Deployment[Deployment: codebuddy]
        Deployment --> Pod[Pod: codebuddy]
        Pod --> Container[Container: codebuddy:latest]

        ConfigMap[ConfigMap: codebuddy-config] --> Container
        Secret[Secret: codebuddy-secrets] --> Container
        ServiceAccount[ServiceAccount: codebuddy] --> Pod
    end
```

## Key Kubernetes Components

The `deploy/kubernetes` directory contains the following manifest files:

### `configmap.yaml`

Defines a `ConfigMap` named `codebuddy-config`. This resource stores non-sensitive configuration data as key-value pairs, which are then injected as environment variables into the `codebuddy` container.

*   **`GROK_MODEL`**: Specifies the AI model to be used (e.g., "grok-3-latest").
*   **`MAX_COST`**: Sets a maximum cost limit for AI interactions.
*   **`RATE_LIMIT_MAX`**: Defines the maximum number of requests allowed within a certain period for rate limiting.
*   `CODEBUDDY_TZ`: (Commented out) An optional timezone override for the Docker sandbox.

**Contribution Note**: To change these application-level settings, modify this file and re-apply it to the cluster (`kubectl apply -f configmap.yaml`).

### `secret.yaml`

Defines a `Secret` named `codebuddy-secrets` of type `Opaque`. This resource stores sensitive configuration data, also injected as environment variables into the `codebuddy` container.

*   **`grok-api-key`**: The API key for accessing the Grok AI service.
*   **`jwt-secret`**: The secret key used for signing and verifying JSON Web Tokens (JWTs) for authentication.

**Contribution Note**: **Crucially, the placeholder values "REPLACE_ME" must be updated with actual secrets before deploying to any environment.** For production, consider using a secret management solution (e.g., HashiCorp Vault, Kubernetes External Secrets) rather than committing secrets directly. For local Kind development, you can edit this file or use `kubectl edit secret codebuddy-secrets`.

### `rbac.yaml`

Defines Role-Based Access Control (RBAC) resources for the Code Buddy application:

*   **`ServiceAccount`**: `codebuddy` - The identity under which the Code Buddy Pod runs.
*   **`Role`**: `codebuddy` - Grants permissions to `get` and `watch` `ConfigMaps` and `Secrets` within the namespace. While the current `Deployment` configuration injects these values directly, this `Role` provides a foundation for scenarios where the application might need to dynamically read these resources at runtime.
*   **`RoleBinding`**: `codebuddy` - Binds the `codebuddy` `ServiceAccount` to the `codebuddy` `Role`.

**Contribution Note**: If the application's runtime needs to interact with other Kubernetes API resources, the `Role` definition would need to be extended.

### `deployment.yaml`

Defines the core `Deployment` resource for the Code Buddy application:

*   **`name: codebuddy`**: The name of the deployment.
*   **`replicas: 1`**: Specifies a single replica of the Code Buddy application.
*   **`image: codebuddy:latest`**: The Docker image to use for the Code Buddy container.
*   **`ports`**: Exposes container ports `3000` (main HTTP server) and `3001` (gateway/websocket).
*   **`env`**: Environment variables are injected from `codebuddy-secrets` (for `GROK_API_KEY`, `JWT_SECRET`) and `codebuddy-config` (for `GROK_MODEL`, `MAX_COST`, `RATE_LIMIT_MAX`). `NODE_ENV` is set to `production`.
*   **`livenessProbe`**: An HTTP GET probe to `/livez` on port `3000` to determine if the application is running and healthy.
*   **`readinessProbe`**: An HTTP GET probe to `/readyz` on port `3000` to determine if the application is ready to serve traffic.
*   **`resources`**: Defines CPU and memory `requests` and `limits` for the container, ensuring resource predictability and preventing resource exhaustion.

**Contribution Note**: Developers can modify this file to update the image tag, adjust resource allocations, or fine-tune health check parameters.

### `service.yaml`

Defines a `Service` named `codebuddy` of type `ClusterIP`:

*   **`selector: app: codebuddy`**: Targets pods with the `app: codebuddy` label (which matches the `Deployment`).
*   **`ports`**:
    *   `http`: Maps internal cluster port `80` to the container's `targetPort: 3000`.
    *   `gateway`: Maps internal cluster port `3001` to the container's `targetPort: 3001`.

This `Service` provides a stable internal IP address and DNS name (`codebuddy`) for other services within the cluster to communicate with the Code Buddy application.

### `ingress.yaml`

Defines an `Ingress` resource named `codebuddy`:

*   **`annotations`**:
    *   `nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"`
    *   `nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"`
    These NGINX-specific annotations are crucial for handling potentially long-lived connections or extended processing times, common in AI interactions.
*   **`rules`**:
    *   **`host: codebuddy.local`**: Specifies that this Ingress rule applies to requests for the `codebuddy.local` hostname.
    *   **`path: /`**: Routes all traffic for the root path to the `codebuddy` service on port `80`.

**Contribution Note**: For production deployments, the `host` should be updated to a publicly resolvable domain name.

## Local Development with Kind (`kind-setup.sh`)

The `kind-setup.sh` script provides a convenient way to set up a local Kubernetes development environment for Code Buddy using [Kind (Kubernetes in Docker)](https://kind.sigs.k8s.io/).

### Purpose

This script automates the following steps:

1.  **Kind Cluster Creation**: Creates a new Kind cluster with specific port mappings to expose the Ingress controller.
2.  **NGINX Ingress Controller Installation**: Deploys the NGINX Ingress controller, which is required for the `Ingress` resource to function.
3.  **Manifest Application**: Applies all Kubernetes manifests from the `deploy/kubernetes` directory to the newly created cluster.

### Usage

To set up your local Code Buddy development environment:

```bash
bash deploy/kubernetes/kind-setup.sh [CLUSTER_NAME]
```

*   `CLUSTER_NAME` is optional. If not provided, the cluster will be named `codebuddy-dev`.

**Example**:

```bash
bash deploy/kubernetes/kind-setup.sh
```

### Execution Flow

1.  **`kind create cluster`**: A Kind cluster is created. The configuration includes `extraPortMappings` to expose host ports `8080` (for HTTP) and `8443` (for HTTPS) to the cluster's internal ports `80` and `443`, respectively. This allows you to access the Ingress from your host machine via `localhost:8080`.
2.  **`kubectl apply -f .../deploy.yaml`**: The NGINX Ingress controller is installed into the `ingress-nginx` namespace.
3.  **`kubectl wait ...`**: The script waits for the NGINX Ingress controller pods to be ready before proceeding.
4.  **`kubectl apply -f ...`**: All Kubernetes manifests (`configmap.yaml`, `secret.yaml`, `rbac.yaml`, `deployment.yaml`, `service.yaml`, `ingress.yaml`) are applied to the cluster in the specified order.

### Accessing Code Buddy Locally

After the script completes, Code Buddy will be accessible via `http://localhost:8080`.

**Important**: The `ingress.yaml` specifies `host: codebuddy.local`. For your browser to resolve `codebuddy.local` to `localhost`, you will need to add an entry to your host's `hosts` file (e.g., `/etc/hosts` on Linux/macOS, `C:\Windows\System32\drivers\etc\hosts` on Windows):

```
127.0.0.1 codebuddy.local
```

Then, navigate to `http://codebuddy.local:8080` in your browser.

## Contributing and Maintenance

*   **Updating Configuration**: For non-sensitive settings, modify `configmap.yaml`. For sensitive data, update `secret.yaml` (or use `kubectl edit secret codebuddy-secrets`).
*   **Application Updates**: To deploy a new version of the Code Buddy application, update the `image` tag in `deployment.yaml` and re-apply the manifest.
*   **Resource Tuning**: Adjust `resources` (CPU/memory) in `deployment.yaml` based on performance monitoring.
*   **Ingress Rules**: Modify `ingress.yaml` to change the hostname, add more paths, or configure additional Ingress features.
*   **Local Development**: Rerun `kind-setup.sh` to recreate a clean development environment, or use `kubectl apply -f` for individual manifest changes.