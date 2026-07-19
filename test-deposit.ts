import { getDepositBalance } from './services/recharge.js';

async function main() {
    try {
        console.log("Fetching deposit balance...");
        const result = await getDepositBalance();
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
