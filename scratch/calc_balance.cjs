const fs = require('fs');
const data = JSON.parse(fs.readFileSync('usepay_030_history.json'));
const payments = data[0].data;
const bills = data[1].data;
const payouts = data[2].data;

const all = [
  ...payments.map(p => ({ type: 'PAYMENT', date: p.created_at, amount: p.amount, status: p.status })),
  ...bills.map(b => ({ type: 'BILL', date: b.created_at, amount: b.amount, charges: b.charges, status: b.status })),
  ...payouts.map(p => ({ type: 'PAYOUT', date: p.created_at, amount: p.amount, charges: p.charge_amount, status: p.status }))
].sort((a, b) => new Date(a.date) - new Date(b.date));

let balance = 0;
all.forEach(tx => {
  if (tx.type === 'PAYMENT' && tx.status === 'approved') {
    balance += Number(tx.amount);
  } else if (tx.type === 'BILL') {
    balance -= (Number(tx.amount) + Number(tx.charges || 0));
    if (tx.status === 'rejected' || tx.status === 'refunded') {
      balance += (Number(tx.amount) + Number(tx.charges || 0)); // Refund
    }
  } else if (tx.type === 'PAYOUT') {
    balance -= (Number(tx.amount) + Number(tx.charges || 0));
    if (tx.status === 'rejected' || tx.status === 'refunded') {
      balance += (Number(tx.amount) + Number(tx.charges || 0)); // Refund
    }
  }
  
  if (new Date(tx.date) >= new Date('2026-05-09T00:00:00')) {
    console.log(tx.date, tx.type.padEnd(7), tx.status.padEnd(10), String(tx.amount).padEnd(10), 'Balance:', balance.toFixed(2));
  }
});
