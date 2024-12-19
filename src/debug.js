import $ from "jquery";
import {
  clearBreakpoint,
  romBanks,
  hexbyte,
  hexword,
  readbyte,
  virtualAddress,
  audio_enable,
  cycleCallback,
  start,
  pages,
} from "./miracle";
import { z80 } from "./z80/z80_full";
import { z80_do_opcodes } from "./z80/z80_ops_full";
import { disassemble } from "./z80/z80_dis";
import { vdp_regs } from "./vdp";
import { setEventNextEvent, setTstates } from "./z80/z80_ops_full";

var debugSerial = 0;
var annotations = null;

export function debug_init(romName) {
  debugSerial = (romBanks[1][0x3ffc] << 8) | romBanks[1][0x3ffd];

  if (!localStorage[debugSerial]) {
    annotations = { romName: romName, labels: {} };
  } else {
    annotations = JSON.parse(localStorage[debugSerial]);
  }

  console.log(
    "Debug initialised for " + romName + " serial 0x" + hexword(debugSerial),
    annotations,
  );
}

// function persistAnnotations() {
//   localStorage[debugSerial] = JSON.stringify(annotations);
// }

// function setLabel(virtual, name) {
//   if (!name || name.match(/^[0-9]/)) {
//     delete annotations.labels[virtual];
//   } else {
//     annotations.labels[virtual] = name;
//   }
//   persistAnnotations();
//   updateDebug();
// }

function addressName(addr) {
  var virtual = virtualAddress(addr);
  if (annotations.labels[virtual]) {
    return (
      '<span class="addr label" title="' +
      hexword(addr) +
      '">' +
      annotations.labels[virtual] +
      "</span>"
    );
  }
  return null;
}

export function addressHtml(addr) {
  var name = addressName(addr);
  if (name) {
    return name + " (0x" + hexword(addr) + ")";
  } else {
    return '<span class="addr">0x' + hexword(addr) + "</span>";
  }
}

function labelHtml(addr) {
  var name = addressName(addr);
  if (name) {
    return name + ":";
  } else {
    return '<span class="addr">' + hexword(addr) + "</span>";
  }
}

// TODO(#18) reinstate
// function endLabelEdit(content) {
//   var addr = $(this).attr("title") || content.previous;
//   var virtual = virtualAddress(parseInt(addr, 16));
//   setLabel(virtual, content.current);
// }

var disassPc = 0;

function updateDisassembly(address) {
  var disass = $("#disassembly");
  disassPc = address;
  disass.children().each(function () {
    var result = disassemble(address);
    var hex = "";
    for (var i = address; i < result[1]; ++i) {
      if (hex !== "") hex += " ";
      hex += hexbyte(readbyte(i));
    }
    $(this).find(".dis_addr").html(labelHtml(address));
    $(this).toggleClass("current", address === z80.pc);
    $(this).find(".instr_bytes").text(hex);
    $(this).find(".disassembly").html(result[0]);
    // TODO(#18) re-enable this once there's a solution
    // $(this).find('.addr')
    //     .editable({editBy: 'dblclick', editClass: 'editable', onSubmit: endLabelEdit})
    //     .keypress(function (e) {
    //         if (e.which === 13) $(this).blur();
    //     });
    address = result[1];
  });
}

function prevInstruction(address) {
  for (
    var startingPoint = address - 20;
    startingPoint !== address;
    startingPoint++
  ) {
    var addr = startingPoint & 0xffff;
    while (addr < address) {
      var result = disassemble(addr);
      if (result[1] === address) {
        return addr;
      }
      addr = result[1];
    }
  }
  return 0;
}

function nextInstruction(address) {
  return disassemble(address)[1] & 0xffff;
}

function updateElement(elem, newVal) {
  elem.toggleClass("changed", newVal !== elem.text()).text(newVal);
}

function updateFlags(f) {
  var string = "cnp_h_zs";
  for (var i = 0; i < 8; ++i) {
    var r = string[i];
    var elem = $("#z80_flag_" + r);
    if (f & 1) {
      r = r.toUpperCase();
    }
    if (elem) {
      updateElement(elem, r);
    }
    f >>= 1;
  }
}

export function showDebug(pc) {
  $("#debug").show(200);
  for (var i = 0; i < $("#disassembly").children().length / 2; i++) {
    pc = prevInstruction(pc);
  }
  updateDebug(pc);
}

function updateDebug(pcOrNone) {
  if (pcOrNone === null) {
    pcOrNone = disassPc;
  }
  updateDisassembly(pcOrNone);
  for (var reg in z80) {
    var elem = $("#z80_" + reg);
    if (elem) {
      if (
        reg.length > 1 &&
        reg[reg.length - 1] !== "h" &&
        reg[reg.length - 1] !== "l"
      ) {
        updateElement(elem, hexword(z80[reg]));
      } else {
        updateElement(elem, hexbyte(z80[reg]));
      }
    }
  }
  var i = 0;
  $("#vdp_registers > div:visible .value").each(function () {
    updateElement($(this), hexbyte(vdp_regs[i++]));
  });
  i = 0;
  $("#pages .value").each(function () {
    updateElement($(this), hexbyte(pages[i++]));
  });
  updateFlags(z80.f);
}

export function stepUntil(f) {
  audio_enable(true);
  clearBreakpoint();
  for (var i = 0; i < 65536; i++) {
    setTstates(0);
    setEventNextEvent(1);
    z80_do_opcodes(cycleCallback);
    if (f()) break;
  }
  showDebug(z80.pc);
  audio_enable(false);
}

export function step() {
  var curpc = z80.pc;
  stepUntil(function () {
    return z80.pc !== curpc;
  });
}

function isUnconditionalJump(addr) {
  var result = disassemble(addr);
  return !!result[0].match(/^(JR 0x|JP|RET|RST)/);
}

export function stepOver() {
  if (isUnconditionalJump(z80.pc)) {
    return step();
  }
  var nextPc = nextInstruction(z80.pc);
  stepUntil(function () {
    return z80.pc === nextPc;
  });
}

function isReturn(addr) {
  var result = disassemble(addr);
  return !!result[0].match(/^RET/);
}

export function stepOut() {
  var sp = z80.sp;
  stepUntil(function () {
    if (z80.sp >= sp && isReturn(z80.pc)) {
      var nextInstr = nextInstruction(z80.pc);
      step();
      return z80.pc !== nextInstr;
    }
    return false;
  });
}

export function debugKeyPress(key) {
  if ($("input:visible").length) {
    return true;
  }
  var keyStr = String.fromCharCode(key);
  switch (keyStr) {
    case "k":
      updateDisassembly(prevInstruction(disassPc));
      break;
    case "j":
      updateDisassembly(nextInstruction(disassPc));
      break;
    case "n":
      step();
      break;
    case "m":
      stepOver();
      break;
    case "u":
      stepOut();
      break;
    case "g":
      start();
      break;
  }
  return true;
}
