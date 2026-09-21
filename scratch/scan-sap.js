const fs = require('fs');
const path = require('path');

function scan(dir, outArr) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
            if (f !== 'node_modules' && f !== '.git' && f !== 'dist' && f !== '.vite') scan(p, outArr);
        } else if (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.json') || f.endsWith('.html') || f.endsWith('.css') || f.endsWith('.cds')) {
            const content = fs.readFileSync(p, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (/\bSAP\b/.test(line) && !line.includes('@sap/') && !line.includes('@cnma/sap')) {
                    outArr.push(`${p}:${idx + 1}: ${line.trim()}`);
                }
            });
        }
    }
}

const fe = [];
scan('d:/Download/VNG-MLAI/project/refractor-migrate/app/8D_hackathon_ui/src', fe);
fs.writeFileSync('scratch/sap-frontend.txt', fe.join('\n'));
console.log(`Frontend found ${fe.length} occurrences.`);

const be = [];
scan('d:/Download/VNG-MLAI/project/refractor-migrate/srv', be);
scan('d:/Download/VNG-MLAI/project/refractor-migrate/db', be);
scan('d:/Download/VNG-MLAI/project/refractor-migrate/shared', be);
fs.writeFileSync('scratch/sap-backend.txt', be.join('\n'));
console.log(`Backend/DB/Shared found ${be.length} occurrences.`);
