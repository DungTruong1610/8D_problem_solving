const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(process.cwd(), 'srv');

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            if (f !== 'node_modules' && f !== '.git') {
                walkDir(dirPath, callback);
            }
        } else {
            if (f.endsWith('.js')) {
                callback(dirPath);
            }
        }
    });
}

if (!fs.existsSync(ROOT_DIR)) {
    console.log(`⚠️  SRV directory not found at ${ROOT_DIR}. Skipping basic import check.`);
    process.exit(0);
}

let errorCount = 0;

walkDir(ROOT_DIR, (filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    // Regex for require('...') or require("...")
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;

    while ((match = requireRegex.exec(content)) !== null) {
        const importPath = match[1];

        // Skip node modules (start with letter, not . or /) or absolute paths for now (rare in our code)
        if (!importPath.startsWith('.')) {
            continue;
        }

        try {
            require.resolve(importPath, { paths: [path.dirname(filePath)] });
        } catch (e) {
            console.error(`ERROR: Broken import in ${filePath}`);
            console.error(`  Cannot resolve: '${importPath}'`);
            errorCount++;
        }
    }
});

if (errorCount > 0) {
    console.error(`\nFound ${errorCount} broken imports.`);
    process.exit(1);
} else {
    console.log("All local imports resolved successfully.");
}
