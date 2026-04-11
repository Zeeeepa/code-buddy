---
title: "packaging"
module: "packaging"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.175Z"
---
# packaging

The `packaging` module is responsible for preparing and distributing the `code-buddy` application across various operating systems and package managers. It contains platform-specific configuration files, build scripts, and wrappers to ensure `code-buddy` can be easily installed and run by end-users, abstracting away the underlying Node.js runtime and build artifacts.

This module currently supports:
*   **Arch Linux**: Via an Arch User Repository (AUR) `PKGBUILD`.
*   **Linux (Snap)**: As a Snap package, providing sandboxed distribution.
*   **Windows**: Through native `.exe` (NSIS) and `.msi` (WiX) installers.

## Common Principles

Regardless of the target platform, the packaging process generally follows these steps:
1.  **Build the Core Application**: The `code-buddy` application itself is a Node.js project. All packaging processes assume that the main project's `npm ci` (install dependencies) and `npm run build` (compile to `dist/`) commands have been executed, producing the necessary JavaScript bundles and assets.
2.  **Bundle Node.js Runtime (Optional but common)**: To provide a consistent and isolated environment, most packages bundle a specific version of the Node.js runtime, rather than relying on a system-wide installation.
3.  **Create a Wrapper Script**: A small script (e.g., `buddy`, `code-buddy.sh`, `codebuddy.cmd`) is created as the primary executable. This wrapper sets up the necessary environment variables and then invokes the bundled Node.js runtime to run the main `dist/index.js` entry point.
4.  **Install Supporting Files**: Licenses, documentation (README, CHANGELOG), and configuration files are included.
5.  **Platform-Specific Integration**: This includes creating shortcuts, adding to system PATH, defining uninstall procedures, and managing permissions.

## Arch Linux (AUR) Packaging

The `packaging/aur/PKGBUILD` file defines how `code-buddy` is built and packaged for Arch Linux and its derivatives, typically for submission to the Arch User Repository (AUR).

### `PKGBUILD` Breakdown

The `PKGBUILD` is a shell script that `makepkg` executes to build a package.

*   **Metadata**:
    *   `pkgname`, `pkgver`, `pkgrel`, `pkgdesc`, `arch`, `url`, `license`: Standard package information.
    *   `depends`, `makedepends`: Specifies `nodejs` (runtime dependency) and `npm`, `git` (build-time dependencies).
    *   `optdepends`: Lists optional dependencies like `ripgrep`, `git`, `fzf` that enhance `code-buddy`'s functionality but are not strictly required for it to run.
    *   `provides`, `conflicts`: Manages package naming and compatibility.
    *   `source`, `sha256sums`: Points to the upstream tarball for the specified version. `sha256sums` is set to `SKIP` for simplicity in this example, but should be a real hash in production.

*   **`build()` Function**:
    ```bash
    build() {
        cd "$srcdir/$pkgname-$pkgver"
        npm ci --ignore-scripts # Install project dependencies
        npm run build         # Build the project
    }
    ```
    This function is responsible for compiling the source code. It navigates into the extracted source directory, installs Node.js dependencies using `npm ci`, and then executes the `npm run build` script defined in the project's `package.json` to generate the `dist` directory.

*   **`package()` Function**:
    ```bash
    package() {
        cd "$srcdir/$pkgname-$pkgver"

        # Create installation directories
        install -dm755 "$pkgdir/usr/lib/$pkgname"
        install -dm755 "$pkgdir/usr/bin"
        install -dm755 "$pkgdir/usr/share/licenses/$pkgname"
        install -dm755 "$pkgdir/usr/share/doc/$pkgname"

        # Copy built files
        cp -r dist "$pkgdir/usr/lib/$pkgname/"
        cp -r node_modules "$pkgdir/usr/lib/$pkgname/"
        cp package.json "$pkgdir/usr/lib/$pkgname/"

        # Create executable wrapper
        cat > "$pkgdir/usr/bin/buddy" << 'EOF'
#!/bin/bash
exec node /usr/lib/code-buddy/dist/index.js "$@"
EOF
        chmod 755 "$pkgdir/usr/bin/buddy"

        # Create symlink for alternative name
        ln -s buddy "$pkgdir/usr/bin/code-buddy"

        # Install license and documentation
        install -Dm644 LICENSE "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
        install -Dm644 README.md "$pkgdir/usr/share/doc/$pkgname/README.md"
        install -Dm644 CONTRIBUTING.md "$pkgdir/usr/share/doc/$pkgname/CONTRIBUTING.md" 2>/dev/null || true
        install -Dm644 CHANGELOG.md "$pkgdir/usr/share/doc/$pkgname/CHANGELOG.md" 2>/dev/null || true
    }
    ```
    This function stages the files into the `$pkgdir` (the root of the future package).
    1.  It creates standard FHS (Filesystem Hierarchy Standard) directories.
    2.  It copies the `dist` directory (containing the built application), `node_modules` (production dependencies), and `package.json` into `/usr/lib/code-buddy`.
    3.  It creates a `buddy` shell script in `/usr/bin`. This script acts as the entry point, executing the main `index.js` using the system's `node` interpreter.
    4.  A symbolic link `code-buddy` is created, pointing to `buddy`, allowing users to invoke the application using either name.
    5.  License and documentation files are installed into their respective FHS locations.

*   **`post_install()` and `post_upgrade()` Functions**:
    ```bash
    post_install() {
        echo "==> Code Buddy has been installed!"
        echo "==> Run 'buddy' or 'code-buddy' to start"
        echo "==> Set GROK_API_KEY environment variable before use"
        echo "==> See /usr/share/doc/code-buddy/README.md for more information"
    }

    post_upgrade() {
        post_install
    }
    ```
    These functions provide informative messages to the user after the package has been installed or upgraded, guiding them on how to use the application and important setup steps (like setting `GROK_API_KEY`).

## Snap Packaging

Snap packages provide a universal, containerized way to distribute applications across various Linux distributions. The `packaging/snap/` directory contains the `snapcraft.yaml` configuration and a wrapper script.

### `snapcraft.yaml` Breakdown

The `snapcraft.yaml` file describes how to build and package the application as a Snap.

*   **Metadata**:
    *   `name`, `base`, `version`, `summary`, `description`, `grade`, `confinement`, `architectures`: Standard Snap package information. `confinement: strict` indicates the application runs in a highly isolated environment.
*   **`apps` Section**:
    ```yaml
    apps:
      code-buddy:
        command: bin/code-buddy
        plugs:
          - home
          - network
          - network-bind
          - removable-media
        environment:
          NODE_ENV: production

      buddy:
        command: bin/code-buddy
        plugs:
          - home
          - network
          - network-bind
          - removable-media
        environment:
          NODE_ENV: production
    ```
    This defines the commands that users can run. Both `code-buddy` and `buddy` point to the same `bin/code-buddy` wrapper script.
    *   `plugs`: Specifies the interfaces the Snap needs to access system resources (e.g., user's home directory, network, removable media).
    *   `environment`: Sets `NODE_ENV` to `production` for the application within the Snap.
*   **`parts` Section**: This section defines how different components of the Snap are built.
    *   **`code-buddy` Part**:
        ```yaml
        parts:
          code-buddy:
            plugin: npm
            source: .
            npm-include-node: true
            npm-node-version: "20.10.0"
            build-packages:
              - build-essential
              - python3
            stage-packages:
              - git
              - ripgrep
            override-build: |
              craftctl default
              npm run build
            organize:
              lib/node_modules/code-buddy: /
        ```
        This part uses the `npm` plugin to build the Node.js application.
        *   `source: .`: The source code is taken from the project root.
        *   `npm-include-node: true`, `npm-node-version: "20.10.0"`: Crucially, this bundles Node.js version 20.10.0 directly into the Snap, ensuring a consistent runtime.
        *   `build-packages`, `stage-packages`: Specifies system packages needed during build and at runtime within the Snap. `git` and `ripgrep` are included as `stage-packages` because `code-buddy` might interact with them.
        *   `override-build`: After the default `npm` plugin actions (which include `npm ci`), `npm run build` is explicitly called to compile the application.
        *   `organize`: This rule moves the contents of the `code-buddy` package (which the `npm` plugin places in `lib/node_modules/code-buddy`) to the root of the Snap's filesystem. This means `dist/` and the application's `node_modules/` will be directly accessible at the Snap's root.
    *   **`wrapper` Part**:
        ```yaml
          wrapper:
            plugin: dump
            source: packaging/snap/
            organize:
              code-buddy.sh: bin/code-buddy
            after: [code-buddy]
        ```
        This part copies the `code-buddy.sh` wrapper script from `packaging/snap/` and places it in `bin/code-buddy` within the Snap. It runs `after` the `code-buddy` part to ensure the application files are already staged.
*   **`layout` Section**:
    ```yaml
    layout:
      /usr/bin/git:
        bind-file: $SNAP/usr/bin/git
      /usr/bin/rg:
        bind-file: $SNAP/usr/bin/rg
    ```
    This section creates "bind mounts" within the Snap's filesystem. It makes the `git` and `rg` (ripgrep) executables that are staged *inside* the Snap (from `stage-packages`) available at the conventional `/usr/bin/git` and `/usr/bin/rg` paths *within the Snap's sandbox*. This allows `code-buddy` to find and execute these tools as if they were system-wide.
*   **`hooks` Section**:
    ```yaml
    hooks:
      configure:
        plugs: [network]
    ```
    Defines hooks that run at specific points in the Snap's lifecycle. The `configure` hook is given `network` access.

### `code-buddy.sh` Wrapper

```bash
#!/bin/bash
# Code Buddy Snap Wrapper

# Set up environment
export HOME="${SNAP_USER_DATA}"
export NODE_ENV="${NODE_ENV:-production}"

# Run the application
exec "${SNAP}/bin/node" "${SNAP}/dist/index.js" "$@"
```
This simple shell script is the actual entry point for the `code-buddy` and `buddy` commands within the Snap.
*   It sets `HOME` to `SNAP_USER_DATA`, which is a directory within the Snap's private user data area, ensuring user-specific files are stored correctly within the sandbox.
*   It sets `NODE_ENV` to `production`.
*   Finally, it uses `exec` to replace the current shell process with the bundled Node.js interpreter, running the main `dist/index.js` application with all passed arguments (`"$@"`). The Node.js executable is located at `${SNAP}/bin/node` because the `npm` plugin stages it there. The `dist/index.js` is at `${SNAP}/dist/index.js` due to the `organize` rule in `snapcraft.yaml`.

## Windows Installer Packaging

The `packaging/windows/` directory contains scripts and configuration files for building native Windows installers (both NSIS `.exe` and WiX `.msi`).

### Build Process (`build-installer.ps1`)

The `build-installer.ps1` PowerShell script orchestrates the entire Windows installer creation process.

*   **Parameters**:
    *   `Version`: Specifies the application version.
    *   `NodeVersion`: The specific Node.js version to bundle.
    *   `SkipNodeDownload`: Allows skipping Node.js download for faster local testing.
    *   `BuildMsi`, `BuildExe`: Flags to control which installer types are built.
*   **Setup**: Cleans and creates `$BuildDir` (staging area) and `$OutputDir` (final installers).
*   **Node.js Download**: If not skipped, it downloads the specified Node.js version (x64 zip), extracts it, and moves its contents into `$BuildDir\node`. This ensures a self-contained Node.js runtime.
*   **Project Build**:
    ```powershell
    Push-Location $ProjectRoot
    try {
        npm ci
        npm run build
    } finally {
        Pop-Location
    }
    ```
    It navigates to the project root, installs dependencies, and runs the `npm run build` command to generate the `dist` directory.
*   **File Copy**: Copies the built `dist` directory, `package.json`, `LICENSE`, and the `codebuddy.cmd` wrapper script into the `$BuildDir`.
*   **Production Dependencies**:
    ```powershell
    Push-Location $BuildDir
    try {
        & "$BuildDir\node\npm.cmd" install --production --ignore-scripts
    } finally {
        Pop-Location
    }
    ```
    It then uses the *bundled* Node.js's `npm.cmd` to install only production dependencies within the `$BuildDir`. This ensures the final package is lean.
*   **NSIS Installer Build**: If `BuildExe` is true (or neither `BuildMsi` nor `BuildExe` are specified), it updates the `installer.nsi` script with the correct version and then invokes `makensis.exe` to compile the NSIS script into `CodeBuddy-X.Y.Z-setup.exe`.
*   **WiX MSI Installer Build**: If `BuildMsi` is true, it dynamically generates a `product.wxs` (WiX XML source file) with product information, features (shortcuts, PATH environment variable). It then uses the WiX Toolset (`heat.exe`, `candle.exe`, `light.exe`) to harvest files from `$BuildDir`, compile the WXS files, and link them into `CodeBuddy-X.Y.Z.msi`.

### Windows Build Flow

The `build-installer.ps1` script orchestrates a multi-stage build process:

```mermaid
graph TD
    A[Project Root] --> B(build-installer.ps1)
    B --> C{Download Node.js}
    B --> D{npm ci & npm run build}
    B --> E{Copy App Files}
    B --> F{npm install --production}
    B --> G{Build NSIS Installer (EXE)}
    B --> H{Build WiX Installer (MSI)}

    C --> I[Bundled Node.js]
    D --> J[Built `dist` & `package.json`]
    E --> K[Staging Dir with App & Node.js]
    F --> L[Staging Dir with Prod `node_modules`]

    G --> M[CodeBuddy-X.Y.Z-setup.exe]
    H --> N[CodeBuddy-X.Y.Z.msi]

    K -- uses --> G
    K -- uses --> H
    L -- uses --> G
    L -- uses --> H
```

### `codebuddy.cmd` Wrapper

```cmd
@echo off
:: Code Buddy CLI Wrapper for Windows

setlocal EnableDelayedExpansion

:: Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"

:: Set up Node.js path
set "NODE_EXE=%SCRIPT_DIR%node\node.exe"

:: Check if bundled Node.js exists, fall back to system Node.js
if not exist "%NODE_EXE%" (
    where node >nul 2>&1
    if errorlevel 1 (
        echo Error: Node.js is not installed. Please install Node.js or reinstall Code Buddy.
        exit /b 1
    )
    set "NODE_EXE=node"
)

:: Set environment variables
set "NODE_ENV=production"
set "CODEBUDDY_HOME=%APPDATA%\codebuddy"

:: Create config directory if it doesn't exist
if not exist "%CODEBUDDY_HOME%" mkdir "%CODEBUDDY_HOME%"

:: Run Code Buddy
"%NODE_EXE%" "%SCRIPT_DIR%dist\index.js" %*
```
This batch script serves as the primary executable for `code-buddy` on Windows.
*   It determines its own directory (`SCRIPT_DIR`), which is the installation path.
*   It first attempts to use the bundled Node.js (`%SCRIPT_DIR%node\node.exe`).
*   If the bundled Node.js is not found (e.g., in a development setup or if the installer failed), it falls back to using a system-wide `node` found in the PATH.
*   It sets `NODE_ENV` to `production` and `CODEBUDDY_HOME` to a user-specific application data directory (`%APPDATA%\codebuddy`), creating it if it doesn't exist.
*   Finally, it executes the `dist\index.js` using the chosen Node.js runtime, passing all command-line arguments (`%*`).

### `installer.nsi` (NSIS Script)

The `installer.nsi` script defines the behavior of the Nullsoft Scriptable Install System (NSIS) installer, which produces the `CodeBuddy-X.Y.Z-setup.exe` executable.

*   **Includes**: Uses `MUI2.nsh` for a modern installer UI, `FileFunc.nsh` for file operations, and `EnvVarUpdate.nsh` for modifying environment variables.
*   **Metadata**: Defines product name, version, publisher, website, and registry keys for uninstallation.
*   **UI Pages**: Configures the sequence of installer pages (Welcome, License, Directory, Components, Install, Finish).
*   **Sections**:
    *   **`Core Files`**: This required section copies the application's `dist` directory, `package.json`, the bundled `node` runtime, and the `codebuddy.cmd` wrapper into the `$INSTDIR` (installation directory). It also creates the user's application data directory (`$APPDATA\codebuddy`).
    *   **`Add to PATH`**: Uses `EnvVarUpdate` to add the `$INSTDIR` to the system's `PATH` environment variable, allowing `codebuddy` to be run from any command prompt.
    *   **`Desktop Shortcut`**, **`Start Menu Shortcuts`**: Creates shortcuts for easy access.
    *   **`-Post`**: A hidden section that runs after all other sections. It writes the uninstaller executable (`uninst.exe`) and populates registry entries required for Windows' "Add or Remove Programs" feature.
*   **Uninstaller Section**: Defines the actions to be taken during uninstallation, including removing the PATH entry, shortcuts, the installation directory, and registry keys. It explicitly avoids removing user configuration data.
*   **Functions**:
    *   `.onInit`: Checks for previous installations and offers to uninstall them before proceeding with a new installation.
    *   `un.onInit`: Prompts the user for confirmation before uninstalling.
    *   `un.onUninstSuccess`: Displays a success message after uninstallation.

### WiX MSI Installer (Dynamic `product.wxs`)

The WiX Toolset is used to create `.msi` (Microsoft Installer) packages. The `build-installer.ps1` script dynamically generates the `product.wxs` file, which is the primary WiX source.

*   **`product.wxs` Generation**: The PowerShell script embeds an XML template for `product.wxs`. This template defines:
    *   **Product Information**: `Id`, `Name`, `Version`, `Manufacturer`, `UpgradeCode`.
    *   **Package Settings**: `InstallerVersion`, `Compressed`, `InstallScope`.
    *   **`MajorUpgrade`**: Configures behavior for upgrading existing installations.
    *   **`MediaTemplate`**: Embeds the cabinet file within the MSI.
    *   **`Feature`**: Defines the main `ProductFeature` which includes components for the application files, shortcuts, and PATH modification.
    *   **`Directory` Structure**: Maps the installation paths (`ProgramFilesFolder`, `INSTALLFOLDER`, `ProgramMenuFolder`).
    *   **`ComponentGroupRef Id="ProductComponents"`**: This is a placeholder. The actual file components are harvested by `heat.exe`.
    *   **`ApplicationShortcut` Component**: Creates a Start Menu shortcut pointing to `codebuddy.cmd`.
    *   **`PathEnvVar` Component**: Adds the `INSTALLFOLDER` to the system's `PATH` environment variable.
*   **WiX Toolset Execution**:
    1.  `heat.exe dir . -cg ProductComponents ... -out files.wxs`: `heat.exe` is used to "harvest" all files from the `$BuildDir` and generate `files.wxs`, which contains `<Component>` definitions for each file, grouped under `ProductComponents`.
    2.  `candle.exe product.wxs files.wxs`: `candle.exe` compiles the `.wxs` source files into `.wixobj` object files.
    3.  `light.exe -ext WixUIExtension product.wixobj files.wixobj -o "$OutputDir\CodeBuddy-$Version.msi"`: `light.exe` links the `.wixobj` files, along with the `WixUIExtension` (for standard UI dialogs), into the final `CodeBuddy-X.Y.Z.msi` installer.

## Contributing to Packaging

When contributing to the `packaging` module, consider the following:

*   **Platform Specificity**: Each platform has its own conventions and tools. Ensure changes adhere to the best practices for AUR, Snap, or Windows installers.
*   **Dependencies**: If `code-buddy`'s core dependencies change (e.g., Node.js version, new npm packages), update the `PKGBUILD`, `snapcraft.yaml`, and `build-installer.ps1` accordingly.
*   **Runtime Environment**: Pay close attention to how Node.js and other external tools (like `git`, `ripgrep`) are bundled or accessed within the package's isolated environment.
*   **Wrapper Scripts**: The wrapper scripts (`buddy`, `code-buddy.sh`, `codebuddy.cmd`) are critical entry points. Ensure they correctly locate the bundled Node.js and the application's `dist/index.js`, and pass arguments appropriately.
*   **Testing**: Thoroughly test installations, upgrades, and uninstallations on the target platforms to catch any issues with file paths, permissions, or environment variables.
*   **Documentation**: Keep comments in the packaging scripts up-to-date and ensure any new packaging features are clearly documented.