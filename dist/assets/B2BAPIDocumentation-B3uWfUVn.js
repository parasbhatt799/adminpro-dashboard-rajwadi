const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/jspdf.es.min-DpO_xqbY.js","assets/index-CakO_YYY.js","assets/index-DAYLOavu.css","assets/typeof-QjJsDpFa.js"])))=>i.map(i=>d[i]);
import{c as I,r as g,j as e,d as F,C as P,_ as S,f as T}from"./index-CakO_YYY.js";import{A as w}from"./activity-C_yE0N--.js";import{D as q}from"./download-k9T7cnKM.js";import{K as U}from"./key-C_DPN72k.js";import{S as B}from"./shield-alert-Dn8Kmh2O.js";import{C as O}from"./circle-alert-xn3GNbfI.js";import{C as L}from"./copy-D6hphmGp.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const G=[["path",{d:"m16 18 6-6-6-6",key:"eg8j8"}],["path",{d:"m8 6-6 6 6 6",key:"ppft3o"}]],M=I("code",G);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=[["rect",{width:"20",height:"8",x:"2",y:"2",rx:"2",ry:"2",key:"ngkwjq"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",ry:"2",key:"iecqi9"}],["line",{x1:"6",x2:"6.01",y1:"6",y2:"6",key:"16zg32"}],["line",{x1:"6",x2:"6.01",y1:"18",y2:"18",key:"nzw8ys"}]],H=I("server",z);function Q(){const[A,_]=g.useState(null),[o,p]=g.useState("curl"),[j,N]=g.useState(!1),E=(l,r)=>{navigator.clipboard.writeText(l),_(r),setTimeout(()=>_(null),2e3)},c=typeof window<"u"?window.location.origin:"https://api.usepay.in",D=async()=>{N(!0);try{const l=await S(()=>import("./jspdf.es.min-DpO_xqbY.js"),__vite__mapDeps([0,1,2,3])),r=l.jsPDF||l.default,i=await S(()=>import("./jspdf.plugin.autotable-Cz_YoQo_.js"),[]),b=i.default||i.autoTable||i,t=new r({orientation:"p",unit:"mm",format:"a4"}),C=m=>{t.setFillColor(15,23,42),t.rect(0,0,210,25,"F"),t.setTextColor(255,255,255),t.setFont("helvetica","bold"),t.setFontSize(14),t.text(m,14,12),t.setFontSize(8),t.setFont("helvetica","normal"),t.setTextColor(148,163,184),t.text(`Base Endpoint: ${c}/api/v1/b2b  |  Generated: ${T(new Date,"dd MMM yyyy, hh:mm a")}`,14,19)},d=(m,h)=>m+h>272?(t.addPage(),C("B2B Bill Payment API Reference (Contd.)"),32):m,n=(m,h,k)=>{const v=h.split(`
`),y=8+v.length*3.8;let u=d(k,y);t.setFillColor(30,41,59),t.rect(14,u,182,6,"F"),t.setFont("helvetica","bold"),t.setFontSize(8),t.setTextColor(165,180,252),t.text(m,18,u+4.2),t.setFillColor(15,23,42),t.rect(14,u+6,182,y-6,"F"),t.setFont("courier","normal"),t.setFontSize(7.5),t.setTextColor(52,211,153);let R=u+10.5;return v.forEach(f=>{t.text(f.length>95?f.substring(0,95)+"...":f,18,R),R+=3.8}),u+y+6};C("B2B Bill Payment API Reference");let s=32;t.setFont("helvetica","bold"),t.setFontSize(11),t.setTextColor(30,41,59),t.text("1. Authentication & Mandatory HTTP Headers",14,s),s+=4,b(t,{startY:s,head:[["Header Name","Value Format","Description"]],body:[["x-api-key","String (pub_live_...)","Public API key issued from Agent Credentials portal"],["x-secret-key","String (sec_live_...)","Secret API key used to authenticate your system"],["Content-Type","application/json","Required payload content type for POST requests"]],theme:"grid",headStyles:{fillColor:[79,70,229],textColor:[255,255,255],fontStyle:"bold",fontSize:8.5},bodyStyles:{fontSize:8},margin:{left:14,right:14}}),s=t.lastAutoTable.finalY+8,t.setFont("helvetica","bold"),t.setFontSize(11),t.setTextColor(30,41,59),t.text("2. API Endpoints Overview",14,s),s+=4,b(t,{startY:s,head:[["Method","Endpoint Path","Description"]],body:[["GET","/balance","Fetch current available agent wallet balance in Rupees"],["GET","/categories","Fetch supported biller categories (Electricity, Fastag, Water, etc.)"],["GET","/billers","Fetch billers list and required customer input parameters"],["POST","/fetch-bill","Fetch customer bill amount, due date, and biller details"],["POST","/pay-bill","Process bill payment and deduct funds from agent wallet"],["GET","/status/:transaction_id","Check real-time live status of a transaction"]],theme:"grid",headStyles:{fillColor:[16,185,129],textColor:[255,255,255],fontStyle:"bold",fontSize:8.5},bodyStyles:{fontSize:8},margin:{left:14,right:14}}),s=t.lastAutoTable.finalY+10,s=d(s,45),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.1 GET /balance - Check Agent Wallet Balance",14,s),s+=4,s=n("Sample Response (200 OK)",`{
  "status": "success",
  "data": {
    "balance": 15450.75,
    "currency": "INR"
  }
}`,s),s=d(s,65),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.2 GET /categories - Fetch Biller Categories",14,s),s+=4,s=n("Sample Response (200 OK)",`{
  "status": "success",
  "data": [
    { "category_name": "Electricity", "code": "ELECTRICITY" },
    { "category_name": "Credit Card", "code": "CREDIT_CARD" },
    { "category_name": "Fastag", "code": "FASTAG" },
    { "category_name": "Water", "code": "WATER" }
  ]
}`,s),s=d(s,75),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.3 GET /billers - Fetch Biller Directory",14,s),s+=4,s=n("Sample Response (200 OK)",`{
  "status": "success",
  "data": [
    {
      "billerId": "DGVCL0000GUJ01",
      "billerName": "Dakshin Gujarat Vij Company Ltd (DGVCL)",
      "category": "Electricity",
      "customerParams": [{ "name": "Consumer Number", "type": "NUMERIC" }]
    }
  ]
}`,s),s=d(s,110),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.4 POST /fetch-bill - Fetch Customer Bill Details",14,s),s+=4,s=n("Sample Request Body",`{
  "billerId": "DGVCL0000GUJ01",
  "mobile": "9898971274",
  "customerParams": [
    { "name": "Consumer Number", "value": "12345678901" }
  ]
}`,s),s=n("Sample Success Response (200 OK)",`{
  "status": "success",
  "message": "Bill fetched successfully",
  "data": {
    "responseCode": "000",
    "responseReason": "Successful",
    "fetchRequestId": "FETCH_REQ_987654321",
    "billerResponse": {
      "customerName": "AJAY KALATHIYA",
      "amount": "1500.00",
      "dueDate": "2026-08-30"
    }
  }
}`,s),s=d(s,140),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.5 POST /pay-bill - Execute Bill Payment",14,s),s+=4,b(t,{startY:s,head:[["Parameter","Type","Required","Description"]],body:[["billerId","String","REQUIRED","Target Biller ID (e.g. DGVCL0000GUJ01)"],["amount","Number","REQUIRED","Amount to be paid in Rupees (e.g. 1500.00)"],["mobile","String","REQUIRED","10-digit customer mobile number"],["paymentMode","String","OPTIONAL","UPI, Internet Banking, Debit Card, Credit Card (Default: Cash)"],["client_transaction_id","String","OPTIONAL","Custom transaction ID for idempotency and tracking"],["customerParams","Array","REQUIRED","Array of { name, value } matching biller requirement"],["billerResponseInfo","Object","OPTIONAL","Exact billerResponse object returned from /fetch-bill"]],theme:"grid",headStyles:{fillColor:[79,70,229],textColor:[255,255,255],fontStyle:"bold",fontSize:8},bodyStyles:{fontSize:7.5},margin:{left:14,right:14}}),s=t.lastAutoTable.finalY+6,s=n("Sample Request Body (/pay-bill)",`{
  "billerId": "DGVCL0000GUJ01",
  "amount": 1500.00,
  "mobile": "9898971274",
  "paymentMode": "UPI",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "customerParams": [
    { "name": "Consumer Number", "value": "12345678901" }
  ]
}`,s),s=n("Sample Success Response (200 OK)",`{
  "status": "success",
  "message": "Bill Paid successfully",
  "transaction_id": "BBPSU1283118228",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "bbps_txn_ref_id": "CC016226CBAF13851712",
  "payment_status": "success",
  "charge_deducted": 10.00
}`,s),s=d(s,130),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(16,185,129),t.text("2.6 GET /status/:transaction_id - Check Live Status & Auto-Refund",14,s),s+=4,t.setFont("helvetica","normal"),t.setFontSize(8),t.setTextColor(71,85,105),t.text("Supports: BBPSU..., client_transaction_id, fetchRequestId (from /fetch-bill), or CC01... ID. Queries BillAvenue live via TRANS_REF_ID or REQUEST_ID.",14,s),s+=5,s=n("Sample Success Response (200 OK)",`{
  "status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "CC016226CBAF13851712",
    "current_status": "success",
    "bbps_status": "SUCCESS",
    "polled_at": "2026-08-14T03:15:00.000Z"
  }
}`,s),s=n("Sample Gateway Failure & Auto-Refund Response (No CC01 Generated)",`{
  "status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "N/A",
    "current_status": "failed",
    "bbps_status": "FAILED_GATEWAY_ERROR",
    "message": "Bill payment failed to connect to gateway. Wallet automatically refunded.",
    "refund_status": "REFUNDED",
    "refunded_amount": 1500.00
  }
}`,s),s=d(s,80),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(225,29,72),t.text("3. HTTP Error Codes & Troubleshooting Matrix",14,s),s+=4,b(t,{startY:s,head:[["HTTP Code","Status","Description","Resolution Action"]],body:[["200 OK","success","Transaction / Request executed successfully","Process order response"],["400 Bad Request","error","Insufficient Wallet Balance","Load funds into B2B wallet"],["400 Bad Request","error","Payment mode Cash disabled for biller",'Pass paymentMode: "UPI" or "Internet Banking"'],["401 Unauthorized","error","Invalid API Keys or IP Not Whitelisted","Whitelist server IP in B2B Settings"],["429 Too Many Requests","error","Daily sync limit reached (50 reqs/day)","Cache biller list locally"],["500 Internal Error","error","Upstream Biller/Gateway Error","Wallet auto-refunded. Retry later"]],theme:"grid",headStyles:{fillColor:[225,29,72],textColor:[255,255,255],fontStyle:"bold",fontSize:8},bodyStyles:{fontSize:7.5},margin:{left:14,right:14}}),t.save(`B2B_Bill_Payment_API_Documentation_${T(new Date,"yyyy-MM-dd")}.pdf`)}catch(l){console.error("Failed to generate API PDF:",l),alert("Failed to generate PDF documentation")}finally{N(!1)}},a=({title:l,code:r,section:i})=>e.jsxs("div",{className:"bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden my-4 shadow-xl",children:[e.jsxs("div",{className:"flex justify-between items-center px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/80",children:[e.jsx("span",{className:"text-xs font-mono font-semibold text-indigo-300",children:l}),e.jsx("button",{onClick:()=>E(r,i),className:"text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs bg-slate-700/50 hover:bg-slate-700 px-2.5 py-1 rounded-md",children:A===i?e.jsxs(e.Fragment,{children:[e.jsx(P,{className:"h-3.5 w-3.5 text-emerald-400"}),e.jsx("span",{className:"text-emerald-400 font-medium",children:"Copied!"})]}):e.jsxs(e.Fragment,{children:[e.jsx(L,{className:"h-3.5 w-3.5 text-slate-300"}),e.jsx("span",{children:"Copy"})]})})]}),e.jsx("div",{className:"p-4 overflow-x-auto",children:e.jsx("pre",{className:"text-xs font-mono text-emerald-400 leading-relaxed",children:e.jsx("code",{children:r})})})]}),x=({params:l})=>e.jsx("div",{className:"overflow-x-auto my-4 rounded-xl border border-slate-700/80 shadow-lg",children:e.jsxs("table",{className:"w-full text-left text-xs",children:[e.jsx("thead",{className:"bg-slate-900/90 text-slate-300 border-b border-slate-700",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-3 font-semibold text-indigo-300",children:"Parameter"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Type"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Required"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Description"})]})}),e.jsx("tbody",{className:"divide-y divide-slate-700/50 bg-slate-900/40",children:l.map((r,i)=>e.jsxs("tr",{className:"hover:bg-slate-800/40 transition-colors",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-white",children:r.name}),e.jsx("td",{className:"px-4 py-3 font-mono text-amber-300",children:r.type}),e.jsx("td",{className:"px-4 py-3 font-semibold",children:r.required?e.jsx("span",{className:"bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded text-[10px]",children:"REQUIRED"}):e.jsx("span",{className:"bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded text-[10px]",children:"OPTIONAL"})}),e.jsx("td",{className:"px-4 py-3 text-slate-300 leading-normal",children:r.desc})]},i))})]})});return e.jsxs("div",{id:"b2b-api-doc-container",className:"space-y-10 w-full text-slate-200 p-6 bg-slate-900 rounded-3xl",children:[e.jsxs("div",{className:"bg-slate-800/90 border border-slate-700 rounded-3xl p-8 shadow-2xl relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-40 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"}),e.jsxs("div",{className:"relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3",children:[e.jsx(w,{className:"h-3.5 w-3.5 text-indigo-400"})," API v1.0 Documentation"]}),e.jsx("h1",{className:"text-3xl font-black text-white tracking-tight mb-2",children:"B2B Bill Payment API Reference"}),e.jsx("p",{className:"text-slate-400 text-sm max-w-2xl leading-relaxed",children:"High-performance, RESTful API documentation for processing utility bill payments, electricity bills, credit cards, fastag, and mobile recharges with real-time status tracking and automated webhook updates."})]}),e.jsx("button",{"data-html2canvas-ignore":"true",onClick:D,disabled:j,className:"inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm shadow-xl border border-indigo-400/30 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0 self-start md:self-center",children:j?e.jsxs(e.Fragment,{children:[e.jsx(F,{size:"sm"}),e.jsx("span",{children:"Generating PDF..."})]}):e.jsxs(e.Fragment,{children:[e.jsx(q,{className:"h-4 w-4 text-white"}),e.jsx("span",{children:"Export PDF Doc"})]})})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3",children:[e.jsx(U,{className:"h-5 w-5 text-indigo-400"}),"1. Authentication & Headers"]}),e.jsxs("p",{className:"text-sm text-slate-300",children:["All API requests must be transmitted securely over ",e.jsx("strong",{children:"HTTPS"}),". Authentication is performed by supplying your unique API credentials in HTTP headers for every request."]}),e.jsxs("div",{className:"bg-slate-900/80 rounded-xl p-4 border border-slate-700/70 space-y-2",children:[e.jsx("span",{className:"text-xs text-slate-400 uppercase font-semibold tracking-wider block",children:"Base Endpoint URL"}),e.jsxs("code",{className:"block text-indigo-300 font-mono text-sm font-bold",children:[c,"/api/v1/b2b"]})]}),e.jsxs("div",{children:[e.jsx("h3",{className:"font-semibold text-white text-sm mb-3",children:"Mandatory HTTP Request Headers:"}),e.jsx("div",{className:"overflow-x-auto rounded-xl border border-slate-700/80",children:e.jsxs("table",{className:"w-full text-left text-xs",children:[e.jsx("thead",{className:"bg-slate-900/90 text-slate-300",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-3 font-semibold text-indigo-300",children:"Header Name"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Value Format"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Description"})]})}),e.jsxs("tbody",{className:"divide-y divide-slate-700/50 bg-slate-900/40",children:[e.jsxs("tr",{children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-emerald-400",children:"x-api-key"}),e.jsx("td",{className:"px-4 py-3 font-mono text-slate-300",children:"String (e.g. pub_live_...)"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Your B2B Public API Key issued from Agent Credentials portal."})]}),e.jsxs("tr",{children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-emerald-400",children:"x-secret-key"}),e.jsx("td",{className:"px-4 py-3 font-mono text-slate-300",children:"String (e.g. sec_live_...)"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Your B2B Secret Key used to authenticate your system."})]}),e.jsxs("tr",{children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-emerald-400",children:"Content-Type"}),e.jsx("td",{className:"px-4 py-3 font-mono text-slate-300",children:"application/json"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Required payload content type for POST requests."})]})]})]})})]}),e.jsxs("div",{className:"bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200 flex items-start gap-3",children:[e.jsx(B,{className:"h-5 w-5 text-amber-400 shrink-0 mt-0.5"}),e.jsxs("div",{children:[e.jsx("strong",{className:"block mb-1 text-amber-300",children:"IP Whitelisting Requirement:"}),"Requests originating from IP addresses that have not been explicitly whitelisted in your B2B Agent Settings will be rejected with an ",e.jsx("code",{children:"HTTP 401 Unauthorized"})," status."]})]})]}),e.jsxs("section",{className:"space-y-8",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2",children:[e.jsx(H,{className:"h-5 w-5 text-indigo-400"}),"2. API Endpoints Reference"]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/balance"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Agent Wallet Balance"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Retrieve real-time available wallet balance for your API account."}),e.jsx(a,{title:"Sample Response (200 OK)",section:"balance_res",code:`{
  "status": "success",
  "data": {
    "agent_id": "b2b_agent_9843",
    "b2b_login_id": "mahida_1212",
    "company_name": "Mahida Enterprise",
    "balance": 25450.75,
    "currency": "INR"
  }
}`}),e.jsx(x,{params:[{name:"status",type:"String",required:!0,desc:"Status of request execution ('success' or 'error')."},{name:"data.balance",type:"Number",required:!0,desc:"Current net available balance in Indian Rupees (₹)."},{name:"data.b2b_login_id",type:"String",required:!0,desc:"Your registered B2B Agent login identifier."}]})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/categories"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"List Biller Categories"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Fetch all supported BBPS biller categories (Electricity, Water, Credit Card, Fastag, Gas, etc.)."}),e.jsx(a,{title:"Sample Response (200 OK)",section:"cat_res",code:`{
  "status": "success",
  "data": [
    { "category_id": 1, "category_name": "Electricity" },
    { "category_id": 2, "category_name": "Mobile Postpaid" },
    { "category_id": 3, "category_name": "DTH" },
    { "category_id": 4, "category_name": "Water" },
    { "category_id": 5, "category_name": "Gas" },
    { "category_id": 6, "category_name": "Broadband" },
    { "category_id": 7, "category_name": "Credit Card" },
    { "category_id": 8, "category_name": "Fastag" }
  ]
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/billers"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Fetch Billers Directory"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Fetch supported billers with required customer input parameters and validation metadata."}),e.jsx(x,{params:[{name:"category_id",type:"Number",required:!1,desc:"Filter billers by category ID (e.g., 1 for Electricity)."},{name:"page",type:"Number",required:!1,desc:"Page index for pagination (Default: 1)."},{name:"limit",type:"Number",required:!1,desc:"Records per page (Max limit allowed: 500)."}]}),e.jsx(a,{title:"Sample Response (200 OK)",section:"billers_res",code:`{
  "status": "success",
  "data": [
    { 
      "biller_id": "DGVCL0000GUJ01", 
      "biller_name": "Dakshin Gujarat Vij Company Limited (DGVCL)",
      "category": "Electricity",
      "payment_modes": ["UPI", "Internet Banking", "Debit Card", "Credit Card"],
      "metadata": {
        "billerInputParams": {
          "paramInfo": [
            {
              "paramName": "Consumer Number",
              "dataType": "NUMERIC",
              "isOptional": "false",
              "minLength": 11,
              "maxLength": 11
            }
          ]
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total_records": 1250,
    "total_pages": 13
  }
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/fetch-bill"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Fetch Customer Bill Amount"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Query the biller's server in real time to fetch customer bill details, due date, customer name, and bill amount."}),e.jsx(x,{params:[{name:"billerId",type:"String",required:!0,desc:"Exact Biller ID retrieved from the /billers API."},{name:"mobile",type:"String",required:!0,desc:"10-digit customer mobile number."},{name:"customerParams",type:"Array of Objects",required:!0,desc:"Array of { name, value } objects matching the biller's required input parameters."}]}),e.jsx(a,{title:"Sample Request Body",section:"fetch_req_code",code:`{
  "billerId": "DGVCL0000GUJ01",
  "mobile": "9898971274",
  "customerParams": [
    { "name": "Consumer Number", "value": "12345678901" }
  ]
}`}),e.jsx(a,{title:"Sample Success Response (200 OK)",section:"fetch_res_code",code:`{
  "status": "success",
  "message": "Bill fetched successfully",
  "data": {
    "responseCode": "000",
    "responseReason": "Successful",
    "fetchRequestId": "FETCH_REQ_987654321",
    "billerResponse": {
      "customerName": "AJAY KALATHIYA",
      "amount": "1500.00",
      "billAmount": "150000",
      "dueDate": "2026-08-30",
      "billDate": "2026-08-10",
      "billNumber": "BLL-2026-08-9843",
      "billPeriod": "MONTHLY"
    },
    "additionalInfo": [
      { "infoName": "Minimum Payable Amount", "infoValue": "500.00" },
      { "infoName": "Total Due Amount", "infoValue": "1500.00" }
    ]
  }
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4 relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-36 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"}),e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3 relative z-10",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/pay-bill"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Execute Bill Payment"})]}),e.jsx("p",{className:"text-xs text-slate-300 relative z-10",children:"Execute the bill payment. Validates agent wallet balance, checks single-transaction maximum limit set by admin, applies dynamic fee charge multiplier (1x for < ₹50k, 2x for ₹50k–₹99.9k, 3x for ₹100k–₹149.9k, etc.), deducts funds, and processes payment via BBPS gateway."}),e.jsxs("div",{className:"relative z-10",children:[e.jsx("h4",{className:"font-semibold text-white text-xs mb-2",children:"Request Payload Parameters:"}),e.jsx(x,{params:[{name:"billerId",type:"String",required:!0,desc:"Target Biller ID (e.g., 'DGVCL0000GUJ01', 'SBIC00000NATDN')."},{name:"amount",type:"Number",required:!0,desc:"Amount to be paid in Rupees (e.g. 1500.00). Pass full bill amount or custom partial amount."},{name:"mobile",type:"String",required:!0,desc:"10-digit customer mobile number."},{name:"paymentMode",type:"String",required:!1,desc:"Payment mode: 'Cash', 'UPI', 'Internet Banking', 'Debit Card', 'Credit Card'. Default: 'Cash'. (Note: Electricity billers have 'Cash' disabled in BillAvenue, pass 'UPI' or 'Internet Banking')."},{name:"client_transaction_id",type:"String",required:!1,desc:"Your system's unique transaction/order ID for idempotency & tracing. If omitted, a BBPSU... ID is auto-generated."},{name:"customerParams",type:"Array of Objects",required:!0,desc:"Array of { name, value } matching required biller parameters."},{name:"customerPan",type:"String",required:!1,desc:"Customer 10-digit PAN Card (e.g. 'ABCDE1234F'). MANDATORY for Cash payments of ₹50,000 or above as per RBI guidelines."},{name:"billerResponseInfo",type:"Object",required:!1,desc:"Pass exact billerResponse object returned by /fetch-bill (customerName, billAmount, dueDate, billDate)."},{name:"additionalInfo",type:"Array of Objects",required:!1,desc:"Optional metadata array like [{ infoName: 'Remark', infoValue: 'Payment' }]."}]})]}),e.jsx(a,{title:"Complete Request Payload Example",section:"pay_req_full",code:`{
  "billerId": "DGVCL0000GUJ01",
  "amount": 1500.00,
  "mobile": "9898971274",
  "paymentMode": "UPI",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "customerParams": [
    { "name": "Consumer Number", "value": "12345678901" }
  ],
  "billerResponseInfo": {
    "customerName": "AJAY KALATHIYA",
    "billAmount": "150000",
    "billDate": "2026-08-10",
    "dueDate": "2026-08-30"
  },
  "additionalInfo": [
    { "infoName": "Remark", "infoValue": "Monthly Electricity Bill Payment" }
  ]
}`}),e.jsx(a,{title:"Success Response (200 OK - Payment Processed Successfully)",section:"pay_res_success",code:`{
  "status": "success",
  "message": "Bill Paid successfully",
  "transaction_id": "BBPSU1283118228",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "payment_status": "success",
  "charge_deducted": 10.00,
  "data": {
    "responseCode": "000",
    "responseReason": "Successful",
    "ExtBillPayResponse": {
      "txnRefId": "CC016226CBAF13851712",
      "approvalRefNumber": "AB1234567890",
      "responseCode": "000",
      "responseReason": "Successful",
      "RespCustomerName": "AJAY KALATHIYA",
      "RespAmount": "150000",
      "txnStatus": "SUCCESS"
    }
  }
}`}),e.jsx(a,{title:"Pending Response (200 OK - Pending Confirmation at Biller End)",section:"pay_res_pending",code:`{
  "status": "success",
  "message": "Transaction initiated, currently pending at biller",
  "transaction_id": "BBPSU9553347160",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "payment_status": "pending",
  "charge_deducted": 10.00,
  "data": {
    "responseCode": "001",
    "responseReason": "Pending at Biller",
    "ExtBillPayResponse": {
      "txnRefId": "CC016226CBAF13848716",
      "txnStatus": "PENDING"
    }
  }
}`}),e.jsx(a,{title:"Error Response (400 Bad Request - Insufficient Wallet Balance)",section:"pay_res_insufficient",code:`{
  "status": "error",
  "message": "Insufficient Wallet Balance. Required: ₹1510.00, Current Balance: ₹450.00"
}`}),e.jsx(a,{title:"Error Response (400 Bad Request - Disabled Payment Mode)",section:"pay_res_disabled_mode",code:`{
  "status": "error",
  "message": "Payment mode Cash is disabled for this biller. Please pass paymentMode as 'UPI' or 'Internet Banking'."
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4 relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-36 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none"}),e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3 relative z-10",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/status/:transaction_id"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Live Status"})]}),e.jsx("p",{className:"text-xs text-slate-300 leading-relaxed relative z-10",children:"Check real-time live transaction status. You can query using any of the following 4 identifiers in the URL parameter:"}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300 relative z-10",children:[e.jsxs("div",{className:"bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60",children:[e.jsx("span",{className:"text-indigo-400 font-semibold block text-[11px]",children:"1. API Transaction ID"}),e.jsx("code",{className:"text-emerald-400 text-[11px]",children:"BBPSU1283118228"})]}),e.jsxs("div",{className:"bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60",children:[e.jsx("span",{className:"text-indigo-400 font-semibold block text-[11px]",children:"2. Custom Client Order ID (Recommended)"}),e.jsx("code",{className:"text-amber-400 text-[11px]",children:"TXN_ORD_20260814_001"})]}),e.jsxs("div",{className:"bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60",children:[e.jsx("span",{className:"text-indigo-400 font-semibold block text-[11px]",children:"3. Fetch Request ID (From /fetch-bill)"}),e.jsx("code",{className:"text-cyan-400 text-[11px]",children:"8ngUMf5Jrb83C8KY0RhjOQjlaNK62510835"})]}),e.jsxs("div",{className:"bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60",children:[e.jsx("span",{className:"text-indigo-400 font-semibold block text-[11px]",children:"4. BillAvenue Reference ID"}),e.jsx("code",{className:"text-purple-400 text-[11px]",children:"CC016226CBAF13851712"})]})]}),e.jsxs("div",{className:"bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 space-y-2 relative z-10",children:[e.jsxs("div",{className:"flex items-center gap-2 text-indigo-300 font-bold text-xs",children:[e.jsx(B,{className:"h-4 w-4 text-indigo-400"}),e.jsx("span",{children:"Smart Status Tracking & Timeout Protection"})]}),e.jsxs("p",{className:"text-[11px] text-slate-300 leading-normal",children:["Even if a network timeout occurred during payment and no ",e.jsx("code",{children:"CC01"})," Reference ID was initially received by your client application, calling ",e.jsx("code",{children:"/status/:transaction_id"})," with your ",e.jsx("code",{children:"client_transaction_id"})," or ",e.jsx("code",{children:"fetchRequestId"})," queries BillAvenue live via ",e.jsx("code",{children:"REQUEST_ID"}),". If the payment succeeded upstream, it updates to ",e.jsx("code",{children:"success"})," and returns the new ",e.jsx("code",{children:"CC01"})," reference number. If the transaction was never processed by the gateway, it safely marks as ",e.jsx("code",{children:"failed"})," and performs an ",e.jsx("strong",{children:"Immediate Automatic Refund"})," back to your B2B Agent Wallet."]})]}),e.jsx(a,{title:"Sample Success Response (200 OK)",section:"status_res_code",code:`{
  "status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "CC016226CBAF13851712",
    "current_status": "success",
    "bbps_status": "SUCCESS",
    "polled_at": "2026-08-14T03:15:00.000Z"
  }
}`}),e.jsx(a,{title:"Sample Gateway Failure & Auto-Refund Response (200 OK - No CC01 Generated)",section:"status_res_auto_refund",code:`{
  "status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "N/A",
    "current_status": "failed",
    "bbps_status": "FAILED_GATEWAY_ERROR",
    "message": "Bill payment failed to connect to biller gateway (No CC01 Ref generated). Agent wallet has been automatically refunded.",
    "refund_status": "REFUNDED",
    "refunded_amount": 1500.00,
    "polled_at": "2026-08-14T03:15:00.000Z"
  }
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/admin-bank-accounts"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Get Admin Bank Accounts List"})]}),e.jsx("p",{className:"text-xs text-slate-300 leading-relaxed",children:"Retrieve active company bank accounts configured by B2B Admin. External portals (Zenot Portal) can render these accounts in a dropdown list for the agent to select their deposit destination."}),e.jsx(a,{title:"Sample Response (200 OK)",section:"admin_banks_res",code:`{
  "status": "success",
  "data": [
    {
      "bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567",
      "bank_name": "ICICI Bank",
      "account_name": "Rajwadi Enterprises Pvt Ltd",
      "account_number": "50200012345678",
      "ifsc_code": "ICIC0005020",
      "branch_name": "Rajkot Main Branch",
      "upi_id": "rajwadi@icici"
    }
  ]
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/fund-request"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Submit B2B Fund Request"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed",children:["Submit a wallet fund request electronically from third-party client portals (e.g. Zenot Portal). Your request will be queued in ",e.jsx("code",{children:"pending"})," status for B2B Admin approval."]}),e.jsx(a,{title:"Sample Request Body",section:"fund_req_body",code:`{
  "amount": 50000,
  "utr_number": "UTR9876543210",
  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567",
  "proof_url": "https://example.com/payment_receipt.jpg"
}`}),e.jsx(a,{title:"Sample Success Response (201 Created)",section:"fund_req_res",code:`{
  "status": "success",
  "message": "Fund request submitted successfully and pending approval",
  "data": {
    "request_id": "88a912bc-9430-4e2b-8a2b-103bc4a9192b",
    "amount": 50000,
    "utr_number": "UTR9876543210",
    "status": "pending",
    "submitted_at": "2026-08-15T00:33:00.000Z"
  }
}`}),e.jsx(x,{params:[{name:"amount",type:"Number",required:!0,desc:"Amount in INR (₹) requested to add to your B2B wallet."},{name:"utr_number",type:"String",required:!0,desc:"Unique Bank Transaction Reference / UTR Number (also accepts 'transaction_ref_no')."},{name:"admin_bank_account_id",type:"String",required:!1,desc:"Optional ID of the Admin Bank Account where money was deposited (obtained from GET /admin-bank-accounts)."},{name:"proof_url",type:"String",required:!1,desc:"Optional URL linking to payment receipt or transaction screenshot."}]})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/fund-request/status/:request_id"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Fund Request Status"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed",children:["Check the live approval status (",e.jsx("code",{children:"pending"}),", ",e.jsx("code",{children:"approved"}),", ",e.jsx("code",{children:"rejected"}),") of a submitted fund request."]}),e.jsx(a,{title:"Sample Response (200 OK)",section:"fund_req_status_res",code:`{
  "status": "success",
  "data": {
    "request_id": "88a912bc-9430-4e2b-8a2b-103bc4a9192b",
    "amount": 50000,
    "utr_number": "UTR9876543210",
    "status": "approved",
    "proof_url": null,
    "created_at": "2026-08-15T00:33:00.000Z",
    "updated_at": "2026-08-15T00:35:00.000Z"
  }
}`})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3",children:[e.jsx(M,{className:"h-5 w-5 text-indigo-400"}),"3. Code Integration Examples"]}),e.jsxs("div",{className:"flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/70 w-fit",children:[e.jsx("button",{onClick:()=>p("curl"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${o==="curl"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"cURL"}),e.jsx("button",{onClick:()=>p("nodejs"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${o==="nodejs"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"Node.js (Axios)"}),e.jsx("button",{onClick:()=>p("python"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${o==="python"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"Python (Requests)"}),e.jsx("button",{onClick:()=>p("php"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${o==="php"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"PHP (cURL)"})]}),o==="curl"&&e.jsx(a,{title:"cURL Request Example (/pay-bill)",section:"code_curl",code:`curl -X POST "${c}/api/v1/b2b/pay-bill" \\
  -H "x-api-key: pub_live_your_key_here" \\
  -H "x-secret-key: sec_live_your_secret_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "billerId": "DGVCL0000GUJ01",
    "amount": 1500.00,
    "mobile": "9898971274",
    "paymentMode": "UPI",
    "client_transaction_id": "TXN_ORD_98431",
    "customerParams": [
      { "name": "Consumer Number", "value": "12345678901" }
    ]
  }'`}),o==="nodejs"&&e.jsx(a,{title:"Node.js Integration Example (Axios)",section:"code_nodejs",code:`const axios = require('axios');

async function payBill() {
  try {
    const response = await axios.post('${c}/api/v1/b2b/pay-bill', {
      billerId: 'DGVCL0000GUJ01',
      amount: 1500.00,
      mobile: '9898971274',
      paymentMode: 'UPI',
      client_transaction_id: 'TXN_ORD_98431',
      customerParams: [
        { name: 'Consumer Number', value: '12345678901' }
      ]
    }, {
      headers: {
        'x-api-key': 'pub_live_your_key_here',
        'x-secret-key': 'sec_live_your_secret_here',
        'Content-Type': 'application/json'
      }
    });

    console.log('Payment Status:', response.data.payment_status);
    console.log('Txn Ref ID:', response.data.data?.ExtBillPayResponse?.txnRefId);
  } catch (error) {
    console.error('Payment Error:', error.response?.data || error.message);
  }
}

payBill();`}),o==="python"&&e.jsx(a,{title:"Python Integration Example (Requests)",section:"code_python",code:`import requests

url = "${c}/api/v1/b2b/pay-bill"
headers = {
    "x-api-key": "pub_live_your_key_here",
    "x-secret-key": "sec_live_your_secret_here",
    "Content-Type": "application/json"
}

payload = {
    "billerId": "DGVCL0000GUJ01",
    "amount": 1500.00,
    "mobile": "9898971274",
    "paymentMode": "UPI",
    "client_transaction_id": "TXN_ORD_98431",
    "customerParams": [
        {"name": "Consumer Number", "value": "12345678901"}
    ]
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print("Payment Result:", data)`}),o==="php"&&e.jsx(a,{title:"PHP Integration Example (cURL)",section:"code_php",code:`<?php
$ch = curl_init("${c}/api/v1/b2b/pay-bill");

$payload = json_encode([
    "billerId" => "DGVCL0000GUJ01",
    "amount" => 1500.00,
    "mobile" => "9898971274",
    "paymentMode" => "UPI",
    "client_transaction_id" => "TXN_ORD_98431",
    "customerParams" => [
        ["name" => "Consumer Number", "value" => "12345678901"]
    ]
]);

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'x-api-key: pub_live_your_key_here',
    'x-secret-key: sec_live_your_secret_here',
    'Content-Type: application/json'
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
var_dump($result);
?>`})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3",children:[e.jsx(w,{className:"h-5 w-5 text-indigo-400"}),"4. Webhook Notifications (Asynchronous Callbacks)"]}),e.jsxs("p",{className:"text-xs text-slate-300",children:["When a transaction is initiated and returns a ",e.jsx("code",{children:"pending"})," status, our background engine continuously polls BBPS. Once confirmed by the biller as ",e.jsx("strong",{children:"Success"})," or ",e.jsx("strong",{children:"Failed"}),", a HTTP POST callback is dispatched to your configured Webhook URL."]}),e.jsx(a,{title:"Webhook Payload Example (Transaction Success)",section:"webhook_success_payload",code:`{
  "event": "PAYMENT_STATUS_UPDATE",
  "transaction_id": "BBPSU9553347160",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "bbps_txn_ref_id": "CC016226CBAF13848716",
  "status": "success",
  "amount": 1500.00,
  "charge_deducted": 10.00,
  "bbps_status": "SUCCESS",
  "refunded": false,
  "timestamp": "2026-08-14T02:25:00.000Z"
}`}),e.jsx(a,{title:"Webhook Payload Example (Transaction Failed & Instant Refunded)",section:"webhook_failed_payload",code:`{
  "event": "PAYMENT_STATUS_UPDATE",
  "transaction_id": "BBPSU9553347160",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "bbps_txn_ref_id": "CC016226CBAF13848716",
  "status": "failed",
  "amount": 1500.00,
  "charge_deducted": 0,
  "bbps_status": "FAILED",
  "refunded": true,
  "refund_amount": 1510.00,
  "timestamp": "2026-08-14T02:25:00.000Z"
}`}),e.jsxs("div",{className:"bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-200 flex items-start gap-3",children:[e.jsx(P,{className:"h-5 w-5 text-emerald-400 shrink-0 mt-0.5"}),e.jsxs("div",{children:[e.jsx("strong",{className:"block mb-1 text-emerald-300",children:"Automated Wallet Refund Guarantee:"}),"If a pending transaction is subsequently marked as ",e.jsx("code",{children:"FAILED"})," by BBPS, the system automatically refunds 100% of the principal bill amount AND charge fee back to your agent wallet instantly."]})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3",children:[e.jsx(O,{className:"h-5 w-5 text-rose-400"}),"5. Error Codes & Troubleshooting Matrix"]}),e.jsx("div",{className:"overflow-x-auto rounded-xl border border-slate-700/80",children:e.jsxs("table",{className:"w-full text-left text-xs",children:[e.jsx("thead",{className:"bg-slate-900/90 text-slate-300",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-3 font-semibold text-rose-400",children:"HTTP Status"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-indigo-300",children:"Response Status"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Error Description & Root Cause"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Recommended Action"})]})}),e.jsxs("tbody",{className:"divide-y divide-slate-700/50 bg-slate-900/40",children:[e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"400 Bad Request"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Insufficient Wallet Balance to cover bill amount + fee."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Load funds into your B2B Agent wallet and retry."})]}),e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"400 Bad Request"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Payment mode 'Cash' disabled by biller."}),e.jsxs("td",{className:"px-4 py-3 text-slate-300",children:["Pass ",e.jsx("code",{children:'paymentMode: "UPI"'})," or ",e.jsx("code",{children:'"Internet Banking"'}),"."]})]}),e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-amber-400",children:"401 Unauthorized"}),e.jsx("td",{className:"px-4 py-3 font-mono text-amber-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Invalid API/Secret Keys or IP address not whitelisted."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Verify credentials and whitelist server IP in B2B settings."})]}),e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-amber-400",children:"429 Rate Limit"}),e.jsx("td",{className:"px-4 py-3 font-mono text-amber-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Daily limit of 50 sync requests reached for /billers endpoint."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Cache biller directory locally and sync once daily."})]}),e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"500 Server Error"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Upstream Biller or Gateway Timeout / System Down."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Wallet is auto-refunded. Retry after a few minutes."})]})]})]})})]})]})}export{Q as default};
