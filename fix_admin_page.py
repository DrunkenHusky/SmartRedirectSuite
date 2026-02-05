import re

file_path = 'client/src/pages/admin.tsx'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Imports
if 'import { ValidationModal }' not in content:
    content = 'import { ValidationModal } from "@/components/admin/ValidationModal";\n' + content

if 'RefreshCw' not in content:
    content = content.replace('LogOut,', 'LogOut, RefreshCw,')

# 2. State
state_vars = """
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showValidationReloadDialog, setShowValidationReloadDialog] = useState(false);
  const [validationReloadTrigger, setValidationReloadTrigger] = useState(0);
"""
if 'showValidationModal' not in content:
    content = content.replace('export default function AdminPage({ onClose }: AdminPageProps) {', 'export default function AdminPage({ onClose }: AdminPageProps) {' + state_vars)

# 3. Query
query_code = """
  const { data: allRules } = useQuery({
    queryKey: ["/api/admin/rules"],
    enabled: showValidationModal && isAuthenticated,
    queryFn: async () => {
      const response = await fetch("/api/admin/rules", { credentials: "include" });
      if (!response.ok) throw new Error("Failed");
      return response.json();
    },
  });
"""
if 'const { data: allRules }' not in content:
    # Insert before paginated rules query
    content = content.replace('const { data: paginatedRulesData', query_code + '\n  const { data: paginatedRulesData')

# 4. Reload Logic
reload_logic = "      if (showValidationModal) setShowValidationReloadDialog(true);"
if 'showValidationReloadDialog' not in content.split('resetRuleForm')[1]:
    # This is a bit risky with regex, let's find the function definition
    # Assuming resetRuleForm is defined as: const resetRuleForm = () => { ... }
    # We want to add it inside.
    # Actually, simpler: search for "resetRuleForm();" calls in mutation success and add logic there?
    # No, better inside the function.
    pass
    # Let's handle it by replacing the function body start
    # const resetRuleForm = () => {
    content = content.replace('const resetRuleForm = () => {', 'const resetRuleForm = () => {' + '\n' + reload_logic)

# 5. Button
button_code = """
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 sm:flex-initial sm:w-auto"
                        onClick={() => setShowValidationModal(true)}
                      >
                         <RefreshCw className="h-4 w-4 mr-2" />
                         Konfigurationsvalidierung
                      </Button>
"""
if 'Konfigurationsvalidierung' not in content:
    # Insert before "Create New Rule Button" comment
    content = content.replace('{/* Create New Rule Button */}', button_code + '\n                      {/* Create New Rule Button */}')

# 6. Component
component_code = """
      <ValidationModal
        open={showValidationModal}
        onOpenChange={setShowValidationModal}
        onEditRule={(ruleId) => {
            const rule = (allRules || rules).find((r: any) => r.id === ruleId);
            if (rule) {
                handleEditRule(rule);
            }
        }}
        rules={allRules || []}
        settings={settingsData}
        reloadTrigger={validationReloadTrigger}
      />

      <AlertDialog open={showValidationReloadDialog} onOpenChange={setShowValidationReloadDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Validierung neu laden?</AlertDialogTitle>
            <AlertDialogDescription>
              Sie haben eine Regel geändert. Möchten Sie die Konfigurationsvalidierung mit den neuen Einstellungen neu laden?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowValidationReloadDialog(false)}>Nein</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
                setShowValidationReloadDialog(false);
                setValidationReloadTrigger(prev => prev + 1);
            }}>Ja, neu laden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
"""
if '<ValidationModal' not in content:
    # Insert before Delete All Rules Dialog
    content = content.replace('{/* Delete All Rules Confirmation Dialog */}', component_code + '\n      {/* Delete All Rules Confirmation Dialog */}')

with open(file_path, 'w') as f:
    f.write(content)

print("Fix applied.")
