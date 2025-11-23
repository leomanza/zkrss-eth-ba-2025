# GEMINI.md - Aztec & Noir Implementation Guide

## Overview
This guide explains how to implement Zero-Knowledge circuits using Noir and deploy them as smart contracts on the Aztec network, following the structure of the `aztec-starter` repository.

## Project Structure
The project follows a standard Aztec/Noir project structure:

- `src/`: Contains the Noir source code.
    - `main.nr`: The main contract entry point.
    - `test/`: Noir tests.
    - `utils/`: Helper functions.
- `Nargo.toml`: Configuration file for the Noir build system (Nargo).
- `package.json`: Node.js dependencies for testing and interaction scripts.

## Development Workflow

### 1. Define the Circuit (Contract)
Aztec contracts are written in Noir. A contract is defined using the `contract` keyword.

```rust
contract MyContract {
    // Imports
    use dep::aztec::prelude::*;

    // Storage definition
    #[aztec(storage)]
    struct Storage {
        // ...
    }

    // Functions
    #[aztec(public)]
    fn constructor() {
        // ...
    }

    #[aztec(private)]
    fn my_private_function() {
        // ...
    }
}
```

### 2. Compile
Use `aztec-nargo` to compile the contract.
```bash
aztec-nargo compile
```
This generates the build artifacts in `target/`.

### 3. Test
Run Noir tests using:
```bash
aztec-nargo test
```

### 4. Deploy and Interact
Use `aztec.js` (included in dependencies) to deploy and interact with the contract from TypeScript/JavaScript.
See `src/test` for integration test examples.

## Implementing zkRSS

### Goal
Implement a system where:
1. **Publisher** signs a Merkle Root of the feed.
2. **User** verifies that a specific item is in the feed and the root is signed by the publisher.

### Key Components
1. **Merkle Tree**: Use `std::merkle` or Aztec's merkle tree implementations.
2. **Signatures**: Use `std::schnorr` or `std::ecdsa` for verifying publisher signatures.
3. **Poseidon Hash**: Use `dep::std::hash::poseidon` for efficient hashing in the circuit.

### Step-by-Step Implementation Plan
1. **Setup**: Initialize the project (done).
2. **Merkle Logic**: Implement/Import Merkle proof verification in Noir.
3. **Signature Verification**: Implement signature verification in Noir.
4. **Contract**: Create the `ZkRSS` contract in `src/main.nr` combining these elements.
5. **Tests**: Write tests in `src/test` to verify the logic.

## Resources
- [Aztec Docs](https://docs.aztec.network)
- [Noir Docs](https://noir-lang.org)
