import os
import re

components_dir = r"c:\Users\ADMIN\Downloads\adminpro-dashboard-rajwadi\src\components"
files = [f for f in os.listdir(components_dir) if f.endswith(".tsx")]

print("=== LOADER SEARCH IN ADMIN COMPONENTS ===")
for filename in sorted(files):
    filepath = os.path.join(components_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Search for Loader2 rendering blocks
    matches = re.finditer(r"(<Loader2\b[^>]*>)", content)
    found_any = False
    for m in matches:
        if not found_any:
            print(f"\nFile: {filename}")
            found_any = True
        
        # Get line number
        line_no = content[:m.start()].count("\n") + 1
        print(f"  Line {line_no}: {m.group(1)}")
