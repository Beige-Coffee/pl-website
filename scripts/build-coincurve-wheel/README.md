# Build coincurve WASM wheel for Pyodide

This builds `coincurve` (Python bindings for libsecp256k1) as a WebAssembly wheel compatible with Pyodide v0.27.7.

## Prerequisites

- Docker

## Build

```bash
cd scripts/build-coincurve-wheel
make build
```

The wheel will be output to `client/public/wasm-wheels/`.

## How it works

1. Uses the `pyodide/pyodide-env:0.27.7` Docker image (has Emscripten pre-configured)
2. Compiles `libsecp256k1` v0.5.1 to WASM using `emcmake cmake` + `emmake make`
3. Builds `coincurve` v20.0.0 against the WASM libsecp256k1 using `pyodide build`
4. Outputs the `.whl` file to the mounted volume

## Usage in the app

The Pyodide web worker (`pyodide-runner.ts`) attempts to install the wheel from `/wasm-wheels/` on startup. If the wheel is not present, the app still works (existing exercises don't depend on it). The `bip32` package (pure Python) is installed via `micropip` after `coincurve` is available.

## Clean

```bash
make clean
```
