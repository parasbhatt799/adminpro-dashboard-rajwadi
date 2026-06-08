async function getCCBillers() {
  const token = "RP54BwilcHzw0zWEB7IBx3g9C5P2IK";
  try {
    const res = await fetch("https://b2b.payprime.in/api/v1/bbps/biller", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, cat_id: "C05" })
    });
    const data = await res.json();
    if (data.status === 'SUCCESS' && data.data?.billers) {
      console.log("BILLER_LIST_START");
      data.data.billers.forEach(b => {
        console.log(b.biller_name);
      });
      console.log("BILLER_LIST_END");
    } else {
      console.log("Error response:", JSON.stringify(data));
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
getCCBillers();
