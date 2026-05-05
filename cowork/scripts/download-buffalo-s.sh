#!/usr/bin/env bash
# Download Buffalo_S ONNX model for Cowork face recognition.
#
# Source: Hugging Face mirror by immich-app (single 13.6 MB recognition
# model, no unzip needed). Places the file at the conventional Electron
# userData path for codebuddy-cowork.
#
# Usage: bash scripts/download-buffalo-s.sh

set -euo pipefail

URL='https://huggingface.co/immich-app/buffalo_s/resolve/main/recognition/model.onnx'

case "$(uname -s)" in
  Linux*)   USERDATA="${HOME}/.config/codebuddy-cowork" ;;
  Darwin*)  USERDATA="${HOME}/Library/Application Support/codebuddy-cowork" ;;
  *)        echo "Unsupported OS $(uname -s) -- use download-buffalo-s.ps1 on Windows" >&2; exit 1 ;;
esac

TARGET="${USERDATA}/models/buffalo_s.onnx"

echo "=== Cowork Buffalo_S model downloader ==="
echo "Source : ${URL}"
echo "Target : ${TARGET}"
echo

if [ -f "${TARGET}" ]; then
  size=$(stat -c%s "${TARGET}" 2>/dev/null || stat -f%z "${TARGET}")
  if [ "${size}" -gt 10485760 ]; then
    echo "[OK] Already present ($((size/1024/1024)) MB) — nothing to do."
    echo "     Delete the file and re-run if you want to refresh."
    exit 0
  fi
  echo "[WARN] Existing file is suspiciously small (${size} bytes), redownloading."
fi

mkdir -p "$(dirname "${TARGET}")"

echo "Downloading..."
if command -v curl >/dev/null 2>&1; then
  curl -L --fail --progress-bar -o "${TARGET}" "${URL}"
elif command -v wget >/dev/null 2>&1; then
  wget --show-progress -O "${TARGET}" "${URL}"
else
  echo "[FAIL] Neither curl nor wget available." >&2
  exit 1
fi

size=$(stat -c%s "${TARGET}" 2>/dev/null || stat -f%z "${TARGET}")
if [ "${size}" -lt 10485760 ]; then
  echo "[FAIL] Downloaded file is ${size} bytes (expected ~13 MB). Removing."
  rm -f "${TARGET}"
  exit 1
fi

echo
echo "[OK] Buffalo_S model installed ($((size/1024/1024)) MB)"
echo "     ${TARGET}"
echo
echo "Open Cowork, click the 👤 in the titlebar, enroll your face."
