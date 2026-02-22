FROM ubuntu:22.04

ARG BITCOIN_VERSION=27.0

RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://bitcoincore.org/bin/bitcoin-core-${BITCOIN_VERSION}/bitcoin-${BITCOIN_VERSION}-x86_64-linux-gnu.tar.gz" \
    | tar -xz --strip-components=1 -C /usr/local/

COPY bitcoin.conf /root/.bitcoin/bitcoin.conf

EXPOSE 18443

CMD ["bitcoind", "-regtest", "-printtoconsole"]
