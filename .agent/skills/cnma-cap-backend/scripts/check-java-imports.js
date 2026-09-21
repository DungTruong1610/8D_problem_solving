const fs = require('fs');
const path = require('path');

/**
 * Script to check for broken internal Java imports.
 * It resolves imports starting with 'cnma.' to physical file paths.
 */

const ROOT_DIR = process.cwd();
const JAVA_SRC_ROOT = path.join(ROOT_DIR, 'srv/src/main/java');

if (!fs.existsSync(JAVA_SRC_ROOT)) {
    console.error(`ERROR: Java source root not found at ${JAVA_SRC_ROOT}`);
    process.exit(1);
}

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

let errorCount = 0;
let fileCount = 0;

console.log(`Scanning Java imports in: ${JAVA_SRC_ROOT}...\n`);

walkDir(JAVA_SRC_ROOT, (filePath) => {
    if (!filePath.endsWith('.java')) return;
    
    fileCount++;
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Regex for import cnma.xxx.yyy; or import static cnma.xxx.yyy;
    const importRegex = /^import\s+(?:static\s+)?(cnma\.[^;]+);/gm;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
        const fullImport = match[1];
        
        // Handle class imports vs static member imports
        // For static imports like cnma.bp.Constants.MY_VAL, we check if cnma.bp.Constants.java exists
        let parts = fullImport.split('.');
        
        // We assume internal classes follow CamelCase. 
        // We find the first part that starts with Uppercase to identify the Class file.
        let classPathParts = [];
        for (let part of parts) {
            classPathParts.push(part);
            if (part[0] === part[0].toUpperCase()) {
                break; // Found the class name
            }
        }

        const relativePath = classPathParts.join('/') + '.java';
        const absolutePath = path.join(JAVA_SRC_ROOT, relativePath);

        if (!fs.existsSync(absolutePath)) {
            // Special check: might be a package import or a generated class (cds.gen is usually elsewhere)
            // But for cnma.* it should be in src/main/java
            console.error(`ERROR: Broken import in ${path.relative(ROOT_DIR, filePath)}`);
            console.error(`  Cannot find: ${fullImport}`);
            console.error(`  Expected path: ${path.relative(ROOT_DIR, absolutePath)}`);
            console.error('--------------------------------------------------');
            errorCount++;
        }
    }
});

console.log(`Scan complete. Checked ${fileCount} files.`);

if (errorCount > 0) {
    console.error(`\nFound ${errorCount} broken internal imports.`);
    process.exit(1);
} else {
    console.log("✅ ALL INTERNAL JAVA IMPORTS ARE VALID!");
}
