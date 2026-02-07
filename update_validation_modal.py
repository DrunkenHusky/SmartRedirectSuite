import re

file_path = 'client/src/components/admin/ValidationModal.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# Helper function to insert
helper_function = """    // Helper to get step styles
    const getStepStyle = (step: any) => {
        if (!step.changed) {
            return {
                dot: 'bg-gray-300',
                line: 'bg-border',
                container: 'bg-background'
            };
        }

        switch (step.type) {
            case 'global':
                return {
                    dot: 'bg-blue-500',
                    line: 'bg-blue-200',
                    container: 'bg-blue-50/50'
                };
            case 'rule':
                return {
                    dot: 'bg-orange-500',
                    line: 'bg-orange-200',
                    container: 'bg-orange-50/20'
                };
             case 'cleanup':
                return {
                    dot: 'bg-purple-500',
                    line: 'bg-purple-200',
                    container: 'bg-purple-50/30'
                };
            default:
                return {
                    dot: 'bg-orange-500',
                    line: 'bg-border',
                    container: 'bg-background'
                };
        }
    };

"""

# Insert helper function
result_row_start = content.find("function ResultRow")
brace_pos = content.find("{", result_row_start)
content = content[:brace_pos+1] + "\n" + helper_function + content[brace_pos+1:]

# Replace the trace steps rendering loop
lines = content.splitlines()
start_line_idx = -1
end_line_idx = -1

for i, line in enumerate(lines):
    if '{result.traceResult.steps.map((step: any, idx: number) => (' in line:
        start_line_idx = i
    # Look for the closing of the map. It seems to be )) or similar.
    # We'll look for the line that has only spaces and maybe `))}` or similar closing structure.
    # Based on previous readings, it seems to be indented.
    if start_line_idx != -1 and i > start_line_idx:
        # Check if line closes the map.
        if line.strip() == '))}' or line.strip().endswith('))}'):
             end_line_idx = i
             break

if start_line_idx != -1 and end_line_idx != -1:
    new_lines = [
        '                                    {result.traceResult.steps.map((step: any, idx: number) => {',
        '                                        const style = getStepStyle(step);',
        '                                        return (',
        '                                        <div key={idx} className={`p-3 text-sm grid grid-cols-[auto_1fr] gap-4 items-start ${style.container}`}>',
        '                                            <div className="flex flex-col items-center pt-1">',
        '                                                <div className={`w-2 h-2 rounded-full ${style.dot}`} />',
        '                                                {idx < result.traceResult.steps.length - 1 && <div className={`w-px h-full my-1 ${style.line}`} />}',
        '                                            </div>',
        '                                            <div className="space-y-1">',
        '                                                <div className="font-medium">{step.description}</div>',
        '                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-muted-foreground">',
        '                                                    <div className="break-all bg-muted/30 p-1 rounded">{step.urlBefore}</div>',
        '                                                    <div className="break-all bg-muted/30 p-1 rounded flex items-center">',
        '                                                        <span className="mr-2">➔</span> {step.urlAfter}',
        '                                                    </div>',
        '                                                </div>',
        '                                            </div>',
        '                                        </div>',
        '                                        );',
        '                                    })}'
    ]

    # Check indentation of start line to match if needed, but we hardcoded indentation above.

    # Replace lines
    lines[start_line_idx:end_line_idx+1] = new_lines

    with open(file_path, 'w') as f:
        f.write('\n'.join(lines))
    print("Successfully updated ValidationModal.tsx")
else:
    print("Could not find the map block lines")
    print(f"Start: {start_line_idx}, End: {end_line_idx}")
