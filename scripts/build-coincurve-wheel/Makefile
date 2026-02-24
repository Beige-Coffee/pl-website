WHEEL_DIR := ../../client/public/wasm-wheels
IMAGE_NAME := coincurve-pyodide-builder

.PHONY: build clean

build:
	docker build -t $(IMAGE_NAME) .
	docker run --rm -v "$(CURDIR)/$(WHEEL_DIR):/output" $(IMAGE_NAME)
	@echo ""
	@echo "Wheel(s) written to $(WHEEL_DIR):"
	@ls -la $(WHEEL_DIR)/*.whl 2>/dev/null || echo "  (none found — build may have failed)"

clean:
	rm -f $(WHEEL_DIR)/*.whl
