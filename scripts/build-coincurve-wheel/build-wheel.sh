#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# Build coincurve as a Pyodide WASM wheel
# ──────────────────────────────────────────────────────────────────────────────
#
# This script:
#   1. Compiles libsecp256k1 to WASM using Emscripten
#   2. Builds the coincurve Python wheel targeting Pyodide's WASM platform
#
# Must be run inside the pyodide/pyodide-env Docker image which has
# Emscripten pre-configured.
# ──────────────────────────────────────────────────────────────────────────────

SECP256K1_VERSION="v0.5.1"
INSTALL_DIR="/tmp/secp256k1-install"

echo "==> Cloning libsecp256k1 ${SECP256K1_VERSION}..."
cd /tmp
git clone --depth 1 --branch "${SECP256K1_VERSION}" \
  https://github.com/bitcoin-core/secp256k1.git

echo "==> Building libsecp256k1 for WASM..."
cd /tmp/secp256k1
mkdir build && cd build

emcmake cmake .. \
  -DCMAKE_INSTALL_PREFIX="${INSTALL_DIR}" \
  -DCMAKE_BUILD_TYPE=Release \
  -DSECP256K1_ENABLE_MODULE_RECOVERY=ON \
  -DSECP256K1_ENABLE_MODULE_ECDH=ON \
  -DSECP256K1_BUILD_TESTS=OFF \
  -DSECP256K1_BUILD_EXHAUSTIVE_TESTS=OFF \
  -DSECP256K1_BUILD_BENCHMARK=OFF \
  -DSECP256K1_BUILD_EXAMPLES=OFF \
  -DBUILD_SHARED_LIBS=OFF

emmake make -j"$(nproc)"
emmake make install

echo "==> libsecp256k1 installed to ${INSTALL_DIR}"
ls -la "${INSTALL_DIR}/lib/"

# ──────────────────────────────────────────────────────────────────────────────
# Build coincurve wheel
# ──────────────────────────────────────────────────────────────────────────────

echo "==> Installing coincurve source..."
cd /tmp
pip download --no-binary :all: --no-deps coincurve==20.0.0
tar xf coincurve-20.0.0.tar.gz
cd coincurve-20.0.0

# Point build at our WASM libsecp256k1
export PKG_CONFIG_PATH="${INSTALL_DIR}/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
export CFLAGS="-I${INSTALL_DIR}/include ${CFLAGS:-}"
export LDFLAGS="-L${INSTALL_DIR}/lib ${LDFLAGS:-}"

# Tell coincurve to use our pre-built library instead of building its own
export COINCURVE_IGNORE_SYSTEM_LIB=0

echo "==> Building coincurve wheel for Pyodide..."
pyodide build .

echo "==> Copying wheel to /output..."
mkdir -p /output
cp dist/*.whl /output/

echo "==> Done! Wheel:"
ls -la /output/*.whl
