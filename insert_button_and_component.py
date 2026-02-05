import os

file_path = 'client/src/pages/admin.tsx'

# Button
marker_button = '{/* Create New Rule Button */}'
insertion_button = """                      {/* Validation Button */}
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

# Component
marker_component = '{/* Delete All Rules Confirmation Dialog */}'
insertion_component = """
      {/* Validation Modal */}
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

      {/* Validation Reload Confirmation */}
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

with open(file_path, 'r') as f:
    content = f.read()

# Insert Button
if marker_button in content and "Konfigurationsvalidierung" not in content:
    content = content.replace(marker_button, insertion_button + marker_button)
    print("Button inserted")

# Insert Component
if marker_component in content and "ValidationModal" not in content:
    content = content.replace(marker_component, insertion_component + marker_component)
    print("Component inserted")

with open(file_path, 'w') as f:
    f.write(content)
