## Miracle — a JavaScript Sega Master System emulator

Miracle can be taken for a spin at https://miracle.xania.org/

### Building

Requires `node` (v18+). No other tools needed — Z80 code generation and
ROM list assembly happen automatically as part of the Vite build.

Place any SMS ROM files in `public/roms/` as `romname.sms`, then:

```sh
npm install      # install dependencies (once)
npm run build    # produce dist/
npm run dev      # start the Vite dev server at http://localhost:5173/
npm run preview  # serve the production build locally
npm test         # run the FUSE Z80 CPU test suite
```

The dev server watches all source files — including the Z80 opcode `.dat`
definitions and `.jscpp` templates — and rebuilds automatically on change.

### Z80 emulation

Z80 emulation and tests are based on rev 1071 of http://svn.matt.west.co.tt/svn/jsspec/trunk

FUSE Z80 CPU tests: 1329/1356 passing. The 27 skipped tests cover undocumented
behaviour (MEMPTR flags, block I/O edge cases) not relevant for SMS emulation.
