/**
 * md-to-pdf.js — Convert Markdown (with Mermaid) to PDF via Chrome headless
 *
 * Usage:
 *   node md-to-pdf.js <input.md> [output.pdf]
 *
 * Requirements: Node.js >= 16, Google Chrome >= 112
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

// ── Args ──────────────────────────────────────────────────────────────────────
const input = process.argv[2];
if (!input) {
  console.error('Usage: node md-to-pdf.js <input.md> [output.pdf]');
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error(`File not found: ${input}`);
  process.exit(1);
}

const outputPdf = process.argv[3] || input.replace(/\.md$/i, '.pdf');
const md = fs.readFileSync(input, 'utf8');
const title = path.basename(input, '.md').replace(/-/g, ' ').replace(/_/g, ' ');

// ── Build HTML ────────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<!-- Typography: Libre Baskerville (headings), Inter (body), JetBrains Mono (code) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<!-- Syntax highlighting -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<!-- Markdown + diagrams -->
<script src="https://cdn.jsdelivr.net/npm/marked@13/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>
  /* ── Base ─────────────────────────────── */
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    max-width: 960px; margin: 40px auto; padding: 0 40px;
    background: #faf8f3; color: #5a5a5a;
    font-size: 13.5px; line-height: 1.7;
  }
  /* ── Headings ─────────────────────────── */
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Libre Baskerville', Georgia, serif;
    color: #3a3a3a; line-height: 1.3; margin: 1.8rem 0 0.8rem;
  }
  h1 { font-size: 26px; border-bottom: 2px solid #e8e4db; padding-bottom: 10px; margin-top: 0; color: #2c1810; }
  h2 { font-size: 20px; border-bottom: 1px solid #e8e4db; padding-bottom: 5px; margin-top: 2.2rem; color: #3a2010; }
  h3 { font-size: 16px; color: #4a3020; margin-top: 1.6rem; }
  h4 { font-size: 14px; color: #5a4030; margin-top: 1.2rem; }
  /* ── Code ─────────────────────────────── */
  code, pre, kbd {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  }
  pre {
    background: #f5f2eb; border: 1px solid #e8e4db; border-radius: 6px;
    padding: 14px 16px; overflow-x: auto; font-size: 12px; line-height: 1.55;
  }
  pre code { background: none; padding: 0; font-size: inherit; border: none; }
  code {
    background: #ebe7de; padding: 2px 5px; border-radius: 3px;
    font-size: 12px; border: 1px solid #e0dbd2;
  }
  /* ── Tables ───────────────────────────── */
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 12.5px; }
  th, td { border: 1px solid #e8e4db; padding: 7px 12px; text-align: left; }
  th { background: #f5f2eb; font-weight: 600; color: #3a3a3a; font-family: 'Inter', sans-serif; }
  tr:nth-child(even) td { background: #fdf9f4; }
  /* ── Blockquote ───────────────────────── */
  blockquote {
    border-left: 3px solid #8b4513; margin: 0 0 1rem; padding: 6px 16px;
    color: #6a6a6a; background: #f5f2eb; border-radius: 0 4px 4px 0;
  }
  /* ── Links ────────────────────────────── */
  a { color: #5c4033; text-decoration: underline; }
  a:hover { color: #8b4513; }
  /* ── Misc ─────────────────────────────── */
  hr { border: none; border-top: 1px solid #e8e4db; margin: 28px 0; }
  img { max-width: 100%; border-radius: 4px; }
  li { margin: 0.25rem 0; }
  /* ── Mermaid diagrams ─────────────────── */
  .mermaid { text-align: center; margin: 24px 0; }
  .mermaid svg { max-width: 100%; height: auto; }
  /* ── Print ────────────────────────────── */
  @media print {
    body { background: white; max-width: 100%; margin: 0; padding: 20px; }
    pre  { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
    h2, h3 { page-break-after: avoid; }
  }
</style>
</head>
<body>
<div id="content"></div>
<script>
  // Mermaid v11: deterministicIds for stable SVG IDs across renders (critical for PDF)
  mermaid.initialize({
    startOnLoad: false,
    deterministicIds: true,
    securityLevel: 'loose',
    theme: 'default',
    fontFamily: 'Inter, system-ui, sans-serif'
  });

  const raw = ${JSON.stringify(md)};
  document.getElementById('content').innerHTML = marked.parse(raw);

  // Replace pre > code.language-mermaid with div.mermaid for diagram rendering
  document.querySelectorAll('pre code.language-mermaid').forEach(el => {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = el.textContent;
    el.closest('pre').replaceWith(div);
  });

  // Syntax-highlight all remaining code blocks (synchronous)
  hljs.highlightAll();

  // Render diagrams, then signal Chrome that the page is ready
  mermaid.run().then(() => {
    document.title = 'READY';
  }).catch(() => {
    document.title = 'READY'; // proceed even if some diagrams fail
  });
</script>
</body>
</html>`;

// ── Write temp HTML ───────────────────────────────────────────────────────────
const tmpHtml = path.join(os.tmpdir(), path.basename(input, '.md') + '_mdpdf.html');
fs.writeFileSync(tmpHtml, html, 'utf8');
console.log('HTML generated:', tmpHtml);

// ── Find Chrome ───────────────────────────────────────────────────────────────
const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/c/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
];

// Also check CHROME env var for custom path
if (process.env.CHROME) chromeCandidates.unshift(process.env.CHROME);

const chrome = chromeCandidates.find(p => {
  try { fs.accessSync(p); return true; } catch { return false; }
});

if (!chrome) {
  console.error([
    'Chrome not found. Set CHROME env var to your Chrome path, e.g.:',
    '  CHROME="/path/to/chrome" node md-to-pdf.js input.md',
  ].join('\n'));
  process.exit(1);
}

// ── Run Chrome headless ───────────────────────────────────────────────────────
const absOutput = path.resolve(outputPdf);
// file:/// URL — normalize backslashes on Windows
const fileUrl = 'file:///' + tmpHtml.replace(/\\/g, '/');

console.log(`Converting: ${input} → ${absOutput}`);
console.log('Chrome:', chrome);

// Use spawnSync with args array — avoids shell quoting issues on Windows/Unix
const result = spawnSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--run-all-compositor-stages-before-draw',
  '--virtual-time-budget=6000',
  `--print-to-pdf=${absOutput}`,
  fileUrl,
], { stdio: 'inherit' });

if (result.error) {
  console.error('Chrome launch error:', result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`Chrome exited with code ${result.status}`);
  process.exit(result.status);
}

const stat = fs.statSync(absOutput);
console.log(`✓ PDF saved: ${absOutput} (${(stat.size / 1024).toFixed(1)} KB)`);
