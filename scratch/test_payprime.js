async function testToken(token) {
  console.log(`Testing token: ${token}`);
  try {
    const response = await fetch("https://b2b.payprime.in/api/v1/bbps/category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const text = await response.text();
    console.log("Response:", text);
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

async function runTests() {
  await testToken("RP54BwilcHzw0zWEB7IBx3g9C5P2IK");
}

runTests();
