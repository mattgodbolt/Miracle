#!/usr/bin/env node
// preprocess.mjs: minimal C preprocessor for z80 jscpp files
//
// Handles the subset of cpp features used in this project:
//   #include "file", #define (simple + function-like + multiline),
//   #undef, #ifndef, #ifdef, #endif
//
// Equivalent to: cpp -CC -P
//   -CC: preserve block comments and line comments in output
//   -P:  no linemarkers; blank lines outside block comments suppressed
//
// Unlike system cpp, this does NOT inject system headers.
// Key cpp rules implemented:
//   - Function-like macro: #define NAME(params) — NO whitespace before '('
//   - Object-like macro:   #define NAME value   — any whitespace before value
//   - Whitespace in macro bodies normalised to single space (cpp behaviour)
//   - Blank lines outside block comments are suppressed (cpp -P behaviour)
//   - Trailing whitespace stripped from output lines (cpp behaviour)

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { exit } from "process";
import { fileURLToPath } from "url";

if (process.argv.length < 3) {
  process.stderr.write(`Usage: ${process.argv[1]} <input.jscpp>\n`);
  exit(1);
}

// ---------------------------------------------------------------------------
// Global mutable state
// ---------------------------------------------------------------------------

/** @type {Map<string, {params: string[]|null, body: string}>} */
const macros = new Map();

/** Conditional-compilation stack; each entry = "should we be outputting?" */
const condStack = [true];
const outputting = () => condStack.every(Boolean);

/** Track whether we are currently inside a multi-line block comment. */
let inBlockComment = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse function-call arguments starting at text[openParen] (must be '(').
 * Handles nested parentheses.
 * Returns [args, endIndex] where endIndex is the index after the closing ')'.
 */
function extractArgs(text, openParen) {
  const args = [];
  let depth = 0;
  let i = openParen + 1;
  let current = "";

  while (i < text.length) {
    const c = text[i];
    if (c === "(") {
      depth++;
      current += c;
    } else if (c === ")") {
      if (depth === 0) {
        args.push(current);
        return [args, i + 1];
      }
      depth--;
      current += c;
    } else if (c === "," && depth === 0) {
      args.push(current);
      current = "";
    } else {
      current += c;
    }
    i++;
  }
  args.push(current); // unclosed paren — best effort
  return [args, i];
}

/**
 * Substitute macro parameters into a body string using word-boundary regex.
 * rawArgs are the original argument texts (used for stringification).
 * expandedArgs are the pre-expanded versions (used for normal substitution).
 */
function substituteParams(params, rawArgs, expandedArgs, body) {
  let result = body;
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    const raw = (rawArgs[i] ?? "").trim();
    const expanded = expandedArgs[i] ?? "";
    // Stringification: #param  →  "raw-argument"
    result = result.replace(
      new RegExp(`#${escapeRegex(param)}(?!\\w)`, "g"),
      `"${raw}"`,
    );
    // Normal parameter substitution
    result = result.replace(
      new RegExp(`\\b${escapeRegex(param)}\\b`, "g"),
      expanded,
    );
  }
  return result;
}

/**
 * Expand all macros in `text`.
 * This is used for macro bodies and for code segments (outside comments/strings).
 * It handles string literals and single-line block comments internally,
 * but does NOT update inBlockComment (multi-line tracking is done in processLine).
 *
 * depth: recursion guard against infinite macro expansion cycles.
 */
function expandText(text, depth = 0) {
  if (depth > 64) return text;

  let result = "";
  let i = 0;

  while (i < text.length) {
    // Inline block comment (both start and end on this segment)
    if (text[i] === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end === -1) {
        // No closing found — treat rest as comment (no expansion)
        result += text.slice(i);
        break;
      }
      result += text.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    // Line comment — rest of text is comment
    if (text[i] === "/" && text[i + 1] === "/") {
      result += text.slice(i);
      break;
    }

    // String literal — pass through unexpanded
    if (text[i] === '"' || text[i] === "'") {
      const q = text[i];
      let j = i + 1;
      while (j < text.length && text[j] !== q) {
        if (text[j] === "\\") j++;
        j++;
      }
      result += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    // Identifier — check for macro
    if (/[a-zA-Z_]/.test(text[i])) {
      let j = i;
      while (j < text.length && /\w/.test(text[j])) j++;
      const ident = text.slice(i, j);

      if (macros.has(ident)) {
        const mac = macros.get(ident);

        if (mac.params !== null) {
          // Function-like macro — requires '(' immediately (no whitespace)
          let k = j;
          while (k < text.length && (text[k] === " " || text[k] === "\t")) k++;
          if (k < text.length && text[k] === "(") {
            const [rawArgs, end] = extractArgs(text, k);
            const expandedArgs = rawArgs.map((a) =>
              expandText(a.trim(), depth + 1),
            );
            const body = substituteParams(
              mac.params,
              rawArgs,
              expandedArgs,
              mac.body,
            );
            result += expandText(body, depth + 1);
            i = end;
            continue;
          }
          // No '(' found — not a call, output identifier as-is
        } else {
          // Object-like macro
          result += expandText(mac.body, depth + 1);
          i = j;
          continue;
        }
      }

      result += ident;
      i = j;
      continue;
    }

    result += text[i];
    i++;
  }

  return result;
}

/**
 * Process a single source line (after line-continuation joining).
 * Handles multi-line block comment state via the module-level inBlockComment flag.
 * Returns the expanded output line (without trailing newline), or null to suppress.
 *
 * Suppression rules (matching cpp -P behaviour):
 *   - Blank lines outside block comments are suppressed entirely.
 *   - Trailing whitespace is stripped.
 */
function processLine(rawLine) {
  // ── Inside a multi-line block comment ─────────────────────────────────────
  if (inBlockComment) {
    const end = rawLine.indexOf("*/");
    if (end === -1) {
      // Whole line is inside a block comment — output as-is (no macro expansion)
      return rawLine;
    }
    // Block comment ends on this line
    inBlockComment = false;
    const commentPart = rawLine.slice(0, end + 2);
    const codePart = rawLine.slice(end + 2);
    const expanded = commentPart + expandText(codePart);
    return expanded.trimEnd();
  }

  // ── Normal (non-comment) line ──────────────────────────────────────────────
  // Check whether a block comment starts on this line without ending
  // (we need to update inBlockComment before calling expandText)
  let searchFrom = 0;
  let pos;
  // Scan for /* that doesn't close on the same line (outside strings/line comments)
  while ((pos = rawLine.indexOf("/*", searchFrom)) !== -1) {
    // Check for a preceding // that would make this a line comment
    const lineCommentPos = rawLine.indexOf("//", searchFrom);
    if (lineCommentPos !== -1 && lineCommentPos < pos) break; // in a line comment

    const closePos = rawLine.indexOf("*/", pos + 2);
    if (closePos === -1) {
      // Block comment starts here and doesn't close on this line
      inBlockComment = true;
      break;
    }
    // Block comment closes on the same line — keep scanning
    searchFrom = closePos + 2;
  }

  const expanded = expandText(rawLine).trimEnd();

  // Suppress blank lines outside block comments (cpp -P behaviour)
  if (expanded === "") return null;

  return expanded;
}

// ---------------------------------------------------------------------------
// Directive parsing
// ---------------------------------------------------------------------------

/**
 * Parse a #define directive from the text after the 'define' keyword.
 * KEY RULE: function-like macros have NO whitespace between name and '('.
 *           If there is whitespace, it's an object-like macro whose value
 *           starts with '('.
 */
function parseDefine(rest) {
  // Function-like: NAME(params...) body  — '(' immediately after name, no space
  const funcRe = /^(\w+)\(([^)]*)\)\s*([\s\S]*)$/;
  const funcMatch = funcRe.exec(rest);
  if (funcMatch) {
    const name = funcMatch[1];
    const rawParams = funcMatch[2];
    const params = rawParams.trim()
      ? rawParams.split(",").map((p) => p.trim())
      : []; // zero-arg: CALL() etc.
    // Normalise whitespace in body (cpp collapses whitespace in macro bodies)
    const body = funcMatch[3].replace(/[ \t]+/g, " ").trim();
    return { name, params, body };
  }

  // Object-like: NAME  [value]
  const simpleRe = /^(\w+)(?:\s+([\s\S]*))?$/;
  const simpleMatch = simpleRe.exec(rest);
  if (simpleMatch) {
    const name = simpleMatch[1];
    const raw = simpleMatch[2] ?? "";
    const body = raw.replace(/[ \t]+/g, " ").trim();
    return { name, params: null, body };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main recursive file processor
// ---------------------------------------------------------------------------

function processFile(filePath, emit, virtualFiles = new Map()) {
  const dir = dirname(filePath);
  const content = virtualFiles.has(filePath)
    ? virtualFiles.get(filePath)
    : readFileSync(filePath, "utf8");

  // ── Step 1: join backslash-continuation lines ─────────────────────────────
  const rawLines = content.split("\n");
  const logicalLines = [];
  let li = 0;
  while (li < rawLines.length) {
    let line = rawLines[li];
    if (line.endsWith("\r")) line = line.slice(0, -1); // strip \r

    while (line.endsWith("\\")) {
      line = line.slice(0, -1); // remove trailing backslash
      li++;
      if (li < rawLines.length) {
        let next = rawLines[li];
        if (next.endsWith("\r")) next = next.slice(0, -1);
        line += next;
      }
    }
    logicalLines.push(line);
    li++;
  }

  // ── Step 2: process each logical line ────────────────────────────────────
  for (const rawLine of logicalLines) {
    const trimmed = rawLine.trimStart();

    // ─── Preprocessor directive ───────────────────────────────────────────
    // Note: directives are only recognised when NOT inside a block comment.
    if (!inBlockComment && trimmed.startsWith("#")) {
      const after = trimmed.slice(1).trimStart();
      const spacePos = after.search(/\s/);
      const keyword = spacePos === -1 ? after : after.slice(0, spacePos);
      const rest = spacePos === -1 ? "" : after.slice(spacePos + 1);

      switch (keyword) {
        case "include": {
          if (!outputting()) break;
          const m = rest.match(/^"([^"]+)"/);
          if (m) processFile(resolve(dir, m[1]), emit, virtualFiles);
          break;
        }

        case "define": {
          if (!outputting()) break;
          const parsed = parseDefine(rest.trimStart());
          if (parsed)
            macros.set(parsed.name, {
              params: parsed.params,
              body: parsed.body,
            });
          break;
        }

        case "undef": {
          if (!outputting()) break;
          const name = rest.match(/^\w+/)?.[0];
          if (name) macros.delete(name);
          break;
        }

        case "ifndef": {
          const name = rest.match(/^\w+/)?.[0];
          condStack.push(outputting() && !(name && macros.has(name)));
          break;
        }

        case "ifdef": {
          const name = rest.match(/^\w+/)?.[0];
          condStack.push(outputting() && !!(name && macros.has(name)));
          break;
        }

        case "else": {
          if (condStack.length > 1) {
            const top = condStack.pop();
            condStack.push(!top && condStack.every(Boolean));
          }
          break;
        }

        case "endif": {
          if (condStack.length > 1) condStack.pop();
          break;
        }
        // Silently ignore: pragma, error, warning, etc.
      }
      // Directives produce no output
      continue;
    }

    // ─── Regular line: expand and emit ───────────────────────────────────
    if (outputting()) {
      const out = processLine(rawLine);
      if (out !== null) emit(out + "\n");
    }
  }
}

// ---------------------------------------------------------------------------
// Library export + CLI entry point
// ---------------------------------------------------------------------------

/**
 * Preprocess a .jscpp file and return the result as a string.
 * @param {string} inputFilePath  Absolute or relative path to the top-level .jscpp
 * @param {Map<string,string>} [virtualFiles]  In-memory file overrides: absolute
 *   path → content.  Used so that #include can resolve generated .jscpp files
 *   without them needing to exist on disk.
 */
export function preprocess(inputFilePath, virtualFiles = new Map()) {
  // Reset all module-level state so this function is safe to call multiple times.
  macros.clear();
  condStack.length = 0;
  condStack.push(true);
  inBlockComment = false;

  const chunks = [];
  processFile(
    resolve(inputFilePath),
    (chunk) => chunks.push(chunk),
    virtualFiles,
  );
  return chunks.join("");
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  if (process.argv.length < 3) {
    process.stderr.write(`Usage: ${process.argv[1]} <input.jscpp>\n`);
    exit(1);
  }
  const chunks = [];
  processFile(resolve(process.argv[2]), (chunk) => chunks.push(chunk));
  process.stdout.write(chunks.join(""));
}
