import { verifyBankAccount } from './services/camlenio_payout'; verifyBankAccount('156848907564', 'INDB0001484', 'TEST' + Date.now()).then(console.log).catch(console.error);
