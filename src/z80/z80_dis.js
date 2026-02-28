/* eslint-disable */
import { hexbyte, readbyte } from "../miracle";
import { addressHtml } from "../debug";
import { sign_extend } from "./z80_ops.js";

// Runtime register-name variable for DD/FD disassembly.
// Set to "IX" or "IY" before entering the relevant switch.
var dis_REGISTER;

export function disassemble(address) {
  const opcode = readbyte(address);
  address++;
  var res = "??";
  switch (opcode) {
    /* @z80-dis-generate opcodes_base.dat */
  }
  return [res, address];
}

function disassemble_CB(address) {
  const opcode = readbyte(address);
  address++;
  var res = "??";
  switch (opcode) {
    /* @z80-dis-generate opcodes_cb.dat */
  }
  return [res, address];
}

function disassemble_ED(address) {
  const opcode = readbyte(address);
  address++;
  var res = "??";
  switch (opcode) {
    /* @z80-dis-generate opcodes_ed.dat */
  }
  return [res, address];
}

function disassemble_DD(address) {
  const opcode = readbyte(address);
  address++;
  var res = "??";
  dis_REGISTER = "IX";
  switch (opcode) {
    /* @z80-dis-generate opcodes_ddfd.dat */
  }
  return [res, address];
}

function disassemble_FD(address) {
  const opcode = readbyte(address);
  address++;
  var res = "??";
  dis_REGISTER = "IY";
  switch (opcode) {
    /* @z80-dis-generate opcodes_ddfd.dat */
  }
  return [res, address];
}

function disassemble_DDFDCB(address) {
  const opcode = readbyte(address);
  address++;
  var res = "??";
  switch (opcode) {
    /* @z80-dis-generate opcodes_ddfdcb.dat */
  }
  return [res, address];
}
