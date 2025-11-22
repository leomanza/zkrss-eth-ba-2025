import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';
import { pedersenHash } from '@aztec/foundation/crypto';

async function main() {
    // 1. Generate Publisher Key (using Grumpkin scalar for private key)
    const privateKey = GrumpkinScalar.random();

    console.log(`Private Key: ${privateKey.toString()}`);
    console.log(`Note: For Schnorr signatures in Aztec, use the account abstraction system`);
    console.log(`This script generates test data that can be used with the ZK circuit`);

    // 2. Create Merkle Tree Data
    // For simplicity, we'll create a sample Merkle root using Pedersen hash
    // In a real scenario, you'd build a proper Merkle tree

    // Sample feed items (as field elements)
    const item1 = Fr.random();
    const item2 = Fr.random();
    const item3 = Fr.random();
    const item4 = Fr.random();

    console.log(`\nSample Feed Items:`);
    console.log(`Item 1: ${item1.toString()}`);
    console.log(`Item 2: ${item2.toString()}`);
    console.log(`Item 3: ${item3.toString()}`);
    console.log(`Item 4: ${item4.toString()}`);

    // Create a simple Merkle root (hash of all items)
    const merkleRoot = pedersenHash([item1, item2, item3, item4]);
    console.log(`\nMerkle Root: ${merkleRoot.toString()}`);

    // 3. Note about signatures
    console.log(`\nFor Schnorr signatures over the Grumpkin curve:`);
    console.log(`- Use Aztec's account abstraction for signing`);
    console.log(`- Or implement Schnorr signing using a dedicated crypto library`);
    console.log(`- The Noir circuit will verify the signature using std::schnorr`);
}

main().catch(console.error);
