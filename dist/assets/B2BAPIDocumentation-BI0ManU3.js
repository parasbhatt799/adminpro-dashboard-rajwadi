const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/jspdf.es.min-D3UxnJJa.js","assets/index-CMd0y-t4.js","assets/index-D5w_P30t.css","assets/typeof-QjJsDpFa.js"])))=>i.map(i=>d[i]);
import{c as Y,l as le,r as m,j as e,d as G,S as oe,C as A,s as ie,_ as H,f as M}from"./index-CMd0y-t4.js";import{C as W}from"./circle-alert-BqfwMbUw.js";import{L as de}from"./landmark-IjVrg8ky.js";import{Z as K}from"./zap-CYABJqrG.js";import{E as ce}from"./eye-DNuCaU9q.js";import{A as z}from"./activity-DIrQyY0f.js";import{D as ue}from"./download-f5xev3HF.js";import{K as me}from"./key-Nx1Nwqxq.js";import{S as pe}from"./shield-alert-Cf7OK8uA.js";import{C as xe}from"./copy-BqeAqDKu.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const be=[["path",{d:"m16 18 6-6-6-6",key:"eg8j8"}],["path",{d:"m8 6-6 6 6 6",key:"ppft3o"}]],he=Y("code",be);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ye=[["rect",{width:"20",height:"8",x:"2",y:"2",rx:"2",ry:"2",key:"ngkwjq"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",ry:"2",key:"iecqi9"}],["line",{x1:"6",x2:"6.01",y1:"6",y2:"6",key:"16zg32"}],["line",{x1:"6",x2:"6.01",y1:"18",y2:"18",key:"nzw8ys"}]],fe=Y("server",ye);function Re(){const[v,w]=le(),[V,q]=m.useState(null),[d,N]=m.useState("curl"),[F,D]=m.useState(!1),[J,T]=m.useState(!0),[b,X]=m.useState(!1),[_e,Z]=m.useState("B2B Partner"),[h,E]=m.useState(!0),[y,O]=m.useState(!1),[c,x]=m.useState("bbps"),Q=(n,o)=>{navigator.clipboard.writeText(n),q(o),setTimeout(()=>q(null),2e3)},p=typeof window<"u"?window.location.origin:"https://api.usepay.in";m.useEffect(()=>{const n=typeof window<"u"&&window.location.pathname.startsWith("/b2b/admin");X(n);const o=typeof window<"u"?localStorage.getItem("b2bAgentId"):null,u=v.get("service");n?(E(!0),O(!0),x(u==="payout"?"payout":"bbps"),T(!1)):o?(async()=>{try{const{data:t,error:_}=await ie.from("b2b_api_credentials").select("first_name, last_name, b2b_login_id, is_bbps_enabled, is_payout_enabled").eq("id",o).maybeSingle();if(_)console.error("Error fetching agent API credentials:",_);else if(t){const i=[t.first_name,t.last_name].filter(Boolean).join(" ").trim()||t.b2b_login_id||"B2B Partner";Z(i);const l=t.is_bbps_enabled!==!1,s=!!t.is_payout_enabled;E(l),O(s),s&&!l?(x("payout"),w({service:"payout"},{replace:!0})):l&&!s?(x("bbps"),w({service:"bbps"},{replace:!0})):l&&s&&x(u==="payout"?"payout":"bbps")}}catch(t){console.error("Error fetching agent API credentials:",t)}finally{T(!1)}})():T(!1)},[]),m.useEffect(()=>{const n=v.get("service");n==="payout"&&(y||b)?x("payout"):n==="bbps"&&(h||b)&&x("bbps")},[v,h,y,b]);const U=n=>{x(n),w({service:n},{replace:!0})},ee=h&&y||b,te=async()=>{D(!0);try{const n=await H(()=>import("./jspdf.es.min-D3UxnJJa.js"),__vite__mapDeps([0,1,2,3])),o=n.jsPDF||n.default,u=await H(()=>import("./jspdf.plugin.autotable-Cz_YoQo_.js"),[]),P=u.default||u.autoTable||u,t=new o({orientation:"p",unit:"mm",format:"a4"}),_=c==="payout"?"B2B Instant Payout API Reference":"B2B Bill Payment API Reference",B=g=>{t.setFillColor(15,23,42),t.rect(0,0,210,25,"F"),t.setTextColor(255,255,255),t.setFont("helvetica","bold"),t.setFontSize(14),t.text(g,14,12),t.setFontSize(8),t.setFont("helvetica","normal"),t.setTextColor(148,163,184),t.text(`Base Endpoint: ${p}/api/v1/b2b  |  Generated: ${M(new Date,"dd MMM yyyy, hh:mm a")}`,14,19)},i=(g,R)=>g+R>272?(t.addPage(),B(`${_} (Contd.)`),32):g,l=(g,R,ne)=>{const L=R.split(`
`),k=8+L.length*3.8;let j=i(ne,k);t.setFillColor(30,41,59),t.rect(14,j,182,6,"F"),t.setFont("helvetica","bold"),t.setFontSize(8),t.setTextColor(165,180,252),t.text(g,18,j+4.2),t.setFillColor(15,23,42),t.rect(14,j+6,182,k-6,"F"),t.setFont("courier","normal"),t.setFontSize(7.5),t.setTextColor(52,211,153);let $=j+10.5;return L.forEach(I=>{t.text(I.length>95?I.substring(0,95)+"...":I,18,$),$+=3.8}),j+k+6};B(_);let s=32;t.setFont("helvetica","bold"),t.setFontSize(11),t.setTextColor(30,41,59),t.text("1. Authentication & Mandatory HTTP Headers",14,s),s+=4,P(t,{startY:s,head:[["Header Name","Value Format","Description"]],body:[["x-api-key","String (pub_live_...)","Public API key issued from Agent Credentials portal"],["x-secret-key","String (sec_live_...)","Secret API key used to authenticate your system"],["Content-Type","application/json","Required payload content type for POST requests"]],theme:"grid",headStyles:{fillColor:[79,70,229],textColor:[255,255,255],fontStyle:"bold",fontSize:8.5},bodyStyles:{fontSize:8},margin:{left:14,right:14}}),s=t.lastAutoTable.finalY+8,t.setFont("helvetica","bold"),t.setFontSize(11),t.setTextColor(30,41,59),t.text("2. Enabled API Endpoints Overview",14,s),s+=4;const C=[["GET","/balance",`Fetch current available agent ${c==="payout"?"Payout":"BBPS"} wallet balance in Rupees`]];c==="bbps"?C.push(["GET","/categories","Fetch supported biller categories (Electricity, Fastag, Water, etc.)"],["GET","/billers","Fetch billers list and required customer input parameters"],["POST","/fetch-bill","Fetch customer bill amount, due date, and biller details"],["POST","/pay-bill","Process bill payment and deduct funds from agent BBPS wallet"],["GET","/status/:transaction_id","Check real-time live status & auto-refund of a bill payment"],["GET","/admin-bank-accounts","Fetch company bank accounts for wallet fund top-up"],["POST","/fund-request",'Submit electronic fund request (wallet_type: "bbps")'],["GET","/fund-request/status/:request_id","Check real-time approval status of submitted fund request"]):C.push(["POST","/payout/transfer","Execute 24x7 instant bank transfer via IMPS or NEFT"],["GET","/payout/status/:order_id","Check real-time live payout transfer status & bank UTR"],["GET","/admin-bank-accounts","Fetch company bank accounts for payout wallet top-up"],["POST","/fund-request",'Submit electronic fund request (wallet_type: "payout")'],["GET","/fund-request/status/:request_id","Check real-time approval status of submitted fund request"]),P(t,{startY:s,head:[["Method","Endpoint Path","Description"]],body:C,theme:"grid",headStyles:{fillColor:c==="payout"?[147,51,234]:[16,185,129],textColor:[255,255,255],fontStyle:"bold",fontSize:8.5},bodyStyles:{fontSize:8},margin:{left:14,right:14}}),s=t.lastAutoTable.finalY+10,s=i(s,45),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.1 GET /balance - Check Agent Wallet Balance",14,s),s+=4,s=l("Sample Response (200 OK)",`{
  "status": "success",
  "data": {
    "balance": 25450.75,
    "bbps_wallet_balance": 15450.75,
    "payout_wallet_balance": 10000.00,
    "is_bbps_enabled": ${h},
    "is_payout_enabled": ${y}
  }
}`,s),c==="bbps"?(s=i(s,65),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.2 GET /categories - Fetch Biller Categories",14,s),s+=4,s=l("Sample Response (200 OK)",`{
  "status": "success",
  "data": [
    { "category_name": "Electricity", "code": "ELECTRICITY" },
    { "category_name": "Fastag", "code": "FASTAG" },
    { "category_name": "Credit Card", "code": "CREDIT_CARD" }
  ]
}`,s),s=i(s,90),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.3 POST /fetch-bill - Fetch Customer Bill Details",14,s),s+=4,s=l("Sample Request Body",`{
  "billerId": "DGVCL0000GUJ01",
  "mobile": "9898971274",
  "customerParams": [{ "name": "Consumer Number", "value": "12345678901" }]
}`,s),s=l("Sample Success Response (200 OK)",`{
  "status": "success",
  "data": {
    "responseCode": "000",
    "billerResponse": { "customerName": "AJAY KALATHIYA", "amount": "1500.00", "dueDate": "2026-08-30" }
  }
}`,s),s=i(s,110),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.4 POST /pay-bill - Execute Bill Payment",14,s),s+=4,s=l("Sample Request Body",`{
  "billerId": "DGVCL0000GUJ01",
  "amount": 1500.00,
  "mobile": "9898971274",
  "paymentMode": "UPI",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "customerParams": [{ "name": "Consumer Number", "value": "12345678901" }]
}`,s),s=l("Sample Success Response (200 OK)",`{
  "status": "success",
  "message": "Bill Paid successfully",
  "transaction_id": "BBPSU1283118228",
  "payment_status": "success",
  "charge_deducted": 10.00
}`,s),s=i(s,75),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(16,185,129),t.text("2.5 GET /status/:transaction_id - Live Status & Auto-Refund",14,s),s+=4,s=l("Sample Status Response (200 OK)",`{
  "status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "CC016226CBAF13851712",
    "current_status": "success",
    "bbps_status": "SUCCESS"
  }
}`,s),s=i(s,85),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.6 POST /fund-request - Submit BBPS Wallet Top-up",14,s),s+=4,s=l("Sample Request Body",`{
  "amount": 50000,
  "utr_number": "UTR9876543210",
  "wallet_type": "bbps",
  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567"
}`,s)):(s=i(s,110),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(147,51,234),t.text("2.2 POST /payout/transfer - 24x7 Instant Bank Transfer",14,s),s+=4,s=l("Sample Request Body",`{
  "amount": 2500.00,
  "account_number": "91234567890123",
  "ifsc_code": "HDFC0001234",
  "beneficiary_name": "Ramesh Kumar",
  "transfer_mode": "IMPS",
  "client_order_id": "ORD_PAYOUT_1001"
}`,s),s=l("Sample Success Response (200 OK)",`{
  "status": "success",
  "message": "Payout transfer completed successfully",
  "data": {
    "order_id": "B2BPO1727443912001",
    "client_order_id": "ORD_PAYOUT_1001",
    "utr": "426812831122",
    "amount": 2500.00,
    "fee": 25.00,
    "total_deducted": 2525.00,
    "status": "success"
  }
}`,s),s=i(s,75),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(147,51,234),t.text("2.3 GET /payout/status/:order_id - Live Payout Status & UTR",14,s),s+=4,s=l("Sample Status Response (200 OK)",`{
  "status": "success",
  "data": {
    "order_id": "B2BPO1727443912001",
    "client_order_id": "ORD_PAYOUT_1001",
    "utr": "426812831122",
    "beneficiary_name": "Ramesh Kumar",
    "status": "success"
  }
}`,s),s=i(s,85),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(147,51,234),t.text("2.4 POST /fund-request - Submit Payout Wallet Top-up",14,s),s+=4,s=l("Sample Request Body",`{
  "amount": 50000,
  "utr_number": "UTR9876543210",
  "wallet_type": "payout",
  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567"
}`,s)),s=i(s,80),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(225,29,72),t.text("3. Error Codes & Troubleshooting Matrix",14,s),s+=4;const S=[["200 OK","success","Request processed successfully","Parse response data payload"],["400 Bad Request","error",`Insufficient ${c==="payout"?"Payout":"BBPS"} Wallet Balance`,`Submit /fund-request with wallet_type: "${c}"`]];c==="payout"?S.push(["400 Bad Request","failed","Invalid IFSC / Beneficiary Account Inactive","Verify bank details. Auto-refunded to payout wallet"]):S.push(["400 Bad Request","error","Payment mode Cash disabled by biller",'Pass paymentMode: "UPI" or "Internet Banking"']),S.push(["401 Unauthorized","error","Invalid API Keys or IP Not Whitelisted","Whitelist server IP in Settings"],["429 Too Many Requests","error","Rate limit exceeded","Implement caching & rate-limiting"],["500 Server Error","error","Upstream Bank/Gateway Timeout","Wallet auto-refunded. Query status"]),P(t,{startY:s,head:[["HTTP Code","Status","Description","Resolution Action"]],body:S,theme:"grid",headStyles:{fillColor:[225,29,72],textColor:[255,255,255],fontStyle:"bold",fontSize:8},bodyStyles:{fontSize:7.5},margin:{left:14,right:14}});const re=_.replace(/[^a-zA-Z0-9]/g,"_");t.save(`${re}_${M(new Date,"yyyy-MM-dd")}.pdf`)}catch(n){console.error("Failed to generate API PDF:",n),alert("Failed to generate PDF documentation")}finally{D(!1)}},r=({title:n,code:o,section:u})=>e.jsxs("div",{className:"bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden my-4 shadow-xl",children:[e.jsxs("div",{className:"flex justify-between items-center px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/80",children:[e.jsx("span",{className:"text-xs font-mono font-semibold text-indigo-300",children:n}),e.jsx("button",{onClick:()=>Q(o,u),className:"text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs bg-slate-700/50 hover:bg-slate-700 px-2.5 py-1 rounded-md",children:V===u?e.jsxs(e.Fragment,{children:[e.jsx(A,{className:"h-3.5 w-3.5 text-emerald-400"}),e.jsx("span",{className:"text-emerald-400 font-medium",children:"Copied!"})]}):e.jsxs(e.Fragment,{children:[e.jsx(xe,{className:"h-3.5 w-3.5 text-slate-300"}),e.jsx("span",{children:"Copy"})]})})]}),e.jsx("div",{className:"p-4 overflow-x-auto",children:e.jsx("pre",{className:"text-xs font-mono text-emerald-400 leading-relaxed",children:e.jsx("code",{children:o})})})]}),f=({params:n})=>e.jsx("div",{className:"overflow-x-auto my-4 rounded-xl border border-slate-700/80 shadow-lg",children:e.jsxs("table",{className:"w-full text-left text-xs",children:[e.jsx("thead",{className:"bg-slate-900/90 text-slate-300 border-b border-slate-700",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-3 font-semibold text-indigo-300",children:"Parameter"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Type"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Required"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Description"})]})}),e.jsx("tbody",{className:"divide-y divide-slate-700/50 bg-slate-900/40",children:n.map((o,u)=>e.jsxs("tr",{className:"hover:bg-slate-800/40 transition-colors",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-white",children:o.name}),e.jsx("td",{className:"px-4 py-3 font-mono text-amber-300",children:o.type}),e.jsx("td",{className:"px-4 py-3 font-semibold",children:o.required?e.jsx("span",{className:"bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded text-[10px]",children:"REQUIRED"}):e.jsx("span",{className:"bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded text-[10px]",children:"OPTIONAL"})}),e.jsx("td",{className:"px-4 py-3 text-slate-300 leading-normal",children:o.desc})]},u))})]})});if(J)return e.jsxs("div",{className:"flex flex-col items-center justify-center min-h-[400px] text-slate-300 gap-3",children:[e.jsx(G,{size:"lg"}),e.jsx("p",{className:"text-sm",children:"Loading API Documentation and service permissions..."})]});if(!h&&!y&&!b)return e.jsx("div",{className:"bg-slate-900 rounded-3xl p-8 border border-slate-800 text-center space-y-4",children:e.jsxs("div",{className:"p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-md mx-auto",children:[e.jsx(W,{className:"h-8 w-8 text-rose-400 mx-auto mb-2"}),e.jsx("h2",{className:"text-lg font-bold text-white",children:"No Services Currently Active"}),e.jsx("p",{className:"text-xs text-slate-400 mt-2",children:"Neither Bill Payment (BBPS) nor Instant Payout API is currently enabled for your account. Please contact your B2B administrator to activate services."})]})});const a=c==="payout",se=a?"B2B Instant Payout API Reference":"B2B Bill Payment API Reference",ae=a?"24x7 Real-time automated bank account transfer API via IMPS / NEFT with dedicated payout wallet, live status checking, and automatic refunds on banking failure.":"High-performance, RESTful API documentation for processing utility bill payments, electricity bills, credit cards, fastag, and mobile recharges with real-time status tracking and automated webhook updates.";return e.jsxs("div",{id:"b2b-api-doc-container",className:"space-y-8 w-full text-slate-200 p-4 md:p-6 bg-slate-900 rounded-3xl",children:[ee&&e.jsxs("div",{className:"bg-slate-800/90 border border-slate-700/80 rounded-2xl p-2.5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3",children:[e.jsxs("div",{className:"flex items-center gap-2 w-full sm:w-auto",children:[e.jsxs("button",{type:"button",onClick:()=>U("bbps"),className:`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${c==="bbps"?"bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/30":"text-slate-400 hover:text-white hover:bg-slate-700/60"}`,children:[e.jsx(de,{className:"h-4 w-4"}),"Bill Payment (BBPS) API"]}),e.jsxs("button",{type:"button",onClick:()=>U("payout"),className:`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all cursor-pointer ${c==="payout"?"bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/30":"text-slate-400 hover:text-white hover:bg-slate-700/60"}`,children:[e.jsx(K,{className:"h-4 w-4"}),"Instant Payout API"]})]}),e.jsxs("div",{className:"text-xs text-slate-400 flex items-center gap-2 self-end sm:self-center",children:[e.jsx(ce,{className:"h-4 w-4 text-indigo-400"}),e.jsxs("span",{children:["Active Documentation: ",e.jsx("strong",{className:a?"text-purple-400":"text-emerald-400",children:a?"Instant Payout API":"Bill Payment (BBPS)"})]})]})]}),e.jsxs("div",{className:`border rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden transition-all ${a?"bg-slate-800/90 border-purple-500/30":"bg-slate-800/90 border-slate-700"}`,children:[e.jsx("div",{className:`absolute top-0 right-0 p-40 blur-[120px] rounded-full pointer-events-none ${a?"bg-purple-600/15":"bg-emerald-600/10"}`}),e.jsxs("div",{className:"relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2 mb-3",children:[e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider",children:[e.jsx(z,{className:"h-3.5 w-3.5 text-indigo-400"})," API v1.0 Live"]}),b&&e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold",children:[e.jsx(oe,{className:"h-3.5 w-3.5 text-amber-400"})," Admin Mode"]}),a?e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold",children:[e.jsx(K,{className:"h-3.5 w-3.5 text-purple-400"})," Service: Instant Payout API"]}):e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold",children:[e.jsx(A,{className:"h-3.5 w-3.5 text-emerald-400"})," Service: Utility Bill Payment (BBPS)"]})]}),e.jsx("h1",{className:"text-2xl md:text-3xl font-black text-white tracking-tight mb-2",children:se}),e.jsx("p",{className:"text-slate-400 text-xs md:text-sm max-w-2xl leading-relaxed",children:ae})]}),e.jsx("div",{className:"flex flex-col sm:flex-row gap-3 shrink-0 self-start md:self-center",children:e.jsx("button",{"data-html2canvas-ignore":"true",onClick:te,disabled:F,className:`inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl text-white font-bold text-xs md:text-sm shadow-xl border transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 ${a?"bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 border-purple-400/30":"bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 border-indigo-400/30"}`,children:F?e.jsxs(e.Fragment,{children:[e.jsx(G,{size:"sm"}),e.jsx("span",{children:"Generating PDF..."})]}):e.jsxs(e.Fragment,{children:[e.jsx(ue,{className:"h-4 w-4 text-white"}),e.jsxs("span",{children:["Export ",a?"Payout":"BBPS"," PDF Doc"]})]})})})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3",children:[e.jsx(me,{className:"h-5 w-5 text-indigo-400"}),"1. Authentication & Mandatory HTTP Headers"]}),e.jsxs("p",{className:"text-sm text-slate-300",children:["All API requests must be transmitted securely over ",e.jsx("strong",{children:"HTTPS"}),". Authentication is performed by supplying your unique API credentials in HTTP headers for every request."]}),e.jsxs("div",{className:"bg-slate-900/80 rounded-xl p-4 border border-slate-700/70 space-y-2",children:[e.jsx("span",{className:"text-xs text-slate-400 uppercase font-semibold tracking-wider block",children:"Base Endpoint URL"}),e.jsxs("code",{className:"block text-indigo-300 font-mono text-sm font-bold",children:[p,"/api/v1/b2b"]})]}),e.jsxs("div",{children:[e.jsx("h3",{className:"font-semibold text-white text-sm mb-3",children:"Mandatory HTTP Request Headers:"}),e.jsx("div",{className:"overflow-x-auto rounded-xl border border-slate-700/80",children:e.jsxs("table",{className:"w-full text-left text-xs",children:[e.jsx("thead",{className:"bg-slate-900/90 text-slate-300",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-3 font-semibold text-indigo-300",children:"Header Name"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Value Format"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Description"})]})}),e.jsxs("tbody",{className:"divide-y divide-slate-700/50 bg-slate-900/40",children:[e.jsxs("tr",{children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-emerald-400",children:"x-api-key"}),e.jsx("td",{className:"px-4 py-3 font-mono text-slate-300",children:"String (e.g. pub_live_...)"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Your B2B Public API Key issued from Agent Credentials portal."})]}),e.jsxs("tr",{children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-emerald-400",children:"x-secret-key"}),e.jsx("td",{className:"px-4 py-3 font-mono text-slate-300",children:"String (e.g. sec_live_...)"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Your B2B Secret Key used to authenticate your system."})]}),e.jsxs("tr",{children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-emerald-400",children:"Content-Type"}),e.jsx("td",{className:"px-4 py-3 font-mono text-slate-300",children:"application/json"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Required payload content type for POST requests."})]})]})]})})]}),e.jsxs("div",{className:"bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200 flex items-start gap-3",children:[e.jsx(pe,{className:"h-5 w-5 text-amber-400 shrink-0 mt-0.5"}),e.jsxs("div",{children:[e.jsx("strong",{className:"block mb-1 text-amber-300",children:"IP Whitelisting Requirement:"}),"Requests originating from IP addresses that have not been explicitly whitelisted in your B2B Agent Settings will be rejected with an ",e.jsx("code",{children:"HTTP 401 Unauthorized"})," status."]})]})]}),e.jsxs("section",{className:"space-y-8",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2",children:[e.jsx(fe,{className:"h-5 w-5 text-indigo-400"}),"2. API Endpoints Reference"]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/balance"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Agent Wallet Balances"})]}),e.jsxs("p",{className:"text-xs text-slate-300",children:["Retrieve real-time available wallet balance for your ",a?"dedicated Payout Wallet":"BBPS Utility Bill Payment Wallet","."]}),e.jsx(r,{title:"Sample Response (200 OK)",section:"balance_res",code:`{
  "status": "success",
  "data": {
    "balance": 25450.75,
    "bbps_wallet_balance": 15450.75,
    "payout_wallet_balance": 10000.00,
    "usable_bbps_balance": 15450.75,
    "fixed_deposit_amount": 0,
    "is_bbps_enabled": ${h},
    "is_payout_enabled": ${y}
  }
}`}),e.jsx(f,{params:[{name:"status",type:"String",required:!0,desc:"Status of request execution ('success' or 'error')."},{name:"data.balance",type:"Number",required:!0,desc:"Legacy / default BBPS wallet balance (₹)."},{name:"data.bbps_wallet_balance",type:"Number",required:!0,desc:"Dedicated wallet balance for utility bill payments (₹)."},{name:"data.payout_wallet_balance",type:"Number",required:!0,desc:"Dedicated wallet balance for 24x7 instant bank payouts (₹)."},{name:"data.is_bbps_enabled",type:"Boolean",required:!0,desc:"Whether Bill Payment service is active for this agent."},{name:"data.is_payout_enabled",type:"Boolean",required:!0,desc:"Whether Instant Payout API service is active for this agent."}]})]}),!a&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/categories"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"List Biller Categories"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Fetch all supported BBPS biller categories (Electricity, Water, Credit Card, Fastag, Gas, etc.)."}),e.jsx(r,{title:"Sample Response (200 OK)",section:"cat_res",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/billers"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Fetch Billers Directory"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Fetch supported billers with required customer input parameters and validation metadata."}),e.jsx(f,{params:[{name:"category_id",type:"Number",required:!1,desc:"Filter billers by category ID (e.g., 1 for Electricity)."},{name:"page",type:"Number",required:!1,desc:"Page index for pagination (Default: 1)."},{name:"limit",type:"Number",required:!1,desc:"Records per page (Max limit allowed: 500)."}]}),e.jsx(r,{title:"Sample Response (200 OK)",section:"billers_res",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/fetch-bill"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Fetch Customer Bill Amount"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Query the biller's server in real time to fetch customer bill details, due date, customer name, and bill amount."}),e.jsx(f,{params:[{name:"billerId",type:"String",required:!0,desc:"Exact Biller ID retrieved from the /billers API."},{name:"mobile",type:"String",required:!0,desc:"10-digit customer mobile number."},{name:"customerParams",type:"Array of Objects",required:!0,desc:"Array of { name, value } objects matching the biller's required input parameters."}]}),e.jsx(r,{title:"Sample Request Body",section:"fetch_req_code",code:`{
  "billerId": "DGVCL0000GUJ01",
  "mobile": "9898971274",
  "customerParams": [
    { "name": "Consumer Number", "value": "12345678901" }
  ]
}`}),e.jsx(r,{title:"Sample Success Response (200 OK)",section:"fetch_res_code",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4 relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-36 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"}),e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3 relative z-10",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/pay-bill"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Execute Bill Payment"})]}),e.jsx("p",{className:"text-xs text-slate-300 relative z-10",children:"Execute the bill payment. Validates agent BBPS wallet balance, deducts funds, and processes payment via BBPS gateway."}),e.jsxs("div",{className:"relative z-10",children:[e.jsx("h4",{className:"font-semibold text-white text-xs mb-2",children:"Request Payload Parameters:"}),e.jsx(f,{params:[{name:"billerId",type:"String",required:!0,desc:"Target Biller ID (e.g., 'DGVCL0000GUJ01', 'SBIC00000NATDN')."},{name:"amount",type:"Number",required:!0,desc:"Amount to be paid in Rupees (e.g. 1500.00). Pass full bill amount or custom partial amount."},{name:"mobile",type:"String",required:!0,desc:"10-digit customer mobile number."},{name:"paymentMode",type:"String",required:!1,desc:"Payment mode: 'Cash', 'UPI', 'Internet Banking', 'Debit Card', 'Credit Card'. Default: 'Cash'."},{name:"client_transaction_id",type:"String",required:!1,desc:"Your system's unique transaction/order ID for idempotency & tracing."},{name:"customerParams",type:"Array of Objects",required:!0,desc:"Array of { name, value } matching required biller parameters."},{name:"customerPan",type:"String",required:!1,desc:"Customer 10-digit PAN Card (MANDATORY for Cash payments >= ₹50,000)."},{name:"billerResponseInfo",type:"Object",required:!1,desc:"Pass exact billerResponse object returned by /fetch-bill."}]})]}),e.jsx(r,{title:"Complete Request Payload Example",section:"pay_req_full",code:`{
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
  }
}`}),e.jsx(r,{title:"Success Response (200 OK - Payment Processed Successfully)",section:"pay_res_success",code:`{
  "status": "success",
  "message": "Bill Paid successfully",
  "transaction_id": "BBPSU1283118228",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "bbps_txn_ref_id": "CC016226CBAF13851712",
  "payment_status": "success",
  "charge_deducted": 10.00
}`}),e.jsx(r,{title:"Error Response (400 Bad Request - Insufficient Wallet Balance)",section:"pay_res_insufficient",code:`{
  "status": "error",
  "message": "Insufficient BBPS Wallet Balance. Required: ₹1510.00, Current Balance: ₹450.00"
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4 relative overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3 relative z-10",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/status/:transaction_id"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Live Status & Auto-Refund"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed relative z-10",children:["Check real-time live transaction status. Query using any identifier: ",e.jsx("code",{children:"BBPSU..."}),", ",e.jsx("code",{children:"client_transaction_id"}),", ",e.jsx("code",{children:"fetchRequestId"}),", or ",e.jsx("code",{children:"CC01..."}),"."]}),e.jsx(r,{title:"Sample Success Response (200 OK)",section:"status_res_code",code:`{
  "status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "CC016226CBAF13851712",
    "current_status": "success",
    "bbps_status": "SUCCESS",
    "polled_at": "2026-08-14T03:15:00.000Z"
  }
}`}),e.jsx(r,{title:"Sample Gateway Failure & Auto-Refund Response (200 OK)",section:"status_res_auto_refund",code:`{
  "status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "N/A",
    "current_status": "failed",
    "bbps_status": "FAILED_GATEWAY_ERROR",
    "message": "Bill payment failed to connect to biller gateway. BBPS wallet automatically refunded.",
    "refund_status": "REFUNDED",
    "refunded_amount": 1500.00
  }
}`})]})]}),a&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/payout/transfer"]}),e.jsx("span",{className:"text-xs text-purple-300 font-mono font-semibold",children:"24x7 Instant Bank Transfer"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed",children:["Execute 24x7 real-time bank account transfer via IMPS or NEFT. Deducts ",e.jsx("code",{children:"Amount + Slab Fee"})," strictly from your dedicated ",e.jsx("strong",{children:"Payout Wallet"}),". If the upstream bank transfer fails, funds are automatically refunded to your Payout Wallet."]}),e.jsx(f,{params:[{name:"amount",type:"Number",required:!0,desc:"Transfer amount in INR (₹100 to ₹2,00,000)."},{name:"account_number",type:"String",required:!0,desc:"Beneficiary bank account number (8 to 22 digits)."},{name:"ifsc_code",type:"String",required:!0,desc:"Beneficiary bank IFSC Code (11 alphanumeric characters)."},{name:"beneficiary_name",type:"String",required:!0,desc:"Name of the bank account holder."},{name:"mobile_number",type:"String",required:!1,desc:"Beneficiary / customer 10-digit mobile number. If omitted, your agent account registered mobile is used automatically."},{name:"transfer_mode",type:"String",required:!1,desc:"Transfer mode: 'IMPS' (default, 24x7 instant) or 'NEFT'."},{name:"client_order_id",type:"String",required:!1,desc:"Your system's unique transaction/order ID for idempotency and status query."},{name:"bank_name",type:"String",required:!1,desc:"Optional name of the beneficiary bank."},{name:"email",type:"String",required:!1,desc:"Optional customer or sender email address."}]}),e.jsx(r,{title:"Sample Request Body",section:"payout_req_body",code:`{
  "amount": 2500.00,
  "account_number": "91234567890123",
  "ifsc_code": "HDFC0001234",
  "beneficiary_name": "Ramesh Kumar",
  "mobile_number": "9876543210",
  "transfer_mode": "IMPS",
  "client_order_id": "ORD_PAYOUT_1001",
  "bank_name": "HDFC Bank"
}`}),e.jsx(r,{title:"Sample Success Response (200 OK)",section:"payout_res_success",code:`{
  "status": "success",
  "message": "Payout transfer completed successfully",
  "data": {
    "order_id": "B2BPO1727443912001",
    "client_order_id": "ORD_PAYOUT_1001",
    "utr": "426812831122",
    "amount": 2500.00,
    "fee": 25.00,
    "total_deducted": 2525.00,
    "beneficiary_name": "Ramesh Kumar",
    "account_number": "91234567890123",
    "ifsc_code": "HDFC0001234",
    "status": "success"
  }
}`}),e.jsx(r,{title:"Sample Failed & Refunded Response (400 Bad Request)",section:"payout_res_failed",code:`{
  "status": "failed",
  "message": "Beneficiary account inactive or invalid IFSC. Funds refunded to payout wallet.",
  "data": {
    "order_id": "B2BPO1727443912001",
    "client_order_id": "ORD_PAYOUT_1001",
    "amount": 2500.00,
    "fee": 25.00,
    "refunded_to_payout_wallet": true,
    "status": "failed"
  }
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/payout/status/:order_id"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Payout Status & Bank UTR"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed",children:["Query the real-time status of a payout transfer using either the system ",e.jsx("code",{children:"order_id"})," or your own ",e.jsx("code",{children:"client_order_id"}),"."]}),e.jsx(r,{title:"Sample Response (200 OK)",section:"payout_status_res",code:`{
  "status": "success",
  "data": {
    "order_id": "B2BPO1727443912001",
    "client_order_id": "ORD_PAYOUT_1001",
    "utr": "426812831122",
    "beneficiary_name": "Ramesh Kumar",
    "account_number": "91234567890123",
    "ifsc_code": "HDFC0001234",
    "transfer_mode": "IMPS",
    "amount": 2500.00,
    "fee": 25.00,
    "total_deducted": 2525.00,
    "status": "success",
    "created_at": "2026-09-27T08:15:00.000Z"
  }
}`})]})]}),e.jsxs("div",{className:"space-y-8",children:[e.jsxs("div",{className:"flex items-center gap-2 pt-2",children:[e.jsx("span",{className:`h-2.5 w-2.5 rounded-full animate-pulse ${a?"bg-purple-400":"bg-emerald-400"}`}),e.jsx("h3",{className:`text-sm font-bold uppercase tracking-wider ${a?"text-purple-400":"text-emerald-400"}`,children:a?"Payout Wallet Fund Deposit APIs":"BBPS Wallet Fund Deposit APIs"})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/admin-bank-accounts"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Get Admin Bank Accounts List"})]}),e.jsx("p",{className:"text-xs text-slate-300 leading-relaxed",children:"Retrieve active company bank accounts configured by B2B Admin for wallet fund top-up. Render these accounts in a dropdown list for the agent to select their deposit destination."}),e.jsx(r,{title:"Sample Response (200 OK)",section:"admin_banks_res",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/fund-request"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Submit B2B Fund Request"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed",children:["Submit a wallet fund request electronically to credit funds into your ",e.jsx("strong",{children:a?"Payout Wallet":"BBPS Wallet"})," (pass ",e.jsxs("code",{children:['wallet_type: "',a?"payout":"bbps",'"']}),"). Your request will be queued in ",e.jsx("code",{children:"pending"})," status for B2B Admin verification and approval."]}),e.jsx(r,{title:"Sample Request Body",section:"fund_req_body",code:`{
  "amount": 50000,
  "utr_number": "UTR9876543210",
  "wallet_type": "${a?"payout":"bbps"}",
  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567",
  "proof_url": "https://example.com/payment_receipt.jpg"
}`}),e.jsx(r,{title:"Sample Success Response (201 Created)",section:"fund_req_res",code:`{
  "status": "success",
  "message": "Fund request submitted successfully and pending approval",
  "data": {
    "request_id": "88a912bc-9430-4e2b-8a2b-103bc4a9192b",
    "amount": 50000,
    "utr_number": "UTR9876543210",
    "wallet_type": "${a?"payout":"bbps"}",
    "status": "pending",
    "submitted_at": "2026-08-15T00:33:00.000Z"
  }
}`}),e.jsx(f,{params:[{name:"amount",type:"Number",required:!0,desc:"Amount in INR (₹) requested to credit to your account."},{name:"utr_number",type:"String",required:!0,desc:"Unique Bank Transaction Reference / UTR Number."},{name:"wallet_type",type:"String",required:!1,desc:`Target wallet destination: '${a?"payout":"bbps"}'.`},{name:"admin_bank_account_id",type:"String",required:!1,desc:"Optional ID of the Admin Bank Account where money was deposited."},{name:"proof_url",type:"String",required:!1,desc:"Optional URL linking to payment receipt or transaction screenshot."}]})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/fund-request/status/:request_id"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Fund Request Status"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed",children:["Check the live approval status (",e.jsx("code",{children:"pending"}),", ",e.jsx("code",{children:"approved"}),", ",e.jsx("code",{children:"rejected"}),") of a submitted fund request."]}),e.jsx(r,{title:"Sample Response (200 OK)",section:"fund_req_status_res",code:`{
  "status": "success",
  "data": {
    "request_id": "88a912bc-9430-4e2b-8a2b-103bc4a9192b",
    "amount": 50000,
    "utr_number": "UTR9876543210",
    "wallet_type": "${a?"payout":"bbps"}",
    "status": "approved",
    "created_at": "2026-08-15T00:33:00.000Z"
  }
}`})]})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"border-b border-slate-700/80 pb-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2",children:[e.jsx(he,{className:"h-5 w-5 text-indigo-400"}),"3. Code Integration Examples: ",a?"Instant Payout (/payout/transfer)":"Bill Payment (/pay-bill)"]}),e.jsxs("p",{className:"text-xs text-slate-400 mt-1",children:["Production-ready code templates in multiple languages for executing ",a?"24x7 instant payouts":"instant bill payments","."]})]}),e.jsxs("div",{className:"flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/70 w-fit",children:[e.jsx("button",{onClick:()=>N("curl"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${d==="curl"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"cURL"}),e.jsx("button",{onClick:()=>N("nodejs"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${d==="nodejs"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"Node.js (Axios)"}),e.jsx("button",{onClick:()=>N("python"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${d==="python"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"Python (Requests)"}),e.jsx("button",{onClick:()=>N("php"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${d==="php"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"PHP (cURL)"})]}),a?e.jsxs(e.Fragment,{children:[d==="curl"&&e.jsx(r,{title:"cURL Request Example (/payout/transfer)",section:"code_curl_payout",code:`curl -X POST "${p}/api/v1/b2b/payout/transfer" \\
  -H "x-api-key: pub_live_your_key_here" \\
  -H "x-secret-key: sec_live_your_secret_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 2500.00,
    "account_number": "91234567890123",
    "ifsc_code": "HDFC0001234",
    "beneficiary_name": "Ramesh Kumar",
    "transfer_mode": "IMPS",
    "client_order_id": "ORD_PAYOUT_1001",
    "bank_name": "HDFC Bank"
  }'`}),d==="nodejs"&&e.jsx(r,{title:"Node.js Integration Example (Axios - Instant Payout)",section:"code_nodejs_payout",code:`const axios = require('axios');

async function sendPayout() {
  try {
    const response = await axios.post('${p}/api/v1/b2b/payout/transfer', {
      amount: 2500.00,
      account_number: '91234567890123',
      ifsc_code: 'HDFC0001234',
      beneficiary_name: 'Ramesh Kumar',
      transfer_mode: 'IMPS',
      client_order_id: 'ORD_PAYOUT_1001',
      bank_name: 'HDFC Bank'
    }, {
      headers: {
        'x-api-key': 'pub_live_your_key_here',
        'x-secret-key': 'sec_live_your_secret_here',
        'Content-Type': 'application/json'
      }
    });

    console.log('Payout Status:', response.data.status);
    console.log('Bank UTR:', response.data.data?.utr);
    console.log('Order ID:', response.data.data?.order_id);
  } catch (error) {
    console.error('Payout Error:', error.response?.data || error.message);
  }
}

sendPayout();`}),d==="python"&&e.jsx(r,{title:"Python Integration Example (Requests - Instant Payout)",section:"code_python_payout",code:`import requests

url = "${p}/api/v1/b2b/payout/transfer"
headers = {
    "x-api-key": "pub_live_your_key_here",
    "x-secret-key": "sec_live_your_secret_here",
    "Content-Type": "application/json"
}

payload = {
    "amount": 2500.00,
    "account_number": "91234567890123",
    "ifsc_code": "HDFC0001234",
    "beneficiary_name": "Ramesh Kumar",
    "transfer_mode": "IMPS",
    "client_order_id": "ORD_PAYOUT_1001",
    "bank_name": "HDFC Bank"
}

response = requests.post(url, json=payload, headers=headers)
print("Payout Result:", response.json())`}),d==="php"&&e.jsx(r,{title:"PHP Integration Example (cURL - Instant Payout)",section:"code_php_payout",code:`<?php
$ch = curl_init("${p}/api/v1/b2b/payout/transfer");

$payload = json_encode([
    "amount" => 2500.00,
    "account_number" => "91234567890123",
    "ifsc_code" => "HDFC0001234",
    "beneficiary_name" => "Ramesh Kumar",
    "transfer_mode" => "IMPS",
    "client_order_id" => "ORD_PAYOUT_1001",
    "bank_name" => "HDFC Bank"
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
?>`})]}):e.jsxs(e.Fragment,{children:[d==="curl"&&e.jsx(r,{title:"cURL Request Example (/pay-bill)",section:"code_curl",code:`curl -X POST "${p}/api/v1/b2b/pay-bill" \\
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
  }'`}),d==="nodejs"&&e.jsx(r,{title:"Node.js Integration Example (Axios - Bill Payment)",section:"code_nodejs",code:`const axios = require('axios');

async function payBill() {
  try {
    const response = await axios.post('${p}/api/v1/b2b/pay-bill', {
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

payBill();`}),d==="python"&&e.jsx(r,{title:"Python Integration Example (Requests - Bill Payment)",section:"code_python",code:`import requests

url = "${p}/api/v1/b2b/pay-bill"
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
print("Payment Result:", response.json())`}),d==="php"&&e.jsx(r,{title:"PHP Integration Example (cURL - Bill Payment)",section:"code_php",code:`<?php
$ch = curl_init("${p}/api/v1/b2b/pay-bill");

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
?>`})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3",children:[e.jsx(z,{className:"h-5 w-5 text-indigo-400"}),"4. Webhook Notifications: ",a?"Instant Payout Status Updates":"BBPS Payment Updates"]}),e.jsxs("p",{className:"text-xs text-slate-300",children:["When transactions are initiated and return a ",e.jsx("code",{children:"pending"})," status, our background engine continuously verifies status with ",a?"the banking network":"BBPS",". Once confirmed as ",e.jsx("strong",{children:"Success"})," or ",e.jsx("strong",{children:"Failed"}),", an HTTP POST callback is dispatched to your configured Webhook URL."]}),a?e.jsxs("div",{className:"space-y-3 pt-2",children:[e.jsx(r,{title:"Payout Webhook Payload (Transfer Success)",section:"webhook_payout_success",code:`{
  "event": "PAYOUT_STATUS_UPDATE",
  "order_id": "B2BPO1727443912001",
  "client_order_id": "ORD_PAYOUT_1001",
  "utr": "426812831122",
  "status": "success",
  "amount": 2500.00,
  "fee": 25.00,
  "beneficiary_name": "Ramesh Kumar",
  "account_number": "91234567890123",
  "ifsc_code": "HDFC0001234",
  "timestamp": "2026-09-27T08:15:02.000Z"
}`}),e.jsx(r,{title:"Payout Webhook Payload (Transfer Failed & Auto-Refunded to Payout Wallet)",section:"webhook_payout_failed",code:`{
  "event": "PAYOUT_STATUS_UPDATE",
  "order_id": "B2BPO1727443912001",
  "client_order_id": "ORD_PAYOUT_1001",
  "status": "failed",
  "amount": 2500.00,
  "fee": 25.00,
  "refunded_to_payout_wallet": true,
  "message": "Beneficiary account inactive or invalid IFSC. Funds refunded to payout wallet.",
  "timestamp": "2026-09-27T08:15:02.000Z"
}`})]}):e.jsxs("div",{className:"space-y-3 pt-2",children:[e.jsx(r,{title:"BBPS Webhook Payload Example (Transaction Success)",section:"webhook_success_payload",code:`{
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
}`}),e.jsx(r,{title:"BBPS Webhook Payload Example (Transaction Failed & Instant Refunded)",section:"webhook_failed_payload",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-200 flex items-start gap-3",children:[e.jsx(A,{className:"h-5 w-5 text-emerald-400 shrink-0 mt-0.5"}),e.jsxs("div",{children:[e.jsx("strong",{className:"block mb-1 text-emerald-300",children:"Automated Wallet Refund Guarantee:"}),"If any transaction is marked as ",e.jsx("code",{children:"FAILED"})," by the upstream banking network or biller gateway, the system automatically refunds 100% of the principal amount and applicable charges back to your ",a?"Payout Wallet":"BBPS Wallet"," instantly."]})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3",children:[e.jsx(W,{className:"h-5 w-5 text-rose-400"}),"5. Error Codes & Troubleshooting Matrix"]}),e.jsx("div",{className:"overflow-x-auto rounded-xl border border-slate-700/80",children:e.jsxs("table",{className:"w-full text-left text-xs",children:[e.jsx("thead",{className:"bg-slate-900/90 text-slate-300",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-3 font-semibold text-rose-400",children:"HTTP Status"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-indigo-300",children:"Response Status"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Error Description & Root Cause"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Recommended Action"})]})}),e.jsxs("tbody",{className:"divide-y divide-slate-700/50 bg-slate-900/40",children:[e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"400 Bad Request"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"error"}),e.jsxs("td",{className:"px-4 py-3 text-slate-300",children:["Insufficient ",a?"Payout":"BBPS"," Wallet Balance to cover requested transaction."]}),e.jsxs("td",{className:"px-4 py-3 text-slate-300",children:["Submit ",e.jsx("code",{children:"/fund-request"})," with ",e.jsxs("code",{children:['wallet_type: "',a?"payout":"bbps",'"']}),"."]})]}),a?e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"400 Bad Request"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"failed"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Invalid IFSC code or beneficiary bank account inactive."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Check bank account and IFSC details. Auto-refunded."})]}):e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"400 Bad Request"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Payment mode 'Cash' disabled by biller."}),e.jsxs("td",{className:"px-4 py-3 text-slate-300",children:["Pass ",e.jsx("code",{children:'paymentMode: "UPI"'})," or ",e.jsx("code",{children:'"Internet Banking"'}),"."]})]}),e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-amber-400",children:"401 Unauthorized"}),e.jsx("td",{className:"px-4 py-3 font-mono text-amber-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Invalid API/Secret Keys or IP address not whitelisted."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Verify credentials and whitelist server IP in B2B settings."})]}),e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-amber-400",children:"429 Rate Limit"}),e.jsx("td",{className:"px-4 py-3 font-mono text-amber-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Daily sync limit reached for directory endpoints."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Cache directory data locally and query as needed."})]}),e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"500 Server Error"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Upstream Biller or Bank Gateway Timeout / System Down."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Wallet is auto-refunded. Retry after a few minutes."})]})]})]})})]})]})}export{Re as default};
