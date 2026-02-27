## Miracle — a JavaScript Sega Master System emulator

Miracle can be taken for a spin at https://miracle.xania.org/

### Building

Requires `make`, `perl`, `node`, and a C preprocessor (`cpp`).

Place any SMS ROM files in `public/roms/` as `romname.sms`, then:

```sh
make        # install npm deps, build z80 code, generate rom list, produce dist/
make dev    # same setup, then start the Vite dev server at http://localhost:5173/
make clean  # remove build artefacts (keeps node_modules)
make distclean  # full reset including node_modules
```

`make` handles `npm install` automatically via a sentinel file, so you don't need to run it by hand.

### Development

Running `make dev` starts the Vite dev server at http://localhost:5173/ with hot module reloading.

### Z80 emulation

Z80 emulation and tests are based on rev 1071 of http://svn.matt.west.co.tt/svn/jsspec/trunk
