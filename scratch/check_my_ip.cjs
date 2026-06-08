const dns = require('dns').promises;

async function checkMyIp() {
  try {
    const res = await fetch('https://ipinfo.io/json');
    const data = await res.json();
    console.log('--- Current Outbound IP Info ---');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to get outbound IP:', err.message);
  }

  try {
    console.log('\n--- Resolving usepay.in ---');
    const ipv4 = await dns.resolve4('usepay.in');
    console.log('usepay.in IPv4:', ipv4);
    try {
      const ipv6 = await dns.resolve6('usepay.in');
      console.log('usepay.in IPv6:', ipv6);
    } catch (e) {
      console.log('usepay.in IPv6 resolution failed or not present:', e.message);
    }
  } catch (err) {
    console.error('DNS lookup failed for usepay.in:', err.message);
  }
}

checkMyIp();
