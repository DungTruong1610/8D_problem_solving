#!/usr/bin/env node
/**
 * verify-imports.js
 * -----------------
 * Scans a Node.js project directory for require() and import statements,
 * then verifies every local path actually exists on disk.
 *
 * Usage:
 *   node verify-imports.js [options]
 *
 * Options:
 *   --dir   <path>       Directory to scan (default: srv). Relative to cwd or absolute.
 *   --ext   <list>       Comma-separated extensions to check (default: js,ts)
 *   --skip  <list>       Comma-separated directory names to exclude
 *                        (default: node_modules,generated,service-specifications,dist,.git)
 *   --json               Output machine-readable JSON
 *   --help               Show this help message
 *
 * Exit codes:
 *   0 = all imports valid (or scan dir not found)
 *   1 = broken imports detected
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─── Parse CLI args ───────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
verify-imports.js — Check all local require()/import paths resolve on disk.

Usage:
  node verify-imports.js [--dir <path>] [--ext js,ts] [--skip dir1,dir2] [--json]

Options:
  --dir   Directory to scan  (default: srv)
  --ext   File extensions     (default: js,ts)
  --skip  Dirs to skip        (default: node_modules,generated,service-specifications,dist,.git)
  --json  Machine-readable JSON output
  --help  Show this message
`);
  process.exit(0);
}

function getArg(flag, defaultVal) {
  const idx = args.indexOf(flag);
  if (idx === -1) return defaultVal;
  return args[idx + 1] || defaultVal;
}

const scanDirArg  = getArg('--dir', 'srv');
const extArg      = getArg('--ext', 'js,ts');
const skipArg     = getArg('--skip', 'node_modules,generated,service-specifications,dist,.git');
const jsonMode    = args.includes('--json');

const SCAN_DIR    = path.isAbsolute(scanDirArg)
  ? scanDirArg
  : path.resolve(process.cwd(), scanDirArg);

const EXTENSIONS  = new Set(extArg.split(',').map(e => '.' + e.trim().replace(/^\./, '')));
const SKIP_DIRS   = new Set(skipArg.split(',').map(s => s.trim()));

// Known external/built-in prefixes — never try to resolve these on disk
const EXTERNAL_PREFIXES = [
  // Node built-ins
  'node:', 'fs', 'path', 'http', 'https', 'os', 'util', 'crypto', 'stream',
  'url', 'events', 'child_process', 'buffer', 'assert', 'net', 'tls', 'dns',
  'readline', 'zlib', 'timers', 'vm', 'module', 'process', 'cluster',
  'string_decoder', 'querystring', 'punycode', 'domain', 'v8', 'perf_hooks',
  // Common npm packages
  '@sap', 'axios', 'xsenv', 'cors', 'express', 'moment', 'uuid',
  'cf-nodejs-logging-support', 'lodash', 'dotenv', 'body-parser',
  'multer', 'joi', 'yup', 'winston', 'pino', 'debug', 'chalk', 'inquirer',
  'commander', 'minimist', 'yargs', 'glob', 'rimraf', 'mkdirp', 'ncp',
  'bluebird', 'async', 'rxjs', 'ramda', 'fp-ts',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isExternalModule(reqPath) {
  if (!reqPath.startsWith('.')) return true; // bare specifier = external
  return EXTERNAL_PREFIXES.some(prefix => reqPath === prefix || reqPath.startsWith(prefix + '/'));
}

/** Resolve a require/import path to a list of candidate file paths. */
function getCandidates(fromDir, reqPath) {
  const base = path.resolve(fromDir, reqPath);
  const candidates = [base];

  // Try adding each expected extension
  for (const ext of EXTENSIONS) {
    candidates.push(base + ext);
    candidates.push(path.join(base, 'index' + ext));
  }

  // Fallback: bare .js / .ts regardless of --ext (handles mixed projects)
  candidates.push(base + '.js', base + '.ts');
  candidates.push(path.join(base, 'index.js'), path.join(base, 'index.ts'));

  return [...new Set(candidates)]; // deduplicate
}

/** Walk a directory recursively, yielding files matching EXTENSIONS. */
function* walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'EACCES' || e.code === 'EPERM') return; // skip inaccessible dirs
    throw e;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walkDir(fullPath);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      yield fullPath;
    }
  }
}

/** Extract all require() and ES import paths from source text, with line numbers. */
function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines   = content.split('\n');
  const results = [];

  // Matches: require("path"), require('path')
  const requireRe = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  // Matches: import ... from "path", import "path", import type ... from "path"
  const importRe  = /(?:^|\s)import\s+(?:type\s+)?(?:[^'"`;]+\s+from\s+)?['"`]([^'"`]+)['"`]/g;

  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i];
    const trimmed = line.trim();

    // Skip single-line comments and JSDoc lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) continue;

    requireRe.lastIndex = 0;
    let m;
    while ((m = requireRe.exec(line)) !== null) {
      const importPath = m[1].trim();
      if (importPath) results.push({ importPath, kind: 'require', line: i + 1 });
    }

    importRe.lastIndex = 0;
    while ((m = importRe.exec(line)) !== null) {
      const importPath = m[1].trim();
      if (importPath) results.push({ importPath, kind: 'import', line: i + 1 });
    }
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SCAN_DIR)) {
  const msg = `⚠️  Scan directory not found: ${SCAN_DIR}. Skipping import check.`;
  if (jsonMode) {
    console.log(JSON.stringify({ skipped: true, reason: msg, errors: [], totalChecked: 0 }));
  } else {
    console.log(msg);
  }
  process.exit(0);
}

const errors        = [];
let   totalFiles    = 0;
let   totalChecked  = 0;

for (const filePath of walkDir(SCAN_DIR)) {
  totalFiles++;
  const imports = extractImports(filePath);

  for (const { importPath, kind, line } of imports) {
    if (isExternalModule(importPath)) continue;

    totalChecked++;
    const candidates = getCandidates(path.dirname(filePath), importPath);
    const exists     = candidates.some(c => fs.existsSync(c));

    if (!exists) {
      const relFile     = path.relative(SCAN_DIR, filePath);
      const resolvedRel = path.relative(SCAN_DIR, path.resolve(path.dirname(filePath), importPath));

      errors.push({
        file:     relFile,
        line,
        kind,
        require:  importPath,
        resolved: resolvedRel,
      });
    }
  }
}

// ─── Output ───────────────────────────────────────────────────────────────────

if (jsonMode) {
  console.log(JSON.stringify({
    skipped:      false,
    scanDir:      SCAN_DIR,
    totalFiles,
    totalChecked,
    errorCount:   errors.length,
    errors,
  }, null, 2));
} else {
  if (errors.length > 0) {
    // Group errors by file
    const byFile = {};
    for (const e of errors) {
      if (!byFile[e.file]) byFile[e.file] = [];
      byFile[e.file].push(e);
    }

    console.log(`\n❌ Broken imports found in: ${SCAN_DIR}\n`);
    for (const [file, errs] of Object.entries(byFile)) {
      console.log(`  📄 ${file}`);
      for (const e of errs) {
        const stmt = e.kind === 'import' ? `import ... from "${e.require}"` : `require("${e.require}")`;
        console.log(`     Line ${e.line}: ${stmt}`);
        console.log(`             → resolved to: ${e.resolved} (not found)`);
      }
      console.log('');
    }
  }

  console.log('========================================');
  console.log(`Files scanned    : ${totalFiles}`);
  console.log(`Local paths checked: ${totalChecked}`);
  console.log(`Broken imports   : ${errors.length}`);
  console.log('========================================');

  if (errors.length === 0) {
    console.log('✅  ALL IMPORTS VALID!');
  } else {
    console.log(`❌  ${errors.length} BROKEN IMPORT(S) FOUND!`);
    process.exit(1);
  }
}

if (errors.length > 0) process.exit(1);
