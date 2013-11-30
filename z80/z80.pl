#!/usr/bin/perl -w

# z80.pl: generate Javascript code for Z80 opcodes
# $Id$

# Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott

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

use strict;

sub GPL ($$) {

    my( $description, $copyright ) = @_;

    return << "CODE";
/* $description
   Copyright (c) $copyright

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
    
    Contact details: <matthew\@west.co.tt>
    Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM

*/
CODE

}

# The status of which flags relates to which condition

# These conditions involve !( F & FLAG_<whatever> )
my %not = map { $_ => 1 } qw( NC NZ P PO );

my %highreg = (
    REGISTER => 'REGISTERH',
    BC => 'B',
    DE => 'D',
    HL => 'H'
);

my %lowreg = (
    REGISTER => 'REGISTERL',
    BC => 'C',
    DE => 'E',
    HL => 'L'
);

# Use F & FLAG_<whatever>
my %flag = (

      C => 'C', NC => 'C',
     PE => 'P', PO => 'P',
      M => 'S',  P => 'S',
      Z => 'Z', NZ => 'Z',

);

# Generalised opcode routines

sub arithmetic_logical ($$$) {

    my( $opcode, $arg1, $arg2 ) = @_;

    unless( $arg2 ) { $arg2 = $arg1; $arg1 = 'A'; }

    if( length $arg1 == 1 ) {
    if( length $arg2 == 1 or $arg2 =~ /^REGISTER[HL]$/ ) {
        print "      $opcode($arg2);\n";
    } elsif( $arg2 eq '(REGISTER+dd)' ) {
        print << "CODE";
      tstates += 11;        /* FIXME: how is this contended? */
      {
    var bytetemp = 
        readbyte( (REGISTER + sign_extend(readbyte( PC++ ))) & 0xffff );
        PC &= 0xffff;
    $opcode(bytetemp);
      }
CODE
    } else {
        my $register = ( $arg2 eq '(HL)' ? 'HL' : 'PC' );
        my $increment = ( $register eq 'PC' ? '++' : '' );
        print << "CODE";
      tstates+=3;
      {
    var bytetemp = readbyte( ${register}R$increment );
    $opcode(bytetemp);
      }
CODE
    }
    } elsif( $opcode eq 'ADD' ) {
        my $arg1h; my $arg1l;
        if ($arg1 eq 'HL') {
            $arg1h = 'H'; $arg1l = 'L';
        } elsif ($arg1 eq 'REGISTER') {
            $arg1h = 'REGISTERH'; $arg1l = 'REGISTERL';
        } else {
            die "Unsupported argument to ADD16: $arg1\n";
        }
    print "      ${opcode}16(${arg1}R,${arg2}R,$arg1h,$arg1l);\n";
    } elsif( $arg1 eq 'HL' and length $arg2 == 2 ) {
    print "      tstates += 7;\n      ${opcode}16(${arg2}R);\n";
    }
}

sub call_jp ($$$) {

    my( $opcode, $condition, $offset ) = @_;

    print "      tstates+=6;\n";

    if( not defined $offset ) {
    print "      $opcode();\n";
    } else {
    if( defined $not{$condition} ) {
        print "      if( ! ( F & FLAG_$flag{$condition} ) ) { $opcode(); }\n";
    } else {
        print "      if( F & FLAG_$flag{$condition} ) { $opcode(); }\n";
    }
    print "      else PC+=2;\n";
    }
}

sub cpi_cpd ($) {

    my( $opcode ) = @_;

    my $modifier = ( $opcode eq 'CPI' ? '+' : '-' );

    print << "CODE";
      {
    var value = readbyte( HLR ), bytetemp = (A - value) & 0xff,
      lookup = ( (        A & 0x08 ) >> 3 ) |
               ( (  (value) & 0x08 ) >> 2 ) |
               ( ( bytetemp & 0x08 ) >> 1 );
    tstates+=8;
    var hltemp = (HLR $modifier 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;
    var bctemp = (BCR - 1) & 0xffff; B = bctemp >> 8; C = bctemp & 0xff;
    F = ( F & FLAG_C ) | ( BCR ? ( FLAG_V | FLAG_N ) : FLAG_N ) |
      halfcarry_sub_table[lookup] | ( bytetemp ? 0 : FLAG_Z ) |
      ( bytetemp & FLAG_S );
    if(F & FLAG_H) bytetemp--;
    F |= ( bytetemp & FLAG_3 ) | ( (bytetemp&0x02) ? FLAG_5 : 0 );
      }
CODE
}

sub cpir_cpdr ($) {

    my( $opcode ) = @_;

    my $modifier = ( $opcode eq 'CPIR' ? '+' : '-' );

    print << "CODE";
      {
    var value = readbyte( HLR ), bytetemp = (A - value) & 0xff,
      lookup = ( (        A & 0x08 ) >> 3 ) |
           ( (  (value) & 0x08 ) >> 2 ) |
           ( ( bytetemp & 0x08 ) >> 1 );
    tstates+=8;
    var hltemp = (HLR $modifier 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;
    var bctemp = (BCR - 1) & 0xffff; B = bctemp >> 8; C = bctemp & 0xff;
    F = ( F & FLAG_C ) | ( BCR ? ( FLAG_V | FLAG_N ) : FLAG_N ) |
      halfcarry_sub_table[lookup] | ( bytetemp ? 0 : FLAG_Z ) |
      ( bytetemp & FLAG_S );
    if(F & FLAG_H) bytetemp--;
    F |= ( bytetemp & FLAG_3 ) | ( (bytetemp&0x02) ? FLAG_5 : 0 );
    if( ( F & ( FLAG_V | FLAG_Z ) ) == FLAG_V ) {
      tstates+=5;
      PC-=2;
    }
      }
CODE
}

sub inc_dec ($$) {

    my( $opcode, $arg ) = @_;

    my $modifier = ( $opcode eq 'INC' ? '+' : '-' );

    if( length $arg == 1 or $arg =~ /^REGISTER[HL]$/ ) {
    print "      $opcode($arg);\n";
    } elsif( length $arg == 2 or $arg eq 'REGISTER' ) {
        if ($arg eq 'SP') {
  print << "CODE";
      tstates += 2;
      $arg = ($arg $modifier 1) & 0xffff;
CODE
        } else {
 print << "CODE";
      tstates += 2;
      var wordtemp = (${arg}R $modifier 1) & 0xffff;
      $highreg{$arg} = wordtemp >> 8;
      $lowreg{$arg} = wordtemp & 0xff;
CODE
        }
    } elsif( $arg eq '(HL)' ) {
    print << "CODE";
      tstates+=7;
      {
    var bytetemp = readbyte( HLR );
    $opcode(bytetemp);
    writebyte(HLR,bytetemp);
      }
CODE
    } elsif( $arg eq '(REGISTER+dd)' ) {
    print << "CODE";
      tstates += 15;        /* FIXME: how is this contended? */
      {
    var wordtemp =
        (REGISTER + sign_extend(readbyte( PC++ ))) & 0xffff;
    PC &= 0xffff;
    var bytetemp = readbyte( wordtemp );
    $opcode(bytetemp);
    writebyte(wordtemp,bytetemp);
      }
CODE
    }

}

sub ini_ind ($) {

    my( $opcode ) = @_;

    my $modifier = ( $opcode eq 'INI' ? '+' : '-' );

    print << "CODE";
      {
    var initemp = readport( BCR );
    tstates += 5; contend_io( BCR, 3 );
    writebyte(HLR,initemp);
    B = (B-1)&0xff;
    var hltemp = (HLR $modifier 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;
    F = (initemp & 0x80 ? FLAG_N : 0 ) | sz53_table[B];
    /* C,H and P/V flags not implemented */
      }
CODE
}

sub inir_indr ($) {

    my( $opcode ) = @_;

    my $modifier = ( $opcode eq 'INIR' ? '+' : '-' );

    print << "CODE";
      {
    var initemp=readport( BCR );
    tstates += 5; contend_io( BCR, 3 );
    writebyte(HLR,initemp);
    B = (B-1)&0xff;
    var hltemp = (HLR $modifier 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;
    F = (initemp & 0x80 ? FLAG_N : 0 ) | sz53_table[B];
    /* C,H and P/V flags not implemented */
    if(B) {
      tstates+=5;
      PC-=2;
    }
      }
CODE
}


sub ldi_ldd ($) {

    my( $opcode ) = @_;

    my $modifier = ( $opcode eq 'LDI' ? '+' : '-' );

    print << "CODE";
      {
    var bytetemp=readbyte( HLR );
    tstates+=8;
    var bctemp = (BCR - 1) & 0xffff; B = bctemp >> 8; C = bctemp & 0xff;
    writebyte(DER,bytetemp);
    var detemp = (DER $modifier 1) & 0xffff; D = detemp >> 8; E = detemp & 0xff;
    var hltemp = (HLR $modifier 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;
    
    bytetemp = (bytetemp + A) & 0xff;
    F = ( F & ( FLAG_C | FLAG_Z | FLAG_S ) ) | ( BCR ? FLAG_V : 0 ) |
      ( bytetemp & FLAG_3 ) | ( (bytetemp & 0x02) ? FLAG_5 : 0 );
      }
CODE
}

sub ldir_lddr ($) {

    my( $opcode ) = @_;

    my $modifier = ( $opcode eq 'LDIR' ? '+' : '-' );

    print << "CODE";
      {
    var bytetemp=readbyte( HLR );
    tstates+=8;
    writebyte(DER,bytetemp);
    var hltemp = (HLR $modifier 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;
    var detemp = (DER $modifier 1) & 0xffff; D = detemp >> 8; E = detemp & 0xff;
    var bctemp = (BCR - 1) & 0xffff; B = bctemp >> 8; C = bctemp & 0xff;
    bytetemp = (bytetemp + A) & 0xff;
    F = ( F & ( FLAG_C | FLAG_Z | FLAG_S ) ) | ( BCR ? FLAG_V : 0 ) |
      ( bytetemp & FLAG_3 ) | ( (bytetemp & 0x02) ? FLAG_5 : 0 );
    if(BCR) {
      tstates+=5;
      PC-=2;
    }
      }
CODE
}

sub otir_otdr ($) {

    my( $opcode ) = @_;

    my $modifier = ( $opcode eq 'OTIR' ? '+' : '-' );

    print << "CODE";
      {
    var outitemp=readbyte( HLR );
    tstates+=5;
    B = (B-1)&0xff;
    var hltemp = (HLR $modifier 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;
    /* This does happen first, despite what the specs say */
    writeport(BCR,outitemp);
    F = (outitemp & 0x80 ? FLAG_N : 0 ) | sz53_table[B];
    /* C,H and P/V flags not implemented */
    if(B) {
      contend_io( BCR, 1 );
      tstates+=7;
      PC-=2;
    } else {
      contend_io( BCR, 3 );
    }
      }
CODE
}

sub outi_outd ($) {

    my( $opcode ) = @_;

    my $modifier = ( $opcode eq 'OUTI' ? '+' : '-' );

    print << "CODE";
      {
    var outitemp=readbyte( HLR );
    B = (B-1)&0xff;    /* This does happen first, despite what the specs say */
    tstates+=5; contend_io( BCR, 3 );
    var hltemp = (HLR $modifier 1) & 0xffff; H = hltemp >> 8; L = hltemp & 0xff;
    writeport(BCR,outitemp);
    F = (outitemp & 0x80 ? FLAG_N : 0 ) | sz53_table[B];
    /* C,H and P/V flags not implemented */
      }
CODE
}

sub push_pop ($$) {

    my( $opcode, $regpair ) = @_;

    my( $high, $low );

    if( $regpair eq 'REGISTER' ) {
    ( $high, $low ) = ( 'REGISTERH', 'REGISTERL' );
    } else {
    ( $high, $low ) = ( $regpair =~ /^(.)(.)$/ );
    }

    print "      ${opcode}16($low,$high);\n";
}

sub res_set_hexmask ($$) {

    my( $opcode, $bit ) = @_;

    my $mask = 1 << $bit;
    $mask = 0xff - $mask if $opcode eq 'RES';

    sprintf '0x%02x', $mask;
}

sub res_set ($$$) {

    my( $opcode, $bit, $register ) = @_;

    my $operator = ( $opcode eq 'RES' ? '&' : '|' );

    my $hex_mask = res_set_hexmask( $opcode, $bit );

    if( length $register == 1 ) {
    print "      $register $operator= $hex_mask;\n";
    } elsif( $register eq '(HL)' ) {
    print << "CODE";
      tstates+=7;
      writebyte(HLR, readbyte(HLR) $operator $hex_mask);
CODE
    } elsif( $register eq '(REGISTER+dd)' ) {
    print << "CODE";
      tstates += 8;
      writebyte(tempaddr, readbyte(tempaddr) $operator $hex_mask);
CODE
    }
}

sub rotate_shift ($$) {

    my( $opcode, $register ) = @_;

    if( length $register == 1 ) {
    print "      $opcode($register);\n";
    } elsif( $register eq '(HL)' ) {
    print << "CODE";
      {
    var bytetemp = readbyte(HLR);
    tstates+=7;
    $opcode(bytetemp);
    writebyte(HLR,bytetemp);
      }
CODE
    } elsif( $register eq '(REGISTER+dd)' ) {
    print << "CODE";
      tstates += 8;
      {
    var bytetemp = readbyte(tempaddr);
    $opcode(bytetemp);
    writebyte(tempaddr,bytetemp);
      }
CODE
    }
}

# Individual opcode routines

sub opcode_ADC (@) { arithmetic_logical( 'ADC', $_[0], $_[1] ); }

sub opcode_ADD (@) { arithmetic_logical( 'ADD', $_[0], $_[1] ); }

sub opcode_AND (@) { arithmetic_logical( 'AND', $_[0], $_[1] ); }

sub opcode_BIT (@) {

    my( $bit, $register ) = @_;

    if( length $register == 1 ) {
    print "      BIT( $bit, $register );\n";
    } elsif( $register eq '(REGISTER+dd)' ) {
    print << "BIT";
      tstates += 5;
      {
    var bytetemp = readbyte( tempaddr );
    BIT_I( $bit, bytetemp, tempaddr );
      }
BIT
    } else {
    print << "BIT";
      {
    var bytetemp = readbyte( HLR );
    tstates+=4;
    BIT( $bit, bytetemp);
      }
BIT
    }
}

sub opcode_CALL (@) { call_jp( 'CALL', $_[0], $_[1] ); }

sub opcode_CCF (@) {
    print << "CCF";
      F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) |
    ( ( F & FLAG_C ) ? FLAG_H : FLAG_C ) | ( A & ( FLAG_3 | FLAG_5 ) );
CCF
}

sub opcode_CP (@) { arithmetic_logical( 'CP', $_[0], $_[1] ); }

sub opcode_CPD (@) { cpi_cpd( 'CPD' ); }

sub opcode_CPDR (@) { cpir_cpdr( 'CPDR' ); }

sub opcode_CPI (@) { cpi_cpd( 'CPI' ); }

sub opcode_CPIR (@) { cpir_cpdr( 'CPIR' ); }

sub opcode_CPL (@) {
    print << "CPL";
      A ^= 0xff;
      F = ( F & ( FLAG_C | FLAG_P | FLAG_Z | FLAG_S ) ) |
    ( A & ( FLAG_3 | FLAG_5 ) ) | ( FLAG_N | FLAG_H );
CPL
}

sub opcode_DAA (@) {
    print << "DAA";
      {
    var add = 0, carry = ( F & FLAG_C );
    if( ( F & FLAG_H ) || ( (A & 0x0f)>9 ) ) add=6;
    if( carry || (A > 0x99 ) ) add|=0x60;
    if( A > 0x99 ) carry=FLAG_C;
    if ( F & FLAG_N ) {
      SUB(add);
    } else {
      ADD(add);
    }
    F = ( F & ~( FLAG_C | FLAG_P) ) | carry | parity_table[A];
      }
DAA
}

sub opcode_DEC (@) { inc_dec( 'DEC', $_[0] ); }

sub opcode_DI (@) { print "      IFF1=IFF2=0;\n"; }

sub opcode_DJNZ (@) {
    print << "DJNZ";
      tstates+=4;
      B = (B-1) & 0xff;
      if(B) { JR(); }
      PC++;
      PC &= 0xffff;
DJNZ
}

sub opcode_EI (@) { print "      IFF1=IFF2=1;\n"; }

sub opcode_EX (@) {

    my( $arg1, $arg2 ) = @_;

    if( $arg1 eq 'AF' and $arg2 eq "AF'" ) {
    print << "EX";
      {
          var olda = A; var oldf = F;
          A = A_; F = F_;
          A_ = olda; F_ = oldf;
      }
EX
    } elsif( $arg1 eq '(SP)' and ( $arg2 eq 'HL' or $arg2 eq 'REGISTER' ) ) {

    my( $high, $low );

    if( $arg2 eq 'HL' ) {
        ( $high, $low ) = qw( H L );
    } else {
        ( $high, $low ) = qw( REGISTERH REGISTERL );
    }

    print << "EX";
      {
    var bytetempl = readbyte( SP     ),
                     bytetemph = readbyte( SP + 1 );
    tstates+=15;
    writebyte(SP+1,$high); writebyte(SP,$low);
    $low=bytetempl; $high=bytetemph;
      }
EX
    } elsif( $arg1 eq 'DE' and $arg2 eq 'HL' ) {
    print << "EX";
      {
    var bytetemp;
    bytetemp = D; D = H; H = bytetemp;
    bytetemp = E; E = L; L = bytetemp;
      }
EX
    }
}

sub opcode_EXX (@) {
    print << "EXX";
      {
    var bytetemp;
    bytetemp = B; B = B_; B_ = bytetemp;
    bytetemp = C; C = C_; C_ = bytetemp;
    bytetemp = D; D = D_; D_ = bytetemp;
    bytetemp = E; E = E_; E_ = bytetemp;
    bytetemp = H; H = H_; H_ = bytetemp;
    bytetemp = L; L = L_; L_ = bytetemp;
      }
EXX
}

sub opcode_HALT (@) { print "      z80.halted=1;\n      PC--;PC &= 0xffff;\n"; }

sub opcode_IM (@) {

    my( $mode ) = @_;

    print "      IM=$mode;\n";
}

sub opcode_IN (@) {

    my( $register, $port ) = @_;

    if( $register eq 'A' and $port eq '(nn)' ) {
    print << "IN";
      { 
    var intemp;
    tstates+=4;
    intemp = readbyte( PC++ ) + ( A << 8 );
    PC &= 0xffff;
    contend_io( intemp, 3 );
        A=readport( intemp );
      }
IN
    } elsif( $register eq 'F' and $port eq '(C)' ) {
    print << "IN";
      tstates += 1;
      {
    var bytetemp;
    IN(bytetemp,BCR);
      }
IN
    } elsif( length $register == 1 and $port eq '(C)' ) {
    print << "IN";
      tstates += 1;
      IN($register,BCR);
IN
    }
}

sub opcode_INC (@) { inc_dec( 'INC', $_[0] ); }

sub opcode_IND (@) { ini_ind( 'IND' ); }

sub opcode_INDR (@) { inir_indr( 'INDR' ); }

sub opcode_INI (@) { ini_ind( 'INI' ); }

sub opcode_INIR (@) { inir_indr( 'INIR' ); }

sub opcode_JP (@) {

    my( $condition, $offset ) = @_;

    if( $condition eq 'HL' or $condition eq 'REGISTER' ) {
        if ($condition eq 'HL') {$condition = 'HLR';}
    print "      PC=${condition};\t\t/* NB: NOT INDIRECT! */\n";
    return;
    } else {
    call_jp( 'JP', $condition, $offset );
    }
}

sub opcode_JR (@) {

    my( $condition, $offset ) = @_;

    if( not defined $offset ) { $offset = $condition; $condition = ''; }

    print "      tstates+=3;\n";

    if( !$condition ) {
    print "      JR();\n";
    } elsif( defined $not{$condition} ) {
    print "      if( ! ( F & FLAG_$flag{$condition} ) ) { JR(); }\n";
    } else {
    print "      if( F & FLAG_$flag{$condition} ) { JR(); }\n";
    }

    print "      PC++; PC &= 0xffff;\n";
}

sub opcode_LD (@) {

    my( $dest, $src ) = @_;

    if( length $dest == 1 or $dest =~ /^REGISTER[HL]$/ ) {

    if( length $src == 1 or $src =~ /^REGISTER[HL]$/ ) {

        if( $dest eq 'R' and $src eq 'A' ) {
        print << "LD";
      tstates += 1;
      /* Keep the RZX instruction counter right */
      /* rzx_instructions_offset += ( R - A ); */
      R=R7=A;
LD
            } elsif( $dest eq 'A' and $src eq 'R' ) {
        print << "LD";
      tstates += 1;
      A=(R&0x7f) | (R7&0x80);
      F = ( F & FLAG_C ) | sz53_table[A] | ( IFF2 ? FLAG_V : 0 );
LD
        } else {
        print "      tstates += 1;\n" if $src eq 'I' or $dest eq 'I';
        print "      $dest=$src;\n" if $dest ne $src;
        if( $dest eq 'A' and $src eq 'I' ) {
            print "      F = ( F & FLAG_C ) | sz53_table[A] | ( IFF2 ? FLAG_V : 0 );\n";
        }
        }
    } elsif( $src eq 'nn' ) {
        print "      tstates+=3;\n      $dest=readbyte(PC++); PC &= 0xffff;\n";
    } elsif( $src =~ /^\(..\)$/ ) {
        my $register = substr $src, 1, 2;
        print << "LD";
      tstates+=3;
      $dest=readbyte(${register}R);
LD
        } elsif( $src eq '(nnnn)' ) {
        print << "LD";
      {
    var wordtemp;
    tstates+=9;
    wordtemp = readbyte(PC++);
    PC &= 0xffff;
    wordtemp|= ( readbyte(PC++) << 8 );
    PC &= 0xffff;
    A=readbyte(wordtemp);
      }
LD
        } elsif( $src eq '(REGISTER+dd)' ) {
        print << "LD";
      tstates += 11;        /* FIXME: how is this contended? */
      $dest = readbyte( (REGISTER + sign_extend(readbyte( PC++ ))) & 0xffff );
      PC &= 0xffff;
LD
        }

    } elsif( length $dest == 2 or $dest eq 'REGISTER' ) {

    my( $high, $low );

    if( $dest eq 'SP' or $dest eq 'REGISTER' ) {
        ( $high, $low ) = ( "${dest}H", "${dest}L" );
    } else {
        ( $high, $low ) = ( $dest =~ /^(.)(.)$/ );
    }

    if( $src eq 'nnnn' ) {
      if( $dest eq 'SP') {
        print << "LD";
      tstates+=6;
      var splow = readbyte(PC++);
      PC &= 0xffff;
      var sphigh=readbyte(PC++);
      SP = splow | (sphigh << 8);
      PC &= 0xffff;
LD
      } else {
        print << "LD";
      tstates+=6;
      $low=readbyte(PC++);
      PC &= 0xffff;
      $high=readbyte(PC++);
      PC &= 0xffff;
LD
      }
        } elsif( $src eq 'HL') {
        print "      tstates += 2;\n      SP=${src}R;\n";
        } elsif( $src eq 'REGISTER' ) {
        print "      tstates += 2;\n      SP=$src;\n";
        } elsif( $src eq '(nnnn)' ) {
          if ( $dest eq 'SP') {
        print "      LD16_RRNNW($dest);\n";
          } else {
        print "      LD16_RRNN($low,$high);\n";
          }
    }

    } elsif( $dest =~ /^\(..\)$/ ) {

    my $register = substr $dest, 1, 2;

    if( length $src == 1 ) {
        print << "LD";
      tstates+=3;
      writebyte(${register}R,$src);
LD
    } elsif( $src eq 'nn' ) {
        print << "LD";
      tstates+=6;
      writebyte(${register}R,readbyte(PC++));
      PC &= 0xffff;
LD
        }

    } elsif( $dest eq '(nnnn)' ) {

    if( $src eq 'A' ) {
        print << "LD";
      tstates+=3;
      {
    var wordtemp = readbyte( PC++ );
    PC &= 0xffff;
    tstates+=6;
    wordtemp|=readbyte(PC++) << 8;
    PC &= 0xffff;
    writebyte(wordtemp,A);
      }
LD
        } elsif( $src =~ /^(.)(.)$/ or $src eq 'REGISTER' ) {

        my( $high, $low );

        if( $src eq 'SP') {
        ( $high, $low ) = ( "${src}HR", "${src}LR" );
        } elsif( $src eq 'REGISTER' ) {
        ( $high, $low ) = ( "${src}H", "${src}L" );
        } else {
        ( $high, $low ) = ( $1, $2 );
        }

        print "      LD16_NNRR($low,$high);\n";
    }
    } elsif( $dest eq '(REGISTER+dd)' ) {

    if( length $src == 1 ) {
    print << "LD";
      tstates += 11;        /* FIXME: how is this contended? */
      writebyte( (REGISTER + sign_extend(readbyte( PC++ ))) & 0xffff, $src );
      PC &= 0xffff;
LD
        } elsif( $src eq 'nn' ) {
        print << "LD";
      tstates += 11;        /* FIXME: how is this contended? */
      {
    var wordtemp =
        (REGISTER + sign_extend(readbyte( PC++ ))) & 0xffff;
    PC &= 0xffff;
    writebyte(wordtemp,readbyte(PC++));
    PC &= 0xffff;
      }
LD
        }
    }

}

sub opcode_LDD (@) { ldi_ldd( 'LDD' ); }

sub opcode_LDDR (@) { ldir_lddr( 'LDDR' ); }

sub opcode_LDI (@) { ldi_ldd( 'LDI' ); }

sub opcode_LDIR (@) { ldir_lddr( 'LDIR' ); }

sub opcode_NEG (@) {
    print << "NEG";
      {
    var bytetemp=A;
    A=0;
    SUB(bytetemp);
      }
NEG
}

sub opcode_NOP (@) { }

sub opcode_OR (@) { arithmetic_logical( 'OR', $_[0], $_[1] ); }

sub opcode_OTDR (@) { otir_otdr( 'OTDR' ); }

sub opcode_OTIR (@) { otir_otdr( 'OTIR' ); }

sub opcode_OUT (@) {

    my( $port, $register ) = @_;

    if( $port eq '(nn)' and $register eq 'A' ) {
    print << "OUT";
      { 
    var outtemp;
    tstates+=4;
    outtemp = readbyte( PC++ ) + ( A << 8 );
    PC &= 0xffff;
    OUT( outtemp , A );
      }
OUT
    } elsif( $port eq '(C)' and length $register == 1 ) {
    print << "OUT";
      tstates += 1;
      OUT(BCR,$register);
OUT
    }
}


sub opcode_OUTD (@) { outi_outd( 'OUTD' ); }

sub opcode_OUTI (@) { outi_outd( 'OUTI' ); }

sub opcode_POP (@) { push_pop( 'POP', $_[0] ); }

sub opcode_PUSH (@) {

    my( $regpair ) = @_;

    print "      tstates++;\n";
    push_pop( 'PUSH', $regpair );
}

sub opcode_RES (@) { res_set( 'RES', $_[0], $_[1] ); }

sub opcode_RET (@) {

    my( $condition ) = @_;

    if( not defined $condition ) {
    print "      RET();\n";
    } else {
    print "      tstates++;\n";

    if( defined $not{$condition} ) {
        print "      if( ! ( F & FLAG_$flag{$condition} ) ) { RET(); }\n";
    } else {
        print "      if( F & FLAG_$flag{$condition} ) { RET(); }\n";
    }
    }
}

sub opcode_RETN (@) { 

    print << "RETN";
      IFF1=IFF2;
      RET();
RETN
}

sub opcode_RL (@) { rotate_shift( 'RL', $_[0] ); }

sub opcode_RLC (@) { rotate_shift( 'RLC', $_[0] ); }

sub opcode_RLCA (@) {
    print << "RLCA";
      A = ( (A & 0x7f) << 1 ) | ( A >> 7 );
      F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) |
    ( A & ( FLAG_C | FLAG_3 | FLAG_5 ) );
RLCA
}

sub opcode_RLA (@) {
    print << "RLA";
      {
    var bytetemp = A;
    A = ( (A & 0x7f) << 1 ) | ( F & FLAG_C );
    F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) |
      ( A & ( FLAG_3 | FLAG_5 ) ) | ( bytetemp >> 7 );
      }
RLA
}

sub opcode_RLD (@) {
    print << "RLD";
      {
    var bytetemp = readbyte( HLR );
    tstates+=10;
    writebyte(HLR, ((bytetemp & 0x0f) << 4 ) | ( A & 0x0f ) );
    A = ( A & 0xf0 ) | ( bytetemp >> 4 );
    F = ( F & FLAG_C ) | sz53p_table[A];
      }
RLD
}

sub opcode_RR (@) { rotate_shift( 'RR', $_[0] ); }

sub opcode_RRA (@) {
    print << "RRA";
      {
    var bytetemp = A;
    A = ( A >> 1 ) | ( (F & 0x01) << 7 );
    F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) |
      ( A & ( FLAG_3 | FLAG_5 ) ) | ( bytetemp & FLAG_C ) ;
      }
RRA
}

sub opcode_RRC (@) { rotate_shift( 'RRC', $_[0] ); }

sub opcode_RRCA (@) {
    print << "RRCA";
      F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) | ( A & FLAG_C );
      A = ( A >> 1) | ( (A & 0x01) << 7 );
      F |= ( A & ( FLAG_3 | FLAG_5 ) );
RRCA
}

sub opcode_RRD (@) {
    print << "RRD";
      {
    var bytetemp = readbyte( HLR );
    tstates+=10;
    writebyte(HLR,  ( (A & 0x0f) << 4 ) | ( bytetemp >> 4 ) );
    A = ( A & 0xf0 ) | ( bytetemp & 0x0f );
    F = ( F & FLAG_C ) | sz53p_table[A];
      }
RRD
}

sub opcode_RST (@) {

    my( $value ) = @_;

    printf "      tstates++;\n      RST(0x%02x);\n", hex $value;
}

sub opcode_SBC (@) { arithmetic_logical( 'SBC', $_[0], $_[1] ); }

sub opcode_SCF (@) {
    print << "SCF";
      F = ( F & ( FLAG_P | FLAG_Z | FLAG_S ) ) |
        ( A & ( FLAG_3 | FLAG_5          ) ) |
        FLAG_C;
SCF
}

sub opcode_SET (@) { res_set( 'SET', $_[0], $_[1] ); }

sub opcode_SLA (@) { rotate_shift( 'SLA', $_[0] ); }

sub opcode_SLL (@) { rotate_shift( 'SLL', $_[0] ); }

sub opcode_SRA (@) { rotate_shift( 'SRA', $_[0] ); }

sub opcode_SRL (@) { rotate_shift( 'SRL', $_[0] ); }

sub opcode_SUB (@) { arithmetic_logical( 'SUB', $_[0], $_[1] ); }

sub opcode_XOR (@) { arithmetic_logical( 'XOR', $_[0], $_[1] ); }

# slttrap was previously defined by this line at the end of opcodes_ed.dat:
# 0xfb slttrap
sub opcode_slttrap ($) {
    print << "slttrap";
      if( settings_current.slt_traps ) {
    if( slt_length[A] ) {
      var base = HL;
      var *data = slt[A];
      size_t length = slt_length[A];
      while( length-- ) writebyte( base++, *data++ );
    }
      }
slttrap
}

sub opcode_shift (@) {

    my( $opcode ) = @_;

    my $lc_opcode = lc $opcode;

    if( $opcode eq 'DDFDCB' ) {

    print << "shift";
      /* FIXME: contention here is just a guess */
      {
    var opcode3;
    tstates+=7;
    tempaddr =
        REGISTER + sign_extend(readbyte_internal( PC++ ));
    PC &= 0xffff;
    opcode3 = readbyte_internal( PC++ );
    PC &= 0xffff;
    z80_ddfdcbxx(opcode3,tempaddr);
      }
shift
    } else {
    print << "shift";
      {
    var opcode2;
    tstates+=4;
    opcode2 = readbyte_internal( PC++ );
    PC &= 0xffff;
    R = (R+1) & 0x7f;
    z80_${lc_opcode}xx(opcode2);
      }
shift
    }
}

# Description of each file

my %description = (

    'opcodes_cb.dat'     => 'opcodes_cb.c: Z80 CBxx opcodes',
    'opcodes_ddfd.dat'   => 'opcodes_ddfd.c Z80 {DD,FD}xx opcodes',
    'opcodes_ddfdcb.dat' => 'opcodes_ddfdcb.c Z80 {DD,FD}CBxx opcodes',
    'opcodes_ed.dat'     => 'opcodes_ed.c: Z80 CBxx opcodes',
    'opcodes_base.dat'   => 'opcodes_base.c: unshifted Z80 opcodes',

);

# Main program

my $data_file = $ARGV[0];

print GPL( $description{ $data_file }, '1999-2008 Philip Kendall, Matthew Westcott' );

print << "COMMENT";

/* NB: this file is autogenerated by '$0' from '$data_file',
   and included in 'z80_ops.jscpp' */

COMMENT

while(<>) {

    # Remove comments
    s/#.*//;

    # Skip (now) blank lines
    next if /^\s*$/;

    chomp;

    my( $number, $opcode, $arguments, $extra ) = split;

    if( not defined $opcode ) {
    print "    ops[$number] = \n";
    next;
    }

    $arguments = '' if not defined $arguments;
    my @arguments = split ',', $arguments;

    print "    ops[$number] = function op_$number(tempaddr) {\t\t/* $opcode";

    print ' ', join ',', @arguments if @arguments;
    print " $extra" if defined $extra;

    print " */\n";

    # Handle the undocumented rotate-shift-or-bit and store-in-register
    # opcodes specially

    if( defined $extra ) {

    my( $register, $opcode ) = @arguments;

    if( $opcode eq 'RES' or $opcode eq 'SET' ) {

        my( $bit ) = split ',', $extra;

        my $operator = ( $opcode eq 'RES' ? '&' : '|' );
        my $hexmask = res_set_hexmask( $opcode, $bit );

        print << "CODE";
      tstates += 8;
      $register=readbyte(tempaddr) $operator $hexmask;
      writebyte(tempaddr, $register);
      };
CODE
    } else {

        print << "CODE";
      tstates += 8;
      $register=readbyte(tempaddr);
      $opcode($register);
      writebyte(tempaddr, $register);
      };
CODE
    }
    next;
    }

    {
        no strict qw( refs );

        if( exists &{ "opcode_$opcode" } ) {
            "opcode_$opcode"->( @arguments );
        }
    }
    print "    };\n";
}

if( $data_file eq 'opcodes_ddfd.dat' ) {

    print << "CODE";
    ops[256] = function z80_ddfd_default() {        /* Instruction did not involve H or L, so backtrack
               one instruction and parse again */
      PC--;        /* FIXME: will be contended again */
      PC &= 0xffff;
      R--;        /* Decrement the R register as well */
      R &= 0x7f;
    }
CODE

} else {
    print << "NOPD";
    ops[256] = function() {};        /* All other opcodes are NOPD */
NOPD
}
