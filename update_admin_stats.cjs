const fs = require('fs');
const path = require('path');

const filePath = path.join('client', 'src', 'pages', 'admin.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find StatsTable component usage
const search = 'enableUserFeedback={generalSettings.enableFeedbackSurvey}';
const insert = 'enableUserFeedback={generalSettings.enableFeedbackSurvey}\n                          settings={generalSettings}\n                          onNavigateToTab={handleTabChange}';

content = content.replace(search, insert);

fs.writeFileSync(filePath, content);
console.log('Admin page updated with StatsTable props');
