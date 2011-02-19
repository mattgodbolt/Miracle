function sign_extend(v) {
  return v < 128 ? v : v-256;
}
function z80_do_opcodes()
{
  while(tstates < event_next_event ) {
    var opcode;
    tstates += (4);; z80.r = (z80.r+1) & 0x7f;
    opcode = memory[z80.pc++]; z80.pc &= 0xffff;
    switch(opcode) {
    case 0x00:
      break;
    case 0x01:
      tstates += (3);;
      z80.c=memory[z80.pc++];
      z80.pc &= 0xffff;
      tstates += (3);;
      z80.b=memory[z80.pc++];
      z80.pc &= 0xffff;
      break;
    case 0x02:
      tstates += (3);;
      writebyte_internal((z80.c | (z80.b << 8)),z80.a);
      break;
    case 0x03:
      tstates += 2;
      var wordtemp = ((z80.c | (z80.b << 8)) + 1) & 0xffff;
      z80.b = wordtemp >> 8;
      z80.c = wordtemp & 0xff;
      break;
    case 0x04:
      { (z80.b) = ((z80.b) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.b)==0x80 ? 0x04 : 0 ) | ( (z80.b)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.b)];};
      break;
    case 0x05:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.b)&0x0f ? 0 : 0x10 ) | 0x02; (z80.b) = ((z80.b) - 1) & 0xff; z80.f |= ( (z80.b)==0x7f ? 0x04 : 0 ) | sz53_table[z80.b];};
      break;
    case 0x06:
      tstates += (3);;
      z80.b=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x07:
      z80.a = ( (z80.a & 0x7f) << 1 ) | ( z80.a >> 7 );
      z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) |
 ( z80.a & ( 0x01 | 0x08 | 0x20 ) );
      break;
    case 0x08:
      if( z80.pc == 0x04d1 || z80.pc == 0x0077 ) {
 if( tape_save_trap() == 0 ) break;
      }
      {
       var olda = z80.a; var oldf = z80.f;
       z80.a = z80.a_; z80.f = z80.f_;
       z80.a_ = olda; z80.f_ = oldf;
      }
      break;
    case 0x09:
      { var add16temp = ((z80.l | (z80.h << 8))) + ((z80.c | (z80.b << 8))); var lookup = ( ( ((z80.l | (z80.h << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.c | (z80.b << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.h) = (add16temp >> 8) & 0xff; (z80.l) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x0a:
      tstates += (3);;
      z80.a=memory[(z80.c | (z80.b << 8))];
      break;
    case 0x0b:
      tstates += 2;
      var wordtemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff;
      z80.b = wordtemp >> 8;
      z80.c = wordtemp & 0xff;
      break;
    case 0x0c:
      { (z80.c) = ((z80.c) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.c)==0x80 ? 0x04 : 0 ) | ( (z80.c)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.c)];};
      break;
    case 0x0d:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.c)&0x0f ? 0 : 0x10 ) | 0x02; (z80.c) = ((z80.c) - 1) & 0xff; z80.f |= ( (z80.c)==0x7f ? 0x04 : 0 ) | sz53_table[z80.c];};
      break;
    case 0x0e:
      tstates += (3);;
      z80.c=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x0f:
      z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( z80.a & 0x01 );
      z80.a = ( z80.a >> 1) | ( (z80.a & 0x01) << 7 );
      z80.f |= ( z80.a & ( 0x08 | 0x20 ) );
      break;
    case 0x10:
      tstates++; tstates += (3);;
      z80.b = (z80.b-1) & 0xff;
      if(z80.b) { { tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; z80.pc += sign_extend(memory[z80.pc]); z80.pc &= 0xffff; }; }
      z80.pc++;
      z80.pc &= 0xffff;
      break;
    case 0x11:
      tstates += (3);;
      z80.e=memory[z80.pc++];
      z80.pc &= 0xffff;
      tstates += (3);;
      z80.d=memory[z80.pc++];
      z80.pc &= 0xffff;
      break;
    case 0x12:
      tstates += (3);;
      writebyte_internal((z80.e | (z80.d << 8)),z80.a);
      break;
    case 0x13:
      tstates += 2;
      var wordtemp = ((z80.e | (z80.d << 8)) + 1) & 0xffff;
      z80.d = wordtemp >> 8;
      z80.e = wordtemp & 0xff;
      break;
    case 0x14:
      { (z80.d) = ((z80.d) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.d)==0x80 ? 0x04 : 0 ) | ( (z80.d)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.d)];};
      break;
    case 0x15:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.d)&0x0f ? 0 : 0x10 ) | 0x02; (z80.d) = ((z80.d) - 1) & 0xff; z80.f |= ( (z80.d)==0x7f ? 0x04 : 0 ) | sz53_table[z80.d];};
      break;
    case 0x16:
      tstates += (3);;
      z80.d=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x17:
      {
 var bytetemp = z80.a;
 z80.a = ( (z80.a & 0x7f) << 1 ) | ( z80.f & 0x01 );
 z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) |
   ( z80.a & ( 0x08 | 0x20 ) ) | ( bytetemp >> 7 );
      }
      break;
    case 0x18:
      tstates += (3);;
      { tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; z80.pc += sign_extend(memory[z80.pc]); z80.pc &= 0xffff; };
      z80.pc++; z80.pc &= 0xffff;
      break;
    case 0x19:
      { var add16temp = ((z80.l | (z80.h << 8))) + ((z80.e | (z80.d << 8))); var lookup = ( ( ((z80.l | (z80.h << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.e | (z80.d << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.h) = (add16temp >> 8) & 0xff; (z80.l) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x1a:
      tstates += (3);;
      z80.a=memory[(z80.e | (z80.d << 8))];
      break;
    case 0x1b:
      tstates += 2;
      var wordtemp = ((z80.e | (z80.d << 8)) - 1) & 0xffff;
      z80.d = wordtemp >> 8;
      z80.e = wordtemp & 0xff;
      break;
    case 0x1c:
      { (z80.e) = ((z80.e) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.e)==0x80 ? 0x04 : 0 ) | ( (z80.e)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.e)];};
      break;
    case 0x1d:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.e)&0x0f ? 0 : 0x10 ) | 0x02; (z80.e) = ((z80.e) - 1) & 0xff; z80.f |= ( (z80.e)==0x7f ? 0x04 : 0 ) | sz53_table[z80.e];};
      break;
    case 0x1e:
      tstates += (3);;
      z80.e=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x1f:
      {
 var bytetemp = z80.a;
 z80.a = ( z80.a >> 1 ) | ( (z80.f & 0x01) << 7 );
 z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) |
   ( z80.a & ( 0x08 | 0x20 ) ) | ( bytetemp & 0x01 ) ;
      }
      break;
    case 0x20:
      tstates += (3);;
      if( ! ( z80.f & 0x40 ) ) { { tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; z80.pc += sign_extend(memory[z80.pc]); z80.pc &= 0xffff; }; }
      z80.pc++; z80.pc &= 0xffff;
      break;
    case 0x21:
      tstates += (3);;
      z80.l=memory[z80.pc++];
      z80.pc &= 0xffff;
      tstates += (3);;
      z80.h=memory[z80.pc++];
      z80.pc &= 0xffff;
      break;
    case 0x22:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; writebyte_internal(ldtemp++,(z80.l)); ldtemp &= 0xffff; tstates += (3);; writebyte_internal(ldtemp,(z80.h)); break;};
      break;
    case 0x23:
      tstates += 2;
      var wordtemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff;
      z80.h = wordtemp >> 8;
      z80.l = wordtemp & 0xff;
      break;
    case 0x24:
      { (z80.h) = ((z80.h) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.h)==0x80 ? 0x04 : 0 ) | ( (z80.h)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.h)];};
      break;
    case 0x25:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.h)&0x0f ? 0 : 0x10 ) | 0x02; (z80.h) = ((z80.h) - 1) & 0xff; z80.f |= ( (z80.h)==0x7f ? 0x04 : 0 ) | sz53_table[z80.h];};
      break;
    case 0x26:
      tstates += (3);;
      z80.h=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x27:
      {
 var add = 0, carry = ( z80.f & 0x01 );
 if( ( z80.f & 0x10 ) || ( (z80.a & 0x0f)>9 ) ) add=6;
 if( carry || (z80.a > 0x99 ) ) add|=0x60;
 if( z80.a > 0x99 ) carry=0x01;
 if ( z80.f & 0x02 ) {
   { var subtemp = z80.a - (add); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (add) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
 } else {
   { var addtemp = z80.a + (add); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (add) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
 }
 z80.f = ( z80.f & ~( 0x01 | 0x04) ) | carry | parity_table[z80.a];
      }
      break;
    case 0x28:
      tstates += (3);;
      if( z80.f & 0x40 ) { { tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; z80.pc += sign_extend(memory[z80.pc]); z80.pc &= 0xffff; }; }
      z80.pc++; z80.pc &= 0xffff;
      break;
    case 0x29:
      { var add16temp = ((z80.l | (z80.h << 8))) + ((z80.l | (z80.h << 8))); var lookup = ( ( ((z80.l | (z80.h << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.l | (z80.h << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.h) = (add16temp >> 8) & 0xff; (z80.l) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x2a:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; (z80.l)=memory[ldtemp++]; ldtemp &= 0xffff; tstates += (3);; (z80.h)=memory[ldtemp]; break;};
      break;
    case 0x2b:
      tstates += 2;
      var wordtemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff;
      z80.h = wordtemp >> 8;
      z80.l = wordtemp & 0xff;
      break;
    case 0x2c:
      { (z80.l) = ((z80.l) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.l)==0x80 ? 0x04 : 0 ) | ( (z80.l)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.l)];};
      break;
    case 0x2d:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.l)&0x0f ? 0 : 0x10 ) | 0x02; (z80.l) = ((z80.l) - 1) & 0xff; z80.f |= ( (z80.l)==0x7f ? 0x04 : 0 ) | sz53_table[z80.l];};
      break;
    case 0x2e:
      tstates += (3);;
      z80.l=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x2f:
      z80.a ^= 0xff;
      z80.f = ( z80.f & ( 0x01 | 0x04 | 0x40 | 0x80 ) ) |
 ( z80.a & ( 0x08 | 0x20 ) ) | ( 0x02 | 0x10 );
      break;
    case 0x30:
      tstates += (3);;
      if( ! ( z80.f & 0x01 ) ) { { tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; z80.pc += sign_extend(memory[z80.pc]); z80.pc &= 0xffff; }; }
      z80.pc++; z80.pc &= 0xffff;
      break;
    case 0x31:
      tstates += (3);;
      var splow = memory[z80.pc++];
      z80.pc &= 0xffff;
      tstates += (3);;
      var sphigh=memory[z80.pc++];
      z80.sp = splow | (sphigh << 8);
      z80.pc &= 0xffff;
      break;
    case 0x32:
      tstates += (3);;
      {
 var wordtemp = memory[z80.pc++];
 z80.pc &= 0xffff;
 tstates += (3);;
 wordtemp|=memory[z80.pc++] << 8;
 z80.pc &= 0xffff;
 tstates += (3);;
 writebyte_internal(wordtemp,z80.a);
      }
      break;
    case 0x33:
      tstates += 2;
      z80.sp = (z80.sp + 1) & 0xffff;
      break;
    case 0x34:
      tstates += (4);;
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 { (bytetemp) = ((bytetemp) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (bytetemp)==0x80 ? 0x04 : 0 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | sz53_table[(bytetemp)];};
 tstates += (3);;
 writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x35:
      tstates += (4);;
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 { z80.f = ( z80.f & 0x01 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | 0x02; (bytetemp) = ((bytetemp) - 1) & 0xff; z80.f |= ( (bytetemp)==0x7f ? 0x04 : 0 ) | sz53_table[bytetemp];};
 tstates += (3);;
 writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x36:
      tstates += (3);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)),memory[z80.pc++]);
      z80.pc &= 0xffff;
      break;
    case 0x37:
      z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) |
        ( z80.a & ( 0x08 | 0x20 ) ) |
        0x01;
      break;
    case 0x38:
      tstates += (3);;
      if( z80.f & 0x01 ) { { tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);; z80.pc += sign_extend(memory[z80.pc]); z80.pc &= 0xffff; }; }
      z80.pc++; z80.pc &= 0xffff;
      break;
    case 0x39:
      { var add16temp = ((z80.l | (z80.h << 8))) + (z80.sp); var lookup = ( ( ((z80.l | (z80.h << 8))) & 0x0800 ) >> 11 ) | ( ( (z80.sp) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.h) = (add16temp >> 8) & 0xff; (z80.l) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x3a:
      {
 var wordtemp;
 tstates += (3);;
 wordtemp = memory[z80.pc++];
 z80.pc &= 0xffff;
 tstates += (3);;
 wordtemp|= ( memory[z80.pc++] << 8 );
 z80.pc &= 0xffff;
 tstates += (3);;
 z80.a=memory[wordtemp];
      }
      break;
    case 0x3b:
      tstates += 2;
      z80.sp = (z80.sp - 1) & 0xffff;
      break;
    case 0x3c:
      { (z80.a) = ((z80.a) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.a)==0x80 ? 0x04 : 0 ) | ( (z80.a)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.a)];};
      break;
    case 0x3d:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.a)&0x0f ? 0 : 0x10 ) | 0x02; (z80.a) = ((z80.a) - 1) & 0xff; z80.f |= ( (z80.a)==0x7f ? 0x04 : 0 ) | sz53_table[z80.a];};
      break;
    case 0x3e:
      tstates += (3);;
      z80.a=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x3f:
      z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) |
 ( ( z80.f & 0x01 ) ? 0x10 : 0x01 ) | ( z80.a & ( 0x08 | 0x20 ) );
      break;
    case 0x40:
      break;
    case 0x41:
      z80.b=z80.c;
      break;
    case 0x42:
      z80.b=z80.d;
      break;
    case 0x43:
      z80.b=z80.e;
      break;
    case 0x44:
      z80.b=z80.h;
      break;
    case 0x45:
      z80.b=z80.l;
      break;
    case 0x46:
      tstates += (3);;
      z80.b=memory[(z80.l | (z80.h << 8))];
      break;
    case 0x47:
      z80.b=z80.a;
      break;
    case 0x48:
      z80.c=z80.b;
      break;
    case 0x49:
      break;
    case 0x4a:
      z80.c=z80.d;
      break;
    case 0x4b:
      z80.c=z80.e;
      break;
    case 0x4c:
      z80.c=z80.h;
      break;
    case 0x4d:
      z80.c=z80.l;
      break;
    case 0x4e:
      tstates += (3);;
      z80.c=memory[(z80.l | (z80.h << 8))];
      break;
    case 0x4f:
      z80.c=z80.a;
      break;
    case 0x50:
      z80.d=z80.b;
      break;
    case 0x51:
      z80.d=z80.c;
      break;
    case 0x52:
      break;
    case 0x53:
      z80.d=z80.e;
      break;
    case 0x54:
      z80.d=z80.h;
      break;
    case 0x55:
      z80.d=z80.l;
      break;
    case 0x56:
      tstates += (3);;
      z80.d=memory[(z80.l | (z80.h << 8))];
      break;
    case 0x57:
      z80.d=z80.a;
      break;
    case 0x58:
      z80.e=z80.b;
      break;
    case 0x59:
      z80.e=z80.c;
      break;
    case 0x5a:
      z80.e=z80.d;
      break;
    case 0x5b:
      break;
    case 0x5c:
      z80.e=z80.h;
      break;
    case 0x5d:
      z80.e=z80.l;
      break;
    case 0x5e:
      tstates += (3);;
      z80.e=memory[(z80.l | (z80.h << 8))];
      break;
    case 0x5f:
      z80.e=z80.a;
      break;
    case 0x60:
      z80.h=z80.b;
      break;
    case 0x61:
      z80.h=z80.c;
      break;
    case 0x62:
      z80.h=z80.d;
      break;
    case 0x63:
      z80.h=z80.e;
      break;
    case 0x64:
      break;
    case 0x65:
      z80.h=z80.l;
      break;
    case 0x66:
      tstates += (3);;
      z80.h=memory[(z80.l | (z80.h << 8))];
      break;
    case 0x67:
      z80.h=z80.a;
      break;
    case 0x68:
      z80.l=z80.b;
      break;
    case 0x69:
      z80.l=z80.c;
      break;
    case 0x6a:
      z80.l=z80.d;
      break;
    case 0x6b:
      z80.l=z80.e;
      break;
    case 0x6c:
      z80.l=z80.h;
      break;
    case 0x6d:
      break;
    case 0x6e:
      tstates += (3);;
      z80.l=memory[(z80.l | (z80.h << 8))];
      break;
    case 0x6f:
      z80.l=z80.a;
      break;
    case 0x70:
      tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)),z80.b);
      break;
    case 0x71:
      tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)),z80.c);
      break;
    case 0x72:
      tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)),z80.d);
      break;
    case 0x73:
      tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)),z80.e);
      break;
    case 0x74:
      tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)),z80.h);
      break;
    case 0x75:
      tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)),z80.l);
      break;
    case 0x76:
      z80.halted=1;
      z80.pc--;z80.pc &= 0xffff;
      break;
    case 0x77:
      tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)),z80.a);
      break;
    case 0x78:
      z80.a=z80.b;
      break;
    case 0x79:
      z80.a=z80.c;
      break;
    case 0x7a:
      z80.a=z80.d;
      break;
    case 0x7b:
      z80.a=z80.e;
      break;
    case 0x7c:
      z80.a=z80.h;
      break;
    case 0x7d:
      z80.a=z80.l;
      break;
    case 0x7e:
      tstates += (3);;
      z80.a=memory[(z80.l | (z80.h << 8))];
      break;
    case 0x7f:
      break;
    case 0x80:
      { var addtemp = z80.a + (z80.b); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.b) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x81:
      { var addtemp = z80.a + (z80.c); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.c) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x82:
      { var addtemp = z80.a + (z80.d); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.d) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x83:
      { var addtemp = z80.a + (z80.e); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.e) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x84:
      { var addtemp = z80.a + (z80.h); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.h) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x85:
      { var addtemp = z80.a + (z80.l); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.l) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x86:
      tstates += (3);;
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 { var addtemp = z80.a + (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x87:
      { var addtemp = z80.a + (z80.a); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.a) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x88:
      { var adctemp = z80.a + (z80.b) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.b) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x89:
      { var adctemp = z80.a + (z80.c) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.c) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8a:
      { var adctemp = z80.a + (z80.d) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.d) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8b:
      { var adctemp = z80.a + (z80.e) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.e) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8c:
      { var adctemp = z80.a + (z80.h) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.h) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8d:
      { var adctemp = z80.a + (z80.l) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.l) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8e:
      tstates += (3);;
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 { var adctemp = z80.a + (bytetemp) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x8f:
      { var adctemp = z80.a + (z80.a) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.a) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x90:
      { var subtemp = z80.a - (z80.b); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.b) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x91:
      { var subtemp = z80.a - (z80.c); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.c) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x92:
      { var subtemp = z80.a - (z80.d); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.d) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x93:
      { var subtemp = z80.a - (z80.e); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.e) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x94:
      { var subtemp = z80.a - (z80.h); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.h) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x95:
      { var subtemp = z80.a - (z80.l); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.l) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x96:
      tstates += (3);;
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 { var subtemp = z80.a - (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x97:
      { var subtemp = z80.a - (z80.a); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.a) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x98:
      { var sbctemp = z80.a - (z80.b) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.b) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x99:
      { var sbctemp = z80.a - (z80.c) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.c) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9a:
      { var sbctemp = z80.a - (z80.d) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.d) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9b:
      { var sbctemp = z80.a - (z80.e) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.e) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9c:
      { var sbctemp = z80.a - (z80.h) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.h) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9d:
      { var sbctemp = z80.a - (z80.l) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.l) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9e:
      tstates += (3);;
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 { var sbctemp = z80.a - (bytetemp) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x9f:
      { var sbctemp = z80.a - (z80.a) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.a) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0xa0:
      { z80.a &= (z80.b); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa1:
      { z80.a &= (z80.c); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa2:
      { z80.a &= (z80.d); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa3:
      { z80.a &= (z80.e); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa4:
      { z80.a &= (z80.h); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa5:
      { z80.a &= (z80.l); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa6:
      tstates += (3);;
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 { z80.a &= (bytetemp); z80.f = 0x10 | sz53p_table[z80.a];};
      }
      break;
    case 0xa7:
      { z80.a &= (z80.a); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa8:
      { z80.a ^= (z80.b); z80.f = sz53p_table[z80.a];};
      break;
    case 0xa9:
      { z80.a ^= (z80.c); z80.f = sz53p_table[z80.a];};
      break;
    case 0xaa:
      { z80.a ^= (z80.d); z80.f = sz53p_table[z80.a];};
      break;
    case 0xab:
      { z80.a ^= (z80.e); z80.f = sz53p_table[z80.a];};
      break;
    case 0xac:
      { z80.a ^= (z80.h); z80.f = sz53p_table[z80.a];};
      break;
    case 0xad:
      { z80.a ^= (z80.l); z80.f = sz53p_table[z80.a];};
      break;
    case 0xae:
      tstates += (3);;
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 { z80.a ^= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xaf:
      { z80.a ^= (z80.a); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb0:
      { z80.a |= (z80.b); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb1:
      { z80.a |= (z80.c); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb2:
      { z80.a |= (z80.d); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb3:
      { z80.a |= (z80.e); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb4:
      { z80.a |= (z80.h); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb5:
      { z80.a |= (z80.l); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb6:
      tstates += (3);;
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 { z80.a |= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xb7:
      { z80.a |= (z80.a); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb8:
      { var cptemp = z80.a - z80.b; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.b) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.b & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xb9:
      { var cptemp = z80.a - z80.c; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.c) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.c & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xba:
      { var cptemp = z80.a - z80.d; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.d) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.d & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbb:
      { var cptemp = z80.a - z80.e; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.e) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.e & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbc:
      { var cptemp = z80.a - z80.h; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.h) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbd:
      { var cptemp = z80.a - z80.l; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.l) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.l & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbe:
      tstates += (3);;
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 { var cptemp = z80.a - bytetemp; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( bytetemp & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      }
      break;
    case 0xbf:
      { var cptemp = z80.a - z80.a; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.a) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.a & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xc0:
      tstates++;
      if( z80.pc==0x056c || z80.pc == 0x0112 ) {
        loadTapeBlock();
        break;
      }
      if( ! ( z80.f & 0x40 ) ) { { { tstates += (3);; var lowbyte =memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; var highbyte=memory[z80.sp++]; z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xc1:
      { tstates += (3);; (z80.c)=memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; (z80.b)=memory[z80.sp++]; z80.sp &= 0xffff;};
      break;
    case 0xc2:
      tstates += (3);; tstates += (3);;
      if( ! ( z80.f & 0x40 ) ) { { var jptemp=z80.pc; var pcl =memory[jptemp++]; jptemp &= 0xffff; var pch =memory[jptemp]; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xc3:
      tstates += (3);; tstates += (3);;
      { var jptemp=z80.pc; var pcl =memory[jptemp++]; jptemp &= 0xffff; var pch =memory[jptemp]; z80.pc = pcl | (pch << 8);};
      break;
    case 0xc4:
      tstates += (3);; tstates += (3);;
      if( ! ( z80.f & 0x40 ) ) { { var calltempl, calltemph; calltempl=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (1);; calltemph=memory[z80.pc++]; z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xc5:
      tstates++;
      { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.b)); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.c));};
      break;
    case 0xc6:
      tstates += (3);;
      {
 var bytetemp = memory[z80.pc++];
 { var addtemp = z80.a + (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xc7:
      tstates++;
      { { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x00);};
      break;
    case 0xc8:
      tstates++;
      if( z80.f & 0x40 ) { { { tstates += (3);; var lowbyte =memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; var highbyte=memory[z80.sp++]; z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xc9:
      { { tstates += (3);; var lowbyte =memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; var highbyte=memory[z80.sp++]; z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};};
      break;
    case 0xca:
      tstates += (3);; tstates += (3);;
      if( z80.f & 0x40 ) { { var jptemp=z80.pc; var pcl =memory[jptemp++]; jptemp &= 0xffff; var pch =memory[jptemp]; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xcb:
      {
 var opcode2;
 tstates += (4);;
 opcode2 = memory[z80.pc++];
 z80.pc &= 0xffff;
 z80.r = (z80.r+1) & 0x7f;
 switch(opcode2) {
    case 0x00:
      { (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( (z80.b)>>7 ); z80.f = ( (z80.b) & 0x01 ) | sz53p_table[(z80.b)];};
      break;
    case 0x01:
      { (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( (z80.c)>>7 ); z80.f = ( (z80.c) & 0x01 ) | sz53p_table[(z80.c)];};
      break;
    case 0x02:
      { (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( (z80.d)>>7 ); z80.f = ( (z80.d) & 0x01 ) | sz53p_table[(z80.d)];};
      break;
    case 0x03:
      { (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( (z80.e)>>7 ); z80.f = ( (z80.e) & 0x01 ) | sz53p_table[(z80.e)];};
      break;
    case 0x04:
      { (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( (z80.h)>>7 ); z80.f = ( (z80.h) & 0x01 ) | sz53p_table[(z80.h)];};
      break;
    case 0x05:
      { (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( (z80.l)>>7 ); z80.f = ( (z80.l) & 0x01 ) | sz53p_table[(z80.l)];};
      break;
    case 0x06:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);; tstates += (3);;
 { (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( (bytetemp)>>7 ); z80.f = ( (bytetemp) & 0x01 ) | sz53p_table[(bytetemp)];};
 writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x07:
      { (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( (z80.a)>>7 ); z80.f = ( (z80.a) & 0x01 ) | sz53p_table[(z80.a)];};
      break;
    case 0x08:
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b)>>1 ) | ( ((z80.b) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.b)];};
      break;
    case 0x09:
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c)>>1 ) | ( ((z80.c) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.c)];};
      break;
    case 0x0a:
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d)>>1 ) | ( ((z80.d) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.d)];};
      break;
    case 0x0b:
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e)>>1 ) | ( ((z80.e) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.e)];};
      break;
    case 0x0c:
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h)>>1 ) | ( ((z80.h) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.h)];};
      break;
    case 0x0d:
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l)>>1 ) | ( ((z80.l) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.l)];};
      break;
    case 0x0e:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);; tstates += (3);;
 { z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp)>>1 ) | ( ((bytetemp) & 0x01)<<7 ); z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x0f:
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a)>>1 ) | ( ((z80.a) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.a)];};
      break;
    case 0x10:
      { var rltemp = (z80.b); (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.b)];};
      break;
    case 0x11:
      { var rltemp = (z80.c); (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.c)];};
      break;
    case 0x12:
      { var rltemp = (z80.d); (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.d)];};
      break;
    case 0x13:
      { var rltemp = (z80.e); (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.e)];};
      break;
    case 0x14:
      { var rltemp = (z80.h); (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.h)];};
      break;
    case 0x15:
      { var rltemp = (z80.l); (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.l)];};
      break;
    case 0x16:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);; tstates += (3);;
 { var rltemp = (bytetemp); (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(bytetemp)];};
 writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x17:
      { var rltemp = (z80.a); (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.a)];};
      break;
    case 0x18:
      { var rrtemp = (z80.b); (z80.b) = ( (z80.b)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.b)];};
      break;
    case 0x19:
      { var rrtemp = (z80.c); (z80.c) = ( (z80.c)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.c)];};
      break;
    case 0x1a:
      { var rrtemp = (z80.d); (z80.d) = ( (z80.d)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.d)];};
      break;
    case 0x1b:
      { var rrtemp = (z80.e); (z80.e) = ( (z80.e)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.e)];};
      break;
    case 0x1c:
      { var rrtemp = (z80.h); (z80.h) = ( (z80.h)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.h)];};
      break;
    case 0x1d:
      { var rrtemp = (z80.l); (z80.l) = ( (z80.l)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.l)];};
      break;
    case 0x1e:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);; tstates += (3);;
 { var rrtemp = (bytetemp); (bytetemp) = ( (bytetemp)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(bytetemp)];};
 writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x1f:
      { var rrtemp = (z80.a); (z80.a) = ( (z80.a)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.a)];};
      break;
    case 0x20:
      { z80.f = (z80.b) >> 7; (z80.b) <<= 1; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      break;
    case 0x21:
      { z80.f = (z80.c) >> 7; (z80.c) <<= 1; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      break;
    case 0x22:
      { z80.f = (z80.d) >> 7; (z80.d) <<= 1; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      break;
    case 0x23:
      { z80.f = (z80.e) >> 7; (z80.e) <<= 1; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      break;
    case 0x24:
      { z80.f = (z80.h) >> 7; (z80.h) <<= 1; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      break;
    case 0x25:
      { z80.f = (z80.l) >> 7; (z80.l) <<= 1; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      break;
    case 0x26:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);; tstates += (3);;
 { z80.f = (bytetemp) >> 7; (bytetemp) <<= 1; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x27:
      { z80.f = (z80.a) >> 7; (z80.a) <<= 1; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      break;
    case 0x28:
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b) & 0x80 ) | ( (z80.b) >> 1 ); z80.f |= sz53p_table[(z80.b)];};
      break;
    case 0x29:
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c) & 0x80 ) | ( (z80.c) >> 1 ); z80.f |= sz53p_table[(z80.c)];};
      break;
    case 0x2a:
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d) & 0x80 ) | ( (z80.d) >> 1 ); z80.f |= sz53p_table[(z80.d)];};
      break;
    case 0x2b:
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e) & 0x80 ) | ( (z80.e) >> 1 ); z80.f |= sz53p_table[(z80.e)];};
      break;
    case 0x2c:
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h) & 0x80 ) | ( (z80.h) >> 1 ); z80.f |= sz53p_table[(z80.h)];};
      break;
    case 0x2d:
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l) & 0x80 ) | ( (z80.l) >> 1 ); z80.f |= sz53p_table[(z80.l)];};
      break;
    case 0x2e:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);; tstates += (3);;
 { z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp) & 0x80 ) | ( (bytetemp) >> 1 ); z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x2f:
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a) & 0x80 ) | ( (z80.a) >> 1 ); z80.f |= sz53p_table[(z80.a)];};
      break;
    case 0x30:
      { z80.f = (z80.b) >> 7; (z80.b) = ( (z80.b) << 1 ) | 0x01; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      break;
    case 0x31:
      { z80.f = (z80.c) >> 7; (z80.c) = ( (z80.c) << 1 ) | 0x01; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      break;
    case 0x32:
      { z80.f = (z80.d) >> 7; (z80.d) = ( (z80.d) << 1 ) | 0x01; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      break;
    case 0x33:
      { z80.f = (z80.e) >> 7; (z80.e) = ( (z80.e) << 1 ) | 0x01; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      break;
    case 0x34:
      { z80.f = (z80.h) >> 7; (z80.h) = ( (z80.h) << 1 ) | 0x01; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      break;
    case 0x35:
      { z80.f = (z80.l) >> 7; (z80.l) = ( (z80.l) << 1 ) | 0x01; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      break;
    case 0x36:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);; tstates += (3);;
 { z80.f = (bytetemp) >> 7; (bytetemp) = ( (bytetemp) << 1 ) | 0x01; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x37:
      { z80.f = (z80.a) >> 7; (z80.a) = ( (z80.a) << 1 ) | 0x01; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      break;
    case 0x38:
      { z80.f = (z80.b) & 0x01; (z80.b) >>= 1; z80.f |= sz53p_table[(z80.b)];};
      break;
    case 0x39:
      { z80.f = (z80.c) & 0x01; (z80.c) >>= 1; z80.f |= sz53p_table[(z80.c)];};
      break;
    case 0x3a:
      { z80.f = (z80.d) & 0x01; (z80.d) >>= 1; z80.f |= sz53p_table[(z80.d)];};
      break;
    case 0x3b:
      { z80.f = (z80.e) & 0x01; (z80.e) >>= 1; z80.f |= sz53p_table[(z80.e)];};
      break;
    case 0x3c:
      { z80.f = (z80.h) & 0x01; (z80.h) >>= 1; z80.f |= sz53p_table[(z80.h)];};
      break;
    case 0x3d:
      { z80.f = (z80.l) & 0x01; (z80.l) >>= 1; z80.f |= sz53p_table[(z80.l)];};
      break;
    case 0x3e:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);; tstates += (3);;
 { z80.f = (bytetemp) & 0x01; (bytetemp) >>= 1; z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x3f:
      { z80.f = (z80.a) & 0x01; (z80.a) >>= 1; z80.f |= sz53p_table[(z80.a)];};
      break;
    case 0x40:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) ); if( ! ( (z80.b) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40; if( (0) == 7 && (z80.b) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x41:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) ); if( ! ( (z80.c) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40; if( (0) == 7 && (z80.c) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x42:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) ); if( ! ( (z80.d) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40; if( (0) == 7 && (z80.d) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x43:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) ); if( ! ( (z80.e) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40; if( (0) == 7 && (z80.e) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x44:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) ); if( ! ( (z80.h) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40; if( (0) == 7 && (z80.h) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x45:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) ); if( ! ( (z80.l) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40; if( (0) == 7 && (z80.l) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x46:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);;
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40; if( (0) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x47:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) ); if( ! ( (z80.a) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40; if( (0) == 7 && (z80.a) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x48:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) ); if( ! ( (z80.b) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40; if( (1) == 7 && (z80.b) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x49:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) ); if( ! ( (z80.c) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40; if( (1) == 7 && (z80.c) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x4a:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) ); if( ! ( (z80.d) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40; if( (1) == 7 && (z80.d) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x4b:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) ); if( ! ( (z80.e) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40; if( (1) == 7 && (z80.e) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x4c:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) ); if( ! ( (z80.h) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40; if( (1) == 7 && (z80.h) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x4d:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) ); if( ! ( (z80.l) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40; if( (1) == 7 && (z80.l) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x4e:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);;
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40; if( (1) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x4f:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) ); if( ! ( (z80.a) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40; if( (1) == 7 && (z80.a) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x50:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) ); if( ! ( (z80.b) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40; if( (2) == 7 && (z80.b) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x51:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) ); if( ! ( (z80.c) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40; if( (2) == 7 && (z80.c) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x52:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) ); if( ! ( (z80.d) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40; if( (2) == 7 && (z80.d) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x53:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) ); if( ! ( (z80.e) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40; if( (2) == 7 && (z80.e) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x54:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) ); if( ! ( (z80.h) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40; if( (2) == 7 && (z80.h) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x55:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) ); if( ! ( (z80.l) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40; if( (2) == 7 && (z80.l) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x56:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);;
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40; if( (2) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x57:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) ); if( ! ( (z80.a) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40; if( (2) == 7 && (z80.a) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x58:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) ); if( ! ( (z80.b) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40; if( (3) == 7 && (z80.b) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x59:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) ); if( ! ( (z80.c) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40; if( (3) == 7 && (z80.c) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x5a:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) ); if( ! ( (z80.d) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40; if( (3) == 7 && (z80.d) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x5b:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) ); if( ! ( (z80.e) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40; if( (3) == 7 && (z80.e) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x5c:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) ); if( ! ( (z80.h) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40; if( (3) == 7 && (z80.h) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x5d:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) ); if( ! ( (z80.l) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40; if( (3) == 7 && (z80.l) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x5e:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);;
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40; if( (3) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x5f:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) ); if( ! ( (z80.a) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40; if( (3) == 7 && (z80.a) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x60:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) ); if( ! ( (z80.b) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40; if( (4) == 7 && (z80.b) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x61:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) ); if( ! ( (z80.c) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40; if( (4) == 7 && (z80.c) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x62:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) ); if( ! ( (z80.d) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40; if( (4) == 7 && (z80.d) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x63:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) ); if( ! ( (z80.e) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40; if( (4) == 7 && (z80.e) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x64:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) ); if( ! ( (z80.h) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40; if( (4) == 7 && (z80.h) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x65:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) ); if( ! ( (z80.l) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40; if( (4) == 7 && (z80.l) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x66:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);;
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40; if( (4) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x67:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) ); if( ! ( (z80.a) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40; if( (4) == 7 && (z80.a) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x68:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) ); if( ! ( (z80.b) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40; if( (5) == 7 && (z80.b) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x69:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) ); if( ! ( (z80.c) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40; if( (5) == 7 && (z80.c) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x6a:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) ); if( ! ( (z80.d) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40; if( (5) == 7 && (z80.d) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x6b:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) ); if( ! ( (z80.e) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40; if( (5) == 7 && (z80.e) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x6c:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) ); if( ! ( (z80.h) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40; if( (5) == 7 && (z80.h) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x6d:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) ); if( ! ( (z80.l) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40; if( (5) == 7 && (z80.l) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x6e:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);;
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40; if( (5) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x6f:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) ); if( ! ( (z80.a) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40; if( (5) == 7 && (z80.a) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x70:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) ); if( ! ( (z80.b) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40; if( (6) == 7 && (z80.b) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x71:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) ); if( ! ( (z80.c) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40; if( (6) == 7 && (z80.c) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x72:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) ); if( ! ( (z80.d) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40; if( (6) == 7 && (z80.d) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x73:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) ); if( ! ( (z80.e) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40; if( (6) == 7 && (z80.e) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x74:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) ); if( ! ( (z80.h) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40; if( (6) == 7 && (z80.h) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x75:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) ); if( ! ( (z80.l) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40; if( (6) == 7 && (z80.l) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x76:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);;
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40; if( (6) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x77:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) ); if( ! ( (z80.a) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40; if( (6) == 7 && (z80.a) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x78:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) ); if( ! ( (z80.b) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40; if( (7) == 7 && (z80.b) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x79:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) ); if( ! ( (z80.c) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40; if( (7) == 7 && (z80.c) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x7a:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) ); if( ! ( (z80.d) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40; if( (7) == 7 && (z80.d) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x7b:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) ); if( ! ( (z80.e) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40; if( (7) == 7 && (z80.e) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x7c:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) ); if( ! ( (z80.h) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40; if( (7) == 7 && (z80.h) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x7d:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) ); if( ! ( (z80.l) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40; if( (7) == 7 && (z80.l) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x7e:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (4);;
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40; if( (7) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x7f:
      { z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) ); if( ! ( (z80.a) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40; if( (7) == 7 && (z80.a) & 0x80 ) z80.f |= 0x80; };
      break;
    case 0x80:
      z80.b &= 0xfe;
      break;
    case 0x81:
      z80.c &= 0xfe;
      break;
    case 0x82:
      z80.d &= 0xfe;
      break;
    case 0x83:
      z80.e &= 0xfe;
      break;
    case 0x84:
      z80.h &= 0xfe;
      break;
    case 0x85:
      z80.l &= 0xfe;
      break;
    case 0x86:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] & 0xfe);
      break;
    case 0x87:
      z80.a &= 0xfe;
      break;
    case 0x88:
      z80.b &= 0xfd;
      break;
    case 0x89:
      z80.c &= 0xfd;
      break;
    case 0x8a:
      z80.d &= 0xfd;
      break;
    case 0x8b:
      z80.e &= 0xfd;
      break;
    case 0x8c:
      z80.h &= 0xfd;
      break;
    case 0x8d:
      z80.l &= 0xfd;
      break;
    case 0x8e:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] & 0xfd);
      break;
    case 0x8f:
      z80.a &= 0xfd;
      break;
    case 0x90:
      z80.b &= 0xfb;
      break;
    case 0x91:
      z80.c &= 0xfb;
      break;
    case 0x92:
      z80.d &= 0xfb;
      break;
    case 0x93:
      z80.e &= 0xfb;
      break;
    case 0x94:
      z80.h &= 0xfb;
      break;
    case 0x95:
      z80.l &= 0xfb;
      break;
    case 0x96:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] & 0xfb);
      break;
    case 0x97:
      z80.a &= 0xfb;
      break;
    case 0x98:
      z80.b &= 0xf7;
      break;
    case 0x99:
      z80.c &= 0xf7;
      break;
    case 0x9a:
      z80.d &= 0xf7;
      break;
    case 0x9b:
      z80.e &= 0xf7;
      break;
    case 0x9c:
      z80.h &= 0xf7;
      break;
    case 0x9d:
      z80.l &= 0xf7;
      break;
    case 0x9e:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] & 0xf7);
      break;
    case 0x9f:
      z80.a &= 0xf7;
      break;
    case 0xa0:
      z80.b &= 0xef;
      break;
    case 0xa1:
      z80.c &= 0xef;
      break;
    case 0xa2:
      z80.d &= 0xef;
      break;
    case 0xa3:
      z80.e &= 0xef;
      break;
    case 0xa4:
      z80.h &= 0xef;
      break;
    case 0xa5:
      z80.l &= 0xef;
      break;
    case 0xa6:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] & 0xef);
      break;
    case 0xa7:
      z80.a &= 0xef;
      break;
    case 0xa8:
      z80.b &= 0xdf;
      break;
    case 0xa9:
      z80.c &= 0xdf;
      break;
    case 0xaa:
      z80.d &= 0xdf;
      break;
    case 0xab:
      z80.e &= 0xdf;
      break;
    case 0xac:
      z80.h &= 0xdf;
      break;
    case 0xad:
      z80.l &= 0xdf;
      break;
    case 0xae:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] & 0xdf);
      break;
    case 0xaf:
      z80.a &= 0xdf;
      break;
    case 0xb0:
      z80.b &= 0xbf;
      break;
    case 0xb1:
      z80.c &= 0xbf;
      break;
    case 0xb2:
      z80.d &= 0xbf;
      break;
    case 0xb3:
      z80.e &= 0xbf;
      break;
    case 0xb4:
      z80.h &= 0xbf;
      break;
    case 0xb5:
      z80.l &= 0xbf;
      break;
    case 0xb6:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] & 0xbf);
      break;
    case 0xb7:
      z80.a &= 0xbf;
      break;
    case 0xb8:
      z80.b &= 0x7f;
      break;
    case 0xb9:
      z80.c &= 0x7f;
      break;
    case 0xba:
      z80.d &= 0x7f;
      break;
    case 0xbb:
      z80.e &= 0x7f;
      break;
    case 0xbc:
      z80.h &= 0x7f;
      break;
    case 0xbd:
      z80.l &= 0x7f;
      break;
    case 0xbe:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] & 0x7f);
      break;
    case 0xbf:
      z80.a &= 0x7f;
      break;
    case 0xc0:
      z80.b |= 0x01;
      break;
    case 0xc1:
      z80.c |= 0x01;
      break;
    case 0xc2:
      z80.d |= 0x01;
      break;
    case 0xc3:
      z80.e |= 0x01;
      break;
    case 0xc4:
      z80.h |= 0x01;
      break;
    case 0xc5:
      z80.l |= 0x01;
      break;
    case 0xc6:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] | 0x01);
      break;
    case 0xc7:
      z80.a |= 0x01;
      break;
    case 0xc8:
      z80.b |= 0x02;
      break;
    case 0xc9:
      z80.c |= 0x02;
      break;
    case 0xca:
      z80.d |= 0x02;
      break;
    case 0xcb:
      z80.e |= 0x02;
      break;
    case 0xcc:
      z80.h |= 0x02;
      break;
    case 0xcd:
      z80.l |= 0x02;
      break;
    case 0xce:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] | 0x02);
      break;
    case 0xcf:
      z80.a |= 0x02;
      break;
    case 0xd0:
      z80.b |= 0x04;
      break;
    case 0xd1:
      z80.c |= 0x04;
      break;
    case 0xd2:
      z80.d |= 0x04;
      break;
    case 0xd3:
      z80.e |= 0x04;
      break;
    case 0xd4:
      z80.h |= 0x04;
      break;
    case 0xd5:
      z80.l |= 0x04;
      break;
    case 0xd6:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] | 0x04);
      break;
    case 0xd7:
      z80.a |= 0x04;
      break;
    case 0xd8:
      z80.b |= 0x08;
      break;
    case 0xd9:
      z80.c |= 0x08;
      break;
    case 0xda:
      z80.d |= 0x08;
      break;
    case 0xdb:
      z80.e |= 0x08;
      break;
    case 0xdc:
      z80.h |= 0x08;
      break;
    case 0xdd:
      z80.l |= 0x08;
      break;
    case 0xde:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] | 0x08);
      break;
    case 0xdf:
      z80.a |= 0x08;
      break;
    case 0xe0:
      z80.b |= 0x10;
      break;
    case 0xe1:
      z80.c |= 0x10;
      break;
    case 0xe2:
      z80.d |= 0x10;
      break;
    case 0xe3:
      z80.e |= 0x10;
      break;
    case 0xe4:
      z80.h |= 0x10;
      break;
    case 0xe5:
      z80.l |= 0x10;
      break;
    case 0xe6:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] | 0x10);
      break;
    case 0xe7:
      z80.a |= 0x10;
      break;
    case 0xe8:
      z80.b |= 0x20;
      break;
    case 0xe9:
      z80.c |= 0x20;
      break;
    case 0xea:
      z80.d |= 0x20;
      break;
    case 0xeb:
      z80.e |= 0x20;
      break;
    case 0xec:
      z80.h |= 0x20;
      break;
    case 0xed:
      z80.l |= 0x20;
      break;
    case 0xee:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] | 0x20);
      break;
    case 0xef:
      z80.a |= 0x20;
      break;
    case 0xf0:
      z80.b |= 0x40;
      break;
    case 0xf1:
      z80.c |= 0x40;
      break;
    case 0xf2:
      z80.d |= 0x40;
      break;
    case 0xf3:
      z80.e |= 0x40;
      break;
    case 0xf4:
      z80.h |= 0x40;
      break;
    case 0xf5:
      z80.l |= 0x40;
      break;
    case 0xf6:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] | 0x40);
      break;
    case 0xf7:
      z80.a |= 0x40;
      break;
    case 0xf8:
      z80.b |= 0x80;
      break;
    case 0xf9:
      z80.c |= 0x80;
      break;
    case 0xfa:
      z80.d |= 0x80;
      break;
    case 0xfb:
      z80.e |= 0x80;
      break;
    case 0xfc:
      z80.h |= 0x80;
      break;
    case 0xfd:
      z80.l |= 0x80;
      break;
    case 0xfe:
      tstates += (4);; tstates += (3);;
      writebyte_internal((z80.l | (z80.h << 8)), memory[(z80.l | (z80.h << 8))] | 0x80);
      break;
    case 0xff:
      z80.a |= 0x80;
      break;
 }
      }
      break;
    case 0xcc:
      tstates += (3);; tstates += (3);;
      if( z80.f & 0x40 ) { { var calltempl, calltemph; calltempl=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (1);; calltemph=memory[z80.pc++]; z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xcd:
      tstates += (3);; tstates += (3);;
      { var calltempl, calltemph; calltempl=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (1);; calltemph=memory[z80.pc++]; z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);};
      break;
    case 0xce:
      tstates += (3);;
      {
 var bytetemp = memory[z80.pc++];
 { var adctemp = z80.a + (bytetemp) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xcf:
      tstates++;
      { { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x08);};
      break;
    case 0xd0:
      tstates++;
      if( ! ( z80.f & 0x01 ) ) { { { tstates += (3);; var lowbyte =memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; var highbyte=memory[z80.sp++]; z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xd1:
      { tstates += (3);; (z80.e)=memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; (z80.d)=memory[z80.sp++]; z80.sp &= 0xffff;};
      break;
    case 0xd2:
      tstates += (3);; tstates += (3);;
      if( ! ( z80.f & 0x01 ) ) { { var jptemp=z80.pc; var pcl =memory[jptemp++]; jptemp &= 0xffff; var pch =memory[jptemp]; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xd3:
      {
 var outtemp;
 tstates += (4);;
 outtemp = memory[z80.pc++] + ( z80.a << 8 );
 z80.pc &= 0xffff;
 { tstates += (3);; writeport(outtemp,z80.a);};
      }
      break;
    case 0xd4:
      tstates += (3);; tstates += (3);;
      if( ! ( z80.f & 0x01 ) ) { { var calltempl, calltemph; calltempl=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (1);; calltemph=memory[z80.pc++]; z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xd5:
      tstates++;
      { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.d)); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.e));};
      break;
    case 0xd6:
      tstates += (3);;
      {
 var bytetemp = memory[z80.pc++];
 { var subtemp = z80.a - (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xd7:
      tstates++;
      { { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x10);};
      break;
    case 0xd8:
      tstates++;
      if( z80.f & 0x01 ) { { { tstates += (3);; var lowbyte =memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; var highbyte=memory[z80.sp++]; z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xd9:
      {
 var bytetemp;
 bytetemp = z80.b; z80.b = z80.b_; z80.b_ = bytetemp;
 bytetemp = z80.c; z80.c = z80.c_; z80.c_ = bytetemp;
 bytetemp = z80.d; z80.d = z80.d_; z80.d_ = bytetemp;
 bytetemp = z80.e; z80.e = z80.e_; z80.e_ = bytetemp;
 bytetemp = z80.h; z80.h = z80.h_; z80.h_ = bytetemp;
 bytetemp = z80.l; z80.l = z80.l_; z80.l_ = bytetemp;
      }
      break;
    case 0xda:
      tstates += (3);; tstates += (3);;
      if( z80.f & 0x01 ) { { var jptemp=z80.pc; var pcl =memory[jptemp++]; jptemp &= 0xffff; var pch =memory[jptemp]; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xdb:
      {
 var intemp;
 tstates += (4);;
 intemp = memory[z80.pc++] + ( z80.a << 8 );
 z80.pc &= 0xffff;
 tstates += (3);;
        z80.a=readport( intemp );
      }
      break;
    case 0xdc:
      tstates += (3);; tstates += (3);;
      if( z80.f & 0x01 ) { { var calltempl, calltemph; calltempl=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (1);; calltemph=memory[z80.pc++]; z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xdd:
      {
 var opcode2;
 tstates += (4);;
 opcode2 = memory[z80.pc++];
 z80.pc &= 0xffff;
 z80.r = (z80.r+1) & 0x7f;
 switch(opcode2) {
    case 0x09:
      { var add16temp = ((z80.ixl | (z80.ixh << 8))) + ((z80.c | (z80.b << 8))); var lookup = ( ( ((z80.ixl | (z80.ixh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.c | (z80.b << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.ixh) = (add16temp >> 8) & 0xff; (z80.ixl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x19:
      { var add16temp = ((z80.ixl | (z80.ixh << 8))) + ((z80.e | (z80.d << 8))); var lookup = ( ( ((z80.ixl | (z80.ixh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.e | (z80.d << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.ixh) = (add16temp >> 8) & 0xff; (z80.ixl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x21:
      tstates += (3);;
      z80.ixl=memory[z80.pc++];
      z80.pc &= 0xffff;
      tstates += (3);;
      z80.ixh=memory[z80.pc++];
      z80.pc &= 0xffff;
      break;
    case 0x22:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; writebyte_internal(ldtemp++,(z80.ixl)); ldtemp &= 0xffff; tstates += (3);; writebyte_internal(ldtemp,(z80.ixh)); break;};
      break;
    case 0x23:
      tstates += 2;
      var wordtemp = ((z80.ixl | (z80.ixh << 8)) + 1) & 0xffff;
      z80.ixh = wordtemp >> 8;
      z80.ixl = wordtemp & 0xff;
      break;
    case 0x24:
      { (z80.ixh) = ((z80.ixh) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.ixh)==0x80 ? 0x04 : 0 ) | ( (z80.ixh)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.ixh)];};
      break;
    case 0x25:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.ixh)&0x0f ? 0 : 0x10 ) | 0x02; (z80.ixh) = ((z80.ixh) - 1) & 0xff; z80.f |= ( (z80.ixh)==0x7f ? 0x04 : 0 ) | sz53_table[z80.ixh];};
      break;
    case 0x26:
      tstates += (3);;
      z80.ixh=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x29:
      { var add16temp = ((z80.ixl | (z80.ixh << 8))) + ((z80.ixl | (z80.ixh << 8))); var lookup = ( ( ((z80.ixl | (z80.ixh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.ixl | (z80.ixh << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.ixh) = (add16temp >> 8) & 0xff; (z80.ixl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x2a:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; (z80.ixl)=memory[ldtemp++]; ldtemp &= 0xffff; tstates += (3);; (z80.ixh)=memory[ldtemp]; break;};
      break;
    case 0x2b:
      tstates += 2;
      var wordtemp = ((z80.ixl | (z80.ixh << 8)) - 1) & 0xffff;
      z80.ixh = wordtemp >> 8;
      z80.ixl = wordtemp & 0xff;
      break;
    case 0x2c:
      { (z80.ixl) = ((z80.ixl) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.ixl)==0x80 ? 0x04 : 0 ) | ( (z80.ixl)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.ixl)];};
      break;
    case 0x2d:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.ixl)&0x0f ? 0 : 0x10 ) | 0x02; (z80.ixl) = ((z80.ixl) - 1) & 0xff; z80.f |= ( (z80.ixl)==0x7f ? 0x04 : 0 ) | sz53_table[z80.ixl];};
      break;
    case 0x2e:
      tstates += (3);;
      z80.ixl=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x34:
      tstates += 15;
      {
 var wordtemp =
     ((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff;
 z80.pc &= 0xffff;
 var bytetemp = memory[wordtemp];
 { (bytetemp) = ((bytetemp) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (bytetemp)==0x80 ? 0x04 : 0 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | sz53_table[(bytetemp)];};
 writebyte_internal(wordtemp,bytetemp);
      }
      break;
    case 0x35:
      tstates += 15;
      {
 var wordtemp =
     ((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff;
 z80.pc &= 0xffff;
 var bytetemp = memory[wordtemp];
 { z80.f = ( z80.f & 0x01 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | 0x02; (bytetemp) = ((bytetemp) - 1) & 0xff; z80.f |= ( (bytetemp)==0x7f ? 0x04 : 0 ) | sz53_table[bytetemp];};
 writebyte_internal(wordtemp,bytetemp);
      }
      break;
    case 0x36:
      tstates += 11;
      {
 var wordtemp =
     ((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff;
 z80.pc &= 0xffff;
 writebyte_internal(wordtemp,memory[z80.pc++]);
 z80.pc &= 0xffff;
      }
      break;
    case 0x39:
      { var add16temp = ((z80.ixl | (z80.ixh << 8))) + (z80.sp); var lookup = ( ( ((z80.ixl | (z80.ixh << 8))) & 0x0800 ) >> 11 ) | ( ( (z80.sp) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.ixh) = (add16temp >> 8) & 0xff; (z80.ixl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x44:
      z80.b=z80.ixh;
      break;
    case 0x45:
      z80.b=z80.ixl;
      break;
    case 0x46:
      tstates += 11;
      z80.b = memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x4c:
      z80.c=z80.ixh;
      break;
    case 0x4d:
      z80.c=z80.ixl;
      break;
    case 0x4e:
      tstates += 11;
      z80.c = memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x54:
      z80.d=z80.ixh;
      break;
    case 0x55:
      z80.d=z80.ixl;
      break;
    case 0x56:
      tstates += 11;
      z80.d = memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x5c:
      z80.e=z80.ixh;
      break;
    case 0x5d:
      z80.e=z80.ixl;
      break;
    case 0x5e:
      tstates += 11;
      z80.e = memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x60:
      z80.ixh=z80.b;
      break;
    case 0x61:
      z80.ixh=z80.c;
      break;
    case 0x62:
      z80.ixh=z80.d;
      break;
    case 0x63:
      z80.ixh=z80.e;
      break;
    case 0x64:
      break;
    case 0x65:
      z80.ixh=z80.ixl;
      break;
    case 0x66:
      tstates += 11;
      z80.h = memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x67:
      z80.ixh=z80.a;
      break;
    case 0x68:
      z80.ixl=z80.b;
      break;
    case 0x69:
      z80.ixl=z80.c;
      break;
    case 0x6a:
      z80.ixl=z80.d;
      break;
    case 0x6b:
      z80.ixl=z80.e;
      break;
    case 0x6c:
      z80.ixl=z80.ixh;
      break;
    case 0x6d:
      break;
    case 0x6e:
      tstates += 11;
      z80.l = memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x6f:
      z80.ixl=z80.a;
      break;
    case 0x70:
      tstates += 11;
      writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.b );
      z80.pc &= 0xffff;
      break;
    case 0x71:
      tstates += 11;
      writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.c );
      z80.pc &= 0xffff;
      break;
    case 0x72:
      tstates += 11;
      writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.d );
      z80.pc &= 0xffff;
      break;
    case 0x73:
      tstates += 11;
      writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.e );
      z80.pc &= 0xffff;
      break;
    case 0x74:
      tstates += 11;
      writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.h );
      z80.pc &= 0xffff;
      break;
    case 0x75:
      tstates += 11;
      writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.l );
      z80.pc &= 0xffff;
      break;
    case 0x77:
      tstates += 11;
      writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.a );
      z80.pc &= 0xffff;
      break;
    case 0x7c:
      z80.a=z80.ixh;
      break;
    case 0x7d:
      z80.a=z80.ixl;
      break;
    case 0x7e:
      tstates += 11;
      z80.a = memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x84:
      { var addtemp = z80.a + (z80.ixh); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixh) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x85:
      { var addtemp = z80.a + (z80.ixl); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixl) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x86:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { var addtemp = z80.a + (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x8c:
      { var adctemp = z80.a + (z80.ixh) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixh) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8d:
      { var adctemp = z80.a + (z80.ixl) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixl) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8e:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { var adctemp = z80.a + (bytetemp) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x94:
      { var subtemp = z80.a - (z80.ixh); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixh) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x95:
      { var subtemp = z80.a - (z80.ixl); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixl) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x96:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { var subtemp = z80.a - (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x9c:
      { var sbctemp = z80.a - (z80.ixh) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixh) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9d:
      { var sbctemp = z80.a - (z80.ixl) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixl) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9e:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { var sbctemp = z80.a - (bytetemp) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xa4:
      { z80.a &= (z80.ixh); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa5:
      { z80.a &= (z80.ixl); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa6:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { z80.a &= (bytetemp); z80.f = 0x10 | sz53p_table[z80.a];};
      }
      break;
    case 0xac:
      { z80.a ^= (z80.ixh); z80.f = sz53p_table[z80.a];};
      break;
    case 0xad:
      { z80.a ^= (z80.ixl); z80.f = sz53p_table[z80.a];};
      break;
    case 0xae:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { z80.a ^= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xb4:
      { z80.a |= (z80.ixh); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb5:
      { z80.a |= (z80.ixl); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb6:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { z80.a |= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xbc:
      { var cptemp = z80.a - z80.ixh; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixh) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.ixh & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbd:
      { var cptemp = z80.a - z80.ixl; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixl) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.ixl & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbe:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { var cptemp = z80.a - bytetemp; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( bytetemp & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      }
      break;
    case 0xcb:
      {
 var tempaddr; var opcode3;
 tstates += (3);;
 tempaddr =
     (z80.ixl | (z80.ixh << 8)) + sign_extend(memory[z80.pc++]);
 z80.pc &= 0xffff;
 tstates += (4);;
 opcode3 = memory[z80.pc++];
 z80.pc &= 0xffff;
 switch(opcode3) {
    case 0x00:
      tstates += 8;
      z80.b=memory[tempaddr];
      { (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( (z80.b)>>7 ); z80.f = ( (z80.b) & 0x01 ) | sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x01:
      tstates += 8;
      z80.c=memory[tempaddr];
      { (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( (z80.c)>>7 ); z80.f = ( (z80.c) & 0x01 ) | sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x02:
      tstates += 8;
      z80.d=memory[tempaddr];
      { (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( (z80.d)>>7 ); z80.f = ( (z80.d) & 0x01 ) | sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x03:
      tstates += 8;
      z80.e=memory[tempaddr];
      { (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( (z80.e)>>7 ); z80.f = ( (z80.e) & 0x01 ) | sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x04:
      tstates += 8;
      z80.h=memory[tempaddr];
      { (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( (z80.h)>>7 ); z80.f = ( (z80.h) & 0x01 ) | sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x05:
      tstates += 8;
      z80.l=memory[tempaddr];
      { (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( (z80.l)>>7 ); z80.f = ( (z80.l) & 0x01 ) | sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x06:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( (bytetemp)>>7 ); z80.f = ( (bytetemp) & 0x01 ) | sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x07:
      tstates += 8;
      z80.a=memory[tempaddr];
      { (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( (z80.a)>>7 ); z80.f = ( (z80.a) & 0x01 ) | sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x08:
      tstates += 8;
      z80.b=memory[tempaddr];
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b)>>1 ) | ( ((z80.b) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x09:
      tstates += 8;
      z80.c=memory[tempaddr];
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c)>>1 ) | ( ((z80.c) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x0a:
      tstates += 8;
      z80.d=memory[tempaddr];
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d)>>1 ) | ( ((z80.d) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x0b:
      tstates += 8;
      z80.e=memory[tempaddr];
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e)>>1 ) | ( ((z80.e) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x0c:
      tstates += 8;
      z80.h=memory[tempaddr];
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h)>>1 ) | ( ((z80.h) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x0d:
      tstates += 8;
      z80.l=memory[tempaddr];
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l)>>1 ) | ( ((z80.l) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x0e:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp)>>1 ) | ( ((bytetemp) & 0x01)<<7 ); z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x0f:
      tstates += 8;
      z80.a=memory[tempaddr];
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a)>>1 ) | ( ((z80.a) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x10:
      tstates += 8;
      z80.b=memory[tempaddr];
      { var rltemp = (z80.b); (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x11:
      tstates += 8;
      z80.c=memory[tempaddr];
      { var rltemp = (z80.c); (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x12:
      tstates += 8;
      z80.d=memory[tempaddr];
      { var rltemp = (z80.d); (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x13:
      tstates += 8;
      z80.e=memory[tempaddr];
      { var rltemp = (z80.e); (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x14:
      tstates += 8;
      z80.h=memory[tempaddr];
      { var rltemp = (z80.h); (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x15:
      tstates += 8;
      z80.l=memory[tempaddr];
      { var rltemp = (z80.l); (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x16:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { var rltemp = (bytetemp); (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x17:
      tstates += 8;
      z80.a=memory[tempaddr];
      { var rltemp = (z80.a); (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x18:
      tstates += 8;
      z80.b=memory[tempaddr];
      { var rrtemp = (z80.b); (z80.b) = ( (z80.b)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x19:
      tstates += 8;
      z80.c=memory[tempaddr];
      { var rrtemp = (z80.c); (z80.c) = ( (z80.c)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x1a:
      tstates += 8;
      z80.d=memory[tempaddr];
      { var rrtemp = (z80.d); (z80.d) = ( (z80.d)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x1b:
      tstates += 8;
      z80.e=memory[tempaddr];
      { var rrtemp = (z80.e); (z80.e) = ( (z80.e)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x1c:
      tstates += 8;
      z80.h=memory[tempaddr];
      { var rrtemp = (z80.h); (z80.h) = ( (z80.h)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x1d:
      tstates += 8;
      z80.l=memory[tempaddr];
      { var rrtemp = (z80.l); (z80.l) = ( (z80.l)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x1e:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { var rrtemp = (bytetemp); (bytetemp) = ( (bytetemp)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x1f:
      tstates += 8;
      z80.a=memory[tempaddr];
      { var rrtemp = (z80.a); (z80.a) = ( (z80.a)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x20:
      tstates += 8;
      z80.b=memory[tempaddr];
      { z80.f = (z80.b) >> 7; (z80.b) <<= 1; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x21:
      tstates += 8;
      z80.c=memory[tempaddr];
      { z80.f = (z80.c) >> 7; (z80.c) <<= 1; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x22:
      tstates += 8;
      z80.d=memory[tempaddr];
      { z80.f = (z80.d) >> 7; (z80.d) <<= 1; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x23:
      tstates += 8;
      z80.e=memory[tempaddr];
      { z80.f = (z80.e) >> 7; (z80.e) <<= 1; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x24:
      tstates += 8;
      z80.h=memory[tempaddr];
      { z80.f = (z80.h) >> 7; (z80.h) <<= 1; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x25:
      tstates += 8;
      z80.l=memory[tempaddr];
      { z80.f = (z80.l) >> 7; (z80.l) <<= 1; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x26:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = (bytetemp) >> 7; (bytetemp) <<= 1; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x27:
      tstates += 8;
      z80.a=memory[tempaddr];
      { z80.f = (z80.a) >> 7; (z80.a) <<= 1; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x28:
      tstates += 8;
      z80.b=memory[tempaddr];
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b) & 0x80 ) | ( (z80.b) >> 1 ); z80.f |= sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x29:
      tstates += 8;
      z80.c=memory[tempaddr];
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c) & 0x80 ) | ( (z80.c) >> 1 ); z80.f |= sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x2a:
      tstates += 8;
      z80.d=memory[tempaddr];
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d) & 0x80 ) | ( (z80.d) >> 1 ); z80.f |= sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x2b:
      tstates += 8;
      z80.e=memory[tempaddr];
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e) & 0x80 ) | ( (z80.e) >> 1 ); z80.f |= sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x2c:
      tstates += 8;
      z80.h=memory[tempaddr];
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h) & 0x80 ) | ( (z80.h) >> 1 ); z80.f |= sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x2d:
      tstates += 8;
      z80.l=memory[tempaddr];
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l) & 0x80 ) | ( (z80.l) >> 1 ); z80.f |= sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x2e:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp) & 0x80 ) | ( (bytetemp) >> 1 ); z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x2f:
      tstates += 8;
      z80.a=memory[tempaddr];
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a) & 0x80 ) | ( (z80.a) >> 1 ); z80.f |= sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x30:
      tstates += 8;
      z80.b=memory[tempaddr];
      { z80.f = (z80.b) >> 7; (z80.b) = ( (z80.b) << 1 ) | 0x01; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x31:
      tstates += 8;
      z80.c=memory[tempaddr];
      { z80.f = (z80.c) >> 7; (z80.c) = ( (z80.c) << 1 ) | 0x01; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x32:
      tstates += 8;
      z80.d=memory[tempaddr];
      { z80.f = (z80.d) >> 7; (z80.d) = ( (z80.d) << 1 ) | 0x01; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x33:
      tstates += 8;
      z80.e=memory[tempaddr];
      { z80.f = (z80.e) >> 7; (z80.e) = ( (z80.e) << 1 ) | 0x01; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x34:
      tstates += 8;
      z80.h=memory[tempaddr];
      { z80.f = (z80.h) >> 7; (z80.h) = ( (z80.h) << 1 ) | 0x01; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x35:
      tstates += 8;
      z80.l=memory[tempaddr];
      { z80.f = (z80.l) >> 7; (z80.l) = ( (z80.l) << 1 ) | 0x01; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x36:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = (bytetemp) >> 7; (bytetemp) = ( (bytetemp) << 1 ) | 0x01; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x37:
      tstates += 8;
      z80.a=memory[tempaddr];
      { z80.f = (z80.a) >> 7; (z80.a) = ( (z80.a) << 1 ) | 0x01; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x38:
      tstates += 8;
      z80.b=memory[tempaddr];
      { z80.f = (z80.b) & 0x01; (z80.b) >>= 1; z80.f |= sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x39:
      tstates += 8;
      z80.c=memory[tempaddr];
      { z80.f = (z80.c) & 0x01; (z80.c) >>= 1; z80.f |= sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x3a:
      tstates += 8;
      z80.d=memory[tempaddr];
      { z80.f = (z80.d) & 0x01; (z80.d) >>= 1; z80.f |= sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x3b:
      tstates += 8;
      z80.e=memory[tempaddr];
      { z80.f = (z80.e) & 0x01; (z80.e) >>= 1; z80.f |= sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x3c:
      tstates += 8;
      z80.h=memory[tempaddr];
      { z80.f = (z80.h) & 0x01; (z80.h) >>= 1; z80.f |= sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x3d:
      tstates += 8;
      z80.l=memory[tempaddr];
      { z80.f = (z80.l) & 0x01; (z80.l) >>= 1; z80.f |= sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x3e:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = (bytetemp) & 0x01; (bytetemp) >>= 1; z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x3f:
      tstates += 8;
      z80.a=memory[tempaddr];
      { z80.f = (z80.a) & 0x01; (z80.a) >>= 1; z80.f |= sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x40:
    case 0x41:
    case 0x42:
    case 0x43:
    case 0x44:
    case 0x45:
    case 0x46:
    case 0x47:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40; if( (0) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x48:
    case 0x49:
    case 0x4a:
    case 0x4b:
    case 0x4c:
    case 0x4d:
    case 0x4e:
    case 0x4f:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40; if( (1) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x50:
    case 0x51:
    case 0x52:
    case 0x53:
    case 0x54:
    case 0x55:
    case 0x56:
    case 0x57:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40; if( (2) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x58:
    case 0x59:
    case 0x5a:
    case 0x5b:
    case 0x5c:
    case 0x5d:
    case 0x5e:
    case 0x5f:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40; if( (3) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x60:
    case 0x61:
    case 0x62:
    case 0x63:
    case 0x64:
    case 0x65:
    case 0x66:
    case 0x67:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40; if( (4) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x68:
    case 0x69:
    case 0x6a:
    case 0x6b:
    case 0x6c:
    case 0x6d:
    case 0x6e:
    case 0x6f:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40; if( (5) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x70:
    case 0x71:
    case 0x72:
    case 0x73:
    case 0x74:
    case 0x75:
    case 0x76:
    case 0x77:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40; if( (6) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x78:
    case 0x79:
    case 0x7a:
    case 0x7b:
    case 0x7c:
    case 0x7d:
    case 0x7e:
    case 0x7f:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40; if( (7) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x80:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x81:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x82:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x83:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x84:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x85:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x86:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xfe);
      break;
    case 0x87:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x88:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x89:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x8a:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x8b:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x8c:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x8d:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x8e:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xfd);
      break;
    case 0x8f:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x90:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x91:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x92:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x93:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x94:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x95:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x96:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xfb);
      break;
    case 0x97:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x98:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x99:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x9a:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x9b:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x9c:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x9d:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x9e:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xf7);
      break;
    case 0x9f:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xa0:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xa1:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xa2:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xa3:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xa4:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xa5:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xa6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xef);
      break;
    case 0xa7:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xa8:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xa9:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xaa:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xab:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xac:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xad:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xae:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xdf);
      break;
    case 0xaf:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xb0:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xb1:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xb2:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xb3:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xb4:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xb5:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xb6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xbf);
      break;
    case 0xb7:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xb8:
      tstates += 8;
      z80.b=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xb9:
      tstates += 8;
      z80.c=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xba:
      tstates += 8;
      z80.d=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xbb:
      tstates += 8;
      z80.e=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xbc:
      tstates += 8;
      z80.h=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xbd:
      tstates += 8;
      z80.l=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xbe:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0x7f);
      break;
    case 0xbf:
      tstates += 8;
      z80.a=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xc0:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xc1:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xc2:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xc3:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xc4:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xc5:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xc6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x01);
      break;
    case 0xc7:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xc8:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xc9:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xca:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xcb:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xcc:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xcd:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xce:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x02);
      break;
    case 0xcf:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xd0:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xd1:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xd2:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xd3:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xd4:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xd5:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xd6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x04);
      break;
    case 0xd7:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xd8:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xd9:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xda:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xdb:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xdc:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xdd:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xde:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x08);
      break;
    case 0xdf:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xe0:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xe1:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xe2:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xe3:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xe4:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xe5:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xe6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x10);
      break;
    case 0xe7:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xe8:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xe9:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xea:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xeb:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xec:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xed:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xee:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x20);
      break;
    case 0xef:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xf0:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xf1:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xf2:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xf3:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xf4:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xf5:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xf6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x40);
      break;
    case 0xf7:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xf8:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xf9:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xfa:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xfb:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xfc:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xfd:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xfe:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x80);
      break;
    case 0xff:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.a);
      break;
 }
      }
      break;
    case 0xe1:
      { tstates += (3);; (z80.ixl)=memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; (z80.ixh)=memory[z80.sp++]; z80.sp &= 0xffff;};
      break;
    case 0xe3:
      {
 var bytetempl = memory[z80.sp],
                  bytetemph = memory[z80.sp + 1];
 tstates += (3);; tstates += (4);;
 tstates += (3);; tstates += (5);;
 writebyte_internal(z80.sp+1,z80.ixh); writebyte_internal(z80.sp,z80.ixl);
 z80.ixl=bytetempl; z80.ixh=bytetemph;
      }
      break;
    case 0xe5:
      tstates++;
      { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.ixh)); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.ixl));};
      break;
    case 0xe9:
      z80.pc=(z80.ixl | (z80.ixh << 8));
      break;
    case 0xf9:
      tstates += 2;
      z80.sp=(z80.ixl | (z80.ixh << 8));
      break;
    default:
      z80.pc--;
      z80.pc &= 0xffff;
      z80.r--;
      z80.r &= 0x7f;
      break;
 }
      }
      break;
    case 0xde:
      tstates += (3);;
      {
 var bytetemp = memory[z80.pc++];
 { var sbctemp = z80.a - (bytetemp) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xdf:
      tstates++;
      { { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x18);};
      break;
    case 0xe0:
      tstates++;
      if( ! ( z80.f & 0x04 ) ) { { { tstates += (3);; var lowbyte =memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; var highbyte=memory[z80.sp++]; z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xe1:
      { tstates += (3);; (z80.l)=memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; (z80.h)=memory[z80.sp++]; z80.sp &= 0xffff;};
      break;
    case 0xe2:
      tstates += (3);; tstates += (3);;
      if( ! ( z80.f & 0x04 ) ) { { var jptemp=z80.pc; var pcl =memory[jptemp++]; jptemp &= 0xffff; var pch =memory[jptemp]; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xe3:
      {
 var bytetempl = memory[z80.sp],
                  bytetemph = memory[z80.sp + 1];
 tstates += (3);; tstates += (4);;
 tstates += (3);; tstates += (5);;
 writebyte_internal(z80.sp+1,z80.h); writebyte_internal(z80.sp,z80.l);
 z80.l=bytetempl; z80.h=bytetemph;
      }
      break;
    case 0xe4:
      tstates += (3);; tstates += (3);;
      if( ! ( z80.f & 0x04 ) ) { { var calltempl, calltemph; calltempl=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (1);; calltemph=memory[z80.pc++]; z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xe5:
      tstates++;
      { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.h)); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.l));};
      break;
    case 0xe6:
      tstates += (3);;
      {
 var bytetemp = memory[z80.pc++];
 { z80.a &= (bytetemp); z80.f = 0x10 | sz53p_table[z80.a];};
      }
      break;
    case 0xe7:
      tstates++;
      { { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x20);};
      break;
    case 0xe8:
      tstates++;
      if( z80.f & 0x04 ) { { { tstates += (3);; var lowbyte =memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; var highbyte=memory[z80.sp++]; z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xe9:
      z80.pc=(z80.l | (z80.h << 8));
      break;
    case 0xea:
      tstates += (3);; tstates += (3);;
      if( z80.f & 0x04 ) { { var jptemp=z80.pc; var pcl =memory[jptemp++]; jptemp &= 0xffff; var pch =memory[jptemp]; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xeb:
      {
 var bytetemp;
 bytetemp = z80.d; z80.d = z80.h; z80.h = bytetemp;
 bytetemp = z80.e; z80.e = z80.l; z80.l = bytetemp;
      }
      break;
    case 0xec:
      tstates += (3);; tstates += (3);;
      if( z80.f & 0x04 ) { { var calltempl, calltemph; calltempl=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (1);; calltemph=memory[z80.pc++]; z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xed:
      {
 var opcode2;
 tstates += (4);;
 opcode2 = memory[z80.pc++];
 z80.pc &= 0xffff;
 z80.r = (z80.r+1) & 0x7f;
 switch(opcode2) {
    case 0x40:
      tstates += 1;
      { tstates += (3);; (z80.b)=readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.b)];};
      break;
    case 0x41:
      tstates += 1;
      { tstates += (3);; writeport((z80.c | (z80.b << 8)),z80.b);};
      break;
    case 0x42:
      tstates += 7;
      { var sub16temp = (z80.l | (z80.h << 8)) - ((z80.c | (z80.b << 8))) - (z80.f & 0x01); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.c | (z80.b << 8))) & 0x8800 ) >> 10 ) | ( ( sub16temp & 0x8800 ) >> 9 ); z80.h = (sub16temp >> 8) & 0xff; z80.l = sub16temp & 0xff; z80.f = ( sub16temp & 0x10000 ? 0x01 : 0 ) | 0x02 | overflow_sub_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_sub_table[lookup&0x07] | ( (z80.l | (z80.h << 8)) ? 0 : 0x40) ;};
      break;
    case 0x43:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; writebyte_internal(ldtemp++,(z80.c)); ldtemp &= 0xffff; tstates += (3);; writebyte_internal(ldtemp,(z80.b)); break;};
      break;
    case 0x44:
    case 0x4c:
    case 0x54:
    case 0x5c:
    case 0x64:
    case 0x6c:
    case 0x74:
    case 0x7c:
      {
 var bytetemp=z80.a;
 z80.a=0;
 { var subtemp = z80.a - (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x45:
    case 0x4d:
    case 0x55:
    case 0x5d:
    case 0x65:
    case 0x6d:
    case 0x75:
    case 0x7d:
      z80.iff1=z80.iff2;
      { { tstates += (3);; var lowbyte =memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; var highbyte=memory[z80.sp++]; z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};};
      break;
    case 0x46:
    case 0x4e:
    case 0x66:
    case 0x6e:
      z80.im=0;
      break;
    case 0x47:
      tstates += 1;
      z80.i=z80.a;
      break;
    case 0x48:
      tstates += 1;
      { tstates += (3);; (z80.c)=readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.c)];};
      break;
    case 0x49:
      tstates += 1;
      { tstates += (3);; writeport((z80.c | (z80.b << 8)),z80.c);};
      break;
    case 0x4a:
      tstates += 7;
      { var add16temp= (z80.l | (z80.h << 8)) + ((z80.c | (z80.b << 8))) + ( z80.f & 0x01 ); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.c | (z80.b << 8))) & 0x8800 ) >> 10 ) | ( ( add16temp & 0x8800 ) >> 9 ); z80.h = (add16temp >> 8) & 0xff; z80.l = add16temp & 0xff; z80.f = ( add16temp & 0x10000 ? 0x01 : 0 )| overflow_add_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_add_table[lookup&0x07]| ( (z80.l | (z80.h << 8)) ? 0 : 0x40 );};
      break;
    case 0x4b:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; (z80.c)=memory[ldtemp++]; ldtemp &= 0xffff; tstates += (3);; (z80.b)=memory[ldtemp]; break;};
      break;
    case 0x4f:
      tstates += 1;
      z80.r=z80.r7=z80.a;
      break;
    case 0x50:
      tstates += 1;
      { tstates += (3);; (z80.d)=readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.d)];};
      break;
    case 0x51:
      tstates += 1;
      { tstates += (3);; writeport((z80.c | (z80.b << 8)),z80.d);};
      break;
    case 0x52:
      tstates += 7;
      { var sub16temp = (z80.l | (z80.h << 8)) - ((z80.e | (z80.d << 8))) - (z80.f & 0x01); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.e | (z80.d << 8))) & 0x8800 ) >> 10 ) | ( ( sub16temp & 0x8800 ) >> 9 ); z80.h = (sub16temp >> 8) & 0xff; z80.l = sub16temp & 0xff; z80.f = ( sub16temp & 0x10000 ? 0x01 : 0 ) | 0x02 | overflow_sub_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_sub_table[lookup&0x07] | ( (z80.l | (z80.h << 8)) ? 0 : 0x40) ;};
      break;
    case 0x53:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; writebyte_internal(ldtemp++,(z80.e)); ldtemp &= 0xffff; tstates += (3);; writebyte_internal(ldtemp,(z80.d)); break;};
      break;
    case 0x56:
    case 0x76:
      z80.im=1;
      break;
    case 0x57:
      tstates += 1;
      z80.a=z80.i;
      z80.f = ( z80.f & 0x01 ) | sz53_table[z80.a] | ( z80.iff2 ? 0x04 : 0 );
      break;
    case 0x58:
      tstates += 1;
      { tstates += (3);; (z80.e)=readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.e)];};
      break;
    case 0x59:
      tstates += 1;
      { tstates += (3);; writeport((z80.c | (z80.b << 8)),z80.e);};
      break;
    case 0x5a:
      tstates += 7;
      { var add16temp= (z80.l | (z80.h << 8)) + ((z80.e | (z80.d << 8))) + ( z80.f & 0x01 ); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.e | (z80.d << 8))) & 0x8800 ) >> 10 ) | ( ( add16temp & 0x8800 ) >> 9 ); z80.h = (add16temp >> 8) & 0xff; z80.l = add16temp & 0xff; z80.f = ( add16temp & 0x10000 ? 0x01 : 0 )| overflow_add_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_add_table[lookup&0x07]| ( (z80.l | (z80.h << 8)) ? 0 : 0x40 );};
      break;
    case 0x5b:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; (z80.e)=memory[ldtemp++]; ldtemp &= 0xffff; tstates += (3);; (z80.d)=memory[ldtemp]; break;};
      break;
    case 0x5e:
    case 0x7e:
      z80.im=2;
      break;
    case 0x5f:
      tstates += 1;
      z80.a=(z80.r&0x7f) | (z80.r7&0x80);
      z80.f = ( z80.f & 0x01 ) | sz53_table[z80.a] | ( z80.iff2 ? 0x04 : 0 );
      break;
    case 0x60:
      tstates += 1;
      { tstates += (3);; (z80.h)=readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.h)];};
      break;
    case 0x61:
      tstates += 1;
      { tstates += (3);; writeport((z80.c | (z80.b << 8)),z80.h);};
      break;
    case 0x62:
      tstates += 7;
      { var sub16temp = (z80.l | (z80.h << 8)) - ((z80.l | (z80.h << 8))) - (z80.f & 0x01); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.l | (z80.h << 8))) & 0x8800 ) >> 10 ) | ( ( sub16temp & 0x8800 ) >> 9 ); z80.h = (sub16temp >> 8) & 0xff; z80.l = sub16temp & 0xff; z80.f = ( sub16temp & 0x10000 ? 0x01 : 0 ) | 0x02 | overflow_sub_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_sub_table[lookup&0x07] | ( (z80.l | (z80.h << 8)) ? 0 : 0x40) ;};
      break;
    case 0x63:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; writebyte_internal(ldtemp++,(z80.l)); ldtemp &= 0xffff; tstates += (3);; writebyte_internal(ldtemp,(z80.h)); break;};
      break;
    case 0x67:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (7);; tstates += (3);;
 writebyte_internal((z80.l | (z80.h << 8)), ( (z80.a & 0x0f) << 4 ) | ( bytetemp >> 4 ) );
 z80.a = ( z80.a & 0xf0 ) | ( bytetemp & 0x0f );
 z80.f = ( z80.f & 0x01 ) | sz53p_table[z80.a];
      }
      break;
    case 0x68:
      tstates += 1;
      { tstates += (3);; (z80.l)=readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.l)];};
      break;
    case 0x69:
      tstates += 1;
      { tstates += (3);; writeport((z80.c | (z80.b << 8)),z80.l);};
      break;
    case 0x6a:
      tstates += 7;
      { var add16temp= (z80.l | (z80.h << 8)) + ((z80.l | (z80.h << 8))) + ( z80.f & 0x01 ); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.l | (z80.h << 8))) & 0x8800 ) >> 10 ) | ( ( add16temp & 0x8800 ) >> 9 ); z80.h = (add16temp >> 8) & 0xff; z80.l = add16temp & 0xff; z80.f = ( add16temp & 0x10000 ? 0x01 : 0 )| overflow_add_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_add_table[lookup&0x07]| ( (z80.l | (z80.h << 8)) ? 0 : 0x40 );};
      break;
    case 0x6b:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; (z80.l)=memory[ldtemp++]; ldtemp &= 0xffff; tstates += (3);; (z80.h)=memory[ldtemp]; break;};
      break;
    case 0x6f:
      {
 var bytetemp = memory[(z80.l | (z80.h << 8))];
 tstates += (7);; tstates += (3);;
 writebyte_internal((z80.l | (z80.h << 8)), ((bytetemp & 0x0f) << 4 ) | ( z80.a & 0x0f ) );
 z80.a = ( z80.a & 0xf0 ) | ( bytetemp >> 4 );
 z80.f = ( z80.f & 0x01 ) | sz53p_table[z80.a];
      }
      break;
    case 0x70:
      tstates += 1;
      {
 var bytetemp;
 { tstates += (3);; (bytetemp)=readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(bytetemp)];};
      }
      break;
    case 0x71:
      tstates += 1;
      { tstates += (3);; writeport((z80.c | (z80.b << 8)),0);};
      break;
    case 0x72:
      tstates += 7;
      { var sub16temp = (z80.l | (z80.h << 8)) - (z80.sp) - (z80.f & 0x01); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( (z80.sp) & 0x8800 ) >> 10 ) | ( ( sub16temp & 0x8800 ) >> 9 ); z80.h = (sub16temp >> 8) & 0xff; z80.l = sub16temp & 0xff; z80.f = ( sub16temp & 0x10000 ? 0x01 : 0 ) | 0x02 | overflow_sub_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_sub_table[lookup&0x07] | ( (z80.l | (z80.h << 8)) ? 0 : 0x40) ;};
      break;
    case 0x73:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; writebyte_internal(ldtemp++,((z80.sp & 0xff))); ldtemp &= 0xffff; tstates += (3);; writebyte_internal(ldtemp,((z80.sp >> 8))); break;};
      break;
    case 0x78:
      tstates += 1;
      { tstates += (3);; (z80.a)=readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.a)];};
      break;
    case 0x79:
      tstates += 1;
      { tstates += (3);; writeport((z80.c | (z80.b << 8)),z80.a);};
      break;
    case 0x7a:
      tstates += 7;
      { var add16temp= (z80.l | (z80.h << 8)) + (z80.sp) + ( z80.f & 0x01 ); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( (z80.sp) & 0x8800 ) >> 10 ) | ( ( add16temp & 0x8800 ) >> 9 ); z80.h = (add16temp >> 8) & 0xff; z80.l = add16temp & 0xff; z80.f = ( add16temp & 0x10000 ? 0x01 : 0 )| overflow_add_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_add_table[lookup&0x07]| ( (z80.l | (z80.h << 8)) ? 0 : 0x40 );};
      break;
    case 0x7b:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; var regl = memory[ldtemp++]; ldtemp &= 0xffff; tstates += (3);; var regh =memory[ldtemp]; z80.sp = regl | (regh << 8); break;};
      break;
    case 0xa0:
      {
 var bytetemp=memory[(z80.l | (z80.h << 8))];
 tstates += (3);; tstates += (3);; tstates += (1);; tstates += (1);;
 var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
 writebyte_internal((z80.e | (z80.d << 8)),bytetemp);
 var detemp = ((z80.e | (z80.d << 8)) + 1) & 0xffff; z80.d = detemp >> 8; z80.e = detemp & 0xff;
 var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 bytetemp = (bytetemp + z80.a) & 0xff;
 z80.f = ( z80.f & ( 0x01 | 0x40 | 0x80 ) ) | ( (z80.c | (z80.b << 8)) ? 0x04 : 0 ) |
   ( bytetemp & 0x08 ) | ( (bytetemp & 0x02) ? 0x20 : 0 );
      }
      break;
    case 0xa1:
      {
 var value = memory[(z80.l | (z80.h << 8))], bytetemp = (z80.a - value) & 0xff,
   lookup = ( ( z80.a & 0x08 ) >> 3 ) |
            ( ( (value) & 0x08 ) >> 2 ) |
            ( ( bytetemp & 0x08 ) >> 1 );
 tstates += (3);; tstates += (1);; tstates += (1);; tstates += (1);;
 tstates += (1);; tstates += (1);;
 var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
 z80.f = ( z80.f & 0x01 ) | ( (z80.c | (z80.b << 8)) ? ( 0x04 | 0x02 ) : 0x02 ) |
   halfcarry_sub_table[lookup] | ( bytetemp ? 0 : 0x40 ) |
   ( bytetemp & 0x80 );
 if(z80.f & 0x10) bytetemp--;
 z80.f |= ( bytetemp & 0x08 ) | ( (bytetemp&0x02) ? 0x20 : 0 );
      }
      break;
    case 0xa2:
      {
 var initemp = readport( (z80.c | (z80.b << 8)) );
 tstates += 2; tstates += (3);; tstates += (3);;
 writebyte_internal((z80.l | (z80.h << 8)),initemp);
 z80.b = (z80.b-1)&0xff;
 var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 z80.f = (initemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
      }
      break;
    case 0xa3:
      {
 var outitemp=memory[(z80.l | (z80.h << 8))];
 z80.b = (z80.b-1)&0xff;
 tstates++; tstates += (4);; tstates += (3);;
 var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 writeport((z80.c | (z80.b << 8)),outitemp);
 z80.f = (outitemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
      }
      break;
    case 0xa8:
      {
 var bytetemp=memory[(z80.l | (z80.h << 8))];
 tstates += (3);; tstates += (3);; tstates += (1);; tstates += (1);;
 var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
 writebyte_internal((z80.e | (z80.d << 8)),bytetemp);
 var detemp = ((z80.e | (z80.d << 8)) - 1) & 0xffff; z80.d = detemp >> 8; z80.e = detemp & 0xff;
 var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 bytetemp = (bytetemp + z80.a) & 0xff;
 z80.f = ( z80.f & ( 0x01 | 0x40 | 0x80 ) ) | ( (z80.c | (z80.b << 8)) ? 0x04 : 0 ) |
   ( bytetemp & 0x08 ) | ( (bytetemp & 0x02) ? 0x20 : 0 );
      }
      break;
    case 0xa9:
      {
 var value = memory[(z80.l | (z80.h << 8))], bytetemp = (z80.a - value) & 0xff,
   lookup = ( ( z80.a & 0x08 ) >> 3 ) |
            ( ( (value) & 0x08 ) >> 2 ) |
            ( ( bytetemp & 0x08 ) >> 1 );
 tstates += (3);; tstates += (1);; tstates += (1);; tstates += (1);;
 tstates += (1);; tstates += (1);;
 var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
 z80.f = ( z80.f & 0x01 ) | ( (z80.c | (z80.b << 8)) ? ( 0x04 | 0x02 ) : 0x02 ) |
   halfcarry_sub_table[lookup] | ( bytetemp ? 0 : 0x40 ) |
   ( bytetemp & 0x80 );
 if(z80.f & 0x10) bytetemp--;
 z80.f |= ( bytetemp & 0x08 ) | ( (bytetemp&0x02) ? 0x20 : 0 );
      }
      break;
    case 0xaa:
      {
 var initemp = readport( (z80.c | (z80.b << 8)) );
 tstates += 2; tstates += (3);; tstates += (3);;
 writebyte_internal((z80.l | (z80.h << 8)),initemp);
 z80.b = (z80.b-1)&0xff;
 var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 z80.f = (initemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
      }
      break;
    case 0xab:
      {
 var outitemp=memory[(z80.l | (z80.h << 8))];
 z80.b = (z80.b-1)&0xff;
 tstates++; tstates += (4);; tstates += (3);;
 var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 writeport((z80.c | (z80.b << 8)),outitemp);
 z80.f = (outitemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
      }
      break;
    case 0xb0:
      {
 var bytetemp=memory[(z80.l | (z80.h << 8))];
 tstates += (3);; tstates += (3);; tstates += (1);; tstates += (1);;
 writebyte_internal((z80.e | (z80.d << 8)),bytetemp);
 var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 var detemp = ((z80.e | (z80.d << 8)) + 1) & 0xffff; z80.d = detemp >> 8; z80.e = detemp & 0xff;
 var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
 bytetemp = (bytetemp + z80.a) & 0xff;
 z80.f = ( z80.f & ( 0x01 | 0x40 | 0x80 ) ) | ( (z80.c | (z80.b << 8)) ? 0x04 : 0 ) |
   ( bytetemp & 0x08 ) | ( (bytetemp & 0x02) ? 0x20 : 0 );
 if((z80.c | (z80.b << 8))) {
   tstates += (1);; tstates += (1);; tstates += (1);;
   tstates += (1);; tstates += (1);;
   z80.pc-=2;
 }
      }
      break;
    case 0xb1:
      {
 var value = memory[(z80.l | (z80.h << 8))], bytetemp = (z80.a - value) & 0xff,
   lookup = ( ( z80.a & 0x08 ) >> 3 ) |
     ( ( (value) & 0x08 ) >> 2 ) |
     ( ( bytetemp & 0x08 ) >> 1 );
 tstates += (3);; tstates += (1);; tstates += (1);; tstates += (1);;
 tstates += (1);; tstates += (1);;
 var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
 z80.f = ( z80.f & 0x01 ) | ( (z80.c | (z80.b << 8)) ? ( 0x04 | 0x02 ) : 0x02 ) |
   halfcarry_sub_table[lookup] | ( bytetemp ? 0 : 0x40 ) |
   ( bytetemp & 0x80 );
 if(z80.f & 0x10) bytetemp--;
 z80.f |= ( bytetemp & 0x08 ) | ( (bytetemp&0x02) ? 0x20 : 0 );
 if( ( z80.f & ( 0x04 | 0x40 ) ) == 0x04 ) {
   tstates += (1);; tstates += (1);; tstates += (1);;
   tstates += (1);; tstates += (1);;
   z80.pc-=2;
 }
      }
      break;
    case 0xb2:
      {
 var initemp=readport( (z80.c | (z80.b << 8)) );
 tstates += 2; tstates += (3);; tstates += (3);;
 writebyte_internal((z80.l | (z80.h << 8)),initemp);
 z80.b = (z80.b-1)&0xff;
 var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 z80.f = (initemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
 if(z80.b) {
   tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);;
   tstates += (1);;
   z80.pc-=2;
 }
      }
      break;
    case 0xb3:
      {
 var outitemp=memory[(z80.l | (z80.h << 8))];
 tstates++; tstates += (4);;
 z80.b = (z80.b-1)&0xff;
 var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 writeport((z80.c | (z80.b << 8)),outitemp);
 z80.f = (outitemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
 if(z80.b) {
   tstates += (1);;
   tstates += (1);; tstates += (1);; tstates += (1);;
   tstates += (1);; tstates += (1);; tstates += (1);;
   tstates += (1);;
   z80.pc-=2;
 } else {
   tstates += (3);;
 }
      }
      break;
    case 0xb8:
      {
 var bytetemp=memory[(z80.l | (z80.h << 8))];
 tstates += (3);; tstates += (3);; tstates += (1);; tstates += (1);;
 writebyte_internal((z80.e | (z80.d << 8)),bytetemp);
 var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 var detemp = ((z80.e | (z80.d << 8)) - 1) & 0xffff; z80.d = detemp >> 8; z80.e = detemp & 0xff;
 var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
 bytetemp = (bytetemp + z80.a) & 0xff;
 z80.f = ( z80.f & ( 0x01 | 0x40 | 0x80 ) ) | ( (z80.c | (z80.b << 8)) ? 0x04 : 0 ) |
   ( bytetemp & 0x08 ) | ( (bytetemp & 0x02) ? 0x20 : 0 );
 if((z80.c | (z80.b << 8))) {
   tstates += (1);; tstates += (1);; tstates += (1);;
   tstates += (1);; tstates += (1);;
   z80.pc-=2;
 }
      }
      break;
    case 0xb9:
      {
 var value = memory[(z80.l | (z80.h << 8))], bytetemp = (z80.a - value) & 0xff,
   lookup = ( ( z80.a & 0x08 ) >> 3 ) |
     ( ( (value) & 0x08 ) >> 2 ) |
     ( ( bytetemp & 0x08 ) >> 1 );
 tstates += (3);; tstates += (1);; tstates += (1);; tstates += (1);;
 tstates += (1);; tstates += (1);;
 var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
 z80.f = ( z80.f & 0x01 ) | ( (z80.c | (z80.b << 8)) ? ( 0x04 | 0x02 ) : 0x02 ) |
   halfcarry_sub_table[lookup] | ( bytetemp ? 0 : 0x40 ) |
   ( bytetemp & 0x80 );
 if(z80.f & 0x10) bytetemp--;
 z80.f |= ( bytetemp & 0x08 ) | ( (bytetemp&0x02) ? 0x20 : 0 );
 if( ( z80.f & ( 0x04 | 0x40 ) ) == 0x04 ) {
   tstates += (1);; tstates += (1);; tstates += (1);;
   tstates += (1);; tstates += (1);;
   z80.pc-=2;
 }
      }
      break;
    case 0xba:
      {
 var initemp=readport( (z80.c | (z80.b << 8)) );
 tstates += 2; tstates += (3);; tstates += (3);;
 writebyte_internal((z80.l | (z80.h << 8)),initemp);
 z80.b = (z80.b-1)&0xff;
 var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 z80.f = (initemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
 if(z80.b) {
   tstates += (1);; tstates += (1);; tstates += (1);; tstates += (1);;
   tstates += (1);;
   z80.pc-=2;
 }
      }
      break;
    case 0xbb:
      {
 var outitemp=memory[(z80.l | (z80.h << 8))];
 tstates++; tstates += (4);;
 z80.b = (z80.b-1)&0xff;
 var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
 writeport((z80.c | (z80.b << 8)),outitemp);
 z80.f = (outitemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
 if(z80.b) {
   tstates += (1);;
   tstates += (1);; tstates += (1);; tstates += (1);;
   tstates += (1);; tstates += (1);; tstates += (1);;
   tstates += (1);;
   z80.pc-=2;
 } else {
   tstates += (3);;
 }
      }
      break;
    default:
      break;
 }
      }
      break;
    case 0xee:
      tstates += (3);;
      {
 var bytetemp = memory[z80.pc++];
 { z80.a ^= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xef:
      tstates++;
      { { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x28);};
      break;
    case 0xf0:
      tstates++;
      if( ! ( z80.f & 0x80 ) ) { { { tstates += (3);; var lowbyte =memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; var highbyte=memory[z80.sp++]; z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xf1:
      { tstates += (3);; (z80.f)=memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; (z80.a)=memory[z80.sp++]; z80.sp &= 0xffff;};
      break;
    case 0xf2:
      tstates += (3);; tstates += (3);;
      if( ! ( z80.f & 0x80 ) ) { { var jptemp=z80.pc; var pcl =memory[jptemp++]; jptemp &= 0xffff; var pch =memory[jptemp]; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xf3:
      z80.iff1=z80.iff2=0;
      break;
    case 0xf4:
      tstates += (3);; tstates += (3);;
      if( ! ( z80.f & 0x80 ) ) { { var calltempl, calltemph; calltempl=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (1);; calltemph=memory[z80.pc++]; z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xf5:
      tstates++;
      { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.a)); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.f));};
      break;
    case 0xf6:
      tstates += (3);;
      {
 var bytetemp = memory[z80.pc++];
 { z80.a |= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xf7:
      tstates++;
      { { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x30);};
      break;
    case 0xf8:
      tstates++;
      if( z80.f & 0x80 ) { { { tstates += (3);; var lowbyte =memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; var highbyte=memory[z80.sp++]; z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xf9:
      tstates += 2;
      z80.sp=(z80.l | (z80.h << 8));
      break;
    case 0xfa:
      tstates += (3);; tstates += (3);;
      if( z80.f & 0x80 ) { { var jptemp=z80.pc; var pcl =memory[jptemp++]; jptemp &= 0xffff; var pch =memory[jptemp]; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xfb:
      z80.iff1=z80.iff2=1;
      break;
    case 0xfc:
      tstates += (3);; tstates += (3);;
      if( z80.f & 0x80 ) { { var calltempl, calltemph; calltempl=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (1);; calltemph=memory[z80.pc++]; z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xfd:
      {
 var opcode2;
 tstates += (4);;
 opcode2 = memory[z80.pc++];
 z80.pc &= 0xffff;
 z80.r = (z80.r+1) & 0x7f;
 switch(opcode2) {
    case 0x09:
      { var add16temp = ((z80.iyl | (z80.iyh << 8))) + ((z80.c | (z80.b << 8))); var lookup = ( ( ((z80.iyl | (z80.iyh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.c | (z80.b << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.iyh) = (add16temp >> 8) & 0xff; (z80.iyl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x19:
      { var add16temp = ((z80.iyl | (z80.iyh << 8))) + ((z80.e | (z80.d << 8))); var lookup = ( ( ((z80.iyl | (z80.iyh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.e | (z80.d << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.iyh) = (add16temp >> 8) & 0xff; (z80.iyl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x21:
      tstates += (3);;
      z80.iyl=memory[z80.pc++];
      z80.pc &= 0xffff;
      tstates += (3);;
      z80.iyh=memory[z80.pc++];
      z80.pc &= 0xffff;
      break;
    case 0x22:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; writebyte_internal(ldtemp++,(z80.iyl)); ldtemp &= 0xffff; tstates += (3);; writebyte_internal(ldtemp,(z80.iyh)); break;};
      break;
    case 0x23:
      tstates += 2;
      var wordtemp = ((z80.iyl | (z80.iyh << 8)) + 1) & 0xffff;
      z80.iyh = wordtemp >> 8;
      z80.iyl = wordtemp & 0xff;
      break;
    case 0x24:
      { (z80.iyh) = ((z80.iyh) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.iyh)==0x80 ? 0x04 : 0 ) | ( (z80.iyh)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.iyh)];};
      break;
    case 0x25:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.iyh)&0x0f ? 0 : 0x10 ) | 0x02; (z80.iyh) = ((z80.iyh) - 1) & 0xff; z80.f |= ( (z80.iyh)==0x7f ? 0x04 : 0 ) | sz53_table[z80.iyh];};
      break;
    case 0x26:
      tstates += (3);;
      z80.iyh=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x29:
      { var add16temp = ((z80.iyl | (z80.iyh << 8))) + ((z80.iyl | (z80.iyh << 8))); var lookup = ( ( ((z80.iyl | (z80.iyh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.iyl | (z80.iyh << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.iyh) = (add16temp >> 8) & 0xff; (z80.iyl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x2a:
      { var ldtemp; tstates += (3);; ldtemp=memory[z80.pc++]; z80.pc &= 0xffff; tstates += (3);; ldtemp|=memory[z80.pc++] << 8; z80.pc &= 0xffff; tstates += (3);; (z80.iyl)=memory[ldtemp++]; ldtemp &= 0xffff; tstates += (3);; (z80.iyh)=memory[ldtemp]; break;};
      break;
    case 0x2b:
      tstates += 2;
      var wordtemp = ((z80.iyl | (z80.iyh << 8)) - 1) & 0xffff;
      z80.iyh = wordtemp >> 8;
      z80.iyl = wordtemp & 0xff;
      break;
    case 0x2c:
      { (z80.iyl) = ((z80.iyl) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.iyl)==0x80 ? 0x04 : 0 ) | ( (z80.iyl)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.iyl)];};
      break;
    case 0x2d:
      { z80.f = ( z80.f & 0x01 ) | ( (z80.iyl)&0x0f ? 0 : 0x10 ) | 0x02; (z80.iyl) = ((z80.iyl) - 1) & 0xff; z80.f |= ( (z80.iyl)==0x7f ? 0x04 : 0 ) | sz53_table[z80.iyl];};
      break;
    case 0x2e:
      tstates += (3);;
      z80.iyl=memory[z80.pc++]; z80.pc &= 0xffff;
      break;
    case 0x34:
      tstates += 15;
      {
 var wordtemp =
     ((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff;
 z80.pc &= 0xffff;
 var bytetemp = memory[wordtemp];
 { (bytetemp) = ((bytetemp) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (bytetemp)==0x80 ? 0x04 : 0 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | sz53_table[(bytetemp)];};
 writebyte_internal(wordtemp,bytetemp);
      }
      break;
    case 0x35:
      tstates += 15;
      {
 var wordtemp =
     ((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff;
 z80.pc &= 0xffff;
 var bytetemp = memory[wordtemp];
 { z80.f = ( z80.f & 0x01 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | 0x02; (bytetemp) = ((bytetemp) - 1) & 0xff; z80.f |= ( (bytetemp)==0x7f ? 0x04 : 0 ) | sz53_table[bytetemp];};
 writebyte_internal(wordtemp,bytetemp);
      }
      break;
    case 0x36:
      tstates += 11;
      {
 var wordtemp =
     ((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff;
 z80.pc &= 0xffff;
 writebyte_internal(wordtemp,memory[z80.pc++]);
 z80.pc &= 0xffff;
      }
      break;
    case 0x39:
      { var add16temp = ((z80.iyl | (z80.iyh << 8))) + (z80.sp); var lookup = ( ( ((z80.iyl | (z80.iyh << 8))) & 0x0800 ) >> 11 ) | ( ( (z80.sp) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); tstates += 7; (z80.iyh) = (add16temp >> 8) & 0xff; (z80.iyl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x44:
      z80.b=z80.iyh;
      break;
    case 0x45:
      z80.b=z80.iyl;
      break;
    case 0x46:
      tstates += 11;
      z80.b = memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x4c:
      z80.c=z80.iyh;
      break;
    case 0x4d:
      z80.c=z80.iyl;
      break;
    case 0x4e:
      tstates += 11;
      z80.c = memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x54:
      z80.d=z80.iyh;
      break;
    case 0x55:
      z80.d=z80.iyl;
      break;
    case 0x56:
      tstates += 11;
      z80.d = memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x5c:
      z80.e=z80.iyh;
      break;
    case 0x5d:
      z80.e=z80.iyl;
      break;
    case 0x5e:
      tstates += 11;
      z80.e = memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x60:
      z80.iyh=z80.b;
      break;
    case 0x61:
      z80.iyh=z80.c;
      break;
    case 0x62:
      z80.iyh=z80.d;
      break;
    case 0x63:
      z80.iyh=z80.e;
      break;
    case 0x64:
      break;
    case 0x65:
      z80.iyh=z80.iyl;
      break;
    case 0x66:
      tstates += 11;
      z80.h = memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x67:
      z80.iyh=z80.a;
      break;
    case 0x68:
      z80.iyl=z80.b;
      break;
    case 0x69:
      z80.iyl=z80.c;
      break;
    case 0x6a:
      z80.iyl=z80.d;
      break;
    case 0x6b:
      z80.iyl=z80.e;
      break;
    case 0x6c:
      z80.iyl=z80.iyh;
      break;
    case 0x6d:
      break;
    case 0x6e:
      tstates += 11;
      z80.l = memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x6f:
      z80.iyl=z80.a;
      break;
    case 0x70:
      tstates += 11;
      writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.b );
      z80.pc &= 0xffff;
      break;
    case 0x71:
      tstates += 11;
      writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.c );
      z80.pc &= 0xffff;
      break;
    case 0x72:
      tstates += 11;
      writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.d );
      z80.pc &= 0xffff;
      break;
    case 0x73:
      tstates += 11;
      writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.e );
      z80.pc &= 0xffff;
      break;
    case 0x74:
      tstates += 11;
      writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.h );
      z80.pc &= 0xffff;
      break;
    case 0x75:
      tstates += 11;
      writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.l );
      z80.pc &= 0xffff;
      break;
    case 0x77:
      tstates += 11;
      writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff, z80.a );
      z80.pc &= 0xffff;
      break;
    case 0x7c:
      z80.a=z80.iyh;
      break;
    case 0x7d:
      z80.a=z80.iyl;
      break;
    case 0x7e:
      tstates += 11;
      z80.a = memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
      z80.pc &= 0xffff;
      break;
    case 0x84:
      { var addtemp = z80.a + (z80.iyh); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyh) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x85:
      { var addtemp = z80.a + (z80.iyl); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyl) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x86:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { var addtemp = z80.a + (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x8c:
      { var adctemp = z80.a + (z80.iyh) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyh) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8d:
      { var adctemp = z80.a + (z80.iyl) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyl) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8e:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { var adctemp = z80.a + (bytetemp) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x94:
      { var subtemp = z80.a - (z80.iyh); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyh) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x95:
      { var subtemp = z80.a - (z80.iyl); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyl) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x96:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { var subtemp = z80.a - (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x9c:
      { var sbctemp = z80.a - (z80.iyh) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyh) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9d:
      { var sbctemp = z80.a - (z80.iyl) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyl) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9e:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { var sbctemp = z80.a - (bytetemp) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xa4:
      { z80.a &= (z80.iyh); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa5:
      { z80.a &= (z80.iyl); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa6:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { z80.a &= (bytetemp); z80.f = 0x10 | sz53p_table[z80.a];};
      }
      break;
    case 0xac:
      { z80.a ^= (z80.iyh); z80.f = sz53p_table[z80.a];};
      break;
    case 0xad:
      { z80.a ^= (z80.iyl); z80.f = sz53p_table[z80.a];};
      break;
    case 0xae:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { z80.a ^= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xb4:
      { z80.a |= (z80.iyh); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb5:
      { z80.a |= (z80.iyl); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb6:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { z80.a |= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xbc:
      { var cptemp = z80.a - z80.iyh; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyh) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.iyh & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbd:
      { var cptemp = z80.a - z80.iyl; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyl) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.iyl & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbe:
      tstates += 11;
      {
 var bytetemp =
     memory[((z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++])) & 0xffff];
     z80.pc &= 0xffff;
 { var cptemp = z80.a - bytetemp; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( bytetemp & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      }
      break;
    case 0xcb:
      {
 var tempaddr; var opcode3;
 tstates += (3);;
 tempaddr =
     (z80.iyl | (z80.iyh << 8)) + sign_extend(memory[z80.pc++]);
 z80.pc &= 0xffff;
 tstates += (4);;
 opcode3 = memory[z80.pc++];
 z80.pc &= 0xffff;
 switch(opcode3) {
    case 0x00:
      tstates += 8;
      z80.b=memory[tempaddr];
      { (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( (z80.b)>>7 ); z80.f = ( (z80.b) & 0x01 ) | sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x01:
      tstates += 8;
      z80.c=memory[tempaddr];
      { (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( (z80.c)>>7 ); z80.f = ( (z80.c) & 0x01 ) | sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x02:
      tstates += 8;
      z80.d=memory[tempaddr];
      { (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( (z80.d)>>7 ); z80.f = ( (z80.d) & 0x01 ) | sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x03:
      tstates += 8;
      z80.e=memory[tempaddr];
      { (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( (z80.e)>>7 ); z80.f = ( (z80.e) & 0x01 ) | sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x04:
      tstates += 8;
      z80.h=memory[tempaddr];
      { (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( (z80.h)>>7 ); z80.f = ( (z80.h) & 0x01 ) | sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x05:
      tstates += 8;
      z80.l=memory[tempaddr];
      { (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( (z80.l)>>7 ); z80.f = ( (z80.l) & 0x01 ) | sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x06:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( (bytetemp)>>7 ); z80.f = ( (bytetemp) & 0x01 ) | sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x07:
      tstates += 8;
      z80.a=memory[tempaddr];
      { (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( (z80.a)>>7 ); z80.f = ( (z80.a) & 0x01 ) | sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x08:
      tstates += 8;
      z80.b=memory[tempaddr];
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b)>>1 ) | ( ((z80.b) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x09:
      tstates += 8;
      z80.c=memory[tempaddr];
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c)>>1 ) | ( ((z80.c) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x0a:
      tstates += 8;
      z80.d=memory[tempaddr];
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d)>>1 ) | ( ((z80.d) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x0b:
      tstates += 8;
      z80.e=memory[tempaddr];
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e)>>1 ) | ( ((z80.e) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x0c:
      tstates += 8;
      z80.h=memory[tempaddr];
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h)>>1 ) | ( ((z80.h) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x0d:
      tstates += 8;
      z80.l=memory[tempaddr];
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l)>>1 ) | ( ((z80.l) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x0e:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp)>>1 ) | ( ((bytetemp) & 0x01)<<7 ); z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x0f:
      tstates += 8;
      z80.a=memory[tempaddr];
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a)>>1 ) | ( ((z80.a) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x10:
      tstates += 8;
      z80.b=memory[tempaddr];
      { var rltemp = (z80.b); (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x11:
      tstates += 8;
      z80.c=memory[tempaddr];
      { var rltemp = (z80.c); (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x12:
      tstates += 8;
      z80.d=memory[tempaddr];
      { var rltemp = (z80.d); (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x13:
      tstates += 8;
      z80.e=memory[tempaddr];
      { var rltemp = (z80.e); (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x14:
      tstates += 8;
      z80.h=memory[tempaddr];
      { var rltemp = (z80.h); (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x15:
      tstates += 8;
      z80.l=memory[tempaddr];
      { var rltemp = (z80.l); (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x16:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { var rltemp = (bytetemp); (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x17:
      tstates += 8;
      z80.a=memory[tempaddr];
      { var rltemp = (z80.a); (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x18:
      tstates += 8;
      z80.b=memory[tempaddr];
      { var rrtemp = (z80.b); (z80.b) = ( (z80.b)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x19:
      tstates += 8;
      z80.c=memory[tempaddr];
      { var rrtemp = (z80.c); (z80.c) = ( (z80.c)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x1a:
      tstates += 8;
      z80.d=memory[tempaddr];
      { var rrtemp = (z80.d); (z80.d) = ( (z80.d)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x1b:
      tstates += 8;
      z80.e=memory[tempaddr];
      { var rrtemp = (z80.e); (z80.e) = ( (z80.e)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x1c:
      tstates += 8;
      z80.h=memory[tempaddr];
      { var rrtemp = (z80.h); (z80.h) = ( (z80.h)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x1d:
      tstates += 8;
      z80.l=memory[tempaddr];
      { var rrtemp = (z80.l); (z80.l) = ( (z80.l)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x1e:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { var rrtemp = (bytetemp); (bytetemp) = ( (bytetemp)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x1f:
      tstates += 8;
      z80.a=memory[tempaddr];
      { var rrtemp = (z80.a); (z80.a) = ( (z80.a)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x20:
      tstates += 8;
      z80.b=memory[tempaddr];
      { z80.f = (z80.b) >> 7; (z80.b) <<= 1; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x21:
      tstates += 8;
      z80.c=memory[tempaddr];
      { z80.f = (z80.c) >> 7; (z80.c) <<= 1; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x22:
      tstates += 8;
      z80.d=memory[tempaddr];
      { z80.f = (z80.d) >> 7; (z80.d) <<= 1; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x23:
      tstates += 8;
      z80.e=memory[tempaddr];
      { z80.f = (z80.e) >> 7; (z80.e) <<= 1; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x24:
      tstates += 8;
      z80.h=memory[tempaddr];
      { z80.f = (z80.h) >> 7; (z80.h) <<= 1; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x25:
      tstates += 8;
      z80.l=memory[tempaddr];
      { z80.f = (z80.l) >> 7; (z80.l) <<= 1; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x26:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = (bytetemp) >> 7; (bytetemp) <<= 1; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x27:
      tstates += 8;
      z80.a=memory[tempaddr];
      { z80.f = (z80.a) >> 7; (z80.a) <<= 1; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x28:
      tstates += 8;
      z80.b=memory[tempaddr];
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b) & 0x80 ) | ( (z80.b) >> 1 ); z80.f |= sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x29:
      tstates += 8;
      z80.c=memory[tempaddr];
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c) & 0x80 ) | ( (z80.c) >> 1 ); z80.f |= sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x2a:
      tstates += 8;
      z80.d=memory[tempaddr];
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d) & 0x80 ) | ( (z80.d) >> 1 ); z80.f |= sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x2b:
      tstates += 8;
      z80.e=memory[tempaddr];
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e) & 0x80 ) | ( (z80.e) >> 1 ); z80.f |= sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x2c:
      tstates += 8;
      z80.h=memory[tempaddr];
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h) & 0x80 ) | ( (z80.h) >> 1 ); z80.f |= sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x2d:
      tstates += 8;
      z80.l=memory[tempaddr];
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l) & 0x80 ) | ( (z80.l) >> 1 ); z80.f |= sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x2e:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp) & 0x80 ) | ( (bytetemp) >> 1 ); z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x2f:
      tstates += 8;
      z80.a=memory[tempaddr];
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a) & 0x80 ) | ( (z80.a) >> 1 ); z80.f |= sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x30:
      tstates += 8;
      z80.b=memory[tempaddr];
      { z80.f = (z80.b) >> 7; (z80.b) = ( (z80.b) << 1 ) | 0x01; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x31:
      tstates += 8;
      z80.c=memory[tempaddr];
      { z80.f = (z80.c) >> 7; (z80.c) = ( (z80.c) << 1 ) | 0x01; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x32:
      tstates += 8;
      z80.d=memory[tempaddr];
      { z80.f = (z80.d) >> 7; (z80.d) = ( (z80.d) << 1 ) | 0x01; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x33:
      tstates += 8;
      z80.e=memory[tempaddr];
      { z80.f = (z80.e) >> 7; (z80.e) = ( (z80.e) << 1 ) | 0x01; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x34:
      tstates += 8;
      z80.h=memory[tempaddr];
      { z80.f = (z80.h) >> 7; (z80.h) = ( (z80.h) << 1 ) | 0x01; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x35:
      tstates += 8;
      z80.l=memory[tempaddr];
      { z80.f = (z80.l) >> 7; (z80.l) = ( (z80.l) << 1 ) | 0x01; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x36:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = (bytetemp) >> 7; (bytetemp) = ( (bytetemp) << 1 ) | 0x01; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x37:
      tstates += 8;
      z80.a=memory[tempaddr];
      { z80.f = (z80.a) >> 7; (z80.a) = ( (z80.a) << 1 ) | 0x01; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x38:
      tstates += 8;
      z80.b=memory[tempaddr];
      { z80.f = (z80.b) & 0x01; (z80.b) >>= 1; z80.f |= sz53p_table[(z80.b)];};
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x39:
      tstates += 8;
      z80.c=memory[tempaddr];
      { z80.f = (z80.c) & 0x01; (z80.c) >>= 1; z80.f |= sz53p_table[(z80.c)];};
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x3a:
      tstates += 8;
      z80.d=memory[tempaddr];
      { z80.f = (z80.d) & 0x01; (z80.d) >>= 1; z80.f |= sz53p_table[(z80.d)];};
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x3b:
      tstates += 8;
      z80.e=memory[tempaddr];
      { z80.f = (z80.e) & 0x01; (z80.e) >>= 1; z80.f |= sz53p_table[(z80.e)];};
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x3c:
      tstates += 8;
      z80.h=memory[tempaddr];
      { z80.f = (z80.h) & 0x01; (z80.h) >>= 1; z80.f |= sz53p_table[(z80.h)];};
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x3d:
      tstates += 8;
      z80.l=memory[tempaddr];
      { z80.f = (z80.l) & 0x01; (z80.l) >>= 1; z80.f |= sz53p_table[(z80.l)];};
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x3e:
      tstates += 8;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = (bytetemp) & 0x01; (bytetemp) >>= 1; z80.f |= sz53p_table[(bytetemp)];};
 writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x3f:
      tstates += 8;
      z80.a=memory[tempaddr];
      { z80.f = (z80.a) & 0x01; (z80.a) >>= 1; z80.f |= sz53p_table[(z80.a)];};
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x40:
    case 0x41:
    case 0x42:
    case 0x43:
    case 0x44:
    case 0x45:
    case 0x46:
    case 0x47:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40; if( (0) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x48:
    case 0x49:
    case 0x4a:
    case 0x4b:
    case 0x4c:
    case 0x4d:
    case 0x4e:
    case 0x4f:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40; if( (1) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x50:
    case 0x51:
    case 0x52:
    case 0x53:
    case 0x54:
    case 0x55:
    case 0x56:
    case 0x57:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40; if( (2) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x58:
    case 0x59:
    case 0x5a:
    case 0x5b:
    case 0x5c:
    case 0x5d:
    case 0x5e:
    case 0x5f:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40; if( (3) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x60:
    case 0x61:
    case 0x62:
    case 0x63:
    case 0x64:
    case 0x65:
    case 0x66:
    case 0x67:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40; if( (4) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x68:
    case 0x69:
    case 0x6a:
    case 0x6b:
    case 0x6c:
    case 0x6d:
    case 0x6e:
    case 0x6f:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40; if( (5) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x70:
    case 0x71:
    case 0x72:
    case 0x73:
    case 0x74:
    case 0x75:
    case 0x76:
    case 0x77:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40; if( (6) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x78:
    case 0x79:
    case 0x7a:
    case 0x7b:
    case 0x7c:
    case 0x7d:
    case 0x7e:
    case 0x7f:
      tstates += 5;
      {
 var bytetemp = memory[tempaddr];
 { z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) ); if( ! ( (bytetemp) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40; if( (7) == 7 && (bytetemp) & 0x80 ) z80.f |= 0x80; };
      }
      break;
    case 0x80:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x81:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x82:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x83:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x84:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x85:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x86:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xfe);
      break;
    case 0x87:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xfe;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x88:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x89:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x8a:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x8b:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x8c:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x8d:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x8e:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xfd);
      break;
    case 0x8f:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xfd;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x90:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x91:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x92:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x93:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x94:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x95:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x96:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xfb);
      break;
    case 0x97:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xfb;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0x98:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0x99:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0x9a:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0x9b:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0x9c:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0x9d:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0x9e:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xf7);
      break;
    case 0x9f:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xf7;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xa0:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xa1:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xa2:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xa3:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xa4:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xa5:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xa6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xef);
      break;
    case 0xa7:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xef;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xa8:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xa9:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xaa:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xab:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xac:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xad:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xae:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xdf);
      break;
    case 0xaf:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xdf;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xb0:
      tstates += 8;
      z80.b=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xb1:
      tstates += 8;
      z80.c=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xb2:
      tstates += 8;
      z80.d=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xb3:
      tstates += 8;
      z80.e=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xb4:
      tstates += 8;
      z80.h=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xb5:
      tstates += 8;
      z80.l=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xb6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0xbf);
      break;
    case 0xb7:
      tstates += 8;
      z80.a=memory[tempaddr] & 0xbf;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xb8:
      tstates += 8;
      z80.b=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xb9:
      tstates += 8;
      z80.c=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xba:
      tstates += 8;
      z80.d=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xbb:
      tstates += 8;
      z80.e=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xbc:
      tstates += 8;
      z80.h=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xbd:
      tstates += 8;
      z80.l=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xbe:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] & 0x7f);
      break;
    case 0xbf:
      tstates += 8;
      z80.a=memory[tempaddr] & 0x7f;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xc0:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xc1:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xc2:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xc3:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xc4:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xc5:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xc6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x01);
      break;
    case 0xc7:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x01;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xc8:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xc9:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xca:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xcb:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xcc:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xcd:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xce:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x02);
      break;
    case 0xcf:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x02;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xd0:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xd1:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xd2:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xd3:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xd4:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xd5:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xd6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x04);
      break;
    case 0xd7:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x04;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xd8:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xd9:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xda:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xdb:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xdc:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xdd:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xde:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x08);
      break;
    case 0xdf:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x08;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xe0:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xe1:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xe2:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xe3:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xe4:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xe5:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xe6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x10);
      break;
    case 0xe7:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x10;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xe8:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xe9:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xea:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xeb:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xec:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xed:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xee:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x20);
      break;
    case 0xef:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x20;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xf0:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xf1:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xf2:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xf3:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xf4:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xf5:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xf6:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x40);
      break;
    case 0xf7:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x40;
      writebyte_internal(tempaddr, z80.a);
      break;
    case 0xf8:
      tstates += 8;
      z80.b=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.b);
      break;
    case 0xf9:
      tstates += 8;
      z80.c=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.c);
      break;
    case 0xfa:
      tstates += 8;
      z80.d=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.d);
      break;
    case 0xfb:
      tstates += 8;
      z80.e=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.e);
      break;
    case 0xfc:
      tstates += 8;
      z80.h=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.h);
      break;
    case 0xfd:
      tstates += 8;
      z80.l=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.l);
      break;
    case 0xfe:
      tstates += 8;
      writebyte_internal(tempaddr, memory[tempaddr] | 0x80);
      break;
    case 0xff:
      tstates += 8;
      z80.a=memory[tempaddr] | 0x80;
      writebyte_internal(tempaddr, z80.a);
      break;
 }
      }
      break;
    case 0xe1:
      { tstates += (3);; (z80.iyl)=memory[z80.sp++]; z80.sp &= 0xffff; tstates += (3);; (z80.iyh)=memory[z80.sp++]; z80.sp &= 0xffff;};
      break;
    case 0xe3:
      {
 var bytetempl = memory[z80.sp],
                  bytetemph = memory[z80.sp + 1];
 tstates += (3);; tstates += (4);;
 tstates += (3);; tstates += (5);;
 writebyte_internal(z80.sp+1,z80.iyh); writebyte_internal(z80.sp,z80.iyl);
 z80.iyl=bytetempl; z80.iyh=bytetemph;
      }
      break;
    case 0xe5:
      tstates++;
      { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.iyh)); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.iyl));};
      break;
    case 0xe9:
      z80.pc=(z80.iyl | (z80.iyh << 8));
      break;
    case 0xf9:
      tstates += 2;
      z80.sp=(z80.iyl | (z80.iyh << 8));
      break;
    default:
      z80.pc--;
      z80.pc &= 0xffff;
      z80.r--;
      z80.r &= 0x7f;
      break;
 }
      }
      break;
    case 0xfe:
      tstates += (3);;
      {
 var bytetemp = memory[z80.pc++];
 { var cptemp = z80.a - bytetemp; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( bytetemp & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      }
      break;
    case 0xff:
      tstates++;
      { { z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; tstates += (3);; writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x38);};
      break;
    }
  }
}
