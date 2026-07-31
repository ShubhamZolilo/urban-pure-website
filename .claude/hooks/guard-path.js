#!/usr/bin/env node
// PreToolUse guard: hard-block any tool call that reaches outside PROJECT_ROOT.
// Reads the hook payload as JSON on stdin, writes a deny decision on stdout.
// Exiting silently (no stdout) means "no opinion" — the normal permission flow runs.

const path = require('path');

const PROJECT_ROOT = 'e:\\ZOLILO\\urban pure';
const ROOT = path.resolve(PROJECT_ROOT).toLowerCase();

// Narrow, explicit exceptions: read-only executables that have to be invoked by
// absolute path because that is where Windows installs them. Everything else
// outside PROJECT_ROOT stays blocked. Only exact full-path matches pass — this is
// not a prefix rule, so nothing else under Program Files is reachable.
const ALLOWED_BINARIES = new Set(
  ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].map((p) =>
    path.resolve(p).toLowerCase()
  )
);

function isAllowedBinary(candidate) {
  return ALLOWED_BINARIES.has(path.resolve(toWindowsPath(candidate)).toLowerCase());
}

// Windows-absolute (E:\x, E:/x) or POSIX/UNC-absolute (/x, //x).
const ABSOLUTE = /^([a-zA-Z]:[\\/]|[\\/])/;
// Git Bash / MSYS drive form: /e/ZOLILO/... -> e:/ZOLILO/...
const MSYS_DRIVE = /^\/([a-zA-Z])(\/|$)/;
// A ".." segment anywhere in the token — the only way a relative path escapes.
const DOTDOT_SEGMENT = /(^|[\\/])\.\.([\\/]|$)/;

function toWindowsPath(token) {
  const msys = token.match(MSYS_DRIVE);
  if (msys) return msys[1] + ':' + token.slice(2);
  return token;
}

function isInsideRoot(candidate) {
  const abs = path.resolve(PROJECT_ROOT, toWindowsPath(candidate)).toLowerCase();
  return abs === ROOT || abs.startsWith(ROOT + path.sep);
}

// Pull out anything from a shell command that could be a filesystem path:
// quoted strings first (they may contain spaces), then bare whitespace-split words.
function extractShellTokens(command) {
  const tokens = [];
  const quoted = /"([^"]*)"|'([^']*)'/g;
  let match;
  while ((match = quoted.exec(command)) !== null) {
    tokens.push(match[1] !== undefined ? match[1] : match[2]);
  }
  const unquoted = command.replace(quoted, ' ');
  for (const word of unquoted.split(/[\s;|&()<>,]+/)) tokens.push(word);
  return tokens.filter(Boolean);
}

// Only judge tokens that actually assert a location. Bare words like "-la" or
// "index.html" resolve under the project root and are none of our business.
function looksLikePath(token) {
  return ABSOLUTE.test(token) || DOTDOT_SEGMENT.test(token);
}

function deny(candidate) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `Blocked: "${candidate}" resolves outside ${PROJECT_ROOT}. ` +
          `This session is locked to that folder and nothing else — including temp ` +
          `directories and the parent folder. Lift the restriction in ` +
          `.claude/settings.json if this is intended.`,
      },
    })
  );
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  raw += chunk;
});
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return; // Malformed payload: stay out of the way rather than blocking every tool.
  }

  const input = payload.tool_input || {};
  const candidates = [];

  // File tools: Read, Write, Edit, NotebookEdit, Glob, Grep.
  for (const field of [input.file_path, input.notebook_path, input.path]) {
    if (typeof field === 'string' && field) candidates.push(field);
  }
  // Glob/Grep patterns are usually relative, but an absolute one is a real escape.
  if (typeof input.pattern === 'string' && ABSOLUTE.test(input.pattern)) {
    candidates.push(input.pattern);
  }

  // Shell tools: Bash, PowerShell.
  if (typeof input.command === 'string' && input.command) {
    for (const token of extractShellTokens(input.command)) {
      if (looksLikePath(token)) candidates.push(token);
    }
  }

  for (const candidate of candidates) {
    if (isAllowedBinary(candidate)) continue;
    if (!isInsideRoot(candidate)) {
      deny(candidate);
      return;
    }
  }
});
