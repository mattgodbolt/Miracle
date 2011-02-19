var halfcarry_add_table = [ 0, 0x10, 0x10, 0x10, 0, 0, 0, 0x10 ];
var halfcarry_sub_table = [ 0, 0, 0x10, 0, 0x10, 0, 0x10, 0x10 ];
var overflow_add_table = [ 0, 0, 0, 0x04, 0x04, 0, 0, 0 ];
var overflow_sub_table = [ 0, 0x04, 0, 0, 0, 0, 0x04, 0 ];
var sz53_table = [];
var parity_table = [];
var sz53p_table = [];
var z80 = {
 a:0, f:0, b:0, c:0, d:0, e:0, h:0, l:0,
 a_:0, f_:0, b_:0, c_:0, d_:0, e_:0, h_:0, l_:0,
 ixh:0, ixl:0, iyh:0, iyl:0,
 i:0,
 r:0,
 r7:0,
 sp:0, pc:0,
 iff1:0, iff2:0, im:0, halted:false
};
function z80_init() {
  z80_init_tables();
}
function z80_init_tables() {
  var i,j,k;
  var parity;
  for(i=0;i<0x100;i++) {
    sz53_table[i]= i & ( 0x08 | 0x20 | 0x80 );
    j=i; parity=0;
    for(k=0;k<8;k++) { parity ^= j & 1; j >>=1; }
    parity_table[i]= ( parity ? 0 : 0x04 );
    sz53p_table[i] = sz53_table[i] | parity_table[i];
  }
  sz53_table[0] |= 0x40;
  sz53p_table[0] |= 0x40;
}
function z80_reset() {
  z80.a =z80.f =z80.b =z80.c =z80.d =z80.e =z80.h =z80.l =0;
  z80.a_ =z80.f_ =z80.b_ =z80.c_ =z80.d_ =z80.e_=z80.h_ =z80.l_=0;
  z80.ixh=z80.ixl=z80.iyh=z80.iyl=0;
  z80.i=z80.r=z80.r7=0;
  z80.sp=z80.pc=0;
  z80.iff1=z80.iff2=z80.im=0;
  z80.halted=0;
}
function z80_interrupt() {
  if( z80.iff1 ) {
    if( z80.halted ) { z80.pc++; z80.pc &= 0xffff; z80.halted = false; }
    z80.iff1=z80.iff2=0;
    z80.sp = (z80.sp - 1) & 0xffff;
    writebyte_internal( z80.sp, (z80.pc >> 8) );
    z80.sp = (z80.sp - 1) & 0xffff;
    writebyte_internal( z80.sp, (z80.pc & 0xff) );
    z80.r = (z80.r+1) & 0x7f;
    switch(z80.im) {
      case 0: z80.pc = 0x0038; tstates+=12; break;
      case 1: z80.pc = 0x0038; tstates+=13; break;
      case 2:
 {
   var inttemp=(0x100*z80.i)+0xff;
   var pcl = memory[inttemp++]; inttemp &= 0xfff; var pch = memory[inttemp];
   z80.pc = pcl | (pch << 8);
   tstates+=19;
   break;
 }
      default:
 ui_error( UI_ERROR_ERROR, "Unknown interrupt mode %d", z80.im );
 fuse_abort();
    }
  }
}
function z80_nmi() {
  z80.iff1 = 0;
  z80.sp = (z80.sp - 1) & 0xffff;
  writebyte_internal( z80.sp, (z80.pc >> 8) );
  z80.sp = (z80.sp - 1) & 0xffff;
  writebyte_internal( z80.sp, (z80.pc & 0xff) );
  tstates += 11; z80.pc = 0x0066;
}
