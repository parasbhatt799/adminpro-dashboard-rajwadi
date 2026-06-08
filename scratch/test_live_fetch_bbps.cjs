async function testFetch(billerId, paramName, paramValue) {
  try {
    const res = await globalThis.fetch('https://www.usepay.in/api/bbps/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billerId,
        customerParams: {
          [paramName]: paramValue
        },
        customerMobile: '9998120909'
      })
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { status: 'ERROR', message: err.message };
  }
}

async function main() {
  console.log("Testing UAT Staging Bill Fetch via Live Server...");

  const tests = [
    { billerId: 'TORR00000ELE', param: 'Service Number', val: '100000001' },
    { billerId: 'TORR00000ELE', param: 'Service Number', val: '123456789' },
    { billerId: 'TORR00000ELE', param: 'Service Number', val: '200000002' },
    { billerId: 'TORR00000ELE', param: 'Service Number', val: '111111111' },
    { billerId: 'ADAN00000GAS', param: 'Customer ID', val: '100000001' },
    { billerId: 'ADAN00000GAS', param: 'Customer ID', val: '1234567890' },
    { billerId: 'AMCW00000WAT', param: 'Tenement Number', val: '100000001' }
  ];

  for (const t of tests) {
    console.log(`\nTesting ${t.billerId} - ${t.param}: ${t.val}`);
    const res = await testFetch(t.billerId, t.param, t.val);
    if (res?.billFetchResponse?.responseCode === '0000') {
      console.log('✅ SUCCESS!');
      console.log(JSON.stringify(res, null, 2));
      break;
    } else {
      console.log(`❌ Failed:`, JSON.stringify(res));
    }
  }
}

main().catch(console.error);
