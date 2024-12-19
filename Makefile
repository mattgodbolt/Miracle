# Miracle, a JS SMS emulator.

# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

# Z80 Support borrowed from JSSpeccy, details:
# Contact details: <matthew@west.co.tt>
# Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM

.PHONY: all z80 clean dist
all: z80 src/roms.js
dist: all
	npm run build

ROMS := $(shell find public/roms -type f | sort)

src/roms.js: $(ROMS) Makefile
	echo 'export const RomList = [' > src/roms.js
	for rom in $(ROMS); do echo \"$$rom\", | sed 's|public/roms/||g' >> src/roms.js; done
	echo '];' >> src/roms.js

z80:
	$(MAKE) -C src/z80

clean:
	$(MAKE) -C src/z80 clean
	rm -f src/roms.js
