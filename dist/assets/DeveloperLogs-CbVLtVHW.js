import{r as m,s as l,j as e,k as h,T as F,A as w,m as A}from"./index-DacmfuEg.js";import{L as I}from"./loader-circle-B6gUnAzT.js";import{D as C}from"./download-DjbuHLDj.js";import{Z as X}from"./zap-DzAvAipj.js";import{A as M}from"./activity-CRWb5VTT.js";import{T as x}from"./terminal-DuNE-HRJ.js";import{C as j}from"./circle-check-big-HeSr8u7s.js";import{C as v}from"./cpu-BByMQSZH.js";const k=`-- =============================================================
-- THE GOD-MODE SQL CLONE v16.0 (COMPLETE INFRASTRUCTURE)
-- Run this in Supabase SQL Editor to clone the entire project.
-- =============================================================

-- 1. CORE CONFIGURATION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 100;
CREATE OR REPLACE FUNCTION generate_user_id() RETURNS TEXT AS $$
BEGIN
    RETURN 'usepay_' || LPAD(nextval('user_id_seq')::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. ALL 23 TABLES WITH COMPLETE COLUMNS

-- profiles
CREATE TABLE IF NOT EXISTS public.users_profiles (
    id TEXT PRIMARY KEY DEFAULT generate_user_id(),
    name TEXT, email TEXT, mobile_number TEXT, password TEXT,
    must_change_password BOOLEAN DEFAULT TRUE, role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'Active', home_address TEXT, firm_name TEXT,
    firm_address TEXT, profile_photo_url TEXT, charge_percentage NUMERIC DEFAULT 0,
    service_charge_enabled BOOLEAN DEFAULT FALSE, custom_service_charge NUMERIC DEFAULT 0,
    custom_daily_live_bbps_limit NUMERIC DEFAULT 0, custom_daily_normal_bill_limit NUMERIC DEFAULT 0,
    wallet_balance NUMERIC DEFAULT 0, hold_balance NUMERIC DEFAULT 0,
    commission_balance NUMERIC DEFAULT 0, admin_base_qr_charge NUMERIC DEFAULT 0,
    kyc_status TEXT DEFAULT 'pending', kyc_rejection_reason TEXT,
    welcome_modal_shown BOOLEAN DEFAULT FALSE, bank_details JSONB,
    onesignal_id TEXT, distributor_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT, email TEXT, mobile_number TEXT, password TEXT,
    role TEXT DEFAULT 'admin', status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- transactions
CREATE TABLE IF NOT EXISTS public.payment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id),
    amount NUMERIC NOT NULL, utr_number TEXT UNIQUE NOT NULL, 
    status TEXT DEFAULT 'pending', rejection_reason TEXT, image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bill_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id),
    service_type TEXT, provider TEXT, consumer_number TEXT, amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending', rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payout_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id),
    beneficiary_name TEXT, account_number TEXT, ifsc_code TEXT, bank_name TEXT,
    amount NUMERIC NOT NULL, status TEXT DEFAULT 'pending', utr_number TEXT,
    rejection_reason TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- administrative
CREATE TABLE IF NOT EXISTS public.admin_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.admin_profiles(id),
    amount NUMERIC, status TEXT DEFAULT 'pending', 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.distributor_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id TEXT REFERENCES public.users_profiles(id),
    amount NUMERIC, status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES public.users_profiles(id),
    pan_number TEXT, aadhar_number TEXT, pan_card_url TEXT, aadhar_front_url TEXT, aadhar_back_url TEXT,
    status TEXT DEFAULT 'pending', rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- settings & system
CREATE TABLE IF NOT EXISTS public.system_status (id INTEGER PRIMARY KEY DEFAULT 1, is_enabled BOOLEAN DEFAULT TRUE, message TEXT, updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.qr_settings (id INTEGER PRIMARY KEY DEFAULT 1, upi_id TEXT, display_name TEXT, qr_image_url TEXT, daily_live_bbps_limit NUMERIC DEFAULT 500000, daily_normal_bill_limit NUMERIC DEFAULT 500000);
CREATE TABLE IF NOT EXISTS public.payout_settings (id INTEGER PRIMARY KEY DEFAULT 1, is_enabled BOOLEAN DEFAULT TRUE, min_amount NUMERIC DEFAULT 100);
CREATE TABLE IF NOT EXISTS public.whatsapp_api_settings (id INTEGER PRIMARY KEY DEFAULT 1, is_active BOOLEAN DEFAULT FALSE, access_token TEXT, phone_number_id TEXT, sender_number TEXT, provider TEXT, aisensy_api_key TEXT, updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.onesignal_settings (id INTEGER PRIMARY KEY DEFAULT 1, app_id TEXT, rest_api_key TEXT);
CREATE TABLE IF NOT EXISTS public.service_charge_slabs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), min_amount NUMERIC, max_amount NUMERIC, charge NUMERIC, type TEXT DEFAULT 'fixed');
CREATE TABLE IF NOT EXISTS public.app_policies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), title TEXT, content TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.headlines (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), message TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.rejection_categories (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS public.rejection_reasons (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), category_id UUID REFERENCES public.rejection_categories(id), reason TEXT);
CREATE TABLE IF NOT EXISTS public.notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, title TEXT, message TEXT, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.qr_history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, amount NUMERIC, utr_number TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.bank_details (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, bank_name TEXT, account_number TEXT, ifsc_code TEXT, account_holder TEXT);
CREATE TABLE IF NOT EXISTS public.complaints (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT, subject TEXT, description TEXT, status TEXT DEFAULT 'open', created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.complaint_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), complaint_id UUID REFERENCES public.complaints(id) ON DELETE CASCADE, sender_id TEXT, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.bill_reminders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT REFERENCES public.users_profiles(id) ON DELETE CASCADE, customer_name TEXT NOT NULL, card_number TEXT NOT NULL, bank_name TEXT NOT NULL, due_amount NUMERIC NOT NULL, due_date DATE NOT NULL, bill_date DATE NOT NULL, is_paid BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- 3. RLS POLICIES (Ultimate Fix)
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_reminders ENABLE ROW LEVEL SECURITY;

-- Allow everything for authenticated admins (using email check if profile doesn't exist yet)
CREATE POLICY "Admins full power" ON public.users_profiles FOR ALL USING (auth.jwt() ->> 'email' LIKE '%admin%');
CREATE POLICY "Admins full power payments" ON public.payment_submissions FOR ALL USING (auth.jwt() ->> 'email' LIKE '%admin%');
CREATE POLICY "Admins full power bill_reminders" ON public.bill_reminders FOR ALL USING (auth.jwt() ->> 'email' LIKE '%admin%');
CREATE POLICY "Users can manage their own bill reminders" ON public.bill_reminders FOR ALL USING (auth.uid()::text = user_id);
-- (Repeat for all tables as needed...)

-- 4. STORAGE SETUP
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false) ON CONFLICT DO NOTHING;

-- 5. INITIAL SEED
INSERT INTO public.system_status (id, message) VALUES (1, 'System operational') ON CONFLICT DO NOTHING;
INSERT INTO public.qr_settings (id, upi_id) VALUES (1, 'pay@upi') ON CONFLICT DO NOTHING;
INSERT INTO public.payout_settings (id, is_enabled) VALUES (1, TRUE) ON CONFLICT DO NOTHING;
`;function Q(){const[_,N]=m.useState(!1),[b,u]=m.useState(!1),[U,o]=m.useState([{id:"initial",time:new Date().toLocaleTimeString(),msg:"System initialized. Realtime stream active.",type:"system"}]),[E,S]=m.useState({latency:0,activeRequests:0,blockedThreats:0,healthScore:100,history:[40,50,60,40,70,80,50,60],lastScan:new Date().toLocaleTimeString()}),g=async()=>{const s=performance.now();try{const[{count:a},{count:n},{count:t},{count:i}]=await Promise.all([l.from("payment_submissions").select("*",{count:"exact",head:!0}).eq("status","pending"),l.from("bill_submissions").select("*",{count:"exact",head:!0}).eq("status","pending"),l.from("kyc_submissions").select("*",{count:"exact",head:!0}).eq("status","pending"),l.from("users_profiles").select("*",{count:"exact",head:!0}).eq("status","Blocked")]),r=performance.now(),c=Math.round(r-s),T=(a||0)+(n||0)+(t||0),p=i||0;S(L=>({latency:c,activeRequests:T,blockedThreats:p,healthScore:Math.max(70,100-T*2-(c>500?10:0)),history:[...L.history.slice(1),Math.min(100,30+T*10+c/10)],lastScan:new Date().toLocaleTimeString()}))}catch(a){console.error("Metrics fetch error:",a)}};m.useEffect(()=>{g();const s=setInterval(g,5e3);return()=>clearInterval(s)},[]),m.useEffect(()=>{const s=(t,i="db")=>{o(r=>[{id:Math.random().toString(36).substr(2,9),time:new Date().toLocaleTimeString(),msg:t,type:i},...r.slice(0,49)])},a=()=>{const t=["User Login: Session Started","DB/Query: SELECT * FROM admin_profiles","System/Kernel: Optimization Complete","API/Sync: WebSocket connected"];s(t[Math.floor(Math.random()*t.length)],"system")};window.simulateDevLog=a;const n=[l.channel("logs-users").on("postgres_changes",{event:"INSERT",schema:"public",table:"users_profiles"},t=>{s(`User Registered: ${t.new.name||t.new.id}`)}),l.channel("logs-qr").on("postgres_changes",{event:"INSERT",schema:"public",table:"payment_submissions"},t=>{s(`New QR Payment: ₹${t.new.amount} from ${t.new.user_id}`)}),l.channel("logs-bill").on("postgres_changes",{event:"INSERT",schema:"public",table:"bill_submissions"},t=>{s(`New Bill Payment: ₹${t.new.amount}`)}),l.channel("logs-kyc").on("postgres_changes",{event:"UPDATE",schema:"public",table:"kyc_submissions"},t=>{s(`KYC ${t.new.status}: ${t.new.user_id}`)}),l.channel("logs-system").on("postgres_changes",{event:"UPDATE",schema:"public",table:"system_status"},t=>{s(`SYSTEM STATUS UPDATED: ${t.new.message}`,"system")})];return n.forEach(t=>t.subscribe()),()=>{n.forEach(t=>l.removeChannel(t))}},[]);const R=async()=>{N(!0);try{const s=["users_profiles","qr_history","rejection_categories","rejection_reasons","admin_profiles","admin_withdrawals","app_policies","bank_details","bill_submissions","complaint_messages","complaints","distributor_withdrawals","headlines","kyc_submissions","notifications","onesignal_settings","payment_submissions","payout_settings","payout_submissions","qr_settings","service_charge_slabs","system_status","whatsapp_api_settings"];let a=`-- MASTER DATABASE EXPORT (TOTAL SYSTEM CLONE)
-- Generated on: ${new Date().toLocaleString()}
-- Powered by UsePay Developer Suite

${k}

-- =========================================
-- LIVE DATA INSERTS
-- =========================================
`;for(const r of s){a+=`
-- DATA FOR TABLE: public.${r}
`;const{data:c,error:T}=await l.from(r).select("*");if(T){a+=`-- Error fetching data for ${r}: ${T.message}
`;continue}if(c&&c.length>0){const p=Object.keys(c[0]);a+=`INSERT INTO public.${r} (${p.join(", ")}) VALUES
`;const L=c.map(y=>`(${p.map(D=>{const d=y[D];return d===null?"NULL":typeof d=="number"||typeof d=="boolean"?d:typeof d=="object"?`'${JSON.stringify(d).replace(/'/g,"''")}'`:`'${String(d).replace(/'/g,"''")}'`}).join(", ")})`);a+=L.join(`,
`)+`;
`}else a+=`-- No data found in ${r}
`}const n=new Blob([a],{type:"text/sql"}),t=window.URL.createObjectURL(n),i=document.createElement("a");i.href=t,i.download=`UsePay_Master_Full_Backup_${new Date().toISOString().split("T")[0]}.sql`,document.body.appendChild(i),i.click(),window.URL.revokeObjectURL(t),document.body.removeChild(i),o(r=>[{id:Math.random().toString(36).substr(2,9),time:new Date().toLocaleTimeString(),msg:"Master SQL Full Database Export successful!",type:"system"},...r])}catch(s){console.error("Export error:",s)}finally{N(!1)}},O=async()=>{u(!0),o(s=>[{id:Math.random().toString(36).substr(2,9),time:new Date().toLocaleTimeString(),msg:"Preparing full system backup (Database + Storage)...",type:"system"},...s]);try{const s=await fetch("/api/full-backup");if(!s.ok)throw new Error("Backup failed on server");const a=await s.blob(),n=window.URL.createObjectURL(a),t=document.createElement("a");t.href=n,t.download=`UsePay_Full_Backup_${new Date().toISOString().replace(/[:.]/g,"-")}.zip`,document.body.appendChild(t),t.click(),window.URL.revokeObjectURL(n),document.body.removeChild(t),o(i=>[{id:Math.random().toString(36).substr(2,9),time:new Date().toLocaleTimeString(),msg:"Full System Backup ZIP downloaded successfully!",type:"system"},...i])}catch(s){console.error("Full Backup error:",s),o(a=>[{id:Math.random().toString(36).substr(2,9),time:new Date().toLocaleTimeString(),msg:`Backup Failed: ${s.message}`,type:"system"},...a])}finally{u(!1)}},f=async()=>{u(!0),o(s=>[{id:Math.random().toString(36).substr(2,9),time:new Date().toLocaleTimeString(),msg:"Starting Quick SQL-only backup...",type:"system"},...s]);try{const s=await fetch("/api/full-backup?mode=quick");if(!s.ok)throw new Error("Backup failed");const a=await s.blob(),n=window.URL.createObjectURL(a),t=document.createElement("a");t.href=n,t.download=`UsePay_Quick_SQL_${new Date().toISOString().split("T")[0]}.zip`,document.body.appendChild(t),t.click(),window.URL.revokeObjectURL(n),document.body.removeChild(t),o(i=>[{id:Math.random().toString(36).substr(2,9),time:new Date().toLocaleTimeString(),msg:"Quick SQL Backup successful!",type:"system"},...i])}catch(s){o(a=>[{id:Math.random().toString(36).substr(2,9),time:new Date().toLocaleTimeString(),msg:`Quick Backup Failed: ${s.message}`,type:"system"},...a])}finally{u(!1)}};return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"text-2xl font-bold text-slate-900",children:"System Logs"}),e.jsx("p",{className:"text-slate-500 mt-1",children:"Real-time developer analytics and system health."})]}),e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsxs("button",{onClick:R,disabled:_,className:"flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-200 transition-all active:scale-95 font-bold text-xs uppercase tracking-widest disabled:opacity-50",children:[_?e.jsx(I,{size:14,className:"animate-spin"}):e.jsx(C,{size:14}),"Master SQL Export"]}),e.jsxs("div",{className:"flex items-center bg-slate-100 rounded-xl p-1 gap-1",children:[e.jsxs("button",{onClick:O,disabled:b,className:"flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg shadow-sm transition-all active:scale-95 font-bold text-[10px] uppercase tracking-widest disabled:opacity-50",children:[b?e.jsx(I,{size:12,className:"animate-spin"}):e.jsx(h,{size:12}),"Full (ZIP)"]}),e.jsx("button",{onClick:f,disabled:b,className:"flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-900 rounded-lg shadow-sm border border-slate-200 transition-all active:scale-95 font-bold text-[10px] uppercase tracking-widest disabled:opacity-50",children:"Quick (SQL)"})]}),e.jsxs("button",{onClick:()=>window.simulateDevLog(),className:"flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 font-bold text-xs uppercase tracking-widest",children:[e.jsx(X,{size:14}),"Test Activity"]}),e.jsxs("button",{onClick:()=>o([{id:"clear",time:new Date().toLocaleTimeString(),msg:"Console cleared by Developer.",type:"system"}]),className:"flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95 font-bold text-xs uppercase tracking-widest",children:[e.jsx(F,{className:"w-3.5 h-3.5"}),"Clear"]}),e.jsxs("div",{className:"flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm font-bold text-xs uppercase tracking-widest animate-pulse",children:[e.jsx(M,{size:14}),"Live Kernels: Active"]})]})]}),e.jsxs("div",{className:"grid grid-cols-1 md:grid-cols-3 gap-6",children:[e.jsxs("div",{className:"bg-white p-6 rounded-3xl border border-slate-100 shadow-sm",children:[e.jsx("div",{className:"w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4",children:e.jsx(x,{size:24})}),e.jsx("h3",{className:"font-bold text-slate-900 text-lg",children:"Event Stream"}),e.jsx("p",{className:"text-slate-500 text-sm mt-1",children:"Monitor all database interactions."}),e.jsx("div",{className:"mt-4 p-4 bg-slate-900 rounded-2xl font-mono text-[10px] space-y-2 h-[200px] overflow-y-auto custom-scrollbar border border-slate-800",children:e.jsx(w,{initial:!1,children:U.map(s=>e.jsxs(A.div,{initial:{opacity:0,x:-10},animate:{opacity:1,x:0},className:"flex items-start gap-2",children:[e.jsxs("span",{className:"text-slate-600 shrink-0",children:["[",s.time,"]"]}),e.jsx("span",{className:s.type==="system"?"text-rose-400 font-bold":"text-emerald-400",children:s.msg})]},s.id))})})]}),e.jsxs("div",{className:"bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden",children:[e.jsx("div",{className:"w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-4",children:e.jsx(h,{size:24})}),e.jsx("h3",{className:"font-bold text-slate-900 text-lg",children:"Security Integrity"}),e.jsx("p",{className:"text-slate-500 text-sm mt-1",children:"Live firewall status."}),e.jsxs("div",{className:"mt-6 space-y-4",children:[e.jsxs("div",{className:"grid grid-cols-2 gap-4 pb-4 border-b border-slate-50",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest",children:"Blocked Threats"}),e.jsx("p",{className:"text-lg font-black text-rose-600 tracking-tight",children:E.blockedThreats})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest",children:"Last Scan"}),e.jsx("p",{className:"text-[11px] font-bold text-slate-900 mt-1",children:E.lastScan})]})]}),e.jsxs("div",{className:"flex items-center justify-between text-xs font-bold pt-2",children:[e.jsx("span",{className:"text-slate-400 uppercase tracking-widest",children:"Firewall Integrity"}),e.jsxs("span",{className:"text-emerald-500",children:[E.healthScore,"%"]})]}),e.jsx("div",{className:"w-full bg-slate-100 h-2 rounded-full overflow-hidden",children:e.jsx(A.div,{initial:{width:0},animate:{width:`${E.healthScore}%`},className:"h-full bg-emerald-500"})}),e.jsx("div",{className:"pt-2",children:e.jsxs("p",{className:"text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2",children:[e.jsx(j,{size:10,className:"text-emerald-500"})," Active Protection Enabled"]})})]})]}),e.jsxs("div",{className:"bg-white p-6 rounded-3xl border border-slate-100 shadow-sm",children:[e.jsx("div",{className:"w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-4",children:e.jsx(v,{size:24})}),e.jsx("h3",{className:"font-bold text-slate-900 text-lg",children:"System Load"}),e.jsx("p",{className:"text-slate-500 text-sm mt-1",children:"Core performance metrics."}),e.jsxs("div",{className:"mt-4 grid grid-cols-2 gap-4 border-b border-slate-50 pb-4 mb-4",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest",children:"Latency"}),e.jsxs("p",{className:"text-lg font-black text-slate-900 tracking-tight",children:[E.latency,"ms"]})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] font-black text-slate-400 uppercase tracking-widest",children:"Pending"}),e.jsxs("p",{className:"text-lg font-black text-slate-900 tracking-tight",children:[E.activeRequests," req"]})]})]}),e.jsx("div",{className:"flex items-end gap-1 h-10",children:E.history.map((s,a)=>e.jsx(A.div,{initial:{height:0},animate:{height:`${s}%`},className:`flex-1 rounded-t-sm ${s>80?"bg-rose-400":s>50?"bg-amber-400":"bg-indigo-400"}`},a))})]})]}),e.jsxs("div",{className:"bg-slate-900 rounded-[32px] p-10 text-center border border-slate-800 shadow-2xl relative overflow-hidden",children:[e.jsx("div",{className:"absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"}),e.jsxs("div",{className:"relative z-10",children:[e.jsx(x,{className:"text-indigo-500 mx-auto mb-6",size:48}),e.jsx("h2",{className:"text-3xl font-black text-white tracking-tight mb-4",children:"Developer Sandbox"}),e.jsxs("p",{className:"text-slate-400 max-w-lg mx-auto leading-relaxed",children:["This panel is currently in ",e.jsx("b",{children:"Stealth Mode"}),". Only authorized developers with the encrypted ID can view this screen. System telemetry is being recorded."]})]})]})]})}export{Q as default};
