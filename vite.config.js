// vite.config.js — Miracle build configuration
//
// Two plugins handle the code-generation steps that were previously driven by
// the Makefile.  Both run during Vite's buildStart hook (which fires for
// `vite build`, `vite dev`, and `vitest`), so no pre-step is required.

import path from "path";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const z80Dir = path.join(__dirname, "src/z80");

// ---------------------------------------------------------------------------
// Mapping: dat file → generated jscpp filenames
// ---------------------------------------------------------------------------

// z80.mjs (opcode logic generator)
const Z80_OUTPUTS = [
  ["opcodes_base.dat", "opcodes_base.jscpp"],
  ["opcodes_cb.dat", "z80_cb.jscpp"],
  ["opcodes_ddfd.dat", "z80_ddfd.jscpp"],
  ["opcodes_ddfdcb.dat", "z80_ddfdcb.jscpp"],
  ["opcodes_ed.dat", "z80_ed.jscpp"],
];

// disass.mjs (disassembler generator)
const DIS_OUTPUTS = [
  ["opcodes_base.dat", "opcodes_base_dis.jscpp"],
  ["opcodes_cb.dat", "z80_cb_dis.jscpp"],
  ["opcodes_ddfd.dat", "z80_ddfd_dis.jscpp"],
  ["opcodes_ddfdcb.dat", "z80_ddfdcb_dis.jscpp"],
  ["opcodes_ed.dat", "z80_ed_dis.jscpp"],
];

// preprocess.mjs: template → output JS file
// z80.jscpp / z80_full.js removed: replaced by src/z80/z80.js (Phase 2).
const TEMPLATES = [
  ["z80_ops.jscpp", "z80_ops_full.js"],
  ["z80_dis.jscpp", "z80_dis.js"],
];

// Files to watch in dev mode (any change triggers full regeneration).
// Note: the generator modules themselves (*.mjs) are NOT listed here — Node's
// ESM cache means they can't be hot-reloaded without a process restart. If you
// edit z80.mjs, disass.mjs, or preprocess.mjs, restart the dev server.
// z80.jscpp and z80_macros.jscpp removed from watch: replaced by src/z80/z80.js.
const Z80_WATCH = [
  ...Z80_OUTPUTS.map(([dat]) => path.join(z80Dir, dat)),
  "z80_ops.jscpp",
  "z80_dis.jscpp",
  "z80_macros.jscpp",
].map((f) => (path.isAbsolute(f) ? f : path.join(z80Dir, f)));

// ---------------------------------------------------------------------------
// Lazy-load the generators (avoids import-time side effects)
// ---------------------------------------------------------------------------

let _generators = null;
async function getGenerators() {
  if (!_generators) {
    const [z80mod, dismod, premod] = await Promise.all([
      import("./src/z80/z80.mjs"),
      import("./src/z80/disass.mjs"),
      import("./src/z80/preprocess.mjs"),
    ]);
    _generators = {
      z80gen: z80mod.generate,
      disgen: dismod.generate,
      preprocess: premod.preprocess,
    };
  }
  return _generators;
}

// ---------------------------------------------------------------------------
// Plugin 1: Z80 code generation
// ---------------------------------------------------------------------------

async function generateZ80() {
  const { z80gen, disgen, preprocess } = await getGenerators();

  // Stage 1: run generators into a virtualFiles map (no disk writes for intermediates)
  const virtualFiles = new Map();
  for (const [dat, out] of Z80_OUTPUTS) {
    virtualFiles.set(path.join(z80Dir, out), z80gen(path.join(z80Dir, dat)));
  }
  for (const [dat, out] of DIS_OUTPUTS) {
    virtualFiles.set(path.join(z80Dir, out), disgen(path.join(z80Dir, dat)));
  }

  // Stage 2: preprocess templates → write final JS files
  for (const [tmpl, out] of TEMPLATES) {
    writeFileSync(
      path.join(z80Dir, out),
      preprocess(path.join(z80Dir, tmpl), virtualFiles),
    );
  }
}

function z80CodegenPlugin() {
  return {
    name: "z80-codegen",
    async buildStart() {
      await generateZ80();
      for (const f of Z80_WATCH) this.addWatchFile(f);
    },
    async handleHotUpdate({ file }) {
      if (Z80_WATCH.includes(file)) {
        await generateZ80();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Plugin 2: ROM list generation
// ---------------------------------------------------------------------------

function generateRoms() {
  const romsDir = path.join(__dirname, "public/roms");
  const roms = existsSync(romsDir)
    ? readdirSync(romsDir)
        .filter((f) => !f.startsWith("."))
        .sort()
    : [];
  const content =
    `export const RomList = [\n` +
    roms.map((r) => `  ${JSON.stringify(r)},\n`).join("") +
    `];\n`;
  writeFileSync(path.join(__dirname, "src/roms.js"), content);
}

function romsPlugin() {
  const romsDir = path.join(__dirname, "public/roms");
  return {
    name: "roms-codegen",
    buildStart() {
      mkdirSync(romsDir, { recursive: true });
      generateRoms();
      this.addWatchFile(romsDir);
    },
    handleHotUpdate({ file }) {
      if (file.startsWith(romsDir)) generateRoms();
    },
  };
}

// ---------------------------------------------------------------------------
// Vite config
// ---------------------------------------------------------------------------

export default {
  plugins: [z80CodegenPlugin(), romsPlugin()],
};
