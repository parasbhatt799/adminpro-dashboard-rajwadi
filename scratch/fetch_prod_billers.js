async function fetchProdBillers() {
  try {
    const res = await fetch("http://143.244.140.126/api/bbps/biller", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cat_id: "C05" })
    });
    const data = await res.json();
    if (data.status === 'SUCCESS' && data.data?.billers) {
      console.log("PROD_BILLER_LIST_START");
      data.data.billers.forEach((b, index) => {
        console.log(`${index + 1}. ${b.biller_name} (${b.biller_id})`);
      });
      console.log("PROD_BILLER_LIST_END");
    } else {
      console.log("Error response:", JSON.stringify(data));
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
fetchProdBillers();
