import $ from "jquery";
import { RomList } from "./roms";
import { z80_init } from "./z80/z80_full";
import { miracle_init, miracle_reset, loadRom, start, stop } from "./miracle";
import { step, stepOver, stepOut } from "./debug";

function loadRomData(name) {
  "use strict";
  const path = "roms/" + name;
  console.log("Loading ROM from " + path);
  const request = new XMLHttpRequest();
  request.open("GET", path, false);
  request.overrideMimeType("text/plain; charset=x-user-defined");
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
  const reader = new FileReader();
  reader.onload = function () {
    resetLoadAndStart(file.name, reader.result);
  };
  reader.readAsBinaryString(file);
}

function addRomToList(rom) {
  $("#rom_list .template")
    .clone()
    .removeClass("template")
    .text(rom)
    .click(function () {
      resetLoadAndStart(rom, loadRomData(rom));
    })
    .appendTo("#rom_list");
}

function parseQuery() {
  const parsedQuery = {};

  const queryString =
    document.location.search.substring(1) +
    "&" +
    window.location.hash.substring(1);

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
  let i;
  hideRomChooser();
  hideAbout();

  const uploadElem = $("#file_upload");
  uploadElem.change(function (e) {
    const files = e.target.files;
    if (files && files.length) {
      loadUploadFile(files[0]);
    }
  });

  for (i = 0; i < RomList.length; ++i) {
    addRomToList(RomList[i]);
  }
  const disass = $("#disassembly");
  for (i = 0; i < 32; i++) {
    disass.find(".template").clone().removeClass("template").appendTo(disass);
  }
  const vdp = $("#vdp_registers");
  for (i = 0; i < 11; i++) {
    vdp
      .find(".template")
      .clone()
      .removeClass("template")
      .appendTo(vdp)
      .find(".register")
      .text("v" + i);
  }
  disass.find(".template").remove();
  $(".menu_start").on("click", () => start());
  $(".menu_stop").on("click", () => stop());
  $(".menu_step").on("click", () => step());
  $(".menu_stepOver").on("click", () => stepOver());
  $(".menu_stepOut").on("click", () => stepOut());
  $(".menu_reset").on("click", () => miracle_reset());
  $(".menu_showRomChooser").on("click", () => showRomChooser());
  $(".menu_showAbout").on("click", () => showAbout());
  z80_init();
  miracle_init();
  miracle_reset();

  const parsedQuery = parseQuery();
  if (parsedQuery["b64sms"]) {
    loadRom("b64.sms", atob(parsedQuery["b64sms"]));
  } else {
    const defaultRom = getDefaultRom();
    loadRom(defaultRom, loadRomData(defaultRom));
  }

  start();
}

function getDefaultRom() {
  if (typeof localStorage !== "undefined" && localStorage.rom)
    return localStorage.rom;
  return "SonicTheHedgehog.sms";
}

function showRomChooser() {
  $("#rom_chooser").show();
}

function clearFileUploadElement() {
  const uploadElem = $("#file_upload")[0];
  uploadElem.value = "";
}

function hideRomChooser() {
  $("#rom_chooser").hide();
  clearFileUploadElement();
}
$("#hideRomChooser").on("click", hideRomChooser);

function showAbout() {
  $("#about").show();
}

function hideAbout() {
  $("#about").hide();
}
$("#hideAbout").on("click", hideAbout);

$(function () {
  go();
});
