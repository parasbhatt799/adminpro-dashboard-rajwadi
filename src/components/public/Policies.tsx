import React from 'react';
import { ArrowLeft, Shield, FileText, RefreshCw, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const PolicyLayout = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold">Back to Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 uppercase tracking-widest">
              Legal Compliance
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full">
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          {/* Decorative Background */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <Icon size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">{title}</h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">UsePay Fintech Solution Pvt Ltd</p>
            </div>
          </div>

          <div className="prose prose-invert max-w-none text-slate-300 space-y-6 text-sm md:text-base leading-relaxed">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6 bg-slate-950/20 text-center">
        <p className="text-slate-600 text-xs font-medium">
          © {new Date().getFullYear()} UsePay Fintech Solution Pvt Ltd. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export const PrivacyPolicy = () => {
  return (
    <PolicyLayout title="Privacy Policy" icon={Shield}>
      <p className="text-slate-400 italic">Last updated: June 08, 2026</p>

      <section className="space-y-3 pt-4">
        <h2 className="text-lg font-bold text-white">1. Introduction & DPDPA Compliance</h2>
        <p>
          Welcome to UsePay Fintech Solution Pvt Ltd ("UsePay", "we", "us", or "our"). We respect your privacy and are committed to protecting your personal data. This Privacy Policy outlines how we collect, process, store, use, and protect your information when you visit our website (usepay.in) or use our fintech dashboard services.
        </p>
        <p>
          This Privacy Policy is designed to comply with the **Digital Personal Data Protection Act (DPDPA), 2023** of India. It explains your rights as a Data Principal and how you can exercise them.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">2. Information We Collect</h2>
        <p>We may collect, use, store, and transfer different kinds of personal data about you, including:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Identity Data:</strong> Full name, business/firm name, username or similar identifier, and government-issued Know Your Customer (KYC) documents (such as PAN card, Aadhaar card, or GST details).</li>
          <li><strong>Contact Data:</strong> Billing address, physical address, email address, and telephone numbers.</li>
          <li><strong>Financial Data:</strong> Bank account details and payment card information used for executing recharges, bill payments, and payouts.</li>
          <li><strong>Transaction Data:</strong> Details about payments, utility bills, recharges, settlements, and QR code payments executed through our system.</li>
          <li><strong>Technical Data:</strong> Internet protocol (IP) address, login data, browser type and version, time zone setting, location, operating system, and platform.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">3. How We Use Your Data</h2>
        <p>We use your personal data only as permitted by law, primarily in the following circumstances:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>To register you as a new partner, distributor, or merchant user.</li>
          <li>To verify identity and perform regulatory KYC checks.</li>
          <li>To process and settle payments, utility bills, recharges, and payout transfers.</li>
          <li>To manage our relationship with you, including notifying you about changes to our policies.</li>
          <li>To secure our network, prevent fraudulent transactions, and maintain audit trails.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">4. Consent Management & Data Principal Rights</h2>
        <p>
          Under the DPDPA 2023, you are a "Data Principal" and have specific rights regarding your personal data:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Right to Confirmation and Access:</strong> You can request summary details of the personal data being processed and the processing activities we undertake.</li>
          <li><strong>Right to Correction and Erasure:</strong> You can request correction of inaccurate or misleading data, completion of incomplete data, or erasure of personal data that is no longer necessary for the purpose of processing (subject to statutory data retention requirements for financial audits).</li>
          <li><strong>Right to Grievance Redressal:</strong> You have the right to register a grievance with our Grievance Officer regarding any processing of personal data.</li>
          <li><strong>Right to Withdraw Consent:</strong> You have the right to withdraw your consent for data processing at any time. To withdraw your consent, you can adjust your account settings or contact our support team. Please note that withdrawing consent may limit our ability to provide fintech services to you.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">5. Data Sharing and Disclosures</h2>
        <p>
          We do not sell, rent, or trade your personal data. We share your information only with trusted third parties under strict confidentiality clauses:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Payment Gateways and Partners:</strong> Our API providers (such as PayPrime) to execute recharges and pay bills.</li>
          <li><strong>Banking Partners:</strong> Financial institutions to settle wallet balances and execute payouts.</li>
          <li><strong>Regulatory Authorities:</strong> Law enforcement agencies or government departments when required under statutory obligations.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">6. Data Security</h2>
        <p>
          We have implemented appropriate technical and organizational security measures (such as SSL/TLS encryption, secure databases, firewalls, and token-based access controls) to prevent your personal data from being accidentally lost, used, accessed, altered, or disclosed in an unauthorized way. We limit access to your data only to employees and partners who have a business need to know.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">7. Data Retention</h2>
        <p>
          We will only retain your personal data for as long as necessary to fulfill the purposes we collected it for, including for the purposes of satisfying any legal, accounting, audit, or reporting requirements.
        </p>
        <p>
          Under the Prevention of Money Laundering Act (PMLA) and guidelines from the Reserve Bank of India (RBI), we are legally obligated to retain records of transactions, customer identity, and verification data for a minimum period of **5 years** from the date of cessation of the transaction/relationship.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">8. Cookie Policy</h2>
        <p>
          We use cookies and similar tracking technologies to track user activity on our dashboard, store session states, and improve your browsing experience. 
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Essential Cookies:</strong> Required for authentication, security, and dashboard navigation. These cannot be disabled.</li>
          <li><strong>Performance & Analytics Cookies:</strong> Help us understand how users interact with our platform to improve overall performance.</li>
        </ul>
        <p>
          You can choose to disable non-essential cookies via your browser settings; however, doing so might degrade your experience on the dashboard.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">9. Grievance Redressal Mechanism & Contact Details</h2>
        <p>
          If you have any questions, feedback, or complaints regarding this Privacy Policy or our privacy practices, you can escalate through our grievance redressal matrix:
        </p>
        
        <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-4 my-4">
          <div>
            <h3 className="font-bold text-indigo-400 text-sm uppercase tracking-wider">Level 1: Customer Support</h3>
            <p className="text-slate-300 text-sm">For primary complaints and general queries:</p>
            <p className="text-white text-sm font-semibold">Email: usepay.in@gmail.com</p>
            <p className="text-slate-500 text-xs mt-1">Expected Response Time: 24 - 48 Hours</p>
          </div>
          
          <div className="border-t border-slate-800/80 pt-3">
            <h3 className="font-bold text-indigo-400 text-sm uppercase tracking-wider">Level 2: Grievance Officer</h3>
            <p className="text-slate-300 text-sm">If your concern is not resolved to your satisfaction within 7 days, you can contact our Grievance Officer:</p>
            <p className="text-white text-sm font-semibold">Grievance Officer: Mr. Amit Sharma</p>
            <p className="text-white text-sm font-semibold">Email: grievance@usepay.in</p>
            <p className="text-slate-300 text-sm mt-1">Address: UsePay Fintech Solution Pvt Ltd, Registered Office, India.</p>
            <p className="text-slate-500 text-xs mt-1">Expected Response Time: Up to 15 Days (as per DPDPA guidelines)</p>
          </div>

          <div className="border-t border-slate-800/80 pt-3">
            <h3 className="font-bold text-indigo-400 text-sm uppercase tracking-wider">Level 3: Nodal Officer</h3>
            <p className="text-slate-300 text-sm">For further escalation or regulatory compliance matters:</p>
            <p className="text-white text-sm font-semibold">Email: nodal@usepay.in</p>
          </div>
        </div>
      </section>
    </PolicyLayout>
  );
};

export const TermsAndConditions = () => {
  return (
    <PolicyLayout title="Terms & Conditions" icon={FileText}>
      <p className="text-slate-400 italic">Last updated: June 08, 2026</p>

      <section className="space-y-3 pt-4">
        <h2 className="text-lg font-bold text-white">1. Agreement to Terms</h2>
        <p>
          These Terms and Conditions constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("user", "merchant", or "distributor") and UsePay Fintech Solution Pvt Ltd ("UsePay", "we", "us", or "our"), concerning your access to and use of the usepay.in website as well as any other media form, media channel, mobile website, or dashboard application related, linked, or otherwise connected thereto.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">2. Intellectual Property Rights</h2>
        <p>
          Unless otherwise indicated, the website and its services, including source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the site (collectively, the "Content") and the trademarks, service marks, and logos contained therein are owned or controlled by us, and are protected by copyright and trademark laws.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">3. User Representations and Registration</h2>
        <p>By using the website, you represent and warrant that:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>All registration information you submit will be true, accurate, current, and complete.</li>
          <li>You will maintain the accuracy of such information and promptly update it when necessary.</li>
          <li>You have the legal capacity to agree to these Terms and Conditions.</li>
          <li>You will not access the site or services through automated or non-human means (such as bots or scripts).</li>
          <li>You will not use the services for any illegal or unauthorized purposes.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">4. Services and Wallet Settlements</h2>
        <p>
          UsePay operates a digital utility dashboard providing BBPS services, recharges, and QR collection payouts.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Fees and Charges:</strong> Transaction fees, daily limits, and service charges (including T+1 QR charges) will apply to your account based on your selected slab or configured profile settings.</li>
          <li><strong>T+1 QR Settlements:</strong> T+1 QR settlements will be processed and credited to the user's main wallet on the next day at 11:30 AM IST, subject to limit availability and verification.</li>
          <li><strong>Fund Transfers:</strong> All fund transfers between users, distributors, and admins are governed by internal wallet balance guidelines. We are not responsible for delays caused by banking networks or gateway timeouts.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">5. Anti-Money Laundering (AML) & Fraud Prevention</h2>
        <p>
          UsePay enforces a zero-tolerance policy towards fraudulent activities, money laundering, and financing of terrorism.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Compliance:</strong> All users are required to undergo a full and valid Know Your Customer (KYC) verification procedure, including submission of Aadhaar, PAN, and bank details, before initiating any payment transactions.</li>
          <li><strong>Monitoring:</strong> We constantly monitor transactions for suspicious velocity, duplicate values, and potential fraud. Any transaction flagged as suspicious will be held for review.</li>
          <li><strong>Account Suspension & Freezing:</strong> We reserve the absolute right to freeze wallet balances, suspend services, or terminate the account of any user/merchant instantly if we receive a fraud alert from our banking partners, cyber police, or regulatory authorities.</li>
          <li><strong>Reporting:</strong> Suspicious activities will be reported to the Financial Intelligence Unit - India (FIU-IND) and other relevant law enforcement agencies without prior notification to the user.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">6. Limitations of Liability</h2>
        <p>
          In no event will UsePay Fintech Solution Pvt Ltd or our directors, employees, or agents be liable to you or any third party for any direct, indirect, consequential, exemplary, incidental, special, or punitive damages, including lost profit, lost revenue, loss of data, or other damages arising from your use of the site or services.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">7. Termination and Account Suspension</h2>
        <p>
          We reserve the right, in our sole discretion and without notice or liability, to deny access to and use of the website and services, including blocking or suspending accounts, to any person for any reason, including without limitation for breach of any representation, warranty, or covenant contained in these Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">8. Governing Law</h2>
        <p>
          These Terms and Conditions and your use of the website and services are governed by and construed in accordance with the laws of India, and any disputes will be subject to the exclusive jurisdiction of the courts of India.
        </p>
      </section>
    </PolicyLayout>
  );
};

export const RefundPolicy = () => {
  return (
    <PolicyLayout title="Refund & Chargeback Policy" icon={RefreshCw}>
      <p className="text-slate-400 italic">Last updated: June 08, 2026</p>

      <section className="space-y-3 pt-4">
        <h2 className="text-lg font-bold text-white">1. Nature of Services & Regulatory Compliance</h2>
        <p>
          UsePay Fintech Solution Pvt Ltd provides digital recharges, utility bill payments (BBPS), and QR-based collection settlements. Due to the digital nature of these services, transactions are processed instantly in real-time through external banking networks and payment gateways. All refund and chargeback operations comply with the rules set by the Reserve Bank of India (RBI) and card networks.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">2. Failed Transactions & Auto-Refunds</h2>
        <p>
          A transaction is considered failed if the payment amount was successfully debited from the merchant or user's account/wallet, but the corresponding recharge, utility bill payment, or settlement was not successfully completed by the external gateway or biller.
        </p>
        <p>
          In case of failed transactions, the debited amount will be auto-refunded back to the user's wallet balance within **3 to 5 business days** after receiving verification and reconciliation files from our payment gateway or banking partners.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">3. Successful Transactions</h2>
        <p>
          Once a recharge, bill payment, or QR collection settlement has been successfully executed, reported, and updated with a successful status in our database:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>The transaction is final, irreversible, and non-refundable.</li>
          <li>No refunds, returns, or reversals will be allowed under any circumstances.</li>
          <li>It is the sole responsibility of the user to enter the correct mobile number, consumer ID, biller details, and transaction amount. UsePay will not refund transactions processed using incorrect user-supplied details.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">4. Dispute Resolution Process</h2>
        <p>
          If you believe a transaction was processed incorrectly or unauthorized, you must raise a formal dispute through our support portal or email us at **usepay.in@gmail.com** within **24 hours** of the transaction timestamp. 
        </p>
        <p>
          Disputes must include the transaction reference number (Txn ID), Unique Transaction Reference (UTR), date, amount, and clear screenshots of the transaction status. UsePay will investigate the dispute with our banking partners and notify you of the outcome within 7 business days.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">5. Chargeback Timelines & Merchant Liabilities</h2>
        <p>
          Chargebacks arise when a cardholder or account holder disputes a transaction directly with their issuing bank.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Notification Timeline:</strong> When a chargeback is received, UsePay will notify the merchant via email or dashboard notification. The merchant must submit valid proof of service delivery or invoice within **5 working days** of receiving the notification to dispute the chargeback.</li>
          <li><strong>Merchant Liability:</strong> The merchant is fully and solely liable for all chargebacks, refunds, customer claims, and any associated bank investigation fees, network penalties, or chargeback fees.</li>
          <li><strong>Wallet Settlement Adjustment:</strong> UsePay reserves the right to debit the chargeback amount and any associated penalties directly from the merchant's wallet balance or hold settlements until the dispute is resolved.</li>
          <li><strong>Account Termination:</strong> Any merchant or distributor raising fraudulent chargebacks or payment disputes without coordinating with UsePay support will face immediate account termination and forfeiture of wallet balances.</li>
        </ul>
      </section>
    </PolicyLayout>
  );
};

export const CancellationPolicy = () => {
  return (
    <PolicyLayout title="Cancellation Policy" icon={XCircle}>
      <p className="text-slate-400 italic">Last updated: June 08, 2026</p>

      <section className="space-y-3 pt-4">
        <h2 className="text-lg font-bold text-white">1. Cancellation of Utility Transactions</h2>
        <p>
          Since UsePay Fintech Solution Pvt Ltd provides digital utility recharges, live BBPS bills payments, and QR payment collection settlements, these services are processed in real-time instantly.
        </p>
        <p>
          Therefore, **cancellation of a successfully submitted recharge or bill payment is not possible**. Once a transaction request is sent to our gateway partners (PayPrime) and confirmed, it is finalized and cannot be stopped, cancelled, or altered.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">2. QR Payment Request Cancellations</h2>
        <p>
          A user may request the cancellation of a pending QR payment request by contacting the admin support or raising a complaint through the portal, provided the status is still "pending". Once a request is approved (either under standard "approved" or "T+1 Approved" status), it cannot be cancelled or retracted.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">3. Account Cancellation or Termination</h2>
        <p>
          If a user, distributor, or super-distributor wishes to cancel their relationship with UsePay and close their account, they must submit a formal request via email to usepay.in@gmail.com.
        </p>
        <p>
          Upon receiving the request, we will review the account for any pending transactions, balances, or disputes. Any remaining wallet balance will be settled as per standard settlement protocols, minus applicable fees and settlements, before final account deactivation.
        </p>
      </section>
    </PolicyLayout>
  );
};
