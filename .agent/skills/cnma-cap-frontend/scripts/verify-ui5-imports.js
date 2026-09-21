const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const ui5AppPath = path.join(projectRoot, '.agent/skills/cnma-cap-frontend/templates/ui5/webapp');

if (!fs.existsSync(ui5AppPath)) {
    console.log('No "app" directory found. Skipping UI5 verification.');
    process.exit(0);
}

// Function to find all files recursively
function getFiles(dir, files = []) {
    const fileList = fs.readdirSync(dir);
    for (const file of fileList) {
        const name = `${dir}/${file}`;
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files);
        } else {
            files.push(name);
        }
    }
    return files;
}

try {
    const files = getFiles(ui5AppPath);
    let hasErrors = false;

    console.log(`Scanning ${files.length} files in ${ui5AppPath}...`);

    for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.xml') || file.endsWith('.json') || file.endsWith('.html')) {
            const content = fs.readFileSync(file, 'utf8');
            // Check for hardcoded absolute paths or specific user placeholders that shouldn't be there
            if (content.includes('d:\\DevSpaces')) {
                console.error(`Error: Hardcoded path found in ${file}`);
                hasErrors = true;
            }
            if (content.includes('{{') && !content.includes('{{ui_namespace}}') && !content.includes('{{project_name}}') && !content.includes('{{appTitle}}')) {
                // warning for un-replaced placeholders, but might be valid in some contexts
                // console.warn(`Warning: Potential un-replaced placeholder in ${file}`);
            }
        }
    }

    if (hasErrors) {
        console.error('UI5 Verification Failed: Hardcoded paths detected.');
        process.exit(1);
    } else {
        console.log('UI5 Verification Passed: No hardcoded paths detected.');
    }

} catch (e) {
    console.error('Error during UI5 verification:', e);
    process.exit(1);
}
