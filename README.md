# ZKRSS: Zero-Knowledge RSS Feed Verification

**ZKRSS** is a decentralized content provenance system that leverages Zero-Knowledge Proofs (ZKPs) on the Aztec network to ensure the **Authenticity**, **Integrity**, and **Non-Repudiation** of RSS feeds.

In an era of AI-generated content and misinformation, ZKRSS allows publishers to cryptographically sign their content feeds, enabling readers to verify that an article truly originated from the claimed source and has not been tampered with—all without revealing the entire subscriber list or compromise privacy.

---

## 🏗 Project Architecture

The project consists of three main components working in harmony:

1.  **Contracts (`/contracts`)**: The core verification logic written in Noir (Aztec's ZK language).
2.  **RSS Service (`/rss-service`)**: A lightweight backend service (Hono.js + Redis) to manage and serve standard RSS feeds.
3.  **App (`/app`)**: A frontend application for users to interact with the system, publish content, and verify provenance.

```mermaid
graph TD
    User[User / Reader] -->|Verifies Proof| App
    Publisher -->|Signs Feed Root| RSS_Service
    RSS_Service -->|Serves RSS + Proofs| App
    App -->|Verifies via ZK Circuit| Contract[ZKRSS Contract (Aztec)]
    Contract -->|Returns Validity| App
```

---

## 1. 📜 Contracts (Aztec / Noir)

The heart of ZKRSS is the smart contract deployed on the Aztec network. It enforces cryptographic rules to validate content.

**Location:** `contracts/src/main.nr`

### Key Features:
*   **Schnorr Signature Verification**: Verifies that the Merkle Root of the feed was signed by the legitimate Publisher's private key.
*   **Merkle Proof Verification**: Verifies that a specific item (article) is a leaf in the Merkle Tree committed to by the signed Root.
*   **Privacy**: All verification happens inside a ZK circuit (Aztec), keeping the verification process private.

### Core Functions:
*   `verify_content_provenance`: Verifies a single item against a signed root using a Merkle proof (Depth 4).
*   `verify_multiple_items`: Batch verification for efficiency. Verifies one signature and multiple Merkle proofs in a single transaction.
*   `verify_with_depth_3`: Optimized verification for smaller feed trees (Depth 3).

### Development:
```bash
cd contracts
aztec-nargo compile  # Compile the circuit
aztec-nargo test     # Run Noir tests
```

---

## 2. 📡 RSS Service

A modern, scalable RSS feed management service built with **Hono.js** and **Upstash Redis**. It acts as the "Publisher" node in the ZKRSS ecosystem.

**Location:** `rss-service/`

### Key Features:
*   **Multi-Format Support**: Serves **RSS 2.0**, **Atom**, and **JSON Feed** formats automatically.
*   **High Performance**: Uses Redis for caching and storage.
*   **Security**: Rate limiting, API Key authentication for publishing, and HTML sanitization.
*   **Standard Compliant**: Produces valid feeds compatible with any standard RSS reader.

### API Endpoints:
*   `GET /rss.xml`: standard RSS feed.
*   `GET /feed.json`: JSON Feed format.
*   `POST /api/items`: Add new items to the feed (Authenticated).

### Development:
```bash
cd rss-service
npm install
npm run dev
# Service runs on http://localhost:4001
```

---

## 3. 📱 App (Frontend)

The user interface for interacting with ZKRSS. It demonstrates the flow of publishing content (generating proofs) and reading content (verifying proofs).

**Location:** `app/`

### Key Features:
*   **Aztec Wallet Integration**: Connects to the Aztec Sandbox via `EmbeddedWallet`.
*   **Contract Interaction**: Deploys and interacts with the `ZKRSS` contract directly from the browser.
*   **Publisher Mode**: Allows users to write articles, generate local Merkle Trees, and "publish" them (simulating the Publisher role).
*   **Reader Mode**: Displays the feed and performs verification of content integrity.

### Tech Stack:
*   **TypeScript**: Type-safe development.
*   **Webpack**: Bundling and dev server.
*   **Aztec.js**: Client library for Aztec network interaction.

### Development:
```bash
# From root
bun install
bun run dev
# App runs on http://localhost:8080 (or configured port)
```

---

## 🚀 Getting Started

Follow these steps to run the entire stack locally.

### Prerequisites
*   [Bun](https://bun.sh/) or Node.js > 20
*   [Docker](https://www.docker.com/) (for Aztec Sandbox)

### 1. Start Aztec Sandbox
Start the local Aztec network.
```bash
aztec start --sandbox
```

### 2. Install Dependencies
Install dependencies for all workspaces.
```bash
bun install
```

### 3. Build & Deploy Contracts
Compile the Noir contracts and generate TypeScript artifacts.
```bash
bun build-contracts
```

### 4. Start the App
Launch the frontend application.
```bash
bun run dev
```

Visit `http://localhost:8080` to use the ZKRSS App!

---

## 🧪 Testing

Run the end-to-end test suite to verify the system.

```bash
bun test
```
This runs Playwright tests that simulate a full user flow: connecting a wallet, deploying the contract, and verifying content.

---

## 📄 License
MIT
