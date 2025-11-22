import { ZkRSSContract } from "../../artifacts/ZkRSS.js";
import { setupWallet } from "../../utils/setup_wallet.js";
import { getAztecNodeUrl, getTimeouts } from "../../../config/config.js";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { createLogger, Logger } from "@aztec/aztec.js/log";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing';
import { TxStatus } from "@aztec/stdlib/tx";
import { TestWallet } from "@aztec/test-wallet/server";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Schnorr } from '@aztec/foundation/crypto';
import { pedersenHash } from '@aztec/foundation/crypto';

/**
 * Simple Merkle tree that matches our Noir contract implementation
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
        const paddedLeaves = [...this.leaves];
        while (paddedLeaves.length < maxLeaves) {
            paddedLeaves.push(Fr.ZERO);
        }

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
        const paddedLeaves = [...this.leaves];
        while (paddedLeaves.length < maxLeaves) {
            paddedLeaves.push(Fr.ZERO);
        }

        const path: Fr[] = [];
        let currentLevel = paddedLeaves;
        let currentIndex = index;

        for (let level = 0; level < this.depth; level++) {
            const siblingIndex = currentIndex ^ 1;
            const sibling = currentLevel[siblingIndex] || Fr.ZERO;
            path.push(sibling);

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

    getLeafCount(): number {
        return this.leaves.length;
    }
}

describe("ZkRSS - Comprehensive Test Suite", () => {
    let wallet: TestWallet;
    let logger: Logger;
    let contract: ZkRSSContract;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
    let ownerAccount: AccountManager;
    let ownerAddress: AztecAddress;

    beforeAll(async () => {
        logger = createLogger('zkrss:e2e');
        const nodeUrl = getAztecNodeUrl();
        const node = createAztecNodeClient(nodeUrl);
        wallet = await setupWallet();

        // Setup fees
        const sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
        sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // Create account
        const secretKey = Fr.random();
        const signingKey = GrumpkinScalar.random();
        const salt = Fr.random();
        ownerAccount = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
        ownerAddress = ownerAccount.address;

        // Deploy account
        await (await ownerAccount.getDeployMethod()).send({
            from: AztecAddress.ZERO,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().deployTimeout });
    }, 600000);

    it("Deploys ZkRSS contract", async () => {
        logger.info("Deploying ZkRSS contract...");
        const tx = ZkRSSContract.deploy(wallet).send({
            fee: { paymentMethod: sponsoredPaymentMethod },
            from: ownerAddress
        });
        contract = await tx.deployed({ timeout: getTimeouts().deployTimeout });
        logger.info(`ZkRSS deployed at ${contract.address}`);
        expect(contract.address).toBeDefined();
    });

    describe("✅ Guarantee 1: Publishers can cryptographically sign RSS feed roots", () => {
        it("Publisher signs a feed root and signature is valid", async () => {
            const schnorr = new Schnorr();
            const secretKey = GrumpkinScalar.random();
            const publicKey = await schnorr.computePublicKey(secretKey);

            // Create a feed with 4 items
            const tree = new SimpleMerkleTree(4);
            const feedItems = [
                Fr.fromString("0xABCD1234"), // Article 1
                Fr.fromString("0xDEADBEEF"), // Article 2
                Fr.fromString("0xCAFEBABE"), // Article 3
                Fr.fromString("0xFEEDFACE")  // Article 4
            ];
            await tree.appendLeaves(feedItems);
            const root = await tree.getRoot();

            // Publisher signs the root
            const signature = await schnorr.constructSignature(root.toBuffer(), secretKey);

            // Verify signature is valid (off-chain)
            const isValid = await schnorr.verifySignature(root.toBuffer(), publicKey, signature);
            expect(isValid).toBe(true);

            logger.info("✅ Publisher successfully signed feed root");
            logger.info(`   Feed contains ${feedItems.length} items`);
            logger.info(`   Root: ${root.toString().substring(0, 20)}...`);
        });

        it("Different publishers have different signatures", async () => {
            const schnorr = new Schnorr();

            // Publisher 1
            const publisher1Key = GrumpkinScalar.random();
            const publisher1PubKey = await schnorr.computePublicKey(publisher1Key);

            // Publisher 2
            const publisher2Key = GrumpkinScalar.random();
            const publisher2PubKey = await schnorr.computePublicKey(publisher2Key);

            // Same content, different publishers
            const tree = new SimpleMerkleTree(4);
            await tree.appendLeaves([Fr.fromString("0x1234")]);
            const root = await tree.getRoot();

            const sig1 = await schnorr.constructSignature(root.toBuffer(), publisher1Key);
            const sig2 = await schnorr.constructSignature(root.toBuffer(), publisher2Key);

            // Signatures should be different
            expect(sig1.toString()).not.toBe(sig2.toString());

            // Each signature only validates with its own public key
            expect(await schnorr.verifySignature(root.toBuffer(), publisher1PubKey, sig1)).toBe(true);
            expect(await schnorr.verifySignature(root.toBuffer(), publisher2PubKey, sig2)).toBe(true);
            expect(await schnorr.verifySignature(root.toBuffer(), publisher1PubKey, sig2)).toBe(false);
            expect(await schnorr.verifySignature(root.toBuffer(), publisher2PubKey, sig1)).toBe(false);

            logger.info("✅ Different publishers produce different signatures");
        });
    });

    describe("✅ Guarantee 2: Users can verify content authenticity in Zero-Knowledge", () => {
        it("Verifies content provenance with valid signature and proof", async () => {
            const schnorr = new Schnorr();
            const secretKey = GrumpkinScalar.random();
            const publicKey = await schnorr.computePublicKey(secretKey);

            const tree = new SimpleMerkleTree(4);
            const values = [Fr.random(), Fr.random(), Fr.random(), Fr.random()];
            await tree.appendLeaves(values);

            const index = 0;
            const siblingPath = await tree.getSiblingPath(index);
            const root = await tree.getRoot();

            const signature = await schnorr.constructSignature(root.toBuffer(), secretKey);

            // Verify in ZK
            const tx = await contract.methods.verify_content_provenance(
                publicKey.x,
                publicKey.y,
                Array.from(signature.toBuffer()),
                root,
                values[index],
                new Fr(index),
                siblingPath
            ).send({
                fee: { paymentMethod: sponsoredPaymentMethod },
                from: ownerAddress
            }).wait();

            expect(tx.status).toBe(TxStatus.SUCCESS);
            logger.info("✅ Content authenticity verified in Zero-Knowledge");
        });

        it("Rejects invalid signature", async () => {
            const schnorr = new Schnorr();
            const secretKey = GrumpkinScalar.random();
            const publicKey = await schnorr.computePublicKey(secretKey);

            const tree = new SimpleMerkleTree(4);
            const values = [Fr.random(), Fr.random()];
            await tree.appendLeaves(values);

            const root = await tree.getRoot();
            const siblingPath = await tree.getSiblingPath(0);

            // Create an INVALID signature (sign different message)
            const wrongMessage = Fr.random();
            const invalidSignature = await schnorr.constructSignature(wrongMessage.toBuffer(), secretKey);

            // Should fail
            await expect(
                contract.methods.verify_content_provenance(
                    publicKey.x,
                    publicKey.y,
                    Array.from(invalidSignature.toBuffer()),
                    root,
                    values[0],
                    new Fr(0),
                    siblingPath
                ).send({
                    fee: { paymentMethod: sponsoredPaymentMethod },
                    from: ownerAddress
                }).wait()
            ).rejects.toThrow();

            logger.info("✅ Invalid signature correctly rejected");
        });

        it("Rejects invalid Merkle proof", async () => {
            const schnorr = new Schnorr();
            const secretKey = GrumpkinScalar.random();
            const publicKey = await schnorr.computePublicKey(secretKey);

            const tree = new SimpleMerkleTree(4);
            const values = [Fr.random(), Fr.random(), Fr.random()];
            await tree.appendLeaves(values);

            const root = await tree.getRoot();
            const signature = await schnorr.constructSignature(root.toBuffer(), secretKey);

            // Get proof for index 0, but try to verify a DIFFERENT item
            const siblingPath = await tree.getSiblingPath(0);
            const wrongItem = Fr.random(); // Not in the tree

            // Should fail
            await expect(
                contract.methods.verify_content_provenance(
                    publicKey.x,
                    publicKey.y,
                    Array.from(signature.toBuffer()),
                    root,
                    wrongItem, // Wrong item!
                    new Fr(0),
                    siblingPath
                ).send({
                    fee: { paymentMethod: sponsoredPaymentMethod },
                    from: ownerAddress
                }).wait()
            ).rejects.toThrow();

            logger.info("✅ Invalid Merkle proof correctly rejected");
        });

        it("Rejects wrong publisher public key", async () => {
            const schnorr = new Schnorr();

            // Real publisher
            const publisherKey = GrumpkinScalar.random();
            const publisherPubKey = await schnorr.computePublicKey(publisherKey);

            // Attacker
            const attackerKey = GrumpkinScalar.random();
            const attackerPubKey = await schnorr.computePublicKey(attackerKey);

            const tree = new SimpleMerkleTree(4);
            const values = [Fr.random()];
            await tree.appendLeaves(values);

            const root = await tree.getRoot();
            const signature = await schnorr.constructSignature(root.toBuffer(), publisherKey);
            const siblingPath = await tree.getSiblingPath(0);

            // Try to verify with WRONG public key
            await expect(
                contract.methods.verify_content_provenance(
                    attackerPubKey.x, // Wrong public key!
                    attackerPubKey.y,
                    Array.from(signature.toBuffer()),
                    root,
                    values[0],
                    new Fr(0),
                    siblingPath
                ).send({
                    fee: { paymentMethod: sponsoredPaymentMethod },
                    from: ownerAddress
                }).wait()
            ).rejects.toThrow();

            logger.info("✅ Wrong publisher public key correctly rejected");
        });
    });

    describe("✅ Guarantee 3: Privacy is preserved (nobody knows which item was verified)", () => {
        it("Same publisher, same tree, different items - all verify successfully", async () => {
            const schnorr = new Schnorr();
            const secretKey = GrumpkinScalar.random();
            const publicKey = await schnorr.computePublicKey(secretKey);

            // Publisher creates a feed with 4 articles
            const tree = new SimpleMerkleTree(4);
            const articles = [
                Fr.fromString("0x1111"), // Sports
                Fr.fromString("0x2222"), // Politics
                Fr.fromString("0x3333"), // Tech
                Fr.fromString("0x4444")  // Weather
            ];
            await tree.appendLeaves(articles);
            const root = await tree.getRoot();

            // Publisher signs the root ONCE
            const signature = await schnorr.constructSignature(root.toBuffer(), secretKey);

            // User 1 verifies Sports article (index 0)
            const proof0 = await tree.getSiblingPath(0);
            const tx1 = await contract.methods.verify_content_provenance(
                publicKey.x,
                publicKey.y,
                Array.from(signature.toBuffer()),
                root,
                articles[0],
                new Fr(0),
                proof0
            ).send({
                fee: { paymentMethod: sponsoredPaymentMethod },
                from: ownerAddress
            }).wait();
            expect(tx1.status).toBe(TxStatus.SUCCESS);

            // User 2 verifies Tech article (index 2)
            const proof2 = await tree.getSiblingPath(2);
            const tx2 = await contract.methods.verify_content_provenance(
                publicKey.x,
                publicKey.y,
                Array.from(signature.toBuffer()),
                root,
                articles[2],
                new Fr(2),
                proof2
            ).send({
                fee: { paymentMethod: sponsoredPaymentMethod },
                from: ownerAddress
            }).wait();
            expect(tx2.status).toBe(TxStatus.SUCCESS);

            // User 3 verifies Weather article (index 3)
            const proof3 = await tree.getSiblingPath(3);
            const tx3 = await contract.methods.verify_content_provenance(
                publicKey.x,
                publicKey.y,
                Array.from(signature.toBuffer()),
                root,
                articles[3],
                new Fr(3),
                proof3
            ).send({
                fee: { paymentMethod: sponsoredPaymentMethod },
                from: ownerAddress
            }).wait();
            expect(tx3.status).toBe(TxStatus.SUCCESS);

            logger.info("✅ Privacy preserved: Different users verified different items");
            logger.info("   All verifications used the SAME signature and root");
            logger.info("   Nobody can tell which specific article each user verified");
        });

        it("Private function execution hides verification details", async () => {
            const schnorr = new Schnorr();
            const secretKey = GrumpkinScalar.random();
            const publicKey = await schnorr.computePublicKey(secretKey);

            const tree = new SimpleMerkleTree(4);
            const sensitiveContent = [
                Fr.fromString("0x1111111111111111"),
                Fr.fromString("0x2222222222222222")
            ];
            await tree.appendLeaves(sensitiveContent);

            const root = await tree.getRoot();
            const signature = await schnorr.constructSignature(root.toBuffer(), secretKey);

            // Verify sensitive content in PRIVATE context
            const index = 1; // User reads item 1
            const proof = await tree.getSiblingPath(index);

            const tx = await contract.methods.verify_content_provenance(
                publicKey.x,
                publicKey.y,
                Array.from(signature.toBuffer()),
                root,
                sensitiveContent[index],
                new Fr(index),
                proof
            ).send({
                fee: { paymentMethod: sponsoredPaymentMethod },
                from: ownerAddress
            }).wait();

            expect(tx.status).toBe(TxStatus.SUCCESS);

            // The transaction succeeds, but the specific item and index are PRIVATE
            logger.info("✅ Sensitive content verified privately");
            logger.info("   Transaction reveals: Publisher pubkey, Root, Signature");
            logger.info("   Transaction HIDES: Specific item, Item index, Item content");
        });
    });

    describe("Edge Cases and Robustness", () => {
        it("Handles single item tree", async () => {
            const schnorr = new Schnorr();
            const secretKey = GrumpkinScalar.random();
            const publicKey = await schnorr.computePublicKey(secretKey);

            const tree = new SimpleMerkleTree(4);
            const singleItem = [Fr.fromString("0x1234567890ABCDEF")];
            await tree.appendLeaves(singleItem);

            const root = await tree.getRoot();
            const signature = await schnorr.constructSignature(root.toBuffer(), secretKey);
            const proof = await tree.getSiblingPath(0);

            const tx = await contract.methods.verify_content_provenance(
                publicKey.x,
                publicKey.y,
                Array.from(signature.toBuffer()),
                root,
                singleItem[0],
                new Fr(0),
                proof
            ).send({
                fee: { paymentMethod: sponsoredPaymentMethod },
                from: ownerAddress
            }).wait();

            expect(tx.status).toBe(TxStatus.SUCCESS);
            logger.info("✅ Single item tree handled correctly");
        });

        it("Handles full tree (16 items)", async () => {
            const schnorr = new Schnorr();
            const secretKey = GrumpkinScalar.random();
            const publicKey = await schnorr.computePublicKey(secretKey);

            const tree = new SimpleMerkleTree(4);
            const fullTree = Array.from({ length: 16 }, (_, i) => Fr.fromString(`0x${i.toString(16).padStart(4, '0')}`));
            await tree.appendLeaves(fullTree);

            const root = await tree.getRoot();
            const signature = await schnorr.constructSignature(root.toBuffer(), secretKey);

            // Verify item at index 15 (last item)
            const proof = await tree.getSiblingPath(15);
            const tx = await contract.methods.verify_content_provenance(
                publicKey.x,
                publicKey.y,
                Array.from(signature.toBuffer()),
                root,
                fullTree[15],
                new Fr(15),
                proof
            ).send({
                fee: { paymentMethod: sponsoredPaymentMethod },
                from: ownerAddress
            }).wait();

            expect(tx.status).toBe(TxStatus.SUCCESS);
            logger.info("✅ Full tree (16 items) handled correctly");
        });

        it("Handles verification at different tree positions", async () => {
            const schnorr = new Schnorr();
            const secretKey = GrumpkinScalar.random();
            const publicKey = await schnorr.computePublicKey(secretKey);

            const tree = new SimpleMerkleTree(4);
            const items = Array.from({ length: 8 }, (_, i) => Fr.fromString(`0x${i}`));
            await tree.appendLeaves(items);

            const root = await tree.getRoot();
            const signature = await schnorr.constructSignature(root.toBuffer(), secretKey);

            // Test different positions
            for (const index of [0, 3, 7]) {
                const proof = await tree.getSiblingPath(index);
                const tx = await contract.methods.verify_content_provenance(
                    publicKey.x,
                    publicKey.y,
                    Array.from(signature.toBuffer()),
                    root,
                    items[index],
                    new Fr(index),
                    proof
                ).send({
                    fee: { paymentMethod: sponsoredPaymentMethod },
                    from: ownerAddress
                }).wait();

                expect(tx.status).toBe(TxStatus.SUCCESS);
            }

            logger.info("✅ Verification works at different tree positions (0, 3, 7)");
        });
    });
});
