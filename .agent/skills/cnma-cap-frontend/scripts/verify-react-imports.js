const fs = require('fs');
const path = require('path');

// Configuration
const APP_DIR = path.resolve(process.cwd(), 'app'); // Default to 'app' or 'src' logic below
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.json'];

// Try to find the source directory
const SRC_DIR = fs.existsSync(path.join(process.cwd(), 'src'))
    ? path.join(process.cwd(), 'src')
    : (fs.existsSync(APP_DIR) ? APP_DIR : process.cwd());

console.log(`Scanning for React/Frontend imports in: ${SRC_DIR}`);

function getAllFiles(dir) {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) continue;
            results = results.concat(getAllFiles(fullPath));
        } else {
            if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

function extractImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Regex for:
    // import ... from '...'
    // import '...'
    // require('...')
    // export ... from '...'
    const importRegex = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\)/g;

    const imports = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

        let match;
        // Reset regex state for each line reuse? No, better to match global on content or line by line.
        // Line by line is safer for line numbers.
        // Re-creating regex for each line is simple.
        const lineRegex = /from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\)/g;

        while ((match = lineRegex.exec(line)) !== null) {
            // match[1] -> from '...'
            // match[2] -> import '...'
            // match[3] -> require('...')
            const importPath = match[1] || match[2] || match[3];
            if (importPath) {
                imports.push({ path: importPath, line: i + 1 });
            }
        }
    }
    return imports;
}

let errorCount = 0;
let totalChecked = 0;

const files = getAllFiles(SRC_DIR);

for (const file of files) {
    const imports = extractImports(file);
    for (const imp of imports) {
        const importPath = imp.path;

        // Skip external modules (non-relative, non-absolute)
        // Check for aliases like @/ later if needed. For now assuming non-relative = package
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            // Check if it might be an alias (e.g. "src/...")
            // Simple check: most likely package.
            continue;
        }

        totalChecked++;

        // Resolve path
        const resolvedDir = path.dirname(file);
        let targetPath = path.resolve(resolvedDir, importPath);

        // Check exact match or with extensions
        let found = false;

        // 1. Exact match (file or directory -> index)
        if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            if (stat.isDirectory()) {
                // Check index files
                for (let ext of EXTENSIONS) {
                    if (fs.existsSync(path.join(targetPath, `index${ext}`))) {
                        found = true;
                        break;
                    }
                }
            } else {
                found = true;
            }
        }

        // 2. Try extensions
        if (!found) {
            for (let ext of EXTENSIONS) {
                if (fs.existsSync(targetPath + ext)) {
                    found = true;
                    break;
                }
            }
        }

        if (!found) {
            errorCount++;
            const relFile = path.relative(process.cwd(), file);
            console.log(`❌ BROKEN: ${relFile}:${imp.line}`);
            console.log(`   import '${importPath}'`);
            console.log(`   resolved to: ${targetPath}`);
            console.log('');
        }
    }
}

console.log(`\n========================================`);
console.log(`Total local imports checked: ${totalChecked}`);
console.log(`Broken imports: ${errorCount}`);
if (errorCount === 0) {
    console.log(`✅ ALL REACT IMPORTS VALID!`);
} else {
    console.log(`❌ ${errorCount} BROKEN IMPORTS FOUND!`);
    process.exit(1);
}
