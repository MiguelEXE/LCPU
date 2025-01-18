import * as monaco from "monaco-editor";
import { Processor } from "./processor";
import { ROM_ARRAY, RAM_ARRAY } from "./memory";
import {compile, decompile} from "./compiler";

const rom = new ROM_ARRAY();
const ram = new RAM_ARRAY();
const cpu = new Processor(rom, ram);
cpu.reset(true);

let global_labels: {[k: string]: number} = {};

const statusInfo = document.querySelector("#status") as HTMLParagraphElement;
const ramViewer = document.querySelector("#ram-viewer") as Element;
const regel = document.querySelectorAll("#rvalues td") as NodeListOf<Element>;
const sregsEl = document.querySelectorAll("#srvalues td");
const registersTable = document.querySelector("#registers") as HTMLTableElement;
const sregsTable = document.querySelector("#sregs") as HTMLTableElement;

const downloadEl = document.querySelector("#download") as HTMLAnchorElement;
const uploadEl = document.querySelector("input[type=\"file\"]") as HTMLInputElement;

const noUpdateInfo = document.querySelector("#noUpdateInfo") as HTMLInputElement;
const noUpdateMemoryEl = document.querySelector("#noUpdateMemory") as HTMLInputElement;
const enableDarkTheme = document.querySelector("#dark-theme") as HTMLInputElement;

const intervalTimeout = document.querySelector("#interval") as HTMLInputElement;
const stepTimes = document.querySelector("#stepTimes") as HTMLInputElement;

const saveName = "lcpu-save";

function updateInfo(){
    if(noUpdateInfo.checked)
        return;
    const decompiled = decompile(rom.readWord(cpu.ip), global_labels);
    statusInfo.innerText = `PC: ${cpu.ip}\nCurrent instruction: ${decompiled}`;
}
function updateRegisters(){
    if(noUpdateInfo.checked)
        return;
    regel[0].textContent = cpu.registers[0].toString();
    regel[1].textContent = cpu.registers[1].toString();
    regel[2].textContent = cpu.registers[2].toString();
}
function updateSRegs(){
    if(noUpdateInfo.checked)
        return;
    sregsEl[0].textContent = cpu.halted.toString();
    sregsEl[1].textContent = cpu.flags.zero.toString();
    sregsEl[2].textContent = cpu.flags.carry.toString();
}
function updateRom(){
    if(noUpdateMemoryEl.checked)
        return;
    let section = cpu.ip & 0xFF00;
    let k = 0;
    while(ramViewer.firstChild)
        ramViewer.firstChild.remove(); // forEach or for loops are glitched
    for(let i=0;i<8;i++){
        const tr = document.createElement("tr");
        for(let j=0;j<16;j++){
            const td = document.createElement("td");
            td.innerText = rom.readWord(section | k++).toString(16).toUpperCase().padStart(4, "0");
            if(((cpu.ip & 0xFF) == k-1)){
                td.style.backgroundColor = "#44a";
                td.style.color = "#eee";
            }
            tr.append(td);
        }
        ramViewer.append(tr);
    }
}
function updateInfoDisplay(updateChecked: boolean){
    if(parseInt(window.localStorage.getItem("info-disabled") ?? "0")){
        statusInfo.classList.add("hidden");
        registersTable.classList.add("hidden");
        sregsTable.classList.add("hidden");
    }else{
        statusInfo.classList.remove("hidden");
        registersTable.classList.remove("hidden");
        sregsTable.classList.remove("hidden");
        updateInfo();
    }
    if(updateChecked) noUpdateInfo.checked = !!parseInt(window.localStorage.getItem("info-disabled") ?? "0");
}
function updateMemoryDisplay(updateChecked: boolean){
    if(parseInt(window.localStorage.getItem("memory-disabled") ?? "0")){
        while(ramViewer.firstChild)
            ramViewer.firstChild.remove();// forEach or for loops are glitched
    }else{
        updateRom();
    }
    if(updateChecked) noUpdateMemoryEl.checked = !!parseInt(window.localStorage.getItem("memory-disabled") ?? "0");
}

const DEFAULT_CODE = `; Welcome to LCPU assembly editor!

jmp main

main: ; your program starts here
hlt
`;

monaco.languages.register({
    id: "assembly"
});

monaco.editor.defineTheme("asm-theme-light", {
    base: "hc-light",
    inherit: true,
    rules: [
        {
            token: "register-x",
            foreground: "#DD1111",
            fontStyle: "bold"
        },
        {
            token: "register-y",
            foreground: "#DDDD11",
            fontStyle: "bold"
        },
        {
            token: "register-z",
            foreground: "#11DDDD",
            fontStyle: "bold"
        }
    ],
    colors: {}
});
monaco.editor.defineTheme("asm-theme-dark", {
    base: "hc-black",
    inherit: true,
    rules: [
        {
            token: "register-x",
            foreground: "#FF4444",
            fontStyle: "bold"
        },
        {
            token: "register-y",
            foreground: "#FFFF44",
            fontStyle: "bold"
        },
        {
            token: "register-z",
            foreground: "#44FFFF",
            fontStyle: "bold"
        }
    ],
    colors: {}
});

monaco.languages.setMonarchTokensProvider("assembly", {
    ignoreCase: true,
    defaultToken: "invalid",
    tokenizer: {
        root: [
            {include: "@comment"},
            {include: "@whitespace"},
            {include: "@extra"},
            {include: "@variables"},
            {include: "@numbers"},
            {include: "@controllers"},
            {include: "@math"},
            {include: "@memory"},
            {include: "@flag"}
        ],
        comment: [
            [/;.+$/, "comment"]
        ],
        whitespace: [
            [/[ \t\r\n]+/, "white"]
        ],
        extra: [
            [/,/, "delimiter"],
            [/\bx\b/, "register-x"],
            [/\by\b/, "register-y"],
            [/\bz\b/, "register-z"]
        ],
        variables: [
            [/.*:/, "variable.name"],
        ],
        numbers: [
            [/#|\$|\$\$/, "number"],
            [/x[0-9a-f]*/i, "number.hex"],
            [/b[0-1]*/i, "number.binary"],
            [/(?:d|\d)/, "number"],
        ],
        controllers: [
            [/^(ret)|(hlt)\b/i, "keyword"],
            [/^(jmp)|(call)|(ret)|(jz)|(jc)\b/i, "keyword", "@controllerVariable"]
        ],
        controllerVariable: [
            [/.+|((?=;))/, "variable.name", "@pop"]
        ],
        math: [
            [/^(add)|(sub)|(cmp)\b/i, "attribute.value"]
        ],
        memory: [
            [/^((lod)|(str)|(ldi))\b/i, "type"]
        ],
        flag: [
            [/(clb)|(stb)|(carry)|(zero)/i, "type"]
        ]
    }
});

const editor = monaco.editor.create(document.querySelector("#code") as HTMLDivElement, {
    language: "assembly",
    theme: "asm-theme-light",
    value: "; Loading..."
});

editor.setValue(DEFAULT_CODE);

function updateAll(){
    updateInfo();
    updateRom();
    updateRegisters();
    updateSRegs();
}
function compile_code(){
    try{
        const code = editor.getValue();
        const { wordcode, labels } = compile(code);
        global_labels = labels;
        const newROM = new Uint16Array(rom.byteLength);
        for(let i=0;i<wordcode.length;i++){
            newROM[i] = wordcode[i];
        }
        rom.loadData(newROM);
        reset(false);
    }catch(e){
        alert(`Compilation error!\n${(e as Error).message}`);
    }
}
function makeStep(){
    for(let i=0;i<stepTimes.valueAsNumber;i++){
        cpu.step();
    }
    updateAll();
}
function reset(onlyCPU: boolean){
    cpu.reset(!onlyCPU);
    if(!onlyCPU){
        ram.fill(0);
    }
    updateAll();
}
function updateTheme(){
    if(enableDarkTheme.checked){
        document.documentElement.classList.add("dark-theme");
        window.localStorage.setItem("dark-theme", "true");
        monaco.editor.setTheme("asm-theme-dark");
    }else{
        document.documentElement.classList.remove("dark-theme");
        window.localStorage.removeItem("dark-theme");
        monaco.editor.setTheme("asm-theme-light");
    }
}
function getFiles(): Promise<FileList>{
    return new Promise(r => {
        uploadEl.onchange = e => r(uploadEl.files as FileList);
        uploadEl.click();
    });
}
function isFirstTime(){
    return !window.localStorage.getItem("alreadyVisited");
}
declare global {
    function compile_code(): void;
    function makeStep(): void;
    function reset(onlyCPU: boolean): void;
    function intervalStep(): void;
    function intervalClear(): void;
    function uploadCode(): void;
    function uploadROM(): void;
    function downloadCode(): void;
    function downloadROM(): void;
    function loadCode(): void;
    function saveCode(): void;
    function newCode(): void;
    var cpu_debug: Processor;
}
let interval: ReturnType<typeof setInterval> | undefined;
window.compile_code = compile_code;
window.makeStep = makeStep;
window.reset = reset;
window.cpu_debug = cpu;
window.intervalClear = function(){
    if(interval !== undefined){
        clearInterval(interval);
        interval = undefined;
    }
}
window.intervalStep = function(){
    window.intervalClear();
    interval = setInterval(makeStep, intervalTimeout.valueAsNumber);
}
window.uploadCode = async function(){
    const file = (await getFiles())[0];
    if(file === undefined){
        return;
    }
    const text = await file.text();
    editor.setValue(text);
    compile_code();
}
window.downloadCode = function(){
    const url = "data:text/plain;charset=utf-8,"+encodeURIComponent(editor.getValue());
    downloadEl.download = "code.lasm";
    downloadEl.href = url;
    downloadEl.click();
}
window.downloadROM = function(){
    const blob = new Blob([rom.buffer], {type:"application/octet-stream"});
    downloadEl.download = "rom.bin";
    downloadEl.href = URL.createObjectURL(blob);
    downloadEl.click();
}
window.uploadROM = async function(){
    const file = (await getFiles())[0];
    if(file === undefined){
        return;
    }
    const buf = await file.arrayBuffer();
    if(buf.byteLength & 1)
        return alert("Invalid ROM. Expected a ROM size multiple of two.");
    rom.loadData(new Uint16Array(buf));
    reset(false);
}
window.saveCode = function(){
    localStorage.setItem(saveName, editor.getValue());
}
window.loadCode = function(){
    const code = localStorage.getItem(saveName);
    if(code !== null){
        editor.setValue(code);
    }
}
window.newCode = function(){
    editor.setValue(DEFAULT_CODE);
}

noUpdateInfo.addEventListener("change", () => {
    window.localStorage.setItem("info-disabled", noUpdateInfo.checked ? "1" : "0");
    updateInfoDisplay(false);
});
noUpdateMemoryEl.addEventListener("change", () => {
    window.localStorage.setItem("memory-disabled", noUpdateMemoryEl.checked ? "1" : "0");
    updateMemoryDisplay(false);
});

if(isFirstTime()){
    window.localStorage.setItem("alreadyVisited", "1");
    window.localStorage.setItem("dark-theme", "true");
}

enableDarkTheme.addEventListener("change", updateTheme);
if(window.localStorage.getItem("dark-theme")){
    enableDarkTheme.checked = true;
    updateTheme();
}
updateInfoDisplay(true);
updateMemoryDisplay(true);
loadCode();
window.addEventListener("unload", saveCode);
compile_code();
document.querySelectorAll("button").forEach(b => {
    b.disabled = false;
});