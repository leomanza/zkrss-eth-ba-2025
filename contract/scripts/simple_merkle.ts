import { Fr } from '@aztec/aztec.js/fields';
import { pedersenHash } from '@aztec/foundation/crypto';

/**
 * Simple Merkle tree implementation that matches our Noir contract exactly
 */
class SimpleMerkleTree {
    private leaves: Fr[];
    private depth: number;

    constructor(depth: number) {
        this.depth = depth;
        this.leaves = [];
    }

    async appendLeaves(leaves: Fr[]) {
        this.leaves.push(...leaves);
    }

    async getRoot(): Promise<Fr> {
        const maxLeaves = 1 << this.depth;

        // Pad with zeros
        const paddedLeaves = [...this.leaves];
        while (paddedLeaves.length < maxLeaves) {
            paddedLeaves.push(Fr.ZERO);
        }

        // Build tree bottom-up
        let currentLevel = paddedLeaves;

        for (let level = 0; level < this.depth; level++) {
            const nextLevel: Fr[] = [];

            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = currentLevel[i + 1];
                const parent = await pedersenHash([left, right], 0);
                nextLevel.push(parent);
            }

            currentLevel = nextLevel;
        }

        return currentLevel[0];
    }

    async getSiblingPath(index: number): Promise<Fr[]> {
        const maxLeaves = 1 << this.depth;

        // Pad with zeros
        const paddedLeaves = [...this.leaves];
        while (paddedLeaves.length < maxLeaves) {
            paddedLeaves.push(Fr.ZERO);
        }

        const path: Fr[] = [];
        let currentLevel = paddedLeaves;
        let currentIndex = index;

        for (let level = 0; level < this.depth; level++) {
            // Get sibling index
            const siblingIndex = currentIndex ^ 1; // Flip the last bit
            const sibling = currentLevel[siblingIndex] || Fr.ZERO;
            path.push(sibling);

            // Move to next level
            const nextLevel: Fr[] = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = currentLevel[i + 1] || Fr.ZERO;
                const parent = await pedersenHash([left, right], 0);
                nextLevel.push(parent);
            }

            currentLevel = nextLevel;
            currentIndex = Math.floor(currentIndex / 2);
        }

        return path;
    }

    getLeaf(index: number): Fr {
        return this.leaves[index] || Fr.ZERO;
    }
}

// Test it
async function testSimpleTree() {
    console.log('=== Testing Simple Merkle Tree ===\n');

    const tree = new SimpleMerkleTree(4);
    const leaves = [
        Fr.fromString('0x1'),
        Fr.fromString('0x2'),
        Fr.fromString('0x3'),
        Fr.fromString('0x4')
    ];

    console.log('Leaves:');
    leaves.forEach((l, i) => console.log(`  [${i}]: ${l.toString()}`));

    await tree.appendLeaves(leaves);

    const root = await tree.getRoot();
    console.log('\nRoot:', root.toString());

    // Get path for index 0
    const path = await tree.getSiblingPath(0);
    console.log('\nSibling path for index 0:');
    path.forEach((s, i) => console.log(`  [${i}]: ${s.toString()}`));

    // Manually verify
    console.log('\n=== Manual Verification ===');
    let current = leaves[0];
    let index = 0;

    for (let i = 0; i < 4; i++) {
        const sibling = path[i];
        const isRight = (index >> i) & 1;

        console.log(`Level ${i}: index=${index}, bit=${isRight}`);
        console.log(`  current: ${current.toString()}`);
        console.log(`  sibling: ${sibling.toString()}`);

        if (isRight === 1) {
            current = await pedersenHash([sibling, current], 0);
        } else {
            current = await pedersenHash([current, sibling], 0);
        }

        console.log(`  result: ${current.toString()}`);
    }

    console.log('\nComputed root:', current.toString());
    console.log('Expected root:', root.toString());
    console.log('Match:', current.toString() === root.toString() ? '✅ YES!' : '❌ NO');
}

testSimpleTree().catch(console.error);
