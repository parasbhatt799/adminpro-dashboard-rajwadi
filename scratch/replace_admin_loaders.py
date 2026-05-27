import os

components_dir = r"c:\Users\ADMIN\Downloads\adminpro-dashboard-rajwadi\src\components"

replacements = {
    "AdminDistributorWithdrawals.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "AdminManagement.tsx": [
        ('<Loader2 className="animate-spin text-indigo-500" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "AdminStatementReport.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "AdminWithdrawal.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "AgreementManagement.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />', '<LogoLoader size="md" className="mx-auto" />'),
        ('<Loader2 className="animate-spin text-indigo-600" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "BankManagement.tsx": [
        ('<Loader2 className="animate-spin text-indigo-500" size={40} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "BillPaymentReport.tsx": [
        ('<Loader2 className="animate-spin mx-auto" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "BillPaymentRequests.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "ComplaintsManagement.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600" size={32} />', '<LogoLoader size="md" className="mx-auto" />'),
        ('<Loader2 className="animate-spin text-indigo-600" size={48} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "DistributorQRReport.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600 mx-auto" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "DistributorsList.tsx": [
        ('<Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "HeadlineManagement.tsx": [
        ('<Loader2 className="animate-spin" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "KYCVerificationRequests.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "PayoutManagement.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600" size={40} />', '<LogoLoader size="md" className="mx-auto" />'),
        ('<Loader2 className="animate-spin text-slate-300" size={40} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "PayoutReport.tsx": [
        ('<Loader2 className="animate-spin text-amber-600 mx-auto" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "PolicyManagement.tsx": [
        ('<Loader2 className="animate-spin" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "QRManagement.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600" size={48} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "QRMasterManagement.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "QRPaymentReport.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600 mx-auto" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "QRScreenshotGallery.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600" size={48} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "ReasonManagement.tsx": [
        ('<Loader2 className="animate-spin text-indigo-500" size={40} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "ServiceChargeManagement.tsx": [
        ('<Loader2 className="animate-spin text-indigo-500" size={40} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "Settings.tsx": [
        ('<Loader2 className="animate-spin text-indigo-600" size={48} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "StatementReport.tsx": [
        ('<Loader2 className="animate-spin mx-auto" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ],
    "SuperDistributorsList.tsx": [
        ('<Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} />', '<LogoLoader size="md" className="mx-auto" />')
    ]
}

print("=== REPLACING ADMIN PANEL SPINNERS (SAFE FIRST LINE IMPORT) ===")

for filename, rules in replacements.items():
    filepath = os.path.join(components_dir, filename)
    if not os.path.exists(filepath):
        print(f"Error: {filename} does not exist!")
        continue
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    modified = False
    new_content = content
    for old_str, new_str in rules:
        if old_str in new_content:
            new_content = new_content.replace(old_str, new_str)
            modified = True
    
    if modified:
        # Add import at the very top of the file
        import_stmt = "import { LogoLoader } from './shared/LoadingSpinner';\n"
        if import_stmt not in new_content:
            new_content = import_stmt + new_content
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated {filename} successfully.")
    else:
        print(f"No replacements performed in {filename} (Loader pattern not found).")
