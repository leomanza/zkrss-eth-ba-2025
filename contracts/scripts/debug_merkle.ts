import { Pedersen, StandardTree, newTree } from '@aztec/merkle-tree';
import { openTmpStore } from '@aztec/kv-store/lmdb';
import { Fr } from '@aztec/aztec.js/fields';
import { pedersenHash } from '@aztec/foundation/crypto';

async function debugMerkleComputation() {
    const pedersen = new Pedersen();
    const db = openTmpStore(true);
    const tree = await newTree(StandardTree, db, pedersen, 'debug', Fr, 4);

    // Add 4 simple leaves
    const values = [
        Fr.fromString('0x1'),
        Fr.fromString('0x2'),
        Fr.fromString('0x3'),
        Fr.fromString('0x4')
    ];

    console.log('=== Merkle Tree Debug ===\n');
    console.log('Leaves:');
    values.forEach((v, i) => console.log(`  [${i}]: ${v.toString()}`));

    await tree.appendLeaves(values);

    const root = Fr.fromBuffer(tree.getRoot(false));
    console.log('\nTree root:', root.toString());

    // Get sibling path for index 0
    const path = await tree.getSiblingPath(0n, false);
    const siblings = path.toFields();

    console.log('\nSibling path for index 0:');
    siblings.forEach((s, i) => console.log(`  [${i}]: ${s.toString()}`));

    // Manually compute root like the contract does
    console.log('\n=== Manual Computation (like Noir contract) ===');
    let current = values[0];
    let index = 0;

    console.log(`Start: current = ${current.toString()}, index = ${index}`);

    for (let i = 0; i < 4; i++) {
        const sibling = siblings[i];
        const isRight = (index >> i) & 1;

        console.log(`\nLevel ${i}:`);
        console.log(`  current: ${current.toString()}`);
        console.log(`  sibling: ${sibling.toString()}`);
        console.log(`  index bit: ${isRight}`);

        let newCurrent;
        if (isRight === 1) {
            console.log(`  Computing: hash([sibling, current])`);
            newCurrent = await pedersenHash([sibling, current], 0);
        } else {
            console.log(`  Computing: hash([current, sibling])`);
            newCurrent = await pedersenHash([current, sibling], 0);
        }

        console.log(`  result: ${newCurrent.toString()}`);
        current = newCurrent;
    }

    console.log(`\n=== Final Comparison ===`);
    console.log(`Computed root: ${current.toString()}`);
    console.log(`Expected root: ${root.toString()}`);
    console.log(`Match: ${current.toString() === root.toString() ? '✅ YES' : '❌ NO'}`);

    if (current.toString() !== root.toString()) {
        console.log('\n⚠️  Mismatch detected! Trying alternative computation...');

        // Try with index bits computed differently
        console.log('\n=== Alternative: Compute index bits per level ===');
        current = values[0];
        let currentIndex = 0;

        for (let i = 0; i < 4; i++) {
            const sibling = siblings[i];
            const isRight = currentIndex & 1;

            console.log(`\nLevel ${i}: index=${currentIndex}, bit=${isRight}`);

            if (isRight === 1) {
                current = await pedersenHash([sibling, current], 0);
            } else {
                current = await pedersenHash([current, sibling], 0);
            }

            currentIndex = currentIndex >> 1;
            console.log(`  result: ${current.toString()}`);
        }

        console.log(`\nAlternative result: ${current.toString()}`);
        console.log(`Match: ${current.toString() === root.toString() ? '✅ YES' : '❌ NO'}`);
    }
}

debugMerkleComputation().catch(console.error);
