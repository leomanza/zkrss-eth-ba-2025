use dep::aztec::macros::aztec as aztec_macro;

#[aztec_macro]
contract ZkRSS {
    use dep::aztec::macros::storage::storage;
    use dep::aztec::macros::functions::{initializer, external};

    #[dep::aztec::macros::storage::storage]
    struct Storage<Context> {
        
    }

    #[dep::aztec::macros::functions::external("public")]
    #[dep::aztec::macros::functions::initializer]
    fn constructor() {}

    /// Verify that a specific item is part of a signed RSS feed
    /// This is the core ZkRSS function providing Authenticity, Integrity, and Non-Repudiation
    #[dep::aztec::macros::functions::external("private")]
    fn verify_content_provenance(
        pub_key_x: Field,
        pub_key_y: Field,
        signature: [u8; 64],
        merkle_root: Field,
        item_hash: Field,
        index: Field,
        path: [Field; 4] 
    ) {
        // 1. Verify Signature (Authenticity & Non-Repudiation)
        let message_bytes: [u8; 32] = merkle_root.to_be_bytes();
        
        let pub_key = std::embedded_curve_ops::EmbeddedCurvePoint {
            x: pub_key_x,
            y: pub_key_y,
            is_infinite: false
        };

        let is_valid_sig = dep::schnorr::verify_signature(pub_key, signature, message_bytes);
        assert(is_valid_sig, "Invalid Publisher Signature");

        // 2. Verify Merkle Membership (Integrity)
        let computed_root = crate::compute_merkle_root(item_hash, index, path);
        assert(computed_root == merkle_root, "Invalid Merkle Proof");
    }

    /// Verify multiple items from the same feed in a single call
    /// More efficient for batch verification - verifies signature once, then all proofs
    #[dep::aztec::macros::functions::external("private")]
    fn verify_multiple_items(
        pub_key_x: Field,
        pub_key_y: Field,
        signature: [u8; 64],
        merkle_root: Field,
        items: [Field; 4],
        indices: [Field; 4],
        paths: [[Field; 4]; 4]
    ) {
        // 1. Verify Signature once for all items
        let message_bytes: [u8; 32] = merkle_root.to_be_bytes();
        
        let pub_key = std::embedded_curve_ops::EmbeddedCurvePoint {
            x: pub_key_x,
            y: pub_key_y,
            is_infinite: false
        };

        let is_valid_sig = dep::schnorr::verify_signature(pub_key, signature, message_bytes);
        assert(is_valid_sig, "Invalid Publisher Signature");

        // 2. Verify each item's Merkle proof
        for i in 0..4 {
            let computed_root = crate::compute_merkle_root(items[i], indices[i], paths[i]);
            assert(computed_root == merkle_root, "Invalid Merkle Proof");
        }
    }

    /// Verify a single item with a different tree depth (depth 3 = 8 leaves)
    #[dep::aztec::macros::functions::external("private")]
    fn verify_with_depth_3(
        pub_key_x: Field,
        pub_key_y: Field,
        signature: [u8; 64],
        merkle_root: Field,
        item_hash: Field,
        index: Field,
        path: [Field; 3]
    ) {
        // Verify signature
        let message_bytes: [u8; 32] = merkle_root.to_be_bytes();
        let pub_key = std::embedded_curve_ops::EmbeddedCurvePoint {
            x: pub_key_x,
            y: pub_key_y,
            is_infinite: false
        };

        let is_valid_sig = dep::schnorr::verify_signature(pub_key, signature, message_bytes);
        assert(is_valid_sig, "Invalid Publisher Signature");

        // Verify Merkle proof with depth 3
        let computed_root = crate::compute_merkle_root_depth_3(item_hash, index, path);
        assert(computed_root == merkle_root, "Invalid Merkle Proof");
    }
}

/// Compute Merkle root from a leaf and its sibling path (depth 4)
/// Uses Pedersen hash with index 0
fn compute_merkle_root(leaf: Field, index: Field, path: [Field; 4]) -> Field {
    let mut current = leaf;
    let mut current_index = index as u32;
    for i in 0..4 {
        let sibling = path[i];
        let is_right = current_index & 1;
        
        if is_right == 1 {
            current = dep::aztec::hash::pedersen_hash([sibling, current], 0);
        } else {
            current = dep::aztec::hash::pedersen_hash([current, sibling], 0);
        }
        current_index = current_index >> 1;
    }
    current
}

/// Compute Merkle root with depth 3 (for smaller trees)
fn compute_merkle_root_depth_3(leaf: Field, index: Field, path: [Field; 3]) -> Field {
    let mut current = leaf;
    let mut current_index = index as u32;
    for i in 0..3 {
        let sibling = path[i];
        let is_right = current_index & 1;
        
        if is_right == 1 {
            current = dep::aztec::hash::pedersen_hash([sibling, current], 0);
        } else {
            current = dep::aztec::hash::pedersen_hash([current, sibling], 0);
        }
        current_index = current_index >> 1;
    }
    current
}
