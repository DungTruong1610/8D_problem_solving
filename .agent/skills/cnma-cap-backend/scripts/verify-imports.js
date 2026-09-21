// M003-#ticket510 (Leo): Verify all require() paths resolve to actual files on disk
// Script to verify all require() paths match actual files on disk after naming convention refactoring
const fs = require('fs');
const path = require('path');

const SRV_DIR = path.resolve(process.cwd(), 'srv');
const EXTERNAL_MODULES = ['cf-nodejs-logging-support', '@sap', 'axios', 'xsenv', 'cors', 'express', 'moment', 'uuid', 'http', 'path', 'fs', 'util', 'crypto', 'stream', 'url', 'events', 'node:'];

function getAllJsFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', 'generated', 'service-specifications'].includes(entry.name)) continue;
            results = results.concat(getAllJsFiles(fullPath));
        } else if (entry.name.endsWith('.js')) {
            results.push(fullPath);
        }
    }
    return results;
}

function extractRequires(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const regex = /require\(['"]([^'"]+)['"]\)/g;
    const requires = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comment lines
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

        let match;
        while ((match = regex.exec(line)) !== null) {
            requires.push({ path: match[1], line: i + 1 });
        }
    }
    return requires;
}

function isExternalModule(reqPath) {
    if (!reqPath.startsWith('.')) return true;
    return EXTERNAL_MODULES.some(m => reqPath.startsWith(m));
}

if (!fs.existsSync(SRV_DIR)) {
    console.log(`⚠️  SRV directory not found at ${SRV_DIR}. Skipping backend verification.`);
    process.exit(0);
}

const files = getAllJsFiles(SRV_DIR);
let errorCount = 0;
let totalChecked = 0;

for (const file of files) {
    const requires = extractRequires(file);
    for (const req of requires) {
        if (isExternalModule(req.path)) continue;
        totalChecked++;

        const resolvedDir = path.dirname(file);
        const resolvedPath = path.resolve(resolvedDir, req.path);

        // Check if file exists (with or without .js extension)
        const candidates = [
            resolvedPath,
            resolvedPath + '.js',
            path.join(resolvedPath, 'index.js')
        ];

        const exists = candidates.some(c => fs.existsSync(c));
        if (!exists) {
            errorCount++;
            const relFile = path.relative(SRV_DIR, file);
            console.log(`❌ BROKEN: ${relFile}:${req.line}`);
            console.log(`   require("${req.path}")`);
            console.log(`   resolved to: ${path.relative(SRV_DIR, resolvedPath)}`);
            console.log('');
        }
    }
}

console.log(`\n========================================`);
console.log(`Total local requires checked: ${totalChecked}`);
console.log(`Broken imports: ${errorCount}`);
if (errorCount === 0) {
    console.log(`✅ ALL IMPORTS ARE VALID!`);
} else {
    console.log(`❌ ${errorCount} BROKEN IMPORTS FOUND!`);
    process.exit(1);
}
