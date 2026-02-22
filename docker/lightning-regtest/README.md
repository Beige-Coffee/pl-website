# Lightning Regtest Environment (Scaffold)

This directory contains the scaffold for a per-student Bitcoin Core regtest environment that will support hands-on interaction with the Lightning tutorial exercises.

## Intended Architecture

- Each student gets their own Docker container running `bitcoind` in regtest mode
- Container exposes RPC on a unique port (base: 18443)
- Student's in-browser Python exercises can call `bitcoin-cli` / RPC via a future shell UI component
- Regtest allows instant block generation for testing transactions

## Quick Start (Local Development)

```bash
docker build -t pl-regtest .
docker run -d -p 18443:18443 --name pl-regtest pl-regtest
```

Test the connection:

```bash
docker exec pl-regtest bitcoin-cli -regtest -rpcuser=student -rpcpassword=lightning getblockchaininfo
```

Generate blocks:

```bash
docker exec pl-regtest bitcoin-cli -regtest -rpcuser=student -rpcpassword=lightning generatetoaddress 101 $(docker exec pl-regtest bitcoin-cli -regtest -rpcuser=student -rpcpassword=lightning getnewaddress)
```

## Future Work

- Per-student container orchestration (Kubernetes or Docker Compose with dynamic port allocation)
- Automatic container provisioning on student registration
- Cleanup/garbage collection for idle containers
- Shell UI component in the browser for students to interact with their regtest environment
- Integration with the tutorial exercises (e.g., broadcast funding transactions to regtest)
