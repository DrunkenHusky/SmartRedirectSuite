import os
import re

replacements = {
    "Inhaltsverzeichnis": "Table of Contents",
    "Funktionsweise": "How it works",
    "Einsatzszenarien": "Use Cases",
    "Schnellstart": "Quick Start",
    "Voraussetzungen": "Prerequisites",
    "Installation": "Installation",
    "Dokumentation": "Documentation",
    "Benutzerhandbuch": "User Manual",
    "Konfigurationsbeispiele": "Configuration Examples",
    "Beispiele": "Examples",
    "Weiterleitung von Parametern": "Forwarding of Parameters",
    "Regelmodi": "Rule Modes",
    "SmartRedirect Suite": "SmartRedirect Suite",
    "Allgemeine Einstellungen": "General Settings",
}

def translate_file(filepath):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    for de, en in replacements.items():
        # Match markdown headers or plain occurrences
        content = re.sub(r'#+\s+' + re.escape(de), lambda m: m.group(0).replace(de, en), content)
        content = re.sub(r'\[(.*?)\]', lambda m: '[' + m.group(1).replace(de, en) + ']', content)
        # Add basic replacements
        content = content.replace("Administrator-Bereich", "Admin Area")
        content = content.replace("Übersicht", "Overview")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

files_to_translate = [
    'README.md',
    'docs/USER_MANUAL.md',
    'docs/ADMIN_DOCUMENTATION.md',
    'docs/API_DOCUMENTATION.md',
    'docs/ARCHITECTURE_OVERVIEW.md'
]

for file in files_to_translate:
    translate_file(file)

print("Documentation translation applied (basic structures).")
