// vite.config.js — Miracle build configuration

import path from "path";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const z80Dir = path.join(__dirname, "src/z80");

// ---------------------------------------------------------------------------
// Mapping: dat file → generated intermediate jscpp filenames
// ---------------------------------------------------------------------------

const Z80_OUTPUTS = [
  ["opcodes_base.dat", "opcodes_base.jscpp"],
  ["opcodes_cb.dat", "z80_cb.jscpp"],
  ["opcodes_ddfd.dat", "z80_ddfd.jscpp"],
  ["opcodes_ddfdcb.dat", "z80_ddfdcb.jscpp"],
  ["opcodes_ed.dat", "z80_ed.jscpp"],
];

const DIS_OUTPUTS = [
  ["opcodes_base.dat", "opcodes_base_dis.jscpp"],
  ["opcodes_cb.dat", "z80_cb_dis.jscpp"],
  ["opcodes_ddfd.dat", "z80_ddfd_dis.jscpp"],
  ["opcodes_ddfdcb.dat", "z80_ddfdcb_dis.jscpp"],
  ["opcodes_ed.dat", "z80_ed_dis.jscpp"],
];

// Templates still preprocessed to disk (disassembler only — z80_ops.js is
// handled inline via the transform hook).
const TEMPLATES = [["z80_dis.jscpp", "z80_dis.js"]];

// ---------------------------------------------------------------------------
// Opcode snippets: the expanded bodies for each /* @z80-generate */ marker.
//
// Each entry is [markerKey, wrapperContent].
// markerKey matches the text inside the @z80-generate comment in z80_ops.js.
// wrapperContent is a jscpp snippet that includes z80_macros.jscpp and the
// generated intermediate, with any needed REGISTER substitution macros.
// ---------------------------------------------------------------------------

const OPCODE_SNIPPETS = [
  [
    "opcodes_base.dat",
    `#include "z80_macros.jscpp"\n#include "opcodes_base.jscpp"\n`,
  ],
  ["opcodes_ed.dat", `#include "z80_macros.jscpp"\n#include "z80_ed.jscpp"\n`],
  ["opcodes_cb.dat", `#include "z80_macros.jscpp"\n#include "z80_cb.jscpp"\n`],
  [
    "opcodes_ddfd.dat ix",
    `#include "z80_macros.jscpp"\n#define REGISTER IX\n#define REGISTERR IX\n#define REGISTERH IXH\n#define REGISTERL IXL\n#include "z80_ddfd.jscpp"\n`,
  ],
  [
    "opcodes_ddfd.dat iy",
    `#include "z80_macros.jscpp"\n#define REGISTER IY\n#define REGISTERR IY\n#define REGISTERH IYH\n#define REGISTERL IYL\n#include "z80_ddfd.jscpp"\n`,
  ],
  [
    "opcodes_ddfdcb.dat",
    `#include "z80_macros.jscpp"\n#include "z80_ddfdcb.jscpp"\n`,
  ],
];

// Files to watch in dev mode (any change triggers full regeneration).
// Note: the generator modules themselves (*.mjs) are NOT listed here — Node's
// ESM cache means they can't be hot-reloaded without a process restart.
const Z80_WATCH = [
  ...Z80_OUTPUTS.map(([dat]) => path.join(z80Dir, dat)),
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
// Z80 code generation
// ---------------------------------------------------------------------------

// Expanded opcode table bodies, keyed by marker text (e.g. "opcodes_base.dat").
// Populated in buildStart, consumed by the transform hook.
const generatedSnippets = new Map();

async function generateZ80() {
  const { z80gen, disgen, preprocess } = await getGenerators();

  // Stage 1: intermediate .jscpp files into a virtualFiles map (no disk writes)
  const virtualFiles = new Map();
  for (const [dat, out] of Z80_OUTPUTS) {
    virtualFiles.set(path.join(z80Dir, out), z80gen(path.join(z80Dir, dat)));
  }
  for (const [dat, out] of DIS_OUTPUTS) {
    virtualFiles.set(path.join(z80Dir, out), disgen(path.join(z80Dir, dat)));
  }

  // Stage 2a: expand each opcode snippet for the transform hook
  generatedSnippets.clear();
  for (const [markerKey, wrapperContent] of OPCODE_SNIPPETS) {
    const virtualPath = path.join(
      z80Dir,
      `__snippet_${markerKey.replace(/\W/g, "_")}.jscpp`,
    );
    virtualFiles.set(virtualPath, wrapperContent);
    generatedSnippets.set(markerKey, preprocess(virtualPath, virtualFiles));
  }

  // Stage 2b: preprocess remaining templates → write to disk
  for (const [tmpl, out] of TEMPLATES) {
    writeFileSync(
      path.join(z80Dir, out),
      preprocess(path.join(z80Dir, tmpl), virtualFiles),
    );
  }
}

function z80CodegenPlugin() {
  const z80OpsId = path.join(__dirname, "src/z80/z80_ops.js");

  return {
    name: "z80-codegen",

    async buildStart() {
      await generateZ80();
      for (const f of Z80_WATCH) this.addWatchFile(f);
    },

    async handleHotUpdate({ file, server }) {
      if (Z80_WATCH.includes(file)) {
        await generateZ80();
        // Invalidate z80_ops.js so the transform re-runs
        const mod = server.moduleGraph.getModuleById(z80OpsId);
        if (mod) server.moduleGraph.invalidateModule(mod);
      }
    },

    transform(code, id) {
      if (id !== z80OpsId) return null;
      if (generatedSnippets.size === 0) return null; // not yet generated

      let result = code;
      for (const [markerKey, snippet] of generatedSnippets) {
        const marker = `/* @z80-generate ${markerKey} */`;
        if (result.includes(marker)) {
          result = result.replace(marker, snippet);
        }
      }
      return result === code ? null : { code: result, map: null };
    },
  };
}

// ---------------------------------------------------------------------------
// ROM list generation
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
