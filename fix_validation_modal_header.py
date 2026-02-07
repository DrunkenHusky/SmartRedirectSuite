file_path = 'client/src/components/admin/ValidationModal.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# The broken header
broken_header = 'function ResultRow({\n    // Helper'

# The correct header start
correct_header = 'function ResultRow({ result, index, isExpanded, onToggle, onEditRule }: { result: any, index: number, isExpanded: boolean, onToggle: () => void, onEditRule: (id: number) => void }) {\n    // Helper'

if broken_header in content:
    content = content.replace(broken_header, correct_header)
    with open(file_path, 'w') as f:
        f.write(content)
    print("Fixed ValidationModal header")
else:
    print("Could not find broken header")
