import { EmbeddedWallet } from "./embedded-wallet";
import { ZkRSSContract } from "../artifacts/ZkRSS";
import { AztecAddress } from "@aztec/aztec.js/addresses";
import { Fr } from "@aztec/aztec.js/fields";
import './style.css';

// --- Configuration & Initialization ---
declare global {
    interface Window {
        userId: string | null;
    }
}

const AZTEC_NODE_URL = "http://localhost:8080"; // Default sandbox URL

let wallet: EmbeddedWallet;
let contract: ZkRSSContract;
let contractAddress: AztecAddress;

// Global State
window.userId = null;
const LOCAL_STORAGE_KEY = 'zkrss_feed_data';

// --- Wallet Handling ---
async function initWallet() {
    try {
        const authDot = document.getElementById('auth-dot');
        const userIdDisplay = document.getElementById('user-id-display');
        const authStatus = document.getElementById('auth-status');

        if (authStatus) authStatus.classList.remove('hidden');
        if (userIdDisplay) userIdDisplay.textContent = "Initializing Wallet...";

        wallet = await EmbeddedWallet.initialize(AZTEC_NODE_URL);

        // Check for existing account
        const accounts = await wallet.getAccounts();
        if (accounts.length > 0) {
            const address = accounts[0].item;
            window.userId = address.toString();
            updateAuthUI(window.userId);
            console.log("Wallet connected:", window.userId);
        } else {
            if (userIdDisplay) userIdDisplay.textContent = "No Account";
            if (authDot) {
                authDot.classList.remove('bg-aztec-success');
                authDot.classList.add('bg-yellow-500');
            }
        }

        // Initialize/Deploy Contract
        if (window.userId) {
            const savedAddress = localStorage.getItem('zkrss_contract_address');
            if (savedAddress) {
                try {
                    contractAddress = AztecAddress.fromString(savedAddress);
                    contract = await ZkRSSContract.at(contractAddress, wallet);
                    console.log("Connected to existing contract:", contractAddress.toString());
                } catch (e) {
                    console.warn("Failed to connect to saved contract, deploying new one.");
                    await deployContract();
                }
            } else {
                await deployContract();
            }
        }

    } catch (e) {
        console.error("Wallet Init Error:", e);
        showMessage("Wallet Error", "Failed to initialize Aztec wallet.", "error");
    }
}

async function deployContract() {
    console.log("Deploying new ZkRSS contract...");
    const deployer = ZkRSSContract.deploy(wallet);
    if (!wallet.connectedAccount) throw new Error("Wallet not connected");
    const receipt = await deployer.send({ contractAddressSalt: Fr.random(), from: wallet.connectedAccount }).wait();
    contract = receipt.contract;
    contractAddress = contract.address;
    localStorage.setItem('zkrss_contract_address', contractAddress.toString());
    console.log("Deployed new contract:", contractAddress.toString());
}

async function createAccount() {
    const btn = document.getElementById('create-account-btn') as HTMLButtonElement;
    const originalText = btn.textContent;

    try {
        btn.disabled = true;
        btn.textContent = "Creating...";

        const address = await wallet.createAccount();
        window.userId = address.toString();
        updateAuthUI(window.userId);
        showMessage("Success", "Aztec Account Created!", "success");

        // Re-init contract if needed
        if (!contract) {
            await deployContract();
        }

    } catch (e) {
        console.error("Account Creation Error:", e);
        showMessage("Error", "Failed to create account.", "error");
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function updateAuthUI(userId: string | null) {
    const authDot = document.getElementById('auth-dot');
    const userIdDisplay = document.getElementById('user-id-display');
    const publishBtn = document.getElementById('publish-btn') as HTMLButtonElement;
    const createBtn = document.getElementById('create-account-btn');

    if (userId) {
        if (authDot) {
            authDot.classList.remove('bg-yellow-500');
            authDot.classList.add('bg-aztec-success');
        }
        if (userIdDisplay) {
            userIdDisplay.textContent = userId.substring(0, 6) + '...' + userId.substring(userId.length - 4);
        }
        if (publishBtn) publishBtn.disabled = false;
        if (createBtn) createBtn.style.display = 'none';
    } else {
        // Handle disconnected state if needed
    }
}

// --- Crypto Utilities ---
async function sha256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- UI Logic ---
function switchTab(tab: string) {
    const pubTab = document.getElementById('tab-publisher');
    const readTab = document.getElementById('tab-reader');
    const pubView = document.getElementById('view-publisher');
    const readView = document.getElementById('view-reader');

    if (tab === 'publisher') {
        pubTab?.classList.add('text-white', 'border-aztec-primary');
        pubTab?.classList.remove('text-aztec-muted', 'border-transparent');
        readTab?.classList.remove('text-white', 'border-aztec-primary');
        readTab?.classList.add('text-aztec-muted', 'border-transparent');

        pubView?.classList.remove('hidden');
        readView?.classList.add('hidden');
    } else {
        readTab?.classList.add('text-white', 'border-aztec-primary');
        readTab?.classList.remove('text-aztec-muted', 'border-transparent');
        pubTab?.classList.remove('text-white', 'border-aztec-primary');
        pubTab?.classList.add('text-aztec-muted', 'border-transparent');

        readView?.classList.remove('hidden');
        pubView?.classList.add('hidden');
    }
};

function showMessage(title: string, message: string, type = 'success') {
    const box = document.getElementById('message-box');
    const titleEl = document.getElementById('msg-title');
    const bodyEl = document.getElementById('msg-body');
    const iconEl = document.getElementById('msg-icon');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = message;

    if (iconEl) {
        if (type === 'success') {
            iconEl.innerHTML = `<svg class="h-6 w-6 text-aztec-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
        } else {
            iconEl.innerHTML = `<svg class="h-6 w-6 text-aztec-error" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
        }
    }

    box?.classList.remove('hidden', 'hiding');
    box?.classList.add('msg-box');

    setTimeout(() => {
        box?.classList.add('hiding');
        setTimeout(() => box?.classList.add('hidden'), 300);
    }, 4000);
};

// --- Publisher Logic ---
async function publishContent() {
    if (!window.userId || !contract) {
        showMessage("Error", "Wallet not connected or contract not ready.", "error");
        return;
    }

    const contentEl = document.getElementById('article-content') as HTMLTextAreaElement;
    const content = contentEl.value.trim();
    const btn = document.getElementById('publish-btn') as HTMLButtonElement;
    const spinner = document.getElementById('publish-spinner');

    if (!content) {
        showMessage("Validation", "Content cannot be empty.", "error");
        return;
    }

    try {
        btn.disabled = true;
        spinner?.classList.remove('hidden');

        // 1. Generate Commitment (Hash)
        const contentHashStr = await sha256(content);
        const contentHashFr = Fr.fromBuffer(Buffer.from(contentHashStr, 'hex').subarray(0, 31));

        // 2. Merkle Tree & Signature
        // Mock Root Construction (Single Item Tree)
        const path = [Fr.ZERO, Fr.ZERO, Fr.ZERO, Fr.ZERO];
        const mockRoot = contentHashFr;

        // Mock Signature
        const signature = "mock_signature_" + Date.now();

        // 3. Store to LocalStorage
        const newPost = {
            content: content,
            contentHash: contentHashStr,
            signature: signature,
            userId: window.userId,
            timestamp: Date.now(),
            merkleRoot: mockRoot.toString(),
            proof: path.map(p => p.toString())
        };

        const existingData = localStorage.getItem(LOCAL_STORAGE_KEY);
        const feed = existingData ? JSON.parse(existingData) : [];
        feed.unshift(newPost);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(feed));

        contentEl.value = '';
        showMessage("Success", "Article published locally!", "success");

        // Refresh Feed
        initFeedListener();

    } catch (error) {
        console.error("Publish Error:", error);
        showMessage("Error", "Failed to publish content.", "error");
    } finally {
        btn.disabled = false;
        spinner?.classList.add('hidden');
    }
};

// --- Reader Logic ---
function initFeedListener() {
    const container = document.getElementById('feed-container');
    const feedData = localStorage.getItem(LOCAL_STORAGE_KEY) || 'http://localhost:4001'; // rss-service running locally
    ;
    if (!container) return;

    const existingData = localStorage.getItem(LOCAL_STORAGE_KEY);
    const feed = existingData ? JSON.parse(existingData) : [];

    if (feed.length === 0) {
        container.innerHTML = '<div class="text-center text-aztec-muted py-10">No articles found. Be the first to publish!</div>';
        return;
    }

    container.innerHTML = '';

    feed.forEach(async (data: any) => {
        const el = document.createElement('div');
        el.className = 'bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-all';

        // Verify Content
        let verificationBadge = '';

        try {
            // For now, just check hash match
            const localHash = await sha256(data.content);
            if (localHash === data.contentHash) {
                verificationBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-800">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                    Verified (Local)
                </span>`;
            } else {
                verificationBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400 border border-red-800">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>
                    Tampered
                </span>`;
            }
        } catch (e) {
            verificationBadge = `<span class="text-xs text-aztec-muted">Verification Error</span>`;
        }

        const date = data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Just now';
        const shortId = data.userId ? (data.userId.substring(0, 6) + '...' + data.userId.substring(data.userId.length - 4)) : 'Unknown';

        el.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center space-x-2">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                        ${shortId.substring(0, 2)}
                    </div>
                    <div>
                        <p class="text-sm font-medium text-white">${shortId}</p>
                        <p class="text-xs text-aztec-muted">${date}</p>
                    </div>
                </div>
                ${verificationBadge}
            </div>
            <div class="text-slate-300 text-sm leading-relaxed mb-4 whitespace-pre-wrap">${data.content}</div>
            <div class="bg-slate-900/50 rounded p-3 text-xs font-mono text-aztec-muted border border-slate-800">
                <div class="flex justify-between mb-1">
                    <span>Hash:</span>
                    <span class="text-slate-500 truncate ml-2" title="${data.contentHash}">${data.contentHash}</span>
                </div>
                <div class="flex justify-between">
                    <span>Sig:</span>
                    <span class="text-slate-500 truncate ml-2" title="${data.signature}">${data.signature}</span>
                </div>
            </div>
        `;
        container.appendChild(el);
    });
}

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tab-publisher')?.addEventListener('click', () => switchTab('publisher'));
    document.getElementById('tab-reader')?.addEventListener('click', () => switchTab('reader'));
    document.getElementById('publish-btn')?.addEventListener('click', publishContent);
    document.getElementById('create-account-btn')?.addEventListener('click', createAccount);
    document.getElementById('close-msg-btn')?.addEventListener('click', () => {
        document.getElementById('message-box')?.classList.add('hidden');
    });

    switchTab('publisher'); // Default view
    initFeedListener();
    initWallet();
});
