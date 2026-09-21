/**
 * scan_hardcoded.cjs
 * All-in-one script: runs ESLint i18next/no-literal-string + grep-like pattern scan.
 * Usage: node .agent/workflows/scripts/scan_hardcoded.cjs
 * Run from the frontend project root (the folder containing tsconfig.app.json and src/).
 */
const fs = require('fs');
const { execSync } = require('child_process');

console.log('========================================');
console.log('  HARDCODED TEXT AUDIT — DISCOVERY');
console.log('========================================\n');

// Phase 1a: ESLint scan
console.log('--- ESLint i18next/no-literal-string (grouped by folder) ---');
try {
  const raw = execSync('npx eslint . -f json 2>/dev/null', { maxBuffer: 50 * 1024 * 1024, encoding: 'utf8' });
  const data = JSON.parse(raw);
  const results = [];
  data.forEach(f => {
    f.messages.forEach(m => {
      if (m.ruleId === 'i18next/no-literal-string') {
        const parts = f.filePath.split(/[/\\]src[/\\]/);
        const p = parts.length > 1 ? parts[parts.length - 1] : f.filePath;
        const text = m.message.replace('disallow literal string: ', '').trim();
        const literal = text.substring(0, 80);
        const folder = 'src/' + p.replace(/[/\\][^/\\]*$/, '');
        results.push({ file: 'src/' + p, line: m.line, literal, folder });
      }
    });
  });

  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.folder]) grouped[r.folder] = [];
    grouped[r.folder].push(r);
  });

  console.log('Total: ' + results.length + ' warnings\n');
  Object.keys(grouped).sort().forEach(folder => {
    console.log('📁 ' + folder + ' (' + grouped[folder].length + ')');
    grouped[folder].forEach(r => console.log('   L' + r.line + ': ' + JSON.stringify(r.literal)));
    console.log('');
  });
} catch (e) {
  console.log('ESLint error:', e.message);
}

// Phase 1b: Grep-like scan using Node.js
console.log('\n--- Pattern scan: JSX text, attributes, toast/alert ---');
const path = require('path');

function walkDir(dir, ext) {
  let files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === 'demos' || entry.name === 'dist') continue;
      if (entry.isDirectory()) files = files.concat(walkDir(full, ext));
      else if (entry.isFile() && (ext.includes(path.extname(entry.name)))) files.push(full);
    }
  } catch (e) { /* ignore */ }
  return files;
}

const scanDirs = ['src/pages', 'src/components/common', 'src/components/filterbar', 'src/hooks'];
const patterns = [
  { name: 'G1: JSX text (same-line)', regex: />\s*([A-Z][a-z]+(?:\s+[a-zA-Z]+)+)\s*<\//, exts: ['.tsx'] },
  { name: 'G2: Hardcoded title/placeholder/label', regex: /(title|placeholder|label|aria-label)="([A-Z][a-z])/, exts: ['.tsx'] },
  { name: 'G3: Toast/alert messages', regex: /(toast\.(success|error|warning|info)|alert)\s*\(\s*['"]/, exts: ['.tsx', '.ts'] },
];

const grepResults = {};

for (const dir of scanDirs) {
  const absDir = path.resolve(dir);
  if (!fs.existsSync(absDir)) continue;
  
  for (const pattern of patterns) {
    const files = walkDir(absDir, pattern.exts);
    for (const file of files) {
      if (file.includes('demos')) continue;
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('{t(') || line.includes("t('") || line.includes('t("')) return;
        const match = line.match(pattern.regex);
        if (match) {
          const relPath = path.relative(process.cwd(), file).replace(/\\/g, '/');
          const folder = relPath.replace(/\/[^/]*$/, '');
          if (!grepResults[folder]) grepResults[folder] = [];
          grepResults[folder].push({ file: relPath, line: idx + 1, pattern: pattern.name, text: line.trim().substring(0, 80) });
        }
      });
    }
  }
}

let grepTotal = 0;
Object.keys(grepResults).sort().forEach(folder => {
  const items = grepResults[folder];
  grepTotal += items.length;
  console.log('📁 ' + folder + ' (' + items.length + ')');
  items.forEach(r => console.log('   ' + r.file + ':' + r.line + ' [' + r.pattern + '] ' + r.text));
  console.log('');
});
console.log('Total grep matches: ' + grepTotal);
