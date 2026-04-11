---
title: "Root — Dockerfile"
module: "root-dockerfile"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.224Z"
---
# Root — Dockerfile

The `Dockerfile` module defines the build process and runtime environment for the Code Buddy application within Docker containers. It employs a multi-stage build strategy to create optimized, secure, and consistent images for production, alongside a dedicated stage for development.

Unlike typical code modules, the `Dockerfile` does not contain executable code in the traditional sense. Instead, it's a declarative script that orchestrates the environment setup, dependency installation, application compilation, and final image assembly. Therefore, it has no internal calls, outgoing calls, or execution flows as detected for runtime code.

## Purpose

The primary goals of this `Dockerfile` are:

1.  **Containerization:** Package the Code Buddy application and its dependencies into a portable, self-contained unit.
2.  **Environment Consistency:** Ensure that the application runs in the same environment across different machines (development, testing, production).
3.  **Production Optimization:** Create a lean, secure, and efficient production image by separating build-time concerns from runtime requirements.
4.  **Development Workflow:** Provide a convenient Docker environment for developers to build, test, and debug the application with hot-reloading capabilities.
5.  **Cross-Architecture Support:** Explicitly designed to support AMD64 and ARM64 architectures.

## Architecture: Multi-Stage Build

The `Dockerfile` utilizes a multi-stage build pattern, which is crucial for minimizing the final image size and improving security. This approach involves multiple `FROM` instructions, where each `FROM` starts a new build stage. Artifacts from previous stages can be selectively copied into subsequent stages.

```mermaid
graph TD
    A[node:20-bookworm] --> B(Stage: builder)
    B -- Copy artifacts --> C(Stage: production)
    A --> D(Stage: development)

    subgraph Build Process
        B -- npm ci --> B1[Install all dependencies]
        B1 -- npm run build --> B2[Compile TypeScript]
        B2 -- npm prune --production --> B3[Remove dev dependencies]
    end

    subgraph Production Image
        C -- node:20-bookworm-slim --> C1[Minimal base image]
        C1 -- apt-get install --> C2[Runtime dependencies]
        C2 -- useradd codebuddy --> C3[Non-root user]
        C3 -- COPY --from=builder --> C4[App artifacts]
        C4 -- ENTRYPOINT --> C5[Run app]
    end

    subgraph Development Image
        D -- npm ci --> D1[Install all dependencies]
        D1 -- COPY . . --> D2[Source code]
        D2 -- npm run dev:node --> D3[Run dev server]
    end
```

This structure ensures that:
*   Heavy build tools (like `python3`, `make`, `g++`) and `devDependencies` are only present in the `builder` stage and are discarded in the final `production` image.
*   The `production` image uses a minimal base image (`node:20-bookworm-slim`) and only includes essential runtime dependencies.
*   The `development` image provides a full environment suitable for iterative development.

## Build Stages Explained

### Stage 1: `builder`

*   **Base Image:** `FROM node:20-bookworm AS builder`
    *   Uses the full `node:20-bookworm` image, which includes a comprehensive set of tools and libraries, suitable for compilation.
*   **Purpose:** This stage is responsible for installing all application dependencies (including `devDependencies`), compiling the TypeScript source code, and preparing the production-ready artifacts.
*   **Key Steps:**
    1.  **Install Build Dependencies:** `RUN apt-get update && apt-get install -y python3 make g++`
        *   These packages are required for compiling native Node.js modules that might be part of the application's dependencies.
    2.  **Install Node.js Dependencies:** `COPY package*.json ./` followed by `RUN npm ci`
        *   `npm ci` (clean install) is used for reproducible builds, ensuring that the exact versions specified in `package-lock.json` are installed. This includes `devDependencies`.
    3.  **Copy Source Code:** `COPY . .`
        *   The entire project source is copied into the container.
    4.  **Build TypeScript:** `RUN npm run build`
        *   Executes the `build` script defined in `package.json`, which typically compiles TypeScript files into JavaScript in the `dist` directory.
    5.  **Prune Dev Dependencies:** `RUN npm prune --production`
        *   Removes all `devDependencies` from `node_modules`, leaving only `dependencies`. This is a critical step for optimizing the final production image size.

### Stage 2: `production`

*   **Base Image:** `FROM node:20-bookworm-slim AS production`
    *   Switches to `node:20-bookworm-slim`, a much smaller base image that contains only the Node.js runtime and essential system libraries, significantly reducing the final image size and attack surface.
*   **Purpose:** To create a secure, minimal, and production-ready Docker image for deploying Code Buddy.
*   **Key Features:**
    1.  **OCI Labels:** `LABEL org.opencontainers.image.*`
        *   Provides metadata about the image (title, description, version, vendor, source, licenses, documentation) which is useful for container registries and management tools.
    2.  **Install Runtime Dependencies:** `RUN apt-get update && apt-get install -y --no-install-recommends git ripgrep curl ca-certificates`
        *   Installs system-level tools required by Code Buddy at runtime:
            *   `git`: For interacting with Git repositories (e.g., cloning, diffing).
            *   `ripgrep`: A fast line-oriented search tool, likely used for code search functionalities.
            *   `curl`: Used for the health check and potentially other HTTP requests.
            *   `ca-certificates`: Essential for secure communication (HTTPS).
    3.  **Non-Root User:** `RUN useradd -m -s /bin/bash -u 1001 codebuddy` and `USER codebuddy`
        *   Creates a dedicated non-root user `codebuddy` with UID 1001. Running containers as a non-root user is a critical security best practice to mitigate potential vulnerabilities.
    4.  **Copy Built Application:** `COPY --from=builder --chown=codebuddy:codebuddy /app/dist ./dist`
        *   Copies *only* the compiled application (`dist`), production `node_modules`, and `package.json` from the `builder` stage. This ensures no build tools or `devDependencies` are included.
        *   `--chown=codebuddy:codebuddy` sets the ownership of these files to the `codebuddy` user.
    5.  **Configuration Directories:** `RUN mkdir -p /home/codebuddy/.codebuddy /home/codebuddy/data`
        *   Creates necessary directories for application configuration and data storage, owned by the `codebuddy` user.
    6.  **Environment Variables:** `ENV NODE_ENV=production`, `ENV HOME=/home/codebuddy`, `ENV CODEBUDDY_HOME=/home/codebuddy/.codebuddy`
        *   Sets `NODE_ENV` to `production` for optimized Node.js runtime behavior.
        *   Defines `HOME` and `CODEBUDDY_HOME` for consistent path resolution within the container.
    7.  **Health Check:** `HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 CMD curl -f http://localhost:3000/api/health 2>/dev/null || exit 0`
        *   Configures Docker to periodically check the application's health by making an HTTP request to `/api/health` on port `3000`. This helps orchestrators (like Kubernetes) determine if the container is healthy and ready to serve requests.
    8.  **Exposed Port:** `EXPOSE 3000`
        *   Indicates that the application listens on port `3000` inside the container.
    9.  **Entry Point:** `ENTRYPOINT ["node", "/app/dist/index.js"]`
        *   Defines the command that will always be executed when the container starts. This ensures the Node.js application is launched.
    10. **Default Command:** `CMD ["--help"]`
        *   Provides default arguments to the `ENTRYPOINT`. If no command is specified when running the container, `node /app/dist/index.js --help` will be executed. This is useful for displaying usage information.

### Stage 3: `development`

*   **Base Image:** `FROM node:20-bookworm AS development`
    *   Uses the full `node:20-bookworm` image, similar to the `builder` stage, as development often requires a richer environment.
*   **Purpose:** To provide a Docker environment optimized for active development, allowing developers to mount their source code and leverage tools like hot-reloading.
*   **Key Features:**
    1.  **Install Dev Dependencies:** `RUN apt-get update && apt-get install -y --no-install-recommends git ripgrep python3 make g++ curl`
        *   Installs all necessary system dependencies for both runtime and development (e.g., `python3`, `make`, `g++` for native module compilation).
    2.  **Install Node.js Dependencies:** `COPY package*.json ./` followed by `RUN npm ci`
        *   Installs all `npm` dependencies, including `devDependencies`.
    3.  **Copy Source (Initial):** `COPY . .`
        *   Copies the source code. In a typical development workflow, this directory would often be mounted as a volume from the host machine to enable live code changes.
    4.  **Environment:** `ENV NODE_ENV=development`
        *   Sets `NODE_ENV` to `development`, which can enable development-specific logging, debugging, and features within the application.
    5.  **Exposed Ports:** `EXPOSE 3000 5173`
        *   Exposes port `3000` for the API server and `5173` for the Vite development server (often used for frontend hot-module replacement).
    6.  **Dev Entry Point:** `CMD ["npm", "run", "dev:node"]`
        *   The default command to run the application in development mode, typically starting a server with watch capabilities.

## Usage

### Building the Production Image

To build the optimized production image:

```bash
docker build -t codebuddy:latest .
```

This command will execute both the `builder` and `production` stages, resulting in a `codebuddy:latest` image that is ready for deployment.

### Running the Production Image

To run the production image:

```bash
docker run -p 3000:3000 -e GROQ_API_KEY="your_api_key" -v codebuddy_data:/home/codebuddy/data codebuddy:latest
```

*   `-p 3000:3000`: Maps port `3000` from the container to port `3000` on the host.
*   `-e GROQ_API_KEY="your_api_key"`: Passes the `GROQ_API_KEY` environment variable to the container.
*   `-v codebuddy_data:/home/codebuddy/data`: Mounts a named Docker volume for persistent data storage.

### Building the Development Image

To build the development image:

```bash
docker build --target development -t codebuddy:dev .
```

The `--target development` flag explicitly tells Docker to build only up to the `development` stage.

### Running the Development Image

To run the development image, typically with source code mounted from the host:

```bash
docker run -p 3000:3000 -p 5173:5173 -v "$(pwd):/app" -e GROQ_API_KEY="your_api_key" codebuddy:dev
```

*   `-p 3000:3000 -p 5173:5173`: Maps both API and Vite HMR ports.
*   `-v "$(pwd):/app"`: Mounts the current host directory (your project root) into `/app` inside the container. This allows for live code changes on the host to be reflected in the running container.

## Contribution Guidelines

When making changes that affect the Docker build:

*   **System Dependencies:** If new `apt-get` packages are required, add them to the appropriate stage (`builder` for build-time tools, `production` for runtime tools, `development` for dev tools). Prioritize adding them to the `production` stage only if strictly necessary for runtime.
*   **Node.js Dependencies:** Update `package.json` and `package-lock.json` as usual. The `npm ci` command ensures these are installed correctly.
*   **Image Size:** Always be mindful of the final `production` image size. Avoid adding unnecessary files or dependencies to the `production` stage. The multi-stage build is designed to help with this.
*   **Security:** Maintain the non-root user (`codebuddy`) and ensure all application files are owned by this user. Avoid running commands as `root` unless absolutely necessary for system-level setup.
*   **Health Check:** If the application's health check endpoint changes, update the `HEALTHCHECK` instruction accordingly.
*   **Entrypoint/CMD:** Understand the distinction between `ENTRYPOINT` and `CMD`. `ENTRYPOINT` defines the main executable, while `CMD` provides default arguments to that executable. This allows users to override `CMD` when running the container (e.g., `docker run codebuddy:latest --version`).