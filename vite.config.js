// vite.config.js — Miracle build configuration

import path from "path";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const z80Dir = path.join(__dirname, "src/z80");

// ---------------------------------------------------------------------------
// Opcode generation config
//
// Each entry maps a transform marker key to [datFile, register] where
// register is 'ix', 'iy', or null (for non-DDFD opcode sets).
// ---------------------------------------------------------------------------

const OPCODE_CONFIGS = [
  ["opcodes_base.dat", "opcodes_base.dat", null],
  ["opcodes_ed.dat", "opcodes_ed.dat", null],
  ["opcodes_cb.dat", "opcodes_cb.dat", null],
  ["opcodes_ddfd.dat ix", "opcodes_ddfd.dat", "ix"],
  ["opcodes_ddfd.dat iy", "opcodes_ddfd.dat", "iy"],
  ["opcodes_ddfdcb.dat", "opcodes_ddfdcb.dat", null],
];

// Disassembler: maps marker key to dat filename.
const DIS_CONFIGS = [
  ["opcodes_base.dat", "opcodes_base.dat"],
  ["opcodes_cb.dat", "opcodes_cb.dat"],
  ["opcodes_ed.dat", "opcodes_ed.dat"],
  ["opcodes_ddfd.dat", "opcodes_ddfd.dat"],
  ["opcodes_ddfdcb.dat", "opcodes_ddfdcb.dat"],
];

// Files to watch in dev mode.
const Z80_WATCH = [
  ...OPCODE_CONFIGS.map(([, dat]) => path.join(z80Dir, dat)),
  ...DIS_CONFIGS.map(([, dat]) => path.join(z80Dir, dat)),
  // Generator modules themselves are NOT listed — ESM cache means they
  // can't be hot-reloaded without a full process restart.
].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

// ---------------------------------------------------------------------------
// Lazy-load the generators (avoids import-time side effects)
// ---------------------------------------------------------------------------

let _generators = null;
async function getGenerators() {
  if (!_generators) {
    const [z80mod, dismod] = await Promise.all([
      import("./src/z80/z80.mjs"),
      import("./src/z80/disass.mjs"),
    ]);
    _generators = { z80gen: z80mod.generate, disgen: dismod.generate };
  }
  return _generators;
}

// ---------------------------------------------------------------------------
// Z80 code generation
// ---------------------------------------------------------------------------

// Generated snippets, keyed by marker text.  Populated in buildStart,
// consumed by the transform hook.
const generatedSnippets = new Map(); // opcode snippets
const generatedDisSnippets = new Map(); // disassembler snippets

async function generateZ80() {
  const { z80gen, disgen } = await getGenerators();

  // Opcode snippets: z80gen now returns pure JS directly.
  generatedSnippets.clear();
  for (const [markerKey, dat, register] of OPCODE_CONFIGS) {
    generatedSnippets.set(markerKey, z80gen(path.join(z80Dir, dat), register));
  }

  // Disassembler snippets: disgen returns pure JS switch cases.
  generatedDisSnippets.clear();
  for (const [markerKey, dat] of DIS_CONFIGS) {
    generatedDisSnippets.set(markerKey, disgen(path.join(z80Dir, dat)));
  }
}

function z80CodegenPlugin() {
  const z80OpsId = path.join(__dirname, "src/z80/z80_ops.js");
  const z80DisId = path.join(__dirname, "src/z80/z80_dis.js");

  return {
    name: "z80-codegen",

    async buildStart() {
      await generateZ80();
      for (const f of Z80_WATCH) this.addWatchFile(f);
    },

    async handleHotUpdate({ file, server }) {
      if (!Z80_WATCH.includes(file)) return;
      await generateZ80();
      // Invalidate both generated modules so Vite pushes HMR updates.
      const mods = [z80OpsId, z80DisId]
        .map((id) => server.moduleGraph.getModuleById(id))
        .filter(Boolean);
      for (const mod of mods) server.moduleGraph.invalidateModule(mod);
      return mods.length > 0 ? mods : undefined;
    },

    transform(code, id) {
      // Replace /* @z80-generate <key> */ markers in z80_ops.js.
      if (id === z80OpsId && generatedSnippets.size > 0) {
        let result = code;
        for (const [markerKey, snippet] of generatedSnippets) {
          const marker = `/* @z80-generate ${markerKey} */`;
          if (result.includes(marker)) result = result.replace(marker, snippet);
        }
        return result !== code ? { code: result, map: null } : null;
      }

      // Replace /* @z80-dis-generate <key> */ markers in z80_dis.js.
      if (id === z80DisId && generatedDisSnippets.size > 0) {
        let result = code;
        for (const [markerKey, snippet] of generatedDisSnippets) {
          const marker = `/* @z80-dis-generate ${markerKey} */`;
          if (result.includes(marker)) result = result.replace(marker, snippet);
        }
        return result !== code ? { code: result, map: null } : null;
      }

      return null;
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
