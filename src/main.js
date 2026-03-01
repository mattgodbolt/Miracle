import { RomList } from "./roms";
import { z80_init } from "./z80/z80.js";
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
  const template = document.querySelector("#rom_list .template");
  const item = template.cloneNode(true);
  item.classList.remove("template");
  item.textContent = rom;
  item.addEventListener("click", () => resetLoadAndStart(rom, loadRomData(rom)));
  document.getElementById("rom_list").appendChild(item);
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

  document.getElementById("file_upload").addEventListener("change", function (e) {
    const files = e.target.files;
    if (files && files.length) {
      loadUploadFile(files[0]);
    }
  });

  for (i = 0; i < RomList.length; ++i) {
    addRomToList(RomList[i]);
  }

  const disass = document.getElementById("disassembly");
  const dissTemplate = disass.querySelector(".template");
  for (i = 0; i < 32; i++) {
    const item = dissTemplate.cloneNode(true);
    item.classList.remove("template");
    disass.appendChild(item);
  }
  dissTemplate.remove();

  const vdp = document.getElementById("vdp_registers");
  const vdpTemplate = vdp.querySelector(".template");
  for (i = 0; i < 11; i++) {
    const item = vdpTemplate.cloneNode(true);
    item.classList.remove("template");
    item.querySelector(".register").textContent = "v" + i;
    vdp.appendChild(item);
  }

  document.querySelectorAll(".menu_start").forEach(el => el.addEventListener("click", () => start()));
  document.querySelectorAll(".menu_stop").forEach(el => el.addEventListener("click", () => stop()));
  document.querySelectorAll(".menu_step").forEach(el => el.addEventListener("click", () => step()));
  document.querySelectorAll(".menu_stepOver").forEach(el => el.addEventListener("click", () => stepOver()));
  document.querySelectorAll(".menu_stepOut").forEach(el => el.addEventListener("click", () => stepOut()));
  document.querySelectorAll(".menu_reset").forEach(el => el.addEventListener("click", () => miracle_reset()));
  document.querySelectorAll(".menu_showRomChooser").forEach(el => el.addEventListener("click", () => showRomChooser()));
  document.querySelectorAll(".menu_showAbout").forEach(el => el.addEventListener("click", () => showAbout()));

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
  document.getElementById("rom_chooser").style.display = "";
}

function clearFileUploadElement() {
  document.getElementById("file_upload").value = "";
}

function hideRomChooser() {
  document.getElementById("rom_chooser").style.display = "none";
  clearFileUploadElement();
}

function showAbout() {
  document.getElementById("about").style.display = "";
}

function hideAbout() {
  document.getElementById("about").style.display = "none";
}

// Modules are deferred by default; DOM is ready when this executes.
document.getElementById("hideRomChooser").addEventListener("click", hideRomChooser);
document.getElementById("hideAbout").addEventListener("click", hideAbout);
go();
