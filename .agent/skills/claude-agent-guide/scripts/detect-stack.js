#!/usr/bin/env node
/**
 * detect-stack.js
 *
 * Scans a Node.js / TypeScript project and emits a single JSON object
 * describing the stack so the claude-agent-guide skill can pick the right
 * CLAUDE.md template variant.
 *
 * Pure Node.js built-ins — no npm install required.
 *
 * Usage:
 *   node detect-stack.js                      # scans process.cwd()
 *   node detect-stack.js --dir /path/to/proj
 *   node detect-stack.js --dir . --verbose
 *
 * Output JSON schema: see references/detection-rules.md
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ---------- CLI args ----------
function parseArgs(argv) {
    const out = { dir: process.cwd(), verbose: false };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dir' || a === '-d') {
            out.dir = path.resolve(argv[++i] || '.');
        } else if (a === '--verbose' || a === '-v') {
            out.verbose = true;
        } else if (a === '--help' || a === '-h') {
            console.log('Usage: detect-stack.js [--dir <path>] [--verbose]');
            process.exit(0);
        }
    }
    return out;
}

// ---------- safe file readers ----------
function readJSON(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        // Strip BOM + trailing commas for tsconfig.json (which allows comments/trailing commas)
        const cleaned = raw
            .replace(/^\uFEFF/, '')
            .replace(/\/\/[^\n\r]*/g, '')       // line comments
            .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
            .replace(/,(\s*[\]}])/g, '$1');      // trailing commas
        return JSON.parse(cleaned);
    } catch {
        return null;
    }
}

function fileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

function dirExists(dirPath) {
    try {
        return fs.statSync(dirPath).isDirectory();
    } catch {
        return false;
    }
}

function listDirs(root, { depth = 1, blocklist } = {}) {
    const block = new Set(
        blocklist || [
            'node_modules',
            '.git',
            'dist',
            'build',
            '.next',
            'coverage',
            '.vscode',
            '.idea',
            '.cache',
            '.turbo',
            '.pnpm-store',
        ]
    );
    const out = [];
    function walk(current, level) {
        if (level > depth) return;
        let entries;
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (!e.isDirectory()) continue;
            if (block.has(e.name)) continue;
            if (e.name.startsWith('.') && level === 0) continue;
            out.push(path.relative(root, path.join(current, e.name)));
            walk(path.join(current, e.name), level + 1);
        }
    }
    walk(root, 0);
    return out;
}

function findFiles(root, pattern, { maxDepth = 3, blocklist } = {}) {
    const block = new Set(
        blocklist || ['node_modules', '.git', 'dist', 'build', '.next', 'coverage']
    );
    const matches = [];
    function walk(current, level) {
        if (level > maxDepth) return;
        let entries;
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (block.has(e.name)) continue;
            const full = path.join(current, e.name);
            if (e.isDirectory()) {
                walk(full, level + 1);
            } else if (pattern.test(e.name)) {
                matches.push(path.relative(root, full));
            }
        }
    }
    walk(root, 0);
    return matches;
}

// ---------- detectors ----------
function detectFramework(pkg, signals) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const candidates = [];

    if (deps['@sap/cds']) {
        candidates.push('cap');
        signals.push(`package.json: @sap/cds@${deps['@sap/cds']}`);
    }
    if (deps['@nestjs/core']) {
        candidates.push('nest');
        signals.push(`package.json: @nestjs/core@${deps['@nestjs/core']}`);
    }
    if (deps['fastify']) {
        candidates.push('fastify');
        signals.push(`package.json: fastify@${deps['fastify']}`);
    }
    if (deps['express']) {
        candidates.push('express');
        signals.push(`package.json: express@${deps['express']}`);
    }
    if (deps['koa']) {
        candidates.push('koa');
        signals.push(`package.json: koa@${deps['koa']}`);
    }
    if (deps['@hapi/hapi'] || deps['hapi']) {
        candidates.push('hapi');
        signals.push('package.json: @hapi/hapi present');
    }

    // Priority / tie-breakers (documented in detection-rules.md)
    if (candidates.includes('cap')) return 'cap';
    if (candidates.includes('nest')) return 'nest';
    if (candidates.includes('fastify')) return 'fastify';
    if (candidates.includes('express')) return 'express';
    if (candidates.includes('koa')) return 'koa';
    if (candidates.includes('hapi')) return 'hapi';
    return 'unknown';
}

function detectORM(pkg, root, signals) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const found = [];

    const prismaSchema = path.join(root, 'prisma', 'schema.prisma');
    if (deps['@prisma/client']) {
        found.push('prisma');
        signals.push(`package.json: @prisma/client@${deps['@prisma/client']}`);
        if (fileExists(prismaSchema)) {
            signals.push('prisma/schema.prisma present');
        } else {
            signals.push('WARNING: @prisma/client present but prisma/schema.prisma missing');
        }
    }
    if (deps['mongoose']) {
        found.push('mongoose');
        signals.push(`package.json: mongoose@${deps['mongoose']}`);
    }
    if (deps['typeorm']) {
        found.push('typeorm');
        signals.push(`package.json: typeorm@${deps['typeorm']}`);
    }
    if (deps['sequelize']) {
        found.push('sequelize');
        signals.push(`package.json: sequelize@${deps['sequelize']}`);
    }
    if (deps['drizzle-orm']) {
        found.push('drizzle');
        signals.push(`package.json: drizzle-orm@${deps['drizzle-orm']}`);
    }
    if (deps['@sap/cds']) {
        // CAP implicitly uses CDS model
        found.push('cds');
    }

    if (found.length === 0) return { orm: 'none', ambiguous: false };
    // Filter out 'cds' from ambiguity check when CAP framework is the primary
    const nonCds = found.filter((f) => f !== 'cds');
    if (nonCds.length > 1) {
        return { orm: 'ambiguous', candidates: nonCds, ambiguous: true };
    }
    return { orm: found[0], ambiguous: false };
}

function detectValidation(pkg, framework, signals) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (deps['zod']) {
        signals.push(`package.json: zod@${deps['zod']}`);
        return 'zod';
    }
    if (deps['class-validator']) {
        signals.push(`package.json: class-validator@${deps['class-validator']}`);
        return 'class-validator';
    }
    if (deps['joi']) return 'joi';
    if (deps['yup']) return 'yup';
    if (deps['valibot']) return 'valibot';
    if (framework === 'nest') {
        signals.push('Nest project with no validation lib detected — assuming class-validator?');
        return 'class-validator?';
    }
    return 'none';
}

function detectAuth(pkg, signals) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    if (deps['@sap/xssec'] || deps['@sap/approuter']) {
        signals.push('package.json: @sap/xssec / @sap/approuter present → XSUAA');
        return 'xsuaa';
    }
    if (deps['@nestjs/passport'] && deps['passport-jwt']) return 'passport-jwt';
    if (deps['@nestjs/jwt']) return 'nestjs-jwt';
    if (deps['jsonwebtoken']) return 'jwt';
    if (deps['@clerk/clerk-sdk-node']) return 'clerk';
    if (deps['next-auth']) return 'next-auth';
    return 'none';
}

function detectModuleSystem(tsconfig, pkg, signals) {
    if (tsconfig && tsconfig.compilerOptions) {
        const mod = String(tsconfig.compilerOptions.module || '').toLowerCase();
        signals.push(`tsconfig.json: module=${tsconfig.compilerOptions.module || '(unset)'}`);
        if (mod === 'nodenext' || mod.startsWith('es')) return 'esm';
        if (mod === 'commonjs') return 'cjs';
    }
    if (pkg && pkg.type === 'module') {
        signals.push('package.json: "type": "module"');
        return 'esm';
    }
    return 'cjs';
}

function detectRuntime(pkg, tsconfig) {
    if (pkg && pkg.engines && pkg.engines.node) {
        const v = pkg.engines.node.match(/\d+/);
        if (v) return `node@${v[0]}`;
    }
    if (tsconfig && tsconfig.compilerOptions && tsconfig.compilerOptions.target) {
        const t = String(tsconfig.compilerOptions.target).toLowerCase();
        if (t.includes('2022') || t.includes('2023')) return 'node@20';
        if (t.includes('2021')) return 'node@16';
        if (t.includes('2020')) return 'node@14';
    }
    return 'node@20';
}

function detectProjectName(pkg, root) {
    if (pkg && pkg.name) return pkg.name;
    return path.basename(root);
}

function detectExternalServices(root, signals) {
    const envExample = path.join(root, '.env.example');
    if (!fileExists(envExample)) return [];
    let raw = '';
    try {
        raw = fs.readFileSync(envExample, 'utf8');
    } catch {
        return [];
    }
    const keys = raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => l.split('=')[0].trim())
        .filter(Boolean);

    const hints = new Set();
    for (const k of keys) {
        const K = k.toUpperCase();
        if (/^STRIPE_/.test(K)) hints.add('Stripe');
        if (/^SENDGRID_|^POSTMARK_|^SMTP_|^MAILGUN_/.test(K)) hints.add('Email');
        if (/^GEMINI_|^GOOGLE_AI_/.test(K)) hints.add('Google Gemini');
        if (/^OPENAI_/.test(K)) hints.add('OpenAI');
        if (/^ANTHROPIC_/.test(K)) hints.add('Anthropic Claude');
        if (/^AWS_|^S3_/.test(K)) hints.add('AWS/S3');
        if (/^CLOUDINARY_/.test(K)) hints.add('Cloudinary');
        if (/^REDIS_/.test(K)) hints.add('Redis');
        if (/^MONGO/.test(K)) hints.add('MongoDB');
        if (/^TWILIO_/.test(K)) hints.add('Twilio');
        if (/^FIREBASE_/.test(K)) hints.add('Firebase');
        if (/^SUPABASE_/.test(K)) hints.add('Supabase');
        if (/^ALGOLIA_/.test(K)) hints.add('Algolia');
    }
    if (hints.size > 0) {
        signals.push(`.env.example scanned: ${keys.length} keys, inferred services: ${[...hints].join(', ')}`);
    }
    return [...hints];
}

// ---------- template selection ----------
function pickTemplate(framework, orm) {
    // Returns { recommendedTemplate, mixins[] }
    if (framework === 'cap') return { recommendedTemplate: 'CLAUDE.cap.md', mixins: [] };

    if (framework === 'nest') {
        if (orm === 'prisma') return { recommendedTemplate: 'CLAUDE.nest.md', mixins: ['CLAUDE.prisma.md'] };
        return { recommendedTemplate: 'CLAUDE.nest.md', mixins: [] };
    }

    if (orm === 'prisma') {
        return { recommendedTemplate: 'CLAUDE.prisma.md', mixins: [] };
    }

    // Express/Fastify/Koa/Hapi/unknown + Mongoose/none → generic
    return { recommendedTemplate: 'CLAUDE.generic.md', mixins: [] };
}

// ---------- main ----------
function main() {
    const args = parseArgs(process.argv);
    const root = args.dir;
    const signals = [];

    if (!dirExists(root)) {
        console.error(JSON.stringify({ error: `Directory not found: ${root}` }));
        process.exit(2);
    }

    const pkg = readJSON(path.join(root, 'package.json'));
    if (!pkg) {
        console.error(
            JSON.stringify({
                error: `package.json not found or invalid at ${root}`,
                hint: 'detect-stack.js requires a Node.js project root.',
            })
        );
        process.exit(2);
    }

    const tsconfig = readJSON(path.join(root, 'tsconfig.json'));
    if (tsconfig) signals.push('tsconfig.json present');
    else signals.push('tsconfig.json missing — assuming JavaScript project');

    // Additional evidence files
    if (fileExists(path.join(root, 'nest-cli.json'))) signals.push('nest-cli.json present');
    if (fileExists(path.join(root, 'mta.yaml'))) signals.push('mta.yaml present (SAP BTP deployment)');
    if (fileExists(path.join(root, '.cdsrc.json'))) signals.push('.cdsrc.json present');
    const cdsFiles = findFiles(root, /\.cds$/, { maxDepth: 3 });
    if (cdsFiles.length > 0) signals.push(`CDS model files found: ${cdsFiles.slice(0, 3).join(', ')}${cdsFiles.length > 3 ? ` (+${cdsFiles.length - 3} more)` : ''}`);

    const framework = detectFramework(pkg, signals);
    const ormResult = detectORM(pkg, root, signals);
    const validation = detectValidation(pkg, framework, signals);
    const auth = detectAuth(pkg, signals);
    const moduleSystem = detectModuleSystem(tsconfig, pkg, signals);
    const runtime = detectRuntime(pkg, tsconfig);
    const projectName = detectProjectName(pkg, root);
    const externalServices = detectExternalServices(root, signals);

    // Stack label
    const isTs = !!tsconfig;
    const stackLabel = isTs ? `node-ts-${moduleSystem}` : 'node-js';

    // Ambiguity handling
    if (ormResult.ambiguous) {
        const out = {
            stack: 'ambiguous',
            framework,
            orm: 'ambiguous',
            validation,
            auth,
            runtime,
            moduleSystem,
            projectName,
            externalServices,
            candidates: ormResult.candidates.map((orm) => ({
                framework,
                orm,
                ...pickTemplate(framework, orm),
            })),
            detectedSignals: signals,
        };
        console.log(JSON.stringify(out, null, 2));
        process.exit(0);
    }

    const { recommendedTemplate, mixins } = pickTemplate(framework, ormResult.orm);

    // Confidence assessment
    let confidence = 'high';
    if (framework === 'unknown') confidence = 'low';
    else if (ormResult.orm === 'none' && framework !== 'cap') confidence = 'medium';

    const out = {
        stack: stackLabel,
        framework,
        orm: ormResult.orm,
        validation,
        auth,
        runtime,
        moduleSystem,
        projectName,
        externalServices,
        recommendedTemplate,
        mixins,
        confidence,
        detectedSignals: signals,
    };

    if (args.verbose) {
        out._debug = {
            projectRoot: root,
            topLevelDirs: listDirs(root, { depth: 0 }),
            hasPrismaSchema: fileExists(path.join(root, 'prisma', 'schema.prisma')),
            hasNestCli: fileExists(path.join(root, 'nest-cli.json')),
            hasMta: fileExists(path.join(root, 'mta.yaml')),
            cdsFileCount: cdsFiles.length,
        };
    }

    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
}

if (require.main === module) {
    main();
}

module.exports = { parseArgs, pickTemplate, readJSON };
