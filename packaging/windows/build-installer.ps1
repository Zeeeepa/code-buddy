# Code Buddy Windows Installer Build Script
# This script builds the Windows installer packages (MSI and EXE)

param(
    [string]$Version = "1.0.0",
    [string]$NodeVersion = "20.10.0",
    [switch]$SkipNodeDownload,
    [switch]$BuildMsi,
    [switch]$BuildExe
)

$ErrorActionPreference = "Stop"

# Configuration
$ProjectRoot = Resolve-Path "$PSScriptRoot\..\.."
$PackagingDir = $PSScriptRoot
$BuildDir = "$PackagingDir\build"
$OutputDir = "$PackagingDir\output"

Write-Host "=== Code Buddy Windows Installer Build ===" -ForegroundColor Cyan
Write-Host "Version: $Version"
Write-Host "Project Root: $ProjectRoot"

# Clean and create directories
Write-Host "`nPreparing build directories..." -ForegroundColor Yellow
if (Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
if (Test-Path $OutputDir) { Remove-Item -Recurse -Force $OutputDir }
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path "$BuildDir\node" | Out-Null

# Download Node.js if needed
if (-not $SkipNodeDownload) {
    Write-Host "`nDownloading Node.js $NodeVersion..." -ForegroundColor Yellow
    $NodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
    $NodeZip = "$BuildDir\node.zip"

    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
    Expand-Archive -Path $NodeZip -DestinationPath $BuildDir

    # Move Node.js files to the right location
    $NodeExtracted = Get-ChildItem "$BuildDir\node-v*-win-x64" | Select-Object -First 1
    Move-Item "$NodeExtracted\*" "$BuildDir\node\" -Force
    Remove-Item $NodeExtracted -Recurse -Force
    Remove-Item $NodeZip
}

# Build the project
Write-Host "`nBuilding Code Buddy..." -ForegroundColor Yellow
Push-Location $ProjectRoot
try {
    npm ci
    npm run build
} finally {
    Pop-Location
}

# Copy application files
Write-Host "`nCopying application files..." -ForegroundColor Yellow
Copy-Item -Recurse "$ProjectRoot\dist" "$BuildDir\dist"
Copy-Item "$ProjectRoot\package.json" "$BuildDir\"
Copy-Item "$ProjectRoot\LICENSE" "$BuildDir\"

# Copy wrapper scripts
Copy-Item "$PackagingDir\codebuddy.cmd" "$BuildDir\"

# Install production dependencies
Write-Host "`nInstalling production dependencies..." -ForegroundColor Yellow
Push-Location $BuildDir
try {
    & "$BuildDir\node\npm.cmd" install --production --ignore-scripts
} finally {
    Pop-Location
}

# Build NSIS installer (EXE)
if ($BuildExe -or (-not $BuildMsi -and -not $BuildExe)) {
    Write-Host "`nBuilding NSIS installer..." -ForegroundColor Yellow

    $NsisPath = "C:\Program Files (x86)\NSIS\makensis.exe"
    if (-not (Test-Path $NsisPath)) {
        $NsisPath = "makensis"
    }

    # Update version in NSI script
    $NsiContent = Get-Content "$PackagingDir\installer.nsi" -Raw
    $NsiContent = $NsiContent -replace '!define PRODUCT_VERSION "[^"]*"', "!define PRODUCT_VERSION `"$Version`""
    $NsiContent | Set-Content "$BuildDir\installer.nsi"

    Push-Location $BuildDir
    try {
        & $NsisPath installer.nsi
        Move-Item "CodeBuddy-$Version-setup.exe" "$OutputDir\" -Force
    } finally {
        Pop-Location
    }
}

# Build WiX MSI installer
if ($BuildMsi) {
    Write-Host "`nBuilding WiX MSI installer..." -ForegroundColor Yellow

    # Generate WiX source
    $WxsContent = @"
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
    <Product Id="*"
             Name="Code Buddy"
             Language="1033"
             Version="$Version"
             Manufacturer="Code Buddy Team"
             UpgradeCode="12345678-1234-1234-1234-123456789012">

        <Package InstallerVersion="200" Compressed="yes" InstallScope="perMachine" />

        <MajorUpgrade DowngradeErrorMessage="A newer version of Code Buddy is already installed." />

        <MediaTemplate EmbedCab="yes" />

        <Feature Id="ProductFeature" Title="Code Buddy" Level="1">
            <ComponentGroupRef Id="ProductComponents" />
            <ComponentRef Id="ApplicationShortcut" />
            <ComponentRef Id="PathEnvVar" />
        </Feature>

        <Directory Id="TARGETDIR" Name="SourceDir">
            <Directory Id="ProgramFilesFolder">
                <Directory Id="INSTALLFOLDER" Name="Code Buddy" />
            </Directory>
            <Directory Id="ProgramMenuFolder">
                <Directory Id="ApplicationProgramsFolder" Name="Code Buddy" />
            </Directory>
        </Directory>

        <ComponentGroup Id="ProductComponents" Directory="INSTALLFOLDER">
            <!-- Files will be harvested by heat.exe -->
        </ComponentGroup>

        <DirectoryRef Id="ApplicationProgramsFolder">
            <Component Id="ApplicationShortcut" Guid="*">
                <Shortcut Id="ApplicationStartMenuShortcut"
                          Name="Code Buddy"
                          Target="[INSTALLFOLDER]codebuddy.cmd"
                          WorkingDirectory="INSTALLFOLDER" />
                <RemoveFolder Id="CleanUpShortCut" Directory="ApplicationProgramsFolder" On="uninstall" />
                <RegistryValue Root="HKCU" Key="Software\CodeBuddy" Name="installed" Type="integer" Value="1" KeyPath="yes" />
            </Component>
        </DirectoryRef>

        <DirectoryRef Id="INSTALLFOLDER">
            <Component Id="PathEnvVar" Guid="*">
                <Environment Id="PATH" Name="PATH" Value="[INSTALLFOLDER]" Permanent="no" Part="last" Action="set" System="yes" />
                <RegistryValue Root="HKLM" Key="Software\CodeBuddy" Name="pathset" Type="integer" Value="1" KeyPath="yes" />
            </Component>
        </DirectoryRef>
    </Product>
</Wix>
"@

    $WxsContent | Set-Content "$BuildDir\product.wxs"

    # Try to find WiX toolset
    $WixPath = "${env:WIX}bin"
    if (-not (Test-Path "$WixPath\candle.exe")) {
        Write-Warning "WiX Toolset not found. Skipping MSI build."
    } else {
        Push-Location $BuildDir
        try {
            # Harvest files
            & "$WixPath\heat.exe" dir . -cg ProductComponents -gg -scom -sreg -sfrag -srd -dr INSTALLFOLDER -out files.wxs

            # Compile
            & "$WixPath\candle.exe" product.wxs files.wxs

            # Link
            & "$WixPath\light.exe" -ext WixUIExtension product.wixobj files.wixobj -o "$OutputDir\CodeBuddy-$Version.msi"
        } finally {
            Pop-Location
        }
    }
}

Write-Host "`n=== Build Complete ===" -ForegroundColor Green
Write-Host "Output files are in: $OutputDir"
Get-ChildItem $OutputDir | ForEach-Object { Write-Host "  - $($_.Name)" }
