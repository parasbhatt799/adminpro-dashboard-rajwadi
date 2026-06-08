const https = require('https');

https.get('https://www.usepay.in/api/bbps/billers', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const list = parsed?.billerInfoResponse?.biller || [];
      const billersArray = Array.isArray(list) ? list : [list];
      console.log('Response Status Code:', res.statusCode);
      console.log('Total billers returned by live server:', billersArray.length);
      if (billersArray.length > 0) {
        console.log('Sample billers:', billersArray.slice(0, 3).map(b => b.billerName));
      } else {
        console.log('No billers returned. Full Response:', data);
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e.message);
      console.log('Raw response:', data);
    }
  });
}).on('error', (err) => {
  console.error('Request failed:', err.message);
});
