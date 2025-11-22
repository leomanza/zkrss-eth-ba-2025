import { Schnorr } from '@aztec/foundation/crypto';
import { StandardMerkleTree } from '@aztec/merkle-tree';
import { Fr } from '@aztec/aztec.js/fields';
import { Hasher } from '@aztec/merkle-tree';

class FrHasher implements Hasher {
    hash(lhs: Buffer, rhs: Buffer): Buffer {
        // Simple mock hash for testing tree structure, or use real Pedersen if available
        // But StandardMerkleTree might expect a specific Hasher interface
        return Buffer.concat([lhs, rhs]).slice(0, 32);
    }
    hashMultiple(inputs: Buffer[]): Buffer {
        return inputs[0]; // Mock
    }
}

async function test() {
    console.log('Testing Schnorr...');
    const schnorr = new Schnorr();
    const msg = Buffer.from('hello world');
    // Schnorr needs a Grumpkin private key. 
    // We can use Fr.random() but we need to convert it to Buffer
    const privKey = Fr.random();
    // Wait, Schnorr.constructSignature takes msg and privKey?
    // Let's check the class instance methods if possible or static

    console.log('Schnorr instance created');

    console.log('Testing Merkle Tree...');
    // const tree = new StandardMerkleTree(new FrHasher(), 'test', 4, 0n);
    // console.log('Tree created');
}

test().catch(console.error);
