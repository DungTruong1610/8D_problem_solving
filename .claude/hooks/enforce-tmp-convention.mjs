/**
 * PreToolUse hook (Bash matcher): enforce the .tmp/ convention.
 *
 * Wired into .claude settings by `cnma hooks` / `cnma init --hooks`. Reads the
 * PreToolUse payload from stdin and either allows the Bash command (no output)
 * or denies it (a JSON decision on stdout).
 *
 * Gated case: `npm pack` without --pack-destination drops the tarball in
 * process.cwd() (the project root) and pollutes `git status`. Allow path: the
 * command or cwd already targets a `.tmp` scratch dir.
 *
 * Shipped as ESM (.mjs) so it runs regardless of the host project's
 * package.json "type". Imports only node:fs — no dependencies.
 */
import { readFileSync } from 'node:fs';

let input = '';
try {
  input = readFileSync(0, 'utf8');
} catch {
  // stdin unavailable — nothing to check, allow
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(input);
} catch {
  process.exit(0);
}

const command = payload?.tool_input?.command ?? '';
const cwd = payload?.tool_input?.cwd ?? '';

if (!command) process.exit(0);

const isNpmPack = /\bnpm\s+pack\b/.test(command);
const hasPackDestination = /--pack-destination/.test(command);
const targetsTmp = /\.tmp/.test(command) || (typeof cwd === 'string' && /\.tmp/.test(cwd));

if (isNpmPack && !hasPackDestination && !targetsTmp) {
  const reason =
    'npm pack would write the tarball to the project root (process.cwd()). ' +
    'Use --pack-destination .tmp/pack/, or run from inside .tmp/.';
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason
      }
    }) + '\n'
  );
}

process.exit(0);
