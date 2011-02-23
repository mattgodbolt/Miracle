# Miracle: a JavaScript Sega Master System emulator.
# By Matt Godbolt <matt@godbolt.org>
# Based heavily on JSSpeccy which is Copyright (C) 2008 Matthew Westcott

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

# Contact details: Matt Godbolt <matt@godbolt.org>
# JSSpeccy contact details: Matthew Westcott <matthew@west.co.tt>

.PHONY: all
all: z80_ops_full.js z80_full.js z80_dis.js

z80_ops_full.js: z80_ops.jscpp z80_macros.jscpp opcodes_base.jscpp z80_cb.jscpp z80_ddfd.jscpp z80_ddfdcb.jscpp z80_ed.jscpp
	cpp -P z80_ops.jscpp z80_ops_full.js

z80_full.js: z80.jscpp z80_macros.jscpp opcodes_base.jscpp z80_cb.jscpp z80_ddfd.jscpp z80_ddfdcb.jscpp z80_ed.jscpp
	cpp -P z80.jscpp z80_full.js

z80_dis.js: z80_dis.jscpp opcodes_base_dis.jscpp z80_cb_dis.jscpp z80_ddfd_dis.jscpp z80_ddfdcb_dis.jscpp z80_ed_dis.jscpp
	cpp -P z80_dis.jscpp z80_dis.js

opcodes_base.jscpp: z80.pl opcodes_base.dat
	perl z80.pl opcodes_base.dat > opcodes_base.jscpp

opcodes_base_dis.jscpp: disass.py opcodes_base.dat
	python disass.py opcodes_base.dat > opcodes_base_dis.jscpp

z80_cb.jscpp: z80.pl opcodes_cb.dat
	perl z80.pl opcodes_cb.dat > z80_cb.jscpp

z80_cb_dis.jscpp: disass.py opcodes_cb.dat
	python disass.py opcodes_cb.dat > z80_cb_dis.jscpp

z80_ddfd.jscpp: z80.pl opcodes_ddfd.dat
	perl z80.pl opcodes_ddfd.dat > z80_ddfd.jscpp

z80_ddfd_dis.jscpp: disass.py opcodes_ddfd.dat
	python disass.py opcodes_ddfd.dat > z80_ddfd_dis.jscpp

z80_ddfdcb.jscpp: z80.pl opcodes_ddfd.dat
	perl z80.pl opcodes_ddfdcb.dat > z80_ddfdcb.jscpp

z80_ddfdcb_dis.jscpp: disass.py opcodes_ddfd.dat
	python disass.py opcodes_ddfdcb.dat > z80_ddfdcb_dis.jscpp

z80_ed.jscpp: z80.pl opcodes_ed.dat
	perl z80.pl opcodes_ed.dat > z80_ed.jscpp

z80_ed_dis.jscpp: disass.py opcodes_ed.dat
	python disass.py opcodes_ed.dat > z80_ed_dis.jscpp

.PHONY: clean
clean:
	rm -f z80_ops_full.js z80_full.js z80_dis.js
	rm -f opcodes_base.jscpp z80_cb.jscpp z80_ddfd.jscpp z80_ddfdcb.jscpp z80_ed.jscpp
	rm -f opcodes_base_dis.jscpp z80_cb_dis.jscpp z80_ddfd_dis.jscpp z80_ddfdcb_dis.jscpp z80_ed_dis.jscpp
