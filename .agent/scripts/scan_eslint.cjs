/**
 * scan_eslint.cjs
 * Pipe-based ESLint parser — reads JSON from stdin, counts i18next warnings by folder.
 * Usage: npx eslint <path> -f json 2>/dev/null | node .agent/workflows/scripts/scan_eslint.cjs
 * Run from the frontend project root.
 */
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(0, 'utf8'));
let total = 0;
const byFile = {};
data.forEach(f => {
    f.messages.forEach(m => {
        if (m.ruleId === 'i18next/no-literal-string') {
            total++;
            const parts = f.filePath.replace(/\\/g, '/').split('/');
            const name = parts[parts.length - 1];
            byFile[name] = (byFile[name] || 0) + 1;
        }
    });
});
console.log('ESLint i18next warnings: ' + total);
if (total > 0) {
    console.log('By file:');
    Object.entries(byFile).sort((a, b) => b[1] - a[1]).forEach(([f, c]) => console.log('  ' + f + ': ' + c));
}
