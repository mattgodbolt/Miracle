#!/usr/bin/env node
// disass.mjs — Z80 disassembler code generator
//
// Reads a Z80 opcode definition file and writes JavaScript switch-case
// fragments to stdout, suitable for inclusion in the disassembler.
//
// Usage: node disass.mjs <opcodes-file.dat>
//
// Based on JSSpeccy by Matthew Westcott <matthew@west.co.tt>

import { readFileSync } from "fs";
import { argv, exit } from "process";

/**
 * Process a single line from a .dat opcode definition file and emit the
 * corresponding JavaScript disassembler fragment to stdout.
 *
 * The .dat format is:
 *   <hex>              — fallthrough case label (no opcode)
 *   <hex> shift <TAG>  — delegate to disassemble_<TAG>(address)
 *   <hex> <OPCODE> [args]  — full disassembler case
 *
 * In args, the following tokens are substituted:
 *   REGISTER, REGISTERH, REGISTERL  — JS runtime variable (IX/IY context)
 *   AF BC DE HL SP PC IX IY / A F B C D E H L — literal register names
 *   nnnn  — 16-bit immediate (reads 2 bytes)
 *   nn    — 8-bit immediate (reads 1 byte)
 *   offset — relative branch target (reads 1 signed byte)
 *   +dd   — indexed offset (reads 1 signed byte)
 */
function processLine(line) {
  // Strip comments and surrounding whitespace (mirrors Python's re.sub + strip)
  line = line.replace(/#.*/, "").trim();
  if (!line) return;

  // Split into at most 3 tokens: number, opcode, rest-of-args
  const firstSpace = line.indexOf(" ");

  if (firstSpace === -1) {
    // Bare number: fallthrough case label (e.g. multiple opcodes → same handler)
    console.log(`case ${line}:`);
    return;
  }

  const number = line.slice(0, firstSpace);
  const rest = line.slice(firstSpace + 1);
  const secondSpace = rest.indexOf(" ");
  const opcode = secondSpace === -1 ? rest : rest.slice(0, secondSpace);
  let args = secondSpace === -1 ? "" : rest.slice(secondSpace + 1);

  if (opcode === "shift") {
    console.log(`case ${number}: return disassemble_${args}(address);`);
    return;
  }

  console.log(`case ${number}: res="<span class=opcode>${opcode}</span>";`);

  // --- Argument substitutions ---

  // 1. Replace REGISTER/REGISTERH/REGISTERL with JS string-concatenation
  //    expressions (these are runtime variables set to "IX" or "IY").
  args = args.replace(
    /(REGISTER[HL]?)/g,
    '<span class=register>" + $1 + "</span>',
  );

  // 2. Replace literal register-pair and single-letter register names with
  //    styled spans.  Word-boundary assertions prevent false matches inside
  //    longer identifiers (applies to both multi-letter pairs and single letters).
  args = args.replace(
    /(\b(?:AF|BC|DE|HL|SP|PC|IX|IY|[AFBCDEHL])\b)/g,
    "<span class=register>$1</span>",
  );

  // --- Operand emission (mirrors Python's if/elif chain) ---

  if (args.includes("nnnn")) {
    const idx = args.indexOf("nnnn");
    const pre = args.slice(0, idx);
    const post = args.slice(idx + 4);
    console.log(
      `res += " ${pre}" + addressHtml((readbyte(address + 1) << 8) | readbyte(address)) + "${post}"; address += 2;`,
    );
  } else if (args.includes("nn")) {
    const idx = args.indexOf("nn");
    const pre = args.slice(0, idx);
    const post = args.slice(idx + 2);
    console.log(
      `res += " ${pre}0x" + hexbyte(readbyte(address)) + "${post}"; address += 1;`,
    );
  } else if (args.includes("offset")) {
    const idx = args.indexOf("offset");
    const pre = args.slice(0, idx);
    const post = args.slice(idx + 6);
    console.log(`var reladdr = address + 1 + sign_extend(readbyte(address));`);
    console.log(
      `res += " ${pre}" + addressHtml(reladdr) + "${post}"; address += 1;`,
    );
  } else if (args.includes("+dd")) {
    // '+dd' is an indexed displacement (signed byte).  The '+dd' check
    // must follow 'nn' so that 'LD (REGISTER+dd),nn' takes the nn branch.
    const idx = args.indexOf("+dd");
    const pre = args.slice(0, idx);
    const post = args.slice(idx + 3);
    console.log(`var offset = sign_extend(readbyte(address));`);
    console.log(`var sign = offset > 0 ? "+" : "-";`);
    console.log(
      `res += " ${pre}" + sign + "0x" + hexbyte(offset) + "${post}"; address += 1;`,
    );
  } else if (opcode === "RST") {
    // args is a hex value (e.g. "00", "8", "38"); no substitutions affect it.
    console.log(`res += " " + addressHtml(0x${args});`);
  } else if (args) {
    console.log(`res += " ${args}";`);
  }

  console.log("break;");
}

function processFile(filename) {
  const content = readFileSync(filename, "utf8");
  for (const line of content.split("\n")) {
    processLine(line);
  }
}

if (argv.length < 3) {
  console.error("Usage: node disass.mjs <opcodes-file.dat>");
  exit(1);
} else {
  processFile(argv[2]);
}
