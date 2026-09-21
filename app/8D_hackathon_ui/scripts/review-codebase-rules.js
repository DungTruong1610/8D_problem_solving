import fs from 'fs';
import path from 'path';
import ts from 'typescript';

console.log("Starting Codebase Rule Review...");

const srcDir = path.resolve('src');
const componentsUi = path.join('src', 'components', 'ui');

// Walk directory recursively
function walkDir(dir, filterExt = ['.tsx', '.ts']) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Exclude common non-user folders
        if (['node_modules', 'dist', 'build', '.git', 'test', '__tests__'].includes(entry.name)) continue;
        // Exclude shadcn UI folder as it contains external component primitives
        if (fullPath.includes(componentsUi)) continue;
        // Exclude test files
        if (entry.name.endsWith('.test.tsx') || entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.tsx') || entry.name.endsWith('.spec.ts')) continue;

        if (entry.isDirectory()) {
            results = results.concat(walkDir(fullPath, filterExt));
        } else if (entry.isFile() && filterExt.includes(path.extname(entry.name))) {
            results.push(fullPath);
        }
    }
    return results;
}

const files = walkDir(srcDir);
const report = {
    hardcodedPixels: [],
    hardcodedHex: [],
    rawColors: [],
    rawHtmlTags: [],
    inlineStyles: [],
    localColorMaps: [],
    hardcodedText: []
};

// Patterns
const pixelRegex = /-\[(\d+(?:\.\d+)?)(px|rem|em)\]/i;
const hexRegex = /#([0-9a-fA-F]{3,8})\b/;
const rawTailwindColorRegex = /\b(bg|text|border|ring|divide|from|to|via)-(red|blue|green|yellow|indigo|purple|pink|orange|amber|emerald|teal|cyan|sky|violet|fuchsia|rose|slate|zinc|neutral|stone|gray)-\d+\b/i;

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    const relativePath = path.relative(process.cwd(), file).replace(/\\/g, '/');

    function addIssue(category, line, message, codeSnippet) {
        report[category].push({
            file: relativePath,
            line,
            message,
            codeSnippet: codeSnippet ? codeSnippet.trim().substring(0, 100) : ''
        });
    }

    function visit(node) {
        // Line number helper (1-indexed)
        const getLineNum = (pos) => sourceFile.getLineAndCharacterOfPosition(pos).line + 1;

        // 1. Check raw HTML elements
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
            const tagName = node.tagName.getText(sourceFile);
            if (['button', 'input', 'textarea', 'select'].includes(tagName)) {
                let isColorPicker = false;
                if (tagName === 'input') {
                    // Check if it has type="color" or type="file" which are sometimes acceptable
                    const typeAttr = node.attributes.properties.find(p => p.name && p.name.getText(sourceFile) === 'type');
                    if (typeAttr && typeAttr.initializer && ts.isStringLiteral(typeAttr.initializer)) {
                        if (['color'].includes(typeAttr.initializer.text)) {
                            isColorPicker = true;
                        }
                    }
                }
                if (!isColorPicker) {
                    addIssue(
                        'rawHtmlTags',
                        getLineNum(node.getStart()),
                        `Raw HTML tag <${tagName}> used. Replace with corresponding @cnma/react-ui component.`,
                        node.getText(sourceFile)
                    );
                }
            }
        }

        // 2. Check className attributes
        if (ts.isJsxAttribute(node) && node.name.text === 'className' && node.initializer) {
            let classNameValue = '';
            if (ts.isStringLiteral(node.initializer)) {
                classNameValue = node.initializer.text;
            } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
                classNameValue = node.initializer.expression.getText(sourceFile);
            }

            if (classNameValue) {
                // Check arbitrary pixels
                if (pixelRegex.test(classNameValue)) {
                    addIssue(
                        'hardcodedPixels',
                        getLineNum(node.getStart()),
                        `Hardcoded pixels/units in className: '${classNameValue.match(pixelRegex)[0]}'`,
                        node.getText(sourceFile)
                    );
                }
                // Check hex colors
                if (hexRegex.test(classNameValue)) {
                    addIssue(
                        'hardcodedHex',
                        getLineNum(node.getStart()),
                        `Hardcoded hex color in className: '${classNameValue.match(hexRegex)[0]}'`,
                        node.getText(sourceFile)
                    );
                }
                // Check raw colors
                if (rawTailwindColorRegex.test(classNameValue)) {
                    addIssue(
                        'rawColors',
                        getLineNum(node.getStart()),
                        `Raw Tailwind color used: '${classNameValue.match(rawTailwindColorRegex)[0]}'`,
                        node.getText(sourceFile)
                    );
                }
            }
        }

        // 3. Check inline styles
        if (ts.isJsxAttribute(node) && node.name.text === 'style' && node.initializer) {
            if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
                const expr = node.initializer.expression;
                // e.g. style={{ padding: '10px', color: '#ff0000' }}
                if (ts.isObjectLiteralExpression(expr)) {
                    expr.properties.forEach(prop => {
                        if (ts.isPropertyAssignment(prop)) {
                            const name = prop.name.getText(sourceFile);
                            const val = prop.initializer;
                            
                            // Check for hardcoded pixel sizes or colors inside the style assignment
                            let valText = val.getText(sourceFile);
                            let hasViolation = false;
                            
                            if (ts.isStringLiteral(val) || ts.isNoSubstitutionTemplateLiteral(val)) {
                                const text = val.text;
                                if (hexRegex.test(text) || pixelRegex.test(text) || /\d+px/i.test(text)) {
                                    hasViolation = true;
                                }
                            } else if (ts.isNumericLiteral(val)) {
                                // e.g. padding: 10
                                if (['padding', 'margin', 'top', 'left', 'right', 'bottom', 'width', 'height', 'gap'].some(k => name.toLowerCase().includes(k))) {
                                    hasViolation = true;
                                }
                            }

                            if (hasViolation) {
                                addIssue(
                                    'inlineStyles',
                                    getLineNum(prop.getStart()),
                                    `Hardcoded inline style property: '${name}: ${valText}'`,
                                    node.getText(sourceFile)
                                );
                            }
                        }
                    });
                } else {
                    // General warning for non-trivial inline styles
                    addIssue(
                        'inlineStyles',
                        getLineNum(node.getStart()),
                        `Dynamic inline style block detected: '${expr.getText(sourceFile)}'`,
                        node.getText(sourceFile)
                    );
                }
            }
        }

        // 4. Check local color maps
        if (ts.isObjectLiteralExpression(node)) {
            // Find parent variable/const name if possible
            let parentVarName = '';
            let parent = node.parent;
            while (parent && !ts.isVariableDeclaration(parent) && !ts.isPropertyAssignment(parent)) {
                parent = parent.parent;
            }
            if (parent && ts.isVariableDeclaration(parent)) {
                parentVarName = parent.name.getText(sourceFile);
            } else if (parent && ts.isPropertyAssignment(parent)) {
                parentVarName = parent.name.getText(sourceFile);
            }

            // Check if object keys map to tailwind raw colors or hex colors
            let colorMappingCount = 0;
            node.properties.forEach(prop => {
                if (ts.isPropertyAssignment(prop) && prop.initializer) {
                    if (ts.isStringLiteral(prop.initializer)) {
                        const val = prop.initializer.text;
                        if (rawTailwindColorRegex.test(val) || hexRegex.test(val)) {
                            colorMappingCount++;
                        }
                    }
                }
            });

            if (colorMappingCount > 0) {
                addIssue(
                    'localColorMaps',
                    getLineNum(node.getStart()),
                    `Local color/status map '${parentVarName || 'unnamed object'}' defined. Move to StatusBadge or theme/constants.`,
                    node.getText(sourceFile)
                );
            }
        }

        // 5. Check hardcoded strings (i18n check)
        if (ts.isJsxText(node)) {
            const text = node.text.trim();
            if (/[a-zA-Z]{2,}/.test(text)) {
                const lowerText = text.toLowerCase();
                const ignoreList = ['lucide', 'http', 'px', 'em', 'rem', '.mp4', '.pdf', '.png', '.jpeg'];
                if (!ignoreList.some(i => lowerText.includes(i))) {
                    addIssue(
                        'hardcodedText',
                        getLineNum(node.getStart()),
                        `Hardcoded JSX Text: "${text}"`,
                        text
                    );
                }
            }
        }

        if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression)) {
            const text = node.expression.text.trim();
            if (/[a-zA-Z]{2,}/.test(text)) {
                addIssue(
                    'hardcodedText',
                    getLineNum(node.getStart()),
                    `Hardcoded JSX Expression string: "${text}"`,
                    text
                );
            }
        }

        if (ts.isJsxAttribute(node) && node.name && ts.isIdentifier(node.name)) {
            const attrName = node.name.text;
            if (['placeholder', 'title', 'label', 'aria-label', 'description'].includes(attrName) && node.initializer) {
                if (ts.isStringLiteral(node.initializer)) {
                    const text = node.initializer.text.trim();
                    if (/[a-zA-Z]/.test(text)) {
                        addIssue(
                            'hardcodedText',
                            getLineNum(node.getStart()),
                            `Hardcoded attribute [${attrName}]: "${text}"`,
                            node.getText(sourceFile)
                        );
                    }
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
});

// Generate Markdown Report
const reportPath = path.resolve('codebase-rules-review-report.md');
let mdContent = `# Codebase Rules & Styling Review Report\n\n`;
mdContent += `Generated at: ${new Date().toISOString()}\n\n`;
mdContent += `This report lists all detected codebase violations based on the zero-tolerance styling and component rules.\n\n`;

const categories = [
    { key: 'hardcodedPixels', title: '§0 Hardcoded Pixels (`[10px]`, `w-[180px]`)' },
    { key: 'hardcodedHex', title: '§0 Hardcoded Hex Colors (`[#ffffff]`)' },
    { key: 'rawColors', title: '§0 Raw Tailwind Colors (`bg-red-500`, `text-blue-500`)' },
    { key: 'rawHtmlTags', title: '§0 Raw HTML Component Primitives (`<button>`, `<input>`)' },
    { key: 'inlineStyles', title: '§0 Inline Styles (`style={{ ... }}`)' },
    { key: 'localColorMaps', title: '§0 Local Status/Color Mappings' },
    { key: 'hardcodedText', title: '§6 i18n / Hardcoded UI Text' }
];

let totalIssues = 0;

categories.forEach(cat => {
    const list = report[cat.key];
    mdContent += `## ${cat.title} (${list.length} issues)\n\n`;
    if (list.length === 0) {
        mdContent += `🎉 **No issues found in this category!**\n\n`;
    } else {
        // Group by file
        const grouped = {};
        list.forEach(issue => {
            if (!grouped[issue.file]) grouped[issue.file] = [];
            grouped[issue.file].push(issue);
        });

        Object.keys(grouped).sort().forEach(file => {
            mdContent += `### File: \`${file}\`\n`;
            grouped[file].sort((a, b) => a.line - b.line).forEach(issue => {
                let codeDisplay = issue.codeSnippet ? ` \`\`\` ${issue.codeSnippet} \`\`\`` : '';
                mdContent += `- [ ] **Line ${issue.line}**: ${issue.message}${codeDisplay}\n`;
                totalIssues++;
            });
            mdContent += `\n`;
        });
    }
    mdContent += `---\n\n`;
});

mdContent += `## Summary\n\n`;
mdContent += `- Total Issues Found: **${totalIssues}**\n`;
categories.forEach(cat => {
    mdContent += `  - ${cat.title.split(' (')[0]}: **${report[cat.key].length}**\n`;
});
mdContent += `\nFix these issues to align with the Lead React Frontend Engineer guidelines.\n`;

fs.writeFileSync(reportPath, mdContent, 'utf8');
console.log(`\nReview complete! Found ${totalIssues} issues.`);
console.log(`Report saved to: ${reportPath}`);
