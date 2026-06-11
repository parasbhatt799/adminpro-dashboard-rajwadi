# Bharat Connect (NPCI) UI Compliance Checklist - UsePay (CC01)

This compliance checklist tracks implementation of all Bharat Connect (formerly BBPS) front-end guidelines based on the UAT verification comments from the BillAvenue team.

---

## 1. Branding & Naming Compliance
- [x] **No Legacy Terminology:** Removed all user-facing occurrences of the term "BBPS" from menus, headers, titles, receipts, and instructions.
- [x] **Branding Rebranding:** Rebranded all reference labels to "Bharat Connect" or "B-Connect".
- [x] **Menu Navigation Labeling:**
  - Sidebar menu label updated to `"Bharat Connect Bill Pay"`
  - Sidebar complaints menu label updated to `"Bharat Connect Complaints"`

---

## 2. Logo & Mnemonic Specifications
- [x] **Bharat Connect Logo Size:** Configured `/bharat_connect.png` in step headers to exactly `83 × 30 px` using inline CSS styling.
- [x] **B Assured Logo Size:** Configured `/assured_logo.png` on the payment success screen and receipt to exactly `130 × 120 px`.
- [x] **B Mnemonic Replacement:** Replaced legacy `/bbps_logo.png` with `/b_mnemonic.png` in navigation menus and the page header.
- [x] **Mnemonic Text Label:** Rendered the text label `"Bill Pay / Pay Bill / Bill Payment"` directly below the B mnemonic logo in the page header.

---

## 3. Utility Service Categories (Grid Panel)
- [x] **Standard Grid Categories:** Updated the main dashboard category list (`STANDARD_CATEGORIES`) to display exactly the 28 official categories specified by the BillAvenue team:
  1. Agent Collection
  2. Broadband Postpaid
  3. Cable TV
  4. Clubs and Associations
  5. Credit Card
  6. DTH
  7. eChallan
  8. Education Fees
  9. Electricity
  10. EV Recharge
  11. Fastag
  12. Fleet Card Recharge
  13. Gas
  14. Housing Society
  15. Insurance
  16. Landline Postpaid
  17. Loan Repayment
  18. LPG Gas
  19. Mobile Postpaid
  20. Mobile Prepaid
  21. Municipal Services
  22. Municipal Taxes
  23. National Pension System
  24. NCMC Recharge
  25. Prepaid Meter
  26. Rental
  27. Subscription
  28. Water

---

## 4. Biller Selection Screen
- [x] **Sample Biller Dropdown:** Implemented a sample biller selection dropdown list directly on the provider selection screen.
- [x] **UAT Billers Integration:** Pre-loaded the dropdown with sample billers, including mandatory UAT testing billers:
  - `OTME00005XXZ43` (UAT Fetch & Pay Biller)
  - `OTNS00005XXZ43` (UAT Quick Pay Biller)
  - `PGVCL - Gujarat Electricity`
  - `Torrent Power - Electricity`
- [x] **Mock Values Pre-population:** Intercepted UAT biller selection to automatically populate parameters (`a`, `a b` etc.) and mock mobile numbers (`9898990084` and `9898990083`) to facilitate seamless testing.

---

## 5. Successful Payment Receipt (17 Mandated Fields)
- [x] **17 Mandatory Receipt Fields:** Rendered all 17 fields on both the payment successful receipt card and the generated PDF receipt:
  1. **B-Connect Txn ID** (Starts with "CC01", length: 20 characters)
  2. **Biller ID**
  3. **Biller Name**
  4. **Customer Name**
  5. **Customer Number** (Mobile)
  6. **Bill Date**
  7. **Bill Period**
  8. **Bill Number**
  9. **Due Date**
  10. **Bill Amount** (Base)
  11. **Customer Convenience Fees** (CCF1)
  12. **Total Amount** (Base Bill Amount + CCF1 Fees)
  13. **Transaction Date & Time**
  14. **Initiating Channel** (`Internet (WEB)`)
  15. **Payment Mode** (`UPI`)
  16. **Transaction Status** (`Successful`)
  17. **Approval Number** (Mocked approval string)
- [x] **Download PDF Action:** Added a "Download PDF" button utilizing `jsPDF` and `autoTable` to output a cleanly formatted, print-ready document containing the 17 fields and the styled trust seal.

---

## 6. Complaint Registration Form
- [x] **Form Consolidation:** Structured the complaint registration form on a single consolidated screen with only the requested fields:
  1. `B-Connect Transaction ID` (starting with CC01)
  2. `Mobile Number`
  3. `Date Range` (Start Date & End Date)
  4. `Complaint Disposition` (Dropdown menu containing the 8 verbatim options)
  5. `Complaint Description`
- [x] **Validation Integrity:** Enforced validation requiring the user to fill either the B-Connect Transaction ID (starts with CC01) OR both the Customer Mobile and Date Range before allowing form submission.
- [x] **8 Mandated Dispositions:** Loaded the dropdown with the verbatim dispositions:
  - *Transaction Successful, Amount Debited but services not received*
  - *Transaction Successful, Amount Debited but Service Disconnected or Service Stopped*
  - *Transaction Successful, Amount Debited but Late Payment Surcharge Charges add in next bill*
  - *Erroneously paid in wrong account*
  - *Duplicate Payment*
  - *Erroneously paid the wrong amount*
  - *Payment information not received from Biller or Delay in receiving payment information from the Biller*
  - *Bill Paid but Amount not adjusted or still showing due amount*

---

## 7. Search Transaction View
- [x] **Search Transaction Module:** Embedded a "Search Transaction" panel with tab options in the payment dashboard.
- [x] **Search Parameters:** Supports searching by B-Connect Transaction ID or by Mobile Number + Date Range.
- [x] **Mock OTP Verification:** Prompts for and validates a mock OTP (`1234`) sent to the customer's mobile when searching by mobile number.
- [x] **Results Table:** Displays search matches in a structured grid showing `Agent ID`, `B-Connect Txn ID`, `Biller Name`, `Amount`, `Date`, and `Status`.

---

## 8. Automated Alert Notifications
- [x] **Payment Successful Alert:** Automatically dispatches a confirmation email using SMTP/Resend on successful payment following the exact format:
  `Thank you for payment of <AMOUNT> against <BILLERNAME>, Consumer no <CONSUMERNO.>, B-connect Txn Ref ID <12digitRefID> on <DATE&TIME> vide <PAYMENTCHANNEL>.`
- [x] **Complaint Registration Alert:** Automatically dispatches a confirmation email using SMTP/Resend on successful complaint lodging following the exact format:
  `Your Complaint has been registered successfully for B-connect Txn Ref ID <12digitRefID>. Your Complaint ID is <ComplaintID>. You can track status of your complaint using your Complaint ID.`

---

## Verification Sign-Off
*   **TypeScript Syntax Compilation:** Passed (`npx tsc --noEmit` returns exit code 0)
*   **Vite Production Build:** Passed (`npm run build` succeeds)
*   **Approval Authority:** UsePay Compliance Team
