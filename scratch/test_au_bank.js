async function getAllCreditCardBillers() {
  const token = "W2voQ2YPnb95on4Ceiw2j24SaVPg0Z";
  const billerRes = await fetch("https://b2b.payprime.in/api/v1/bbps/biller", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, cat_id: "C05" })
  });
  const billerData = await billerRes.json();
  console.log("Full Biller API response with W2voQ2YPnb95on4Ceiw2j24SaVPg0Z:", JSON.stringify(billerData, null, 2));
}

getAllCreditCardBillers();
