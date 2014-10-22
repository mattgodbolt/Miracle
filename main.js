var tstates = 0;
var running;
var event_next_event;
var breakpointHit = false;

function loadRomData(name) {
    "use strict";
    var path = "roms/" + name;
    console.log("Loading ROM from " + path);
    var request = new XMLHttpRequest();
    request.open("GET", path, false);
    request.overrideMimeType('text/plain; charset=x-user-defined');
    request.send(null);
    if (request.status != 200) return [];
    return request.response;
}

function addRomToList(rom) {
    $('#rom_list .template')
        .clone()
        .removeClass('template')
        .text(rom)
        .click(function () {
            miracle_reset();
            loadRom(rom, loadRomData(rom));
            hideRomChooser();
            start();
        })
        .appendTo('#rom_list');
}

function go() {
    var i;
    hideRomChooser();
    hideAbout();
    for (i = 0; i < RomList.length; ++i) {
        addRomToList(RomList[i]);
    }
    var disass = $('#disassembly');
    for (i = 0; i < 32; i++) {
        disass.find('.template').clone().removeClass('template').appendTo(disass);
    }
    var vdp = $('#vdp_registers');
    for (i = 0; i < 11; i++) {
        vdp.find('.template').clone().removeClass('template').appendTo(vdp).find('.register').text('v' + i);
    }
    disass.find('.template').remove();
    $('#menu button').each(function () {
        var f = window[$(this).attr('class').match(/menu_(.*)/)[1]];
        $(this).click(f);
    });
    z80_init();
    miracle_init();
    miracle_reset();
    const defaultRom = getDefaultRom();
    loadRom(defaultRom, loadRomData(defaultRom));
    start();
}

function getDefaultRom() {
    if (typeof(localStorage) !== "undefined" && localStorage.rom) return localStorage.rom;
    return 'SonicTheHedgehog.sms';
}

function showRomChooser() {
    $('#rom_chooser').show();
}

function hideRomChooser() {
    $('#rom_chooser').hide();
}

function showAbout() {
    $('#about').show();
}

function hideAbout() {
    $('#about').hide();
}

$(function () {
    go();
});
