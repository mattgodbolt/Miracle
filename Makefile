# Miracle: a JavaScript Sega Master System emulator.
#
# Run 'make' to build everything from scratch.
# Run 'make dev' to start the development server.
#
# All generated files are listed in .gitignore and src/z80/.gitignore.

.PHONY: all dist dev preview clean distclean

##
## Primary targets
##

# Default: full production build.
all: dist/index.html

# Alias used by the deploy workflow (and consistent with other projects).
dist: all

# Start the Vite dev server (installs deps and builds the z80/roms prereqs first).
dev: node_modules/.package-lock.json src/roms.js \
		src/z80/z80_full.js src/z80/z80_dis.js
	npx vite

# Serve the production build for final checks.
preview: dist/index.html
	npx vite preview

# Remove build artefacts; keeps node_modules.
clean:
	$(MAKE) -C src/z80 clean
	rm -f src/roms.js
	rm -rf dist/

# Full reset including node_modules.
distclean: clean
	rm -rf node_modules/

##
## Internal rules
##

# npm install — .package-lock.json is the sentinel npm creates on each install.
node_modules/.package-lock.json: package-lock.json
	npm install
	@touch $@   # ensure timestamp is always updated, even when npm is a no-op

# ROM list module — regenerated whenever the contents of public/roms/ change.
ROMS := $(sort $(wildcard public/roms/*))
src/roms.js: $(ROMS) Makefile
	@mkdir -p public/roms
	@{ \
		printf 'export const RomList = [\n'; \
		for rom in $(ROMS); do printf '  "%s",\n' "$$(basename $$rom)"; done; \
		printf '];\n'; \
	} > $@

# Z80 code generation is delegated to src/z80/Makefile which tracks its own fine-
# grained deps.  FORCE: causes the recipe to always run, but the actual file
# timestamps (unchanged if sources are already up to date) control whether the
# production build is re-triggered.
FORCE:
src/z80/z80_full.js src/z80/z80_ops_full.js src/z80/z80_dis.js: FORCE
	$(MAKE) -C src/z80

# Production build — depends on all source inputs.
SRC_JS := $(filter-out src/roms.js src/z80/z80_full.js src/z80/z80_ops_full.js \
	src/z80/z80_dis.js, $(wildcard src/*.js src/*/*.js))
dist/index.html: node_modules/.package-lock.json src/roms.js \
		src/z80/z80_full.js src/z80/z80_dis.js \
		$(SRC_JS) index.html
	npm run build
