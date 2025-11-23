import { Pedersen } from '@aztec/merkle-tree';
import { Fr } from '@aztec/aztec.js/fields';
import { pedersenHash } from '@aztec/foundation/crypto';

async function findHashIndex() {
    // Test what hash function Pedersen actually uses
    const pedersen = new Pedersen();

    const leaf1 = Fr.fromString('0x1');
    const leaf2 = Fr.fromString('0x2');

    console.log('Testing Pedersen hash:');
    console.log('Leaf 1:', leaf1.toString());
    console.log('Leaf 2:', leaf2.toString());

    // Test Pedersen.hash (used by StandardTree)
    const hashResult = Fr.fromBuffer(pedersen.hash(leaf1.toBuffer(), leaf2.toBuffer()));
    console.log('\nPedersen.hash(1, 2):', hashResult.toString());

    // Test pedersenHash with different indices
    console.log('\nTesting pedersenHash with different indices:');
    for (let i = 0; i < 5; i++) {
        const result = await pedersenHash([leaf1, leaf2], i);
        console.log(`pedersenHash([1, 2], ${i}):`, result.toString());
    }

    // Check if Pedersen.hash matches any of them
    console.log('\nChecking which index matches Pedersen.hash:');
    for (let i = 0; i < 10; i++) {
        const result = await pedersenHash([leaf1, leaf2], i);
        if (result.toString() === hashResult.toString()) {
            console.log(`✅ MATCH! Pedersen.hash uses index ${i}`);
            return i;
        }
    }

    console.log('❌ No match found in indices 0-9');
    return -1;
}

findHashIndex().catch(console.error);
