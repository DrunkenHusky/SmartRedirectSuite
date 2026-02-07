file_path = 'client/src/components/admin/ValidationModal.tsx'

with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "result, index, isExpanded, onToggle, onEditRule }: { result: any" in line and "function ResultRow" not in line:
        continue # Skip this garbage line
    new_lines.append(line)

with open(file_path, 'w') as f:
    f.writelines(new_lines)

print("Removed garbage line")
