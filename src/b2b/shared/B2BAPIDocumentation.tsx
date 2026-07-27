import React, { useState } from 'react';
import { Book, Code, Key, Server, AlertCircle, Copy, CheckCircle2, Activity } from 'lucide-react';

export default function B2BAPIDocumentation() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const CodeBlock = ({ title, code, section }: { title: string, code: string, section: string }) => (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden my-4">
      <div className="flex justify-between items-center px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs font-mono text-slate-400">{title}</span>
        <button 
          onClick={() => copyToClipboard(code, section)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          {copiedSection === section ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm font-mono text-emerald-400 leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Book className="h-6 w-6 text-indigo-400" />
          API Documentation
        </h2>
        <p className="text-slate-400">Complete guide to integrating with our B2B Bill Payment API.</p>
      </div>

      {/* Authentication */}
      <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />
        
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 relative z-10">
          <Key className="h-5 w-5 text-indigo-400" />
          1. Authentication & Base URL
        </h3>
        
        <div className="relative z-10 space-y-4 text-slate-300">
          <p>All API requests must be made over HTTPS. You must include your API credentials in the headers of every request.</p>
          
          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
            <span className="text-sm text-slate-400 uppercase font-semibold">Base URL</span>
            <code className="block mt-2 text-indigo-300 font-mono">{typeof window !== 'undefined' ? window.location.origin : 'https://api.yourdomain.com'}/api/b2b</code>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-2">Required Headers:</h4>
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-300">
              <li><code className="text-indigo-300 font-mono px-1 py-0.5 bg-slate-900 rounded">x-api-key</code>: Your Public API Key</li>
              <li><code className="text-indigo-300 font-mono px-1 py-0.5 bg-slate-900 rounded">x-secret-key</code>: Your Secret Key</li>
              <li><code className="text-indigo-300 font-mono px-1 py-0.5 bg-slate-900 rounded">Content-Type</code>: application/json</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section className="space-y-6">
        
        {/* Get Balance */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs uppercase tracking-wider font-bold">GET</span>
            /balance
          </h3>
          <p className="text-slate-400 mb-4">Retrieve your current wallet balance.</p>
          <CodeBlock 
            title="Response (200 OK)"
            section="balance_response"
            code={`{
  "status": "success",
  "data": {
    "balance": 15000.50
  }
}`}
          />
        </div>

        {/* Fetch Categories */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs uppercase tracking-wider font-bold">GET</span>
            /categories
          </h3>
          <p className="text-slate-400 mb-4">Fetch a list of all available biller categories (e.g., Electricity, Water).</p>
          <CodeBlock 
            title="Response (200 OK)"
            section="cat_response"
            code={`{
  "status": "success",
  "data": [
    { "category_id": 1, "category_name": "Electricity" },
    { "category_id": 2, "category_name": "Water" }
  ]
}`}
          />
        </div>

        {/* Fetch Billers */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs uppercase tracking-wider font-bold">GET</span>
            /billers
          </h3>
          <p className="text-slate-400 mb-2">Fetch billers. You can filter by category: <code>?category_id=1</code></p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-200">
              <strong>Bulk Sync Limits:</strong> For syncing databases, use pagination <code>?page=1&limit=500</code>. The maximum allowed limit per request is <strong>500</strong>. You are strictly allowed a maximum of <strong>50 requests per day</strong> to this endpoint.
            </p>
          </div>
          <CodeBlock 
            title="Response (200 OK)"
            section="billers_response"
            code={`{
  "status": "success",
  "data": [
    { 
      "biller_id": "DGVCL0000GUJ01", 
      "biller_name": "Dakshin Gujarat Vij Company Limited (DGVCL)",
      "category_id": 1,
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 500,
    "total_records": 12500,
    "total_pages": 25
  }
}`}
          />
        </div>

        {/* Fetch Bill */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs uppercase tracking-wider font-bold">POST</span>
            /fetch-bill
          </h3>
          <p className="text-slate-400 mb-4">Retrieve the outstanding bill amount for a customer.</p>
          
          <CodeBlock 
            title="Request Body"
            section="fetch_req"
            code={`{
  "billerId": "DGVCL0000GUJ01",
  "mobile": "9876543210",
  "customerParams": [
    { "name": "Consumer Number", "value": "12345678901" }
  ]
}`}
          />

          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 my-4">
            <h4 className="font-semibold text-white mb-2 text-sm">Understanding Request Parameters:</h4>
            <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
              <li><code>billerId</code>: The exact ID received from the <code>/billers</code> API.</li>
              <li><code>customerParams</code>: An array of objects. The <code>name</code> must exactly match the parameter name requested by the biller (found in the biller metadata).</li>
              <li><strong>Note:</strong> You do NOT need to send <code>initChannel</code>, <code>mac</code>, or <code>ip</code>. Our middleware server automatically handles all BBPS-mandated device info for you (e.g., passing 'AGT').</li>
            </ul>
          </div>

          <CodeBlock 
            title="Response (200 OK)"
            section="fetch_res"
            code={`{
  "status": "success",
  "data": {
    "responseCode": "000",
    "billerResponse": {
      "customerName": "JOHN DOE",
      "amount": "1500.00",
      "dueDate": "2024-01-15"
    }
  }
}`}
          />
        </div>

        {/* Pay Bill */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-32 bg-purple-500/5 blur-[100px] rounded-full pointer-events-none" />
          
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 relative z-10">
            <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs uppercase tracking-wider font-bold">POST</span>
            /pay-bill
          </h3>
          <p className="text-slate-400 mb-4 relative z-10">Process the bill payment. This will deduct the amount from your Wallet Balance.</p>
          
          <div className="relative z-10">
            <CodeBlock 
              title="Request Body"
              section="pay_req"
              code={`{
  "billerId": "DGVCL0000GUJ01",
  "amount": 1500.00,
  "mobile": "9876543210",
  "customerParams": [
    { "name": "Consumer Number", "value": "12345678901" }
  ],
  "billerResponseInfo": {
    "billAmount": "1500.00",
    "billDate": "2024-01-01"
  }
}`}
            />

            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 my-4">
              <h4 className="font-semibold text-white mb-2 text-sm">Understanding Pay Request Parameters:</h4>
              <ul className="list-disc pl-5 text-sm text-slate-300 space-y-2">
                <li><code>amount</code>: The amount to be paid. <strong>Yes, you can pass a manual/custom amount</strong> (e.g. for prepaid recharges, credit cards, or ad-hoc billers) as long as the biller supports it. For exact bills, pass the fetched amount.</li>
                <li><code>billerResponseInfo</code>: When paying a fetched bill, you MUST pass the <code>billerResponseInfo</code> object exactly as you received it in the <code>/fetch-bill</code> response (inside the <code>billerResponse</code> object). If you are doing a direct manual payment (where fetch is not required), you can pass an empty object <code>{}</code> or omit it.</li>
              </ul>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 my-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-200">
                <strong>Important:</strong> If your wallet balance is lower than the requested amount, the API will return a 400 error and the payment will not be processed.
              </p>
            </div>

            <CodeBlock 
              title="Response (200 OK)"
              section="pay_res"
              code={`{
  "status": "success",
  "transaction_id": "USEPAY6456545445",
  "payment_status": "success",
  "data": {
    "responseCode": "000",
    "billPayResponse": {
      "txnReferenceId": "BBPS12345678",
      "txnStatus": "SUCCESS"
    }
  }
}`}
            />
          </div>
        </div>

      </section>
      
      {/* BBPS Transaction Status */}
      <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          Transaction Status & BBPS Codes
        </h3>
        <p className="text-slate-400 text-sm mb-4">Our API normalizes BillAvenue's XML responses. Here is how to read the final payment status from the <code>/pay-bill</code> response.</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">payment_status</th>
                <th className="px-6 py-4 font-semibold">responseCode</th>
                <th className="px-6 py-4 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              <tr className="hover:bg-slate-700/20">
                <td className="px-6 py-4 font-bold text-emerald-400">success</td>
                <td className="px-6 py-4 font-mono text-slate-300">000</td>
                <td className="px-6 py-4 text-slate-300">Transaction was successful. BBPS generated a receipt.</td>
              </tr>
              <tr className="hover:bg-slate-700/20">
                <td className="px-6 py-4 font-bold text-amber-400">pending</td>
                <td className="px-6 py-4 font-mono text-slate-300">000 (usually)</td>
                <td className="px-6 py-4 text-slate-300">Transaction is pending at the biller's end. A status check will be required later.</td>
              </tr>
              <tr className="hover:bg-slate-700/20">
                <td className="px-6 py-4 font-bold text-red-400">failed</td>
                <td className="px-6 py-4 font-mono text-slate-300">999 (or others)</td>
                <td className="px-6 py-4 text-slate-300">Transaction failed. Wallet balance has been automatically refunded to the agent.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      
      {/* Error Codes */}
      <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Server className="h-5 w-5 text-indigo-400" />
          Error Codes
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold">HTTP Code</th>
                <th className="px-6 py-4 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              <tr className="hover:bg-slate-700/20">
                <td className="px-6 py-4 font-mono text-red-400">400</td>
                <td className="px-6 py-4 text-slate-300">Bad Request (Missing parameters or <strong>Insufficient Balance</strong>)</td>
              </tr>
              <tr className="hover:bg-slate-700/20">
                <td className="px-6 py-4 font-mono text-red-400">401</td>
                <td className="px-6 py-4 text-slate-300">Unauthorized (Invalid API/Secret Keys or IP Address not whitelisted)</td>
              </tr>
              <tr className="hover:bg-slate-700/20">
                <td className="px-6 py-4 font-mono text-amber-400">429</td>
                <td className="px-6 py-4 text-slate-300">Too Many Requests (Daily sync limit of 50 requests reached for <code>/billers</code>)</td>
              </tr>
              <tr className="hover:bg-slate-700/20">
                <td className="px-6 py-4 font-mono text-red-400">500</td>
                <td className="px-6 py-4 text-slate-300">Internal Server Error (Upstream provider failed)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Developer FAQ */}
      <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl mb-10">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Book className="h-5 w-5 text-amber-400" />
          Developer FAQ
        </h3>
        
        <div className="space-y-4 text-sm text-slate-300">
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
            <h4 className="font-bold text-white mb-1">Q: Can I process manual amounts or partial payments?</h4>
            <p className="mb-2"><strong>A:</strong> Yes! Our API fully supports custom and partial payments, provided the specific biller allows it (e.g., Credit Cards, specific Electricity Boards).</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Custom Amount:</strong> For ad-hoc billers (Fastag, Prepaid), you can directly pass your custom amount in the <code>amount</code> field of <code>/pay-bill</code>.</li>
              <li><strong>Partial Payment:</strong> If a fetched bill is for ₹10,000 but the customer wants to pay only ₹5,000, simply pass <code>5000</code> in the <code>amount</code> field. Our system will deduct exactly ₹5,000 from your wallet and process the partial payment with BBPS.</li>
            </ul>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
            <h4 className="font-bold text-white mb-1">Q: Do I need to send MAC address, IP, or initChannel?</h4>
            <p><strong>A:</strong> No. Our B2B middleware automatically handles BBPS mandated device info like <code>initChannel</code> ('AGT'), MAC, and server IPs. You just need to focus on core payment parameters.</p>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
            <h4 className="font-bold text-white mb-1">Q: What happens if a transaction fails at BBPS?</h4>
            <p><strong>A:</strong> If the API returns a 500 error or if the <code>payment_status</code> is <code>failed</code> (Code 999), the deducted amount is instantly and automatically refunded to your agent wallet. You do not need to call a separate refund API.</p>
          </div>
        </div>
      </section>

    </div>
  );
}
