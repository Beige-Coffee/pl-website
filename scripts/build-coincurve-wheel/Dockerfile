FROM pyodide/pyodide-env:0.27.7

RUN pip install pyodide-build==0.27.7

COPY build-wheel.sh /build-wheel.sh
RUN chmod +x /build-wheel.sh

ENTRYPOINT ["/build-wheel.sh"]
