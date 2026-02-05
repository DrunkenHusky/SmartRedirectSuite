const fs = require('fs');
const path = require('path');

const filePath = path.join('server', 'routes.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Update CSV Header
const headerSearch = "const csvHeader = includeReferrer";
const headerReplace = "const csvHeader = includeReferrer\n            ? 'ID,Alte URL,Neue URL,Pfad,Referrer,Zeitstempel,User-Agent,Regel ID,Feedback,Qualität,Benutzervorschlag,Strategie,Globale Regeln\\n'\n            : 'ID,Alte URL,Neue URL,Pfad,Zeitstempel,User-Agent,Regel ID,Feedback,Qualität,Benutzervorschlag,Strategie,Globale Regeln\\n';";

content = content.replace(/const csvHeader = includeReferrer[\s\S]*?:.*?;/, headerReplace);

// Update CSV Data Mapping
const dataSearch = "const userProposedUrl = track.userProposedUrl || '';";
const dataInsert = `const userProposedUrl = track.userProposedUrl || '';
            const strategy = track.redirectStrategy || '';
            const globalRules = (track.appliedGlobalRules || []).map(r => r.description).join('; ');`;

content = content.replace(dataSearch, dataInsert);

// Update CSV Row Construction
// We need to replace the return statement inside the map
const rowSearch = "return `\"${track.id}\",\"${track.oldUrl}\"";
// Regex to match the return line for both includeReferrer cases
// It's easier to replace the whole block or use regex to append fields

// Replace the return line for includeReferrer = true
content = content.replace(
    /return `\"${track.id}\",\"${track.oldUrl}\",\"${(.*?)}\",\"${track.path}\",\"${track.referrer \|\| ''}\",\"${track.timestamp}\",\"${track.userAgent \|\| ''}\",\"${ruleId}\",\"${feedback}\",\"${quality}\",\"${userProposedUrl}\"`;/,
    "return `\"${track.id}\",\"${track.oldUrl}\",\"${}\",\"${track.path}\",\"${track.referrer || ''}\",\"${track.timestamp}\",\"${track.userAgent || ''}\",\"${ruleId}\",\"${feedback}\",\"${quality}\",\"${userProposedUrl}\",\"${strategy}\",\"${globalRules}\"`;"
);

// Replace the return line for includeReferrer = false
content = content.replace(
    /return `\"${track.id}\",\"${track.oldUrl}\",\"${(.*?)}\",\"${track.path}\",\"${track.timestamp}\",\"${track.userAgent \|\| ''}\",\"${ruleId}\",\"${feedback}\",\"${quality}\",\"${userProposedUrl}\"`;/,
    "return `\"${track.id}\",\"${track.oldUrl}\",\"${}\",\"${track.path}\",\"${track.timestamp}\",\"${track.userAgent || ''}\",\"${ruleId}\",\"${feedback}\",\"${quality}\",\"${userProposedUrl}\",\"${strategy}\",\"${globalRules}\"`;"
);

fs.writeFileSync(filePath, content);
console.log('Routes updated successfully');
