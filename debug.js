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
        var addr = startingPoint;
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

function step() {
    var curpc = z80.pc;
    for (var i = 0; i < 65536; i++) {
        tstates = 0;
        event_next_event = 1;
        z80_do_opcodes();
        if (z80.pc != curpc) break;
    }
    updateDebug();
}
