// Import from specific subpaths - @aztec/aztec.js doesn't have a root export
import * as Account from '@aztec/aztec.js/account';
import * as Crypto from '@aztec/aztec.js/crypto';
import * as Contracts from '@aztec/aztec.js/contracts';
import * as Wallet from '@aztec/aztec.js/wallet';
import * as Utils from '@aztec/aztec.js/utils';
import * as Keys from '@aztec/aztec.js/keys';

function findKey(obj: any, target: string, path: string = '') {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
        if (key.toLowerCase().includes(target.toLowerCase())) {
            console.log(`Found ${target} at: ${path}.${key}`);
        }
        // Shallow search to avoid cycles
        // if (typeof obj[key] === 'object') findKey(obj[key], target, `${path}.${key}`);
    }
}

console.log('Searching for Schnorr in Crypto...');
findKey(Crypto, 'Schnorr', 'Crypto');
console.log('Searching for Grumpkin in Crypto...');
findKey(Crypto, 'Grumpkin', 'Crypto');
console.log('Searching for Schnorr in Keys...');
findKey(Keys, 'Schnorr', 'Keys');
console.log('Searching for Grumpkin in Keys...');
findKey(Keys, 'Grumpkin', 'Keys');
