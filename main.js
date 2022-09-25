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
    if (request.status !== 200) return [];
    return request.response;
}

function resetLoadAndStart(filename, romdata) {
    miracle_reset();
    loadRom(filename, romdata);
    hideRomChooser();
    start();
}

function loadUploadFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
        resetLoadAndStart(file.name, reader.result);
    };
    reader.readAsBinaryString(file);
}

function addRomToList(rom) {
    $('#rom_list .template')
        .clone()
        .removeClass('template')
        .text(rom)
        .click(function () {
            resetLoadAndStart(rom, loadRomData(rom));
        })
        .appendTo('#rom_list');
}

function parseQuery() {
    const parsedQuery = {};

    let queryString = document.location.search.substring(1) + "&" + window.location.hash.substring(1);

    queryString.split("&").forEach(function (keyval) {
        const keyAndVal = keyval.split("=");
        const key = decodeURIComponent(keyAndVal[0]);

        let val = null;
        if (keyAndVal.length > 1) val = decodeURIComponent(keyAndVal[1]);
        parsedQuery[key] = val;
    });

    return parsedQuery;
}

function go() {
    var i;
    hideRomChooser();
    hideAbout();

    var uploadElem = $('#file_upload');
    uploadElem.change(function (e) {
        var files = e.target.files;
        if (files && files.length) {
            loadUploadFile(files[0]);
        }
    });

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

    const parsedQuery = parseQuery();
    if (parsedQuery['b64sms']) {
        loadRom('b64.sms', atob(parsedQuery['b64sms']));
    } else {
        const defaultRom = getDefaultRom();
        loadRom(defaultRom, loadRomData(defaultRom));
    }

    start();
}

function getDefaultRom() {
    if (typeof (localStorage) !== "undefined" && localStorage.rom) return localStorage.rom;
    return 'SonicTheHedgehog.sms';
}

function showRomChooser() {
    $('#rom_chooser').show();
}

function clearFileUploadElement() {
    var uploadElem = $('#file_upload')[0];
    uploadElem.value = '';
}

function hideRomChooser() {
    $('#rom_chooser').hide();
    clearFileUploadElement();
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
