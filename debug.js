function updateDisassembly(address) {
    var disass = $('#disassembly');
    disass.children().each(function() {
        var result = disassemble(address);
        $(this).find('.addr').text(hexword(address));
        $(this).toggleClass('current', address == z80.pc);
        $(this).find('.disassembly').text(result[0]);
        address = result[1];
    });
}

function prevInstruction(address) {
    for (var startingPoint = address - 20; startingPoint != address; startingPoint++) {
        var addr = startingPoint & 0xffff;
        while (addr < address) {
            var result = disassemble(addr);
            if (result[1] == address) {
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

function updateDebug() {
    $('#debug').removeClass('hidden');
    var disassPc = z80.pc;
    for (var i = 0; i < $('#disassembly').children().length / 2; i++) {
        disassPc = prevInstruction(disassPc);
    }
    updateDisassembly(disassPc);
    for (var reg in z80) {
        var elem = $('#z80_' + reg);
        if (elem) {
            var newVal = '';
            if (reg.length > 1 && reg[reg.length-1] != 'h'
                    && reg[reg.length-1] != 'l') {
                newVal = hexword(z80[reg]);
            } else {
                newVal = hexbyte(z80[reg]);
            }
            elem.toggleClass('changed', newVal != elem.text()).text(newVal);
        }
    }
}

function stepUntil(f) {
    for (var i = 0; i < 65536; i++) {
        tstates = 0;
        event_next_event = 1;
        z80_do_opcodes();
        if (f()) break;
    }
    updateDebug();
}

function step() {
    var curpc = z80.pc;
    stepUntil(function () { return z80.pc != curpc; });
}

function isUnconditionalJump(addr) {
    var result = disassemble(addr);
    if (result[0].match(/^JMP|RET/)) {
        return true;
    }
    return false;
}

function stepOver() {
    if (isUnconditionalJump(z80.pc)) {
        return step();
    }
    var sp = z80.sp;
    var nextPc = nextInstruction(z80.pc);
    stepUntil(function () { return z80.pc == nextPc || z80.sp == sp; });
}

function stepOut() {
    var sp = z80.sp;
    // TODO: this isn't very good really...it catches POP etc.
    stepUntil(function () { return z80.sp > sp; });
}

function currentDis() {
    return parseInt($('#disassembly .addr').first().text(), 16);
}

function debugKeyPress(key) {
    var keyStr = String.fromCharCode(key);
    switch (keyStr) {
    case 'k':
        updateDisassembly(prevInstruction(currentDis()));
        break;
    case 'j':
        updateDisassembly(nextInstruction(currentDis()));
        break;
    case 'n':
        step();
        break;
    case 'm':
        stepOver();
        break;
    case 'u':
        stepOut();
        break;
    case 'g':
        start();
        break;
    }
    //console.log(key);
}

