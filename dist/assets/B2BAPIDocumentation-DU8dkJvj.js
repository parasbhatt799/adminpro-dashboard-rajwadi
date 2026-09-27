const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/jspdf.es.min-CIHkK7CH.js","assets/index-CGAY25SE.js","assets/index-DXkfmJJu.css","assets/typeof-QjJsDpFa.js"])))=>i.map(i=>d[i]);
import{c as J,r as u,j as e,d as M,S as oe,C as D,s as ie,_ as K,f as z}from"./index-CGAY25SE.js";import{C as Y}from"./circle-alert-Qd34XHhG.js";import{A as W}from"./activity-WBbc4Naw.js";import{Z as E}from"./zap-BQcaiy5n.js";import{D as de}from"./download-DTdU-5q5.js";import{L as ce}from"./layers-CnT8Ebnu.js";import{L as V}from"./landmark-yDRm_C1A.js";import{E as ue}from"./eye-D_lMdc-w.js";import{K as me}from"./key-0929zTBn.js";import{S as xe}from"./shield-alert-DTesftiI.js";import{C as pe}from"./copy-Dm2DgFER.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const be=[["path",{d:"m16 18 6-6-6-6",key:"eg8j8"}],["path",{d:"m8 6-6 6 6 6",key:"ppft3o"}]],he=J("code",be);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ye=[["rect",{width:"20",height:"8",x:"2",y:"2",rx:"2",ry:"2",key:"ngkwjq"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",ry:"2",key:"iecqi9"}],["line",{x1:"6",x2:"6.01",y1:"6",y2:"6",key:"16zg32"}],["line",{x1:"6",x2:"6.01",y1:"18",y2:"18",key:"nzw8ys"}]],fe=J("server",ye);function Ie(){const[X,q]=u.useState(null),[i,T]=u.useState("curl"),[O,U]=u.useState(!1),[Z,B]=u.useState(!0),[v,Q]=u.useState(!1),[_e,ee]=u.useState("B2B Partner"),[f,L]=u.useState(!0),[m,$]=u.useState(!1),[d,y]=u.useState("all"),[R,_]=u.useState("bbps"),te=(r,l)=>{navigator.clipboard.writeText(r),q(l),setTimeout(()=>q(null),2e3)},x=typeof window<"u"?window.location.origin:"https://api.usepay.in";u.useEffect(()=>{const r=typeof window<"u"&&window.location.pathname.startsWith("/b2b/admin");Q(r);const l=typeof window<"u"?localStorage.getItem("b2bAgentId"):null;r?(L(!0),$(!0),y("all"),_("bbps"),B(!1)):l?(async()=>{try{const{data:n,error:t}=await ie.from("b2b_api_credentials").select("first_name, last_name, company_name, b2b_login_id, client_id, is_bbps_enabled, is_payout_enabled").eq("id",l).maybeSingle();if(n){const w=[n.first_name,n.last_name].filter(Boolean).join(" ").trim()||n.company_name||n.b2b_login_id||n.client_id||"B2B Partner";ee(w);const N=n.is_bbps_enabled!==!1,o=!!n.is_payout_enabled;L(N),$(o),N&&!o?(y("bbps"),_("bbps")):!N&&o?(y("payout"),_("payout")):(y("all"),_("bbps"))}}catch(n){console.error("Error fetching agent API credentials:",n)}finally{B(!1)}})():B(!1)},[]);const p=f&&(d==="all"||d==="bbps"),b=m&&(d==="all"||d==="payout"),g=f&&m||v,se=async()=>{U(!0);try{const r=await K(()=>import("./jspdf.es.min-CIHkK7CH.js"),__vite__mapDeps([0,1,2,3])),l=r.jsPDF||r.default,h=await K(()=>import("./jspdf.plugin.autotable-Cz_YoQo_.js"),[]),n=h.default||h.autoTable||h,t=new l({orientation:"p",unit:"mm",format:"a4"}),k=g?d:m?"payout":"bbps",w=k==="payout"?"B2B Instant Payout API Reference":k==="bbps"?"B2B Bill Payment API Reference":"B2B Full API Reference (BBPS & Payout)",N=P=>{t.setFillColor(15,23,42),t.rect(0,0,210,25,"F"),t.setTextColor(255,255,255),t.setFont("helvetica","bold"),t.setFontSize(14),t.text(P,14,12),t.setFontSize(8),t.setFont("helvetica","normal"),t.setTextColor(148,163,184),t.text(`Base Endpoint: ${x}/api/v1/b2b  |  Generated: ${z(new Date,"dd MMM yyyy, hh:mm a")}`,14,19)},o=(P,I)=>P+I>272?(t.addPage(),N(`${w} (Contd.)`),32):P,c=(P,I,ne)=>{const G=I.split(`
`),A=8+G.length*3.8;let S=o(ne,A);t.setFillColor(30,41,59),t.rect(14,S,182,6,"F"),t.setFont("helvetica","bold"),t.setFontSize(8),t.setTextColor(165,180,252),t.text(P,18,S+4.2),t.setFillColor(15,23,42),t.rect(14,S+6,182,A-6,"F"),t.setFont("courier","normal"),t.setFontSize(7.5),t.setTextColor(52,211,153);let H=S+10.5;return G.forEach(F=>{t.text(F.length>95?F.substring(0,95)+"...":F,18,H),H+=3.8}),S+A+6};N(w);let s=32;t.setFont("helvetica","bold"),t.setFontSize(11),t.setTextColor(30,41,59),t.text("1. Authentication & Mandatory HTTP Headers",14,s),s+=4,n(t,{startY:s,head:[["Header Name","Value Format","Description"]],body:[["x-api-key","String (pub_live_...)","Public API key issued from Agent Credentials portal"],["x-secret-key","String (sec_live_...)","Secret API key used to authenticate your system"],["Content-Type","application/json","Required payload content type for POST requests"]],theme:"grid",headStyles:{fillColor:[79,70,229],textColor:[255,255,255],fontStyle:"bold",fontSize:8.5},bodyStyles:{fontSize:8},margin:{left:14,right:14}}),s=t.lastAutoTable.finalY+8,t.setFont("helvetica","bold"),t.setFontSize(11),t.setTextColor(30,41,59),t.text("2. Enabled API Endpoints Overview",14,s),s+=4;const C=[["GET","/balance","Fetch current available agent wallet balance in Rupees"]];p&&C.push(["GET","/categories","Fetch supported biller categories (Electricity, Fastag, Water, etc.)"],["GET","/billers","Fetch billers list and required customer input parameters"],["POST","/fetch-bill","Fetch customer bill amount, due date, and biller details"],["POST","/pay-bill","Process bill payment and deduct funds from agent wallet"],["GET","/status/:transaction_id","Check real-time live status & auto-refund of a bill payment"]),b&&C.push(["POST","/payout/transfer","Execute 24x7 instant bank transfer via IMPS or NEFT"],["GET","/payout/status/:order_id","Check real-time live payout transfer status & bank UTR"]),C.push(["GET","/admin-bank-accounts","Fetch company bank accounts for wallet fund top-up"],["POST","/fund-request","Submit electronic fund request (bbps or payout wallet)"],["GET","/fund-request/status/:request_id","Check real-time approval status of submitted fund request"]),n(t,{startY:s,head:[["Method","Endpoint Path","Description"]],body:C,theme:"grid",headStyles:{fillColor:[16,185,129],textColor:[255,255,255],fontStyle:"bold",fontSize:8.5},bodyStyles:{fontSize:8},margin:{left:14,right:14}}),s=t.lastAutoTable.finalY+10,s=o(s,45),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.1 GET /balance - Check Agent Wallet Balance",14,s),s+=4,s=c("Sample Response (200 OK)",`{
  "status": "success",
  "data": {
    "balance": 25450.75,
    "bbps_wallet_balance": 15450.75,
    "payout_wallet_balance": 10000.00,
    "is_bbps_enabled": ${f},
    "is_payout_enabled": ${m}
  }
}`,s),p&&(s=o(s,65),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.2 GET /categories - Fetch Biller Categories",14,s),s+=4,s=c("Sample Response (200 OK)",`{
  "status": "success",
  "data": [
    { "category_name": "Electricity", "code": "ELECTRICITY" },
    { "category_name": "Fastag", "code": "FASTAG" },
    { "category_name": "Credit Card", "code": "CREDIT_CARD" }
  ]
}`,s),s=o(s,90),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.3 POST /fetch-bill - Fetch Customer Bill Details",14,s),s+=4,s=c("Sample Request Body",`{
  "billerId": "DGVCL0000GUJ01",
  "mobile": "9898971274",
  "customerParams": [{ "name": "Consumer Number", "value": "12345678901" }]
}`,s),s=c("Sample Success Response (200 OK)",`{
  "status": "success",
  "data": {
    "responseCode": "000",
    "billerResponse": { "customerName": "AJAY KALATHIYA", "amount": "1500.00", "dueDate": "2026-08-30" }
  }
}`,s),s=o(s,110),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.4 POST /pay-bill - Execute Bill Payment",14,s),s+=4,s=c("Sample Request Body",`{
  "billerId": "DGVCL0000GUJ01",
  "amount": 1500.00,
  "mobile": "9898971274",
  "paymentMode": "UPI",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "customerParams": [{ "name": "Consumer Number", "value": "12345678901" }]
}`,s),s=c("Sample Success Response (200 OK)",`{
  "status": "success",
  "message": "Bill Paid successfully",
  "transaction_id": "BBPSU1283118228",
  "payment_status": "success",
  "charge_deducted": 10.00
}`,s),s=o(s,75),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(16,185,129),t.text("2.5 GET /status/:transaction_id - Live Status & Auto-Refund",14,s),s+=4,s=c("Sample Status Response (200 OK)",`{
  "status": "success",
  "data": {
    "transaction_id": "BBPSU1283118228",
    "client_transaction_id": "TXN_ORD_20260814_001",
    "bbps_txn_ref_id": "CC016226CBAF13851712",
    "current_status": "success",
    "bbps_status": "SUCCESS"
  }
}`,s)),b&&(s=o(s,110),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(147,51,234),t.text("2.6 POST /payout/transfer - 24x7 Instant Bank Transfer",14,s),s+=4,s=c("Sample Request Body",`{
  "amount": 2500.00,
  "account_number": "91234567890123",
  "ifsc_code": "HDFC0001234",
  "beneficiary_name": "Ramesh Kumar",
  "transfer_mode": "IMPS",
  "client_order_id": "ORD_PAYOUT_1001"
}`,s),s=c("Sample Success Response (200 OK)",`{
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
}`,s),s=o(s,75),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(147,51,234),t.text("2.7 GET /payout/status/:order_id - Live Payout Status & UTR",14,s),s+=4,s=c("Sample Status Response (200 OK)",`{
  "status": "success",
  "data": {
    "order_id": "B2BPO1727443912001",
    "client_order_id": "ORD_PAYOUT_1001",
    "utr": "426812831122",
    "beneficiary_name": "Ramesh Kumar",
    "status": "success"
  }
}`,s)),s=o(s,85),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(79,70,229),t.text("2.8 POST /fund-request - Submit Wallet Top-up Request",14,s),s+=4,s=c("Sample Request Body",`{
  "amount": 50000,
  "utr_number": "UTR9876543210",
  "wallet_type": "${b&&!p?"payout":"bbps"}",
  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567"
}`,s),s=o(s,80),t.setFont("helvetica","bold"),t.setFontSize(10),t.setTextColor(225,29,72),t.text("3. Error Codes & Troubleshooting Matrix",14,s),s+=4,n(t,{startY:s,head:[["HTTP Code","Status","Description","Resolution Action"]],body:[["200 OK","success","Request processed successfully","Parse response data payload"],["400 Bad Request","error","Insufficient Wallet Balance","Load funds via /fund-request"],["400 Bad Request","error","Invalid IFSC / Account Inactive","Verify beneficiary bank details"],["401 Unauthorized","error","Invalid API Keys or IP Not Whitelisted","Whitelist server IP in Settings"],["429 Too Many Requests","error","Rate limit exceeded","Implement caching & rate-limiting"],["500 Server Error","error","Upstream Bank/Gateway Timeout","Wallet auto-refunded. Query status"]],theme:"grid",headStyles:{fillColor:[225,29,72],textColor:[255,255,255],fontStyle:"bold",fontSize:8},bodyStyles:{fontSize:7.5},margin:{left:14,right:14}});const le=w.replace(/[^a-zA-Z0-9]/g,"_");t.save(`${le}_${z(new Date,"yyyy-MM-dd")}.pdf`)}catch(r){console.error("Failed to generate API PDF:",r),alert("Failed to generate PDF documentation")}finally{U(!1)}},a=({title:r,code:l,section:h})=>e.jsxs("div",{className:"bg-slate-900 rounded-xl border border-slate-700/80 overflow-hidden my-4 shadow-xl",children:[e.jsxs("div",{className:"flex justify-between items-center px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/80",children:[e.jsx("span",{className:"text-xs font-mono font-semibold text-indigo-300",children:r}),e.jsx("button",{onClick:()=>te(l,h),className:"text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs bg-slate-700/50 hover:bg-slate-700 px-2.5 py-1 rounded-md",children:X===h?e.jsxs(e.Fragment,{children:[e.jsx(D,{className:"h-3.5 w-3.5 text-emerald-400"}),e.jsx("span",{className:"text-emerald-400 font-medium",children:"Copied!"})]}):e.jsxs(e.Fragment,{children:[e.jsx(pe,{className:"h-3.5 w-3.5 text-slate-300"}),e.jsx("span",{children:"Copy"})]})})]}),e.jsx("div",{className:"p-4 overflow-x-auto",children:e.jsx("pre",{className:"text-xs font-mono text-emerald-400 leading-relaxed",children:e.jsx("code",{children:l})})})]}),j=({params:r})=>e.jsx("div",{className:"overflow-x-auto my-4 rounded-xl border border-slate-700/80 shadow-lg",children:e.jsxs("table",{className:"w-full text-left text-xs",children:[e.jsx("thead",{className:"bg-slate-900/90 text-slate-300 border-b border-slate-700",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-3 font-semibold text-indigo-300",children:"Parameter"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Type"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Required"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Description"})]})}),e.jsx("tbody",{className:"divide-y divide-slate-700/50 bg-slate-900/40",children:r.map((l,h)=>e.jsxs("tr",{className:"hover:bg-slate-800/40 transition-colors",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-white",children:l.name}),e.jsx("td",{className:"px-4 py-3 font-mono text-amber-300",children:l.type}),e.jsx("td",{className:"px-4 py-3 font-semibold",children:l.required?e.jsx("span",{className:"bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded text-[10px]",children:"REQUIRED"}):e.jsx("span",{className:"bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded text-[10px]",children:"OPTIONAL"})}),e.jsx("td",{className:"px-4 py-3 text-slate-300 leading-normal",children:l.desc})]},h))})]})});if(Z)return e.jsxs("div",{className:"flex flex-col items-center justify-center min-h-[400px] text-slate-300 gap-3",children:[e.jsx(M,{size:"lg"}),e.jsx("p",{className:"text-sm",children:"Loading API Documentation and service permissions..."})]});if(!f&&!m&&!v)return e.jsx("div",{className:"bg-slate-900 rounded-3xl p-8 border border-slate-800 text-center space-y-4",children:e.jsxs("div",{className:"p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl max-w-md mx-auto",children:[e.jsx(Y,{className:"h-8 w-8 text-rose-400 mx-auto mb-2"}),e.jsx("h2",{className:"text-lg font-bold text-white",children:"No Services Currently Active"}),e.jsx("p",{className:"text-xs text-slate-400 mt-2",children:"Neither Bill Payment (BBPS) nor Instant Payout API is currently enabled for your account. Please contact your B2B administrator to activate services."})]})});const ae=g?d==="payout"?"B2B Instant Payout API Reference":d==="bbps"?"B2B Bill Payment API Reference":"B2B Master API Reference":m?"B2B Instant Payout API Reference":"B2B Bill Payment API Reference",re=g?"Unified RESTful API documentation for processing utility bill payments (BBPS) and 24x7 instant bank transfers (Payout) with real-time tracking and automated webhook updates.":m?"High-speed, 24x7 automated IMPS/NEFT bank transfer API with dedicated payout wallet, instant transaction status tracking, and automated failure refunds.":"High-performance, RESTful API documentation for processing utility bill payments, electricity bills, credit cards, fastag, and mobile recharges with real-time status tracking and automated refunds.";return e.jsxs("div",{id:"b2b-api-doc-container",className:"space-y-8 w-full text-slate-200 p-4 md:p-6 bg-slate-900 rounded-3xl",children:[e.jsxs("div",{className:"bg-slate-800/90 border border-slate-700 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-40 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"}),e.jsxs("div",{className:"relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6",children:[e.jsxs("div",{children:[e.jsxs("div",{className:"flex flex-wrap items-center gap-2 mb-3",children:[e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider",children:[e.jsx(W,{className:"h-3.5 w-3.5 text-indigo-400"})," API v1.0 Live"]}),v&&e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold",children:[e.jsx(oe,{className:"h-3.5 w-3.5 text-amber-400"})," Admin Full Suite Access"]}),!v&&f&&e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold",children:[e.jsx(D,{className:"h-3.5 w-3.5 text-emerald-400"})," Bill Payment Active"]}),!v&&m&&e.jsxs("span",{className:"inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold",children:[e.jsx(E,{className:"h-3.5 w-3.5 text-purple-400"})," Payout API Active"]})]}),e.jsx("h1",{className:"text-2xl md:text-3xl font-black text-white tracking-tight mb-2",children:ae}),e.jsx("p",{className:"text-slate-400 text-xs md:text-sm max-w-2xl leading-relaxed",children:re})]}),e.jsx("div",{className:"flex flex-col sm:flex-row gap-3 shrink-0 self-start md:self-center",children:e.jsx("button",{"data-html2canvas-ignore":"true",onClick:se,disabled:O,className:"inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs md:text-sm shadow-xl border border-indigo-400/30 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50",children:O?e.jsxs(e.Fragment,{children:[e.jsx(M,{size:"sm"}),e.jsx("span",{children:"Generating PDF..."})]}):e.jsxs(e.Fragment,{children:[e.jsx(de,{className:"h-4 w-4 text-white"}),e.jsx("span",{children:"Export PDF Doc"})]})})})]}),g&&e.jsxs("div",{className:"mt-6 pt-6 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-4",children:[e.jsxs("div",{className:"flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700/80",children:[e.jsxs("button",{onClick:()=>y("all"),className:`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${d==="all"?"bg-indigo-600 text-white shadow-lg shadow-indigo-600/30":"text-slate-400 hover:text-white hover:bg-slate-800"}`,children:[e.jsx(ce,{className:"h-3.5 w-3.5"}),"All APIs"]}),e.jsxs("button",{onClick:()=>y("bbps"),className:`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${d==="bbps"?"bg-emerald-600 text-white shadow-lg shadow-emerald-600/30":"text-slate-400 hover:text-white hover:bg-slate-800"}`,children:[e.jsx(V,{className:"h-3.5 w-3.5"}),"Bill Payment (BBPS)"]}),e.jsxs("button",{onClick:()=>y("payout"),className:`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${d==="payout"?"bg-purple-600 text-white shadow-lg shadow-purple-600/30":"text-slate-400 hover:text-white hover:bg-slate-800"}`,children:[e.jsx(E,{className:"h-3.5 w-3.5"}),"Instant Payout API"]})]}),e.jsxs("div",{className:"text-xs text-slate-400 flex items-center gap-2",children:[e.jsx(ue,{className:"h-4 w-4 text-indigo-400"}),e.jsxs("span",{children:["Showing: ",e.jsx("strong",{className:"text-white capitalize",children:d==="all"?"All Enabled APIs":d})," documentation"]})]})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3",children:[e.jsx(me,{className:"h-5 w-5 text-indigo-400"}),"1. Authentication & Mandatory HTTP Headers"]}),e.jsxs("p",{className:"text-sm text-slate-300",children:["All API requests must be transmitted securely over ",e.jsx("strong",{children:"HTTPS"}),". Authentication is performed by supplying your unique API credentials in HTTP headers for every request."]}),e.jsxs("div",{className:"bg-slate-900/80 rounded-xl p-4 border border-slate-700/70 space-y-2",children:[e.jsx("span",{className:"text-xs text-slate-400 uppercase font-semibold tracking-wider block",children:"Base Endpoint URL"}),e.jsxs("code",{className:"block text-indigo-300 font-mono text-sm font-bold",children:[x,"/api/v1/b2b"]})]}),e.jsxs("div",{children:[e.jsx("h3",{className:"font-semibold text-white text-sm mb-3",children:"Mandatory HTTP Request Headers:"}),e.jsx("div",{className:"overflow-x-auto rounded-xl border border-slate-700/80",children:e.jsxs("table",{className:"w-full text-left text-xs",children:[e.jsx("thead",{className:"bg-slate-900/90 text-slate-300",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-3 font-semibold text-indigo-300",children:"Header Name"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Value Format"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Description"})]})}),e.jsxs("tbody",{className:"divide-y divide-slate-700/50 bg-slate-900/40",children:[e.jsxs("tr",{children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-emerald-400",children:"x-api-key"}),e.jsx("td",{className:"px-4 py-3 font-mono text-slate-300",children:"String (e.g. pub_live_...)"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Your B2B Public API Key issued from Agent Credentials portal."})]}),e.jsxs("tr",{children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-emerald-400",children:"x-secret-key"}),e.jsx("td",{className:"px-4 py-3 font-mono text-slate-300",children:"String (e.g. sec_live_...)"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Your B2B Secret Key used to authenticate your system."})]}),e.jsxs("tr",{children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-emerald-400",children:"Content-Type"}),e.jsx("td",{className:"px-4 py-3 font-mono text-slate-300",children:"application/json"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Required payload content type for POST requests."})]})]})]})})]}),e.jsxs("div",{className:"bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200 flex items-start gap-3",children:[e.jsx(xe,{className:"h-5 w-5 text-amber-400 shrink-0 mt-0.5"}),e.jsxs("div",{children:[e.jsx("strong",{className:"block mb-1 text-amber-300",children:"IP Whitelisting Requirement:"}),"Requests originating from IP addresses that have not been explicitly whitelisted in your B2B Agent Settings will be rejected with an ",e.jsx("code",{children:"HTTP 401 Unauthorized"})," status."]})]})]}),e.jsxs("section",{className:"space-y-8",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2",children:[e.jsx(fe,{className:"h-5 w-5 text-indigo-400"}),"2. API Endpoints Reference"]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/balance"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Agent Wallet Balances"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Retrieve real-time available wallet balance for your active services (BBPS Utility Bill Payment and Instant Payout)."}),e.jsx(a,{title:"Sample Response (200 OK)",section:"balance_res",code:`{
  "status": "success",
  "data": {
    "balance": 25450.75,
    "bbps_wallet_balance": 15450.75,
    "payout_wallet_balance": 10000.00,
    "usable_bbps_balance": 15450.75,
    "fixed_deposit_amount": 0,
    "is_bbps_enabled": ${f},
    "is_payout_enabled": ${m}
  }
}`}),e.jsx(j,{params:[{name:"status",type:"String",required:!0,desc:"Status of request execution ('success' or 'error')."},{name:"data.balance",type:"Number",required:!0,desc:"Legacy / default BBPS wallet balance (₹)."},{name:"data.bbps_wallet_balance",type:"Number",required:!0,desc:"Dedicated wallet balance for utility bill payments (₹)."},{name:"data.payout_wallet_balance",type:"Number",required:!0,desc:"Dedicated wallet balance for 24x7 instant bank payouts (₹)."},{name:"data.is_bbps_enabled",type:"Boolean",required:!0,desc:"Whether Bill Payment service is active for this agent."},{name:"data.is_payout_enabled",type:"Boolean",required:!0,desc:"Whether Instant Payout API service is active for this agent."}]})]}),p&&e.jsxs("div",{className:"space-y-8",children:[e.jsxs("div",{className:"flex items-center gap-2 pt-2",children:[e.jsx("span",{className:"h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"}),e.jsx("h3",{className:"text-sm font-bold uppercase tracking-wider text-emerald-400",children:"Utility Bill Payment Endpoints (BBPS)"})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/categories"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"List Biller Categories"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Fetch all supported BBPS biller categories (Electricity, Water, Credit Card, Fastag, Gas, etc.)."}),e.jsx(a,{title:"Sample Response (200 OK)",section:"cat_res",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/billers"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Fetch Billers Directory"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Fetch supported billers with required customer input parameters and validation metadata."}),e.jsx(j,{params:[{name:"category_id",type:"Number",required:!1,desc:"Filter billers by category ID (e.g., 1 for Electricity)."},{name:"page",type:"Number",required:!1,desc:"Page index for pagination (Default: 1)."},{name:"limit",type:"Number",required:!1,desc:"Records per page (Max limit allowed: 500)."}]}),e.jsx(a,{title:"Sample Response (200 OK)",section:"billers_res",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/fetch-bill"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Fetch Customer Bill Amount"})]}),e.jsx("p",{className:"text-xs text-slate-300",children:"Query the biller's server in real time to fetch customer bill details, due date, customer name, and bill amount."}),e.jsx(j,{params:[{name:"billerId",type:"String",required:!0,desc:"Exact Biller ID retrieved from the /billers API."},{name:"mobile",type:"String",required:!0,desc:"10-digit customer mobile number."},{name:"customerParams",type:"Array of Objects",required:!0,desc:"Array of { name, value } objects matching the biller's required input parameters."}]}),e.jsx(a,{title:"Sample Request Body",section:"fetch_req_code",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4 relative overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 right-0 p-36 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"}),e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3 relative z-10",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/pay-bill"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Execute Bill Payment"})]}),e.jsx("p",{className:"text-xs text-slate-300 relative z-10",children:"Execute the bill payment. Validates agent BBPS wallet balance, deducts funds, and processes payment via BBPS gateway."}),e.jsxs("div",{className:"relative z-10",children:[e.jsx("h4",{className:"font-semibold text-white text-xs mb-2",children:"Request Payload Parameters:"}),e.jsx(j,{params:[{name:"billerId",type:"String",required:!0,desc:"Target Biller ID (e.g., 'DGVCL0000GUJ01', 'SBIC00000NATDN')."},{name:"amount",type:"Number",required:!0,desc:"Amount to be paid in Rupees (e.g. 1500.00). Pass full bill amount or custom partial amount."},{name:"mobile",type:"String",required:!0,desc:"10-digit customer mobile number."},{name:"paymentMode",type:"String",required:!1,desc:"Payment mode: 'Cash', 'UPI', 'Internet Banking', 'Debit Card', 'Credit Card'. Default: 'Cash'."},{name:"client_transaction_id",type:"String",required:!1,desc:"Your system's unique transaction/order ID for idempotency & tracing."},{name:"customerParams",type:"Array of Objects",required:!0,desc:"Array of { name, value } matching required biller parameters."},{name:"customerPan",type:"String",required:!1,desc:"Customer 10-digit PAN Card (MANDATORY for Cash payments >= ₹50,000)."},{name:"billerResponseInfo",type:"Object",required:!1,desc:"Pass exact billerResponse object returned by /fetch-bill."},{name:"additionalInfo",type:"Array of Objects",required:!1,desc:"Optional metadata array like [{ infoName: 'Remark', infoValue: 'Payment' }]."}]})]}),e.jsx(a,{title:"Complete Request Payload Example",section:"pay_req_full",code:`{
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
}`}),e.jsx(a,{title:"Success Response (200 OK - Payment Processed Successfully)",section:"pay_res_success",code:`{
  "status": "success",
  "message": "Bill Paid successfully",
  "transaction_id": "BBPSU1283118228",
  "client_transaction_id": "TXN_ORD_20260814_001",
  "bbps_txn_ref_id": "CC016226CBAF13851712",
  "payment_status": "success",
  "charge_deducted": 10.00
}`}),e.jsx(a,{title:"Error Response (400 Bad Request - Insufficient Wallet Balance)",section:"pay_res_insufficient",code:`{
  "status": "error",
  "message": "Insufficient Wallet Balance. Required: ₹1510.00, Current Balance: ₹450.00"
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4 relative overflow-hidden",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3 relative z-10",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/status/:transaction_id"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Live Status & Auto-Refund"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed relative z-10",children:["Check real-time live transaction status. Query using any of the 4 identifiers: ",e.jsx("code",{children:"BBPSU..."}),", ",e.jsx("code",{children:"client_transaction_id"}),", ",e.jsx("code",{children:"fetchRequestId"}),", or ",e.jsx("code",{children:"CC01..."}),"."]}),e.jsx(a,{title:"Sample Success Response (200 OK)",section:"status_res_code",code:`{
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
    "message": "Bill payment failed to connect to biller gateway. BBPS wallet automatically refunded.",
    "refund_status": "REFUNDED",
    "refunded_amount": 1500.00,
    "polled_at": "2026-08-14T03:15:00.000Z"
  }
}`})]})]}),b&&e.jsxs("div",{className:"space-y-8",children:[e.jsxs("div",{className:"flex items-center gap-2 pt-2",children:[e.jsx("span",{className:"h-2.5 w-2.5 rounded-full bg-purple-400 animate-pulse"}),e.jsx("h3",{className:"text-sm font-bold uppercase tracking-wider text-purple-400",children:"Instant Bank Payout Endpoints (24x7 IMPS / NEFT)"})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/payout/transfer"]}),e.jsx("span",{className:"text-xs text-purple-300 font-mono font-semibold",children:"24x7 Instant Bank Transfer"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed",children:["Execute 24x7 real-time bank account transfer via IMPS or NEFT. Deducts ",e.jsx("code",{children:"Amount + Slab Fee"})," strictly from your dedicated ",e.jsx("strong",{children:"Payout Wallet"}),". If the upstream bank transfer fails, funds are automatically refunded to your Payout Wallet."]}),e.jsx(j,{params:[{name:"amount",type:"Number",required:!0,desc:"Transfer amount in INR (₹100 to ₹2,00,000)."},{name:"account_number",type:"String",required:!0,desc:"Beneficiary bank account number (8 to 22 digits)."},{name:"ifsc_code",type:"String",required:!0,desc:"Beneficiary bank IFSC Code (11 alphanumeric characters)."},{name:"beneficiary_name",type:"String",required:!0,desc:"Name of the bank account holder."},{name:"transfer_mode",type:"String",required:!1,desc:"Transfer mode: 'IMPS' (default, 24x7 instant) or 'NEFT'."},{name:"client_order_id",type:"String",required:!1,desc:"Your system's unique transaction/order ID for idempotency and status query."},{name:"bank_name",type:"String",required:!1,desc:"Optional name of the beneficiary bank."}]}),e.jsx(a,{title:"Sample Request Body",section:"payout_req_body",code:`{
  "amount": 2500.00,
  "account_number": "91234567890123",
  "ifsc_code": "HDFC0001234",
  "beneficiary_name": "Ramesh Kumar",
  "transfer_mode": "IMPS",
  "client_order_id": "ORD_PAYOUT_1001",
  "bank_name": "HDFC Bank"
}`}),e.jsx(a,{title:"Sample Success Response (200 OK)",section:"payout_res_success",code:`{
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
}`}),e.jsx(a,{title:"Sample Failed & Refunded Response (400 Bad Request)",section:"payout_res_failed",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/payout/status/:order_id"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Payout Status & Bank UTR"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed",children:["Query the real-time status of a payout transfer using either the system ",e.jsx("code",{children:"order_id"})," or your own ",e.jsx("code",{children:"client_order_id"}),"."]}),e.jsx(a,{title:"Sample Response (200 OK)",section:"payout_status_res",code:`{
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
    "created_at": "2026-09-27T08:15:00.000Z",
    "updated_at": "2026-09-27T08:15:02.000Z"
  }
}`})]})]}),e.jsxs("div",{className:"space-y-8",children:[e.jsxs("div",{className:"flex items-center gap-2 pt-2",children:[e.jsx("span",{className:"h-2.5 w-2.5 rounded-full bg-indigo-400 animate-pulse"}),e.jsx("h3",{className:"text-sm font-bold uppercase tracking-wider text-indigo-400",children:"Wallet Fund Management & Deposit APIs"})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/admin-bank-accounts"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Get Admin Bank Accounts List"})]}),e.jsx("p",{className:"text-xs text-slate-300 leading-relaxed",children:"Retrieve active company bank accounts configured by B2B Admin for wallet fund top-up. Render these accounts in a dropdown list for the agent to select their deposit destination."}),e.jsx(a,{title:"Sample Response (200 OK)",section:"admin_banks_res",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"POST"}),"/fund-request"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Submit B2B Fund Request"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed",children:["Submit a wallet fund request electronically. Select target destination using ",e.jsx("code",{children:'wallet_type: "bbps"'})," or ",e.jsx("code",{children:'"payout"'})," based on your enabled service. Your request will be queued in ",e.jsx("code",{children:"pending"})," status for B2B Admin verification and approval."]}),e.jsx(a,{title:"Sample Request Body",section:"fund_req_body",code:`{
  "amount": 50000,
  "utr_number": "UTR9876543210",
  "wallet_type": "${b&&!p?"payout":"bbps"}",
  "admin_bank_account_id": "a98e21bc-1234-4567-89ab-cdef01234567",
  "proof_url": "https://example.com/payment_receipt.jpg"
}`}),e.jsx(a,{title:"Sample Success Response (201 Created)",section:"fund_req_res",code:`{
  "status": "success",
  "message": "Fund request submitted successfully and pending approval",
  "data": {
    "request_id": "88a912bc-9430-4e2b-8a2b-103bc4a9192b",
    "amount": 50000,
    "utr_number": "UTR9876543210",
    "wallet_type": "${b&&!p?"payout":"bbps"}",
    "status": "pending",
    "submitted_at": "2026-08-15T00:33:00.000Z"
  }
}`}),e.jsx(j,{params:[{name:"amount",type:"Number",required:!0,desc:"Amount in INR (₹) requested to credit to your account."},{name:"utr_number",type:"String",required:!0,desc:"Unique Bank Transaction Reference / UTR Number."},{name:"wallet_type",type:"String",required:!1,desc:"Target wallet destination: 'bbps' (Utility Bill Payment) or 'payout' (Instant Payout). Default: 'bbps'."},{name:"admin_bank_account_id",type:"String",required:!1,desc:"Optional ID of the Admin Bank Account where money was deposited."},{name:"proof_url",type:"String",required:!1,desc:"Optional URL linking to payment receipt or transaction screenshot."}]})]}),e.jsxs("div",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between border-b border-slate-700/80 pb-3",children:[e.jsxs("h3",{className:"text-lg font-bold text-white flex items-center gap-3",children:[e.jsx("span",{className:"bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-xs uppercase font-extrabold tracking-wider",children:"GET"}),"/fund-request/status/:request_id"]}),e.jsx("span",{className:"text-xs text-slate-400 font-mono font-semibold",children:"Check Fund Request Status"})]}),e.jsxs("p",{className:"text-xs text-slate-300 leading-relaxed",children:["Check the live approval status (",e.jsx("code",{children:"pending"}),", ",e.jsx("code",{children:"approved"}),", ",e.jsx("code",{children:"rejected"}),") of a submitted fund request."]}),e.jsx(a,{title:"Sample Response (200 OK)",section:"fund_req_status_res",code:`{
  "status": "success",
  "data": {
    "request_id": "88a912bc-9430-4e2b-8a2b-103bc4a9192b",
    "amount": 50000,
    "utr_number": "UTR9876543210",
    "wallet_type": "${b&&!p?"payout":"bbps"}",
    "status": "approved",
    "proof_url": null,
    "created_at": "2026-08-15T00:33:00.000Z",
    "updated_at": "2026-08-15T00:35:00.000Z"
  }
}`})]})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("div",{className:"flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/80 pb-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2",children:[e.jsx(he,{className:"h-5 w-5 text-indigo-400"}),"3. Code Integration Examples"]}),g&&e.jsxs("div",{className:"flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-700",children:[e.jsx("button",{onClick:()=>_("bbps"),className:`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${R==="bbps"?"bg-emerald-600 text-white":"text-slate-400 hover:text-white"}`,children:"Bill Payment (/pay-bill)"}),e.jsx("button",{onClick:()=>_("payout"),className:`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${R==="payout"?"bg-purple-600 text-white":"text-slate-400 hover:text-white"}`,children:"Payout Transfer (/payout/transfer)"})]})]}),e.jsxs("div",{className:"flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/70 w-fit",children:[e.jsx("button",{onClick:()=>T("curl"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${i==="curl"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"cURL"}),e.jsx("button",{onClick:()=>T("nodejs"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${i==="nodejs"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"Node.js (Axios)"}),e.jsx("button",{onClick:()=>T("python"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${i==="python"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"Python (Requests)"}),e.jsx("button",{onClick:()=>T("php"),className:`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${i==="php"?"bg-indigo-600 text-white shadow":"text-slate-400 hover:text-white"}`,children:"PHP (cURL)"})]}),(g?R:m?"payout":"bbps")==="payout"?e.jsxs(e.Fragment,{children:[i==="curl"&&e.jsx(a,{title:"cURL Request Example (/payout/transfer)",section:"code_curl_payout",code:`curl -X POST "${x}/api/v1/b2b/payout/transfer" \\
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
  }'`}),i==="nodejs"&&e.jsx(a,{title:"Node.js Integration Example (Axios - Instant Payout)",section:"code_nodejs_payout",code:`const axios = require('axios');

async function sendPayout() {
  try {
    const response = await axios.post('${x}/api/v1/b2b/payout/transfer', {
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

sendPayout();`}),i==="python"&&e.jsx(a,{title:"Python Integration Example (Requests - Instant Payout)",section:"code_python_payout",code:`import requests

url = "${x}/api/v1/b2b/payout/transfer"
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
print("Payout Result:", response.json())`}),i==="php"&&e.jsx(a,{title:"PHP Integration Example (cURL - Instant Payout)",section:"code_php_payout",code:`<?php
$ch = curl_init("${x}/api/v1/b2b/payout/transfer");

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
?>`})]}):e.jsxs(e.Fragment,{children:[i==="curl"&&e.jsx(a,{title:"cURL Request Example (/pay-bill)",section:"code_curl",code:`curl -X POST "${x}/api/v1/b2b/pay-bill" \\
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
  }'`}),i==="nodejs"&&e.jsx(a,{title:"Node.js Integration Example (Axios - Bill Payment)",section:"code_nodejs",code:`const axios = require('axios');

async function payBill() {
  try {
    const response = await axios.post('${x}/api/v1/b2b/pay-bill', {
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

payBill();`}),i==="python"&&e.jsx(a,{title:"Python Integration Example (Requests - Bill Payment)",section:"code_python",code:`import requests

url = "${x}/api/v1/b2b/pay-bill"
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
print("Payment Result:", response.json())`}),i==="php"&&e.jsx(a,{title:"PHP Integration Example (cURL - Bill Payment)",section:"code_php",code:`<?php
$ch = curl_init("${x}/api/v1/b2b/pay-bill");

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
?>`})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3",children:[e.jsx(W,{className:"h-5 w-5 text-indigo-400"}),"4. Webhook Notifications (Asynchronous Callbacks)"]}),e.jsxs("p",{className:"text-xs text-slate-300",children:["When transactions are initiated and return a ",e.jsx("code",{children:"pending"})," status, our background engine continuously verifies status. Once confirmed as ",e.jsx("strong",{children:"Success"})," or ",e.jsx("strong",{children:"Failed"}),", an HTTP POST callback is dispatched to your configured Webhook URL."]}),b&&e.jsxs("div",{className:"space-y-3 pt-2",children:[e.jsxs("h4",{className:"text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2",children:[e.jsx(E,{className:"h-4 w-4"})," Instant Payout Webhook Payloads"]}),e.jsx(a,{title:"Payout Webhook Payload (Transfer Success)",section:"webhook_payout_success",code:`{
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
}`}),e.jsx(a,{title:"Payout Webhook Payload (Transfer Failed & Auto-Refunded)",section:"webhook_payout_failed",code:`{
  "event": "PAYOUT_STATUS_UPDATE",
  "order_id": "B2BPO1727443912001",
  "client_order_id": "ORD_PAYOUT_1001",
  "status": "failed",
  "amount": 2500.00,
  "fee": 25.00,
  "refunded_to_payout_wallet": true,
  "message": "Beneficiary account inactive or invalid IFSC. Funds refunded to payout wallet.",
  "timestamp": "2026-09-27T08:15:02.000Z"
}`})]}),p&&e.jsxs("div",{className:"space-y-3 pt-2",children:[e.jsxs("h4",{className:"text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2",children:[e.jsx(V,{className:"h-4 w-4"})," Utility Bill Payment Webhook Payloads"]}),e.jsx(a,{title:"BBPS Webhook Payload Example (Transaction Success)",section:"webhook_success_payload",code:`{
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
}`}),e.jsx(a,{title:"BBPS Webhook Payload Example (Transaction Failed & Instant Refunded)",section:"webhook_failed_payload",code:`{
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
}`})]}),e.jsxs("div",{className:"bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-200 flex items-start gap-3",children:[e.jsx(D,{className:"h-5 w-5 text-emerald-400 shrink-0 mt-0.5"}),e.jsxs("div",{children:[e.jsx("strong",{className:"block mb-1 text-emerald-300",children:"Automated Wallet Refund Guarantee:"}),"If any transaction is marked as ",e.jsx("code",{children:"FAILED"})," by the upstream banking network or biller gateway, the system automatically refunds 100% of the principal amount and applicable charges back to your respective wallet instantly."]})]})]}),e.jsxs("section",{className:"bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-4",children:[e.jsxs("h2",{className:"text-xl font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3",children:[e.jsx(Y,{className:"h-5 w-5 text-rose-400"}),"5. Error Codes & Troubleshooting Matrix"]}),e.jsx("div",{className:"overflow-x-auto rounded-xl border border-slate-700/80",children:e.jsxs("table",{className:"w-full text-left text-xs",children:[e.jsx("thead",{className:"bg-slate-900/90 text-slate-300",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-4 py-3 font-semibold text-rose-400",children:"HTTP Status"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-indigo-300",children:"Response Status"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Error Description & Root Cause"}),e.jsx("th",{className:"px-4 py-3 font-semibold text-slate-400",children:"Recommended Action"})]})}),e.jsxs("tbody",{className:"divide-y divide-slate-700/50 bg-slate-900/40",children:[e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"400 Bad Request"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Insufficient Wallet Balance (BBPS or Payout wallet)."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Submit /fund-request for target wallet and retry."})]}),b&&e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"400 Bad Request"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"failed"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Invalid IFSC code or beneficiary bank account inactive."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Check bank account and IFSC details. Auto-refunded."})]}),p&&e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"400 Bad Request"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Payment mode 'Cash' disabled by biller."}),e.jsxs("td",{className:"px-4 py-3 text-slate-300",children:["Pass ",e.jsx("code",{children:'paymentMode: "UPI"'})," or ",e.jsx("code",{children:'"Internet Banking"'}),"."]})]}),e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-amber-400",children:"401 Unauthorized"}),e.jsx("td",{className:"px-4 py-3 font-mono text-amber-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Invalid API/Secret Keys or IP address not whitelisted."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Verify credentials and whitelist server IP in B2B settings."})]}),e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-amber-400",children:"429 Rate Limit"}),e.jsx("td",{className:"px-4 py-3 font-mono text-amber-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Daily sync limit reached for directory endpoints."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Cache biller / bank data locally and query as needed."})]}),e.jsxs("tr",{className:"hover:bg-slate-800/40",children:[e.jsx("td",{className:"px-4 py-3 font-mono font-bold text-rose-400",children:"500 Server Error"}),e.jsx("td",{className:"px-4 py-3 font-mono text-rose-300",children:"error"}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Upstream Biller or Bank Gateway Timeout / System Down."}),e.jsx("td",{className:"px-4 py-3 text-slate-300",children:"Wallet is auto-refunded. Retry after a few minutes."})]})]})]})})]})]})}export{Ie as default};
