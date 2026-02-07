file_path = 'client/src/components/admin/ValidationModal.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# The broken block we want to replace
broken_block_start = '{result.traceResult.steps.map((step: any, idx: number) => {'

# We can search for this unique start
start_idx = content.find(broken_block_start)

if start_idx == -1:
    print("Could not find the start of the block")
    exit(1)

# Find the end of the map block. It should be `})}`
end_idx = content.find('})}', start_idx)
if end_idx == -1:
    print("Could not find the end of the block")
    exit(1)
end_idx += 3 # Include `})}`

# The correct replacement
replacement = '''{result.traceResult.steps.map((step: any, idx: number) => {
                                        const style = getStepStyle(step);
                                        return (
                                        <div key={idx} className={`p-3 text-sm grid grid-cols-[auto_1fr] gap-4 items-start ${style.container}`}>
                                            <div className="flex flex-col items-center pt-1">
                                                <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                                                {idx < result.traceResult.steps.length - 1 && <div className={`w-px h-full my-1 ${style.line}`} />}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="font-medium">{step.description}</div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono text-muted-foreground">
                                                    <div className="break-all bg-muted/30 p-1 rounded">{step.urlBefore}</div>
                                                    <div className="break-all bg-muted/30 p-1 rounded flex items-center">
                                                        <span className="mr-2">➔</span> {step.urlAfter}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}'''

# Replace
new_content = content[:start_idx] + replacement + content[end_idx:]

with open(file_path, 'w') as f:
    f.write(new_content)

print("Fixed ValidationModal.tsx")
