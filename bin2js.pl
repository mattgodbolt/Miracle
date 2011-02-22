#!/usr/bin/perl -w

# bin2js.pl: Convert a directory of binary files to a Javascript hash of strings
# Copyright (C) 2008 Matthew Westcott

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

# Contact details: <matthew@west.co.tt>
# Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM

$dir = $ARGV[0];

print "var $dir = {};\n";
opendir(DIR, $dir) || die "can't opendir $dir: $!";
while ($file = readdir(DIR)) {
	next if $file =~ /^\./;
	open(FILE, "<$dir/$file") || die "can't open $file: $!";
	print "${dir}['$file'] = [\n";
	while (read(FILE, $str, 16*1024)) {
		print "  '";
		$str =~ s/([0-9\x00-\x1f\x7f-\xff\\\'\"])/ sprintf("\\%o", ord($1)) /egs;
		#$str =~ s/([^A-Za-z])/ sprintf("\\%o", ord($1)) /egs;
		print $str;
		print "',\n";
	}
	print "];\n";
	close(FILE);
};
#		STDOUT << "\\#{b.to_s(8)}"
closedir(DIR);
