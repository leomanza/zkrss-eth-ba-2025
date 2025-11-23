import { Pedersen, StandardTree, newTree } from '@aztec/merkle-tree';
import { openTmpStore } from '@aztec/kv-store/lmdb';
import { Fr } from '@aztec/aztec.js/fields';
import { pedersenHash } from '@aztec/foundation/crypto';

async function investigateTreeStructure() {
    const pedersen = new Pedersen();
    const db = openTmpStore(true);
    const tree = await newTree(StandardTree, db, pedersen, 'debug', Fr, 4);

    // Add just 2 leaves to see the structure clearly
    const leaf0 = Fr.fromString('0x1');
    const leaf1 = Fr.fromString('0x2');

    console.log('=== Adding 2 Leaves ===\n');
    console.log('Leaf 0:', leaf0.toString());
    console.log('Leaf 1:', leaf1.toString());

    await tree.appendLeaves([leaf0, leaf1]);

    const root = Fr.fromBuffer(tree.getRoot(false));
    console.log('\nTree root:', root.toString());

    // Get sibling paths for both leaves
    const path0 = await tree.getSiblingPath(0n, false);
    const path1 = await tree.getSiblingPath(1n, false);

    console.log('\nSibling path for index 0:');
    path0.toFields().forEach((s, i) => console.log(`  [${i}]: ${s.toString()}`));

    console.log('\nSibling path for index 1:');
    path1.toFields().forEach((s, i) => console.log(`  [${i}]: ${s.toString()}`));

    // The sibling at level 0 for index 0 should be leaf 1
    console.log('\n=== Analysis ===');
    console.log('Expected sibling[0] for index 0: leaf1 =', leaf1.toString());
    console.log('Actual sibling[0] for index 0:', path0.toFields()[0].toString());
    console.log('Match:', path0.toFields()[0].toString() === leaf1.toString() ? '✅' : '❌');

    // Try computing the first level hash
    console.log('\n=== Computing First Level ===');
    const level0Hash = await pedersenHash([leaf0, leaf1], 0);
    console.log('hash(leaf0, leaf1):', level0Hash.toString());

    // Check if this matches the root (for a 2-leaf tree at depth 4, we'd need to hash with zeros)
    console.log('\n=== Computing Full Root (2 leaves, depth 4) ===');
    let current = level0Hash;
    const zero = Fr.ZERO;

    for (let i = 1; i < 4; i++) {
        console.log(`Level ${i}: hash(current, 0)`);
        current = await pedersenHash([current, zero], 0);
        console.log(`  result: ${current.toString()}`);
    }

    console.log('\nFinal computed root:', current.toString());
    console.log('Expected root:', root.toString());
    console.log('Match:', current.toString() === root.toString() ? '✅' : '❌');
}

investigateTreeStructure().catch(console.error);
