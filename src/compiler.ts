import assert from "assert";

const opcodes = [
    "HLT",
    "ADD",
    "SUB",
    "STB",
    "NAND",
    "LDI",
    "SHR",
    "CMP",
    "JMP",
    "JC",
    "JZ",
    "LOD",
    "STR",
    "CALL",
    "RET",
    "CLB"
];
// Type 0: no operands
// Type 1: register, register, carry
// Type 2: register, register
// Type 3: ROM address
// Type 4: register, RAM address
// Type 5: carry, zero
// Type 6: register,
// Type 7: register, 8-bit value
const mneonicType: {[k: string]: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | undefined} = {
    "HLT":      0,
    "RET":      0,
    "ADD":      1,
    "SUB":      1,
    "CMP":      1,
    "NAND":     2,
    "JMP":      3,
    "JC":       3,
    "JZ":       3,
    "CALL":     3,
    "LOD":      4,
    "STR":      4,
    "STB":      5,
    "CLB":      5,
    "SHR":      6,
    "LDI":      7
};

const instructionAliases = {
    "NOP":      "ADD null,0"
};

function skipSpaces(operands: string[]){
    while(operands[0] === " " || operands[0] === "\t")
        operands.shift();
}
function skipSpacesAndNextArgument(operands: string[]){
    skipSpaces(operands);
    assert.strictEqual(operands[0], ",", `Expected ',' received '${operands[0]}'`);
    operands.shift();
    skipSpaces(operands);
}
function endInstruction(operands: string[]){
    skipSpaces(operands);
    assert.strictEqual(operands[0], undefined, `Expected EOL, received '${operands[0]}'`);
    operands.shift();
}
function readRegister(register: string[]){
    switch(register.shift()?.toLowerCase()){
        case "n":
            if(!(register.shift()?.toLowerCase() === "u" && register.shift()?.toLowerCase() === "l" && register.shift()?.toLowerCase() === "l"))
                throw new Error("Invalid register");
            return 0;
        case "x":
            return 1;
        case "y":
            return 2;
        case "z":
            return 3;
        default:
            throw new Error("Invalid register");
    }
}
function readRom(operands: string[]){
    assert.deepEqual(operands[0], "$", `Expected '$'. Received '${operands[0]}'`);
    operands.shift();
    assert.deepEqual(operands[0], "$", `Expected '$'. Received '${operands[0]}'`);
    operands.shift();
    
    let mode = operands[0];
    let actualMode: "decimal" | "binary" | "hex" = "decimal";
    if(mode === "d"){
        operands.shift();
    }else if(mode === "b"){
        actualMode = "binary";
        operands.shift();
    }else if(mode === "x"){
        actualMode = "hex";
        operands.shift();
    }

    let digits: string[];
    if(actualMode === "binary"){
        digits = "01".split("");
    }else if(actualMode === "decimal"){
        digits = "0123456789".split("");
    }else{
        digits = "0123456789ABCDEF".split("");
    }
    const base = digits.length;
    
    assert(digits.indexOf(operands[0]) >= 0, "Expected value.");
    let result = 0;
    while(digits.indexOf(operands[0]) >= 0)
        result = result * base + digits.indexOf(operands.shift() as string);
    return result;
}
function readRam(operands: string[]){
    assert.deepEqual(operands[0], "$", `Expected '$'. Received '${operands[0]}'`);
    operands.shift();
    
    let mode = operands[0];
    let actualMode: "decimal" | "binary" | "hex" = "decimal";
    if(mode === "d"){
        operands.shift();
    }else if(mode === "b"){
        actualMode = "binary";
        operands.shift();
    }else if(mode === "x"){
        actualMode = "hex";
        operands.shift();
    }

    let digits: string[];
    if(actualMode === "binary"){
        digits = "01".split("");
    }else if(actualMode === "decimal"){
        digits = "0123456789".split("");
    }else{
        digits = "0123456789ABCDEF".split("");
    }
    const base = digits.length;
    
    assert(digits.indexOf(operands[0]) >= 0, "Expected value.");
    let result = 0;
    while(digits.indexOf(operands[0]) >= 0)
        result = result * base + digits.indexOf(operands.shift() as string);
    return result;
}
function readValue(operands: string[]){
    assert.deepEqual(operands[0], "#", `Expected '#'. Received '${operands[0]}'`);
    operands.shift();

    let mode = operands[0];
    let actualMode: "decimal" | "binary" | "hex" = "decimal";
    if(mode === "d"){
        operands.shift();
    }else if(mode === "b"){
        actualMode = "binary";
        operands.shift();
    }else if(mode === "x"){
        actualMode = "hex";
        operands.shift();
    }

    let digits: string[];
    if(actualMode === "binary"){
        digits = "01".split("");
    }else if(actualMode === "decimal"){
        digits = "0123456789".split("");
    }else{
        digits = "0123456789ABCDEF".split("");
    }
    const base = digits.length;
    
    assert(digits.indexOf(operands[0]) >= 0, "Expected value.");
    let result = 0;
    while(digits.indexOf(operands[0]) >= 0)
        result = result * base + digits.indexOf(operands.shift() as string);
    assert(result < 256, "Value must be in range 0 > value > 256");
    return result;
}

const labelRegex = /^(.*):/;
function absolutefyLabels(code: string){
    const lines = code.replace(/;.*$/gm, "").split("\n");
    const labels: {[k: string]: number} = {};
    const labelAliases: string[] = [];

    function commitLabels(){
        let label: string | undefined;
        while((label = labelAliases.shift()) !== undefined)
            labels[label] = offset;
    }

    let offset = 0;
    // Phase 1: Label Addressing
    for(const line of lines){
        const label = labelRegex.exec(line);
        if(label !== null){
            const labelName = label[1];
            labelAliases.push(labelName);
        }
        const code = line.slice(label !== null ? label[1].length+1 : 0).trim();
        assert(!labelRegex.test(code), "Cannot declare two labels on the same line.");
        if(code.length > 1){
            commitLabels();
            offset++;
        }
    }
    // Phase 2: Label Assignment
    const mutatedLines: string[] = [];
    for(const line of lines){
        const label = labelRegex.exec(line);
        const code = line.slice(label !== null ? label[1].length+1 : 0).trim();
        //assert(!labelRegex.test(code), "Cannot declare two labels on the same line."); // wont fail
        const [instruction, ...operands] = code.split(" ");
        const mutatedOperands = operands.map(operand => {
            const match = operand.match(/^\w*/);
            if(match !== null && match[0] && !/x|y|z/i.test(operand)){
                const label = labels[match[0] as string];
                assert.notStrictEqual(label, undefined, `Unknown label '${match[0]}'`);
                return `${(match.input as string).replace(match[0] as string, `$$$$${label.toString()}`)}`;
            }
            return operand;
        });
        const mutatedCode = `${instruction} ${mutatedOperands.join(" ")}`;
        mutatedLines.push(mutatedCode);
    }
    return { mutated: mutatedLines.join("\n"), labels};
}
function getLabels(code: string){
    const lines = code.replace(/;.*$/gm, "").split("\n");
    const labels: {[k: string]: number} = {};
    const labelAliases: string[] = [];

    function commitLabels(){
        let label: string | undefined;
        while((label = labelAliases.shift()) !== undefined)
            labels[label] = offset;
    }

    let offset = 0;
    // Phase 1: Label Addressing
    for(const line of lines){
        const label = labelRegex.exec(line);
        if(label !== null){
            const labelName = label[1];
            labelAliases.push(labelName);
        }
        const code = line.slice(label !== null ? label[1].length+1 : 0).trim();
        assert(!labelRegex.test(code), "Cannot declare two labels on the same line.");
        if(code.length > 1){
            commitLabels();
            offset++;
        }
    }
    return labels;
}
function compile(code: string){
    const {mutated, labels} = absolutefyLabels(code);
    const wordcode: number[] = [];
    for(const line of mutated.split("\n")){
        if(line.trim() === "")
            continue;
        wordcode.push(compileLine(line));
    }
    return { wordcode, labels };
}
function compileLine(line: string){
    const splitted = line.split(" ");
    assert(splitted.length > 0, "Expected instruction. Received EOL");
    const mneonic = splitted.shift() as string;
    const type = mneonicType[mneonic.toUpperCase()];
    assert.notStrictEqual(type, undefined, `Invalid instruction '${mneonic}'`);
    const operands = splitted.join(" ").split("");
    let opcode = opcodes.indexOf(mneonic.toUpperCase()) << 12;
    skipSpaces(operands);
    switch(type){
        case 0:
            break;
        case 1:
            opcode |= readRegister(operands) << 10;
            skipSpacesAndNextArgument(operands);
            opcode |= readRegister(operands) << 8;
            skipSpaces(operands);
            if(operands[0] !== undefined){
                skipSpacesAndNextArgument(operands);
                let buf = "";
                for(let i=0;i<5;i++)
                    buf += operands.shift() ?? "";
                assert.strictEqual(buf.toLowerCase(), "carry", `Expected 'carry'. Received '${buf}'`);
            }
            break;
        case 2:
            opcode |= readRegister(operands) << 10;
            skipSpacesAndNextArgument(operands);
            opcode |= readRegister(operands) << 8;
            break;
        case 3:
            opcode |= readRom(operands);
            break;
        case 4:
            opcode |= readRegister(operands) << 10;
            skipSpacesAndNextArgument(operands);
            opcode |= readRam(operands);
            break;
        case 5:
            const flags = {
                carry: false,
                zero: false
            };
            let buf = "";
            while(true){
                for(let i=0;i<5;i++){
                    if(operands[0] === "," || operands[0] === undefined)
                        break;
                    buf += operands.shift() ?? "";
                }
                if(buf.toLowerCase() === "carry"){
                    flags.carry = true;
                }else if(buf.toLowerCase() === "zero"){
                    flags.zero = true;
                }else{
                    throw new Error(`Invalid flag. Expected 'carry' or 'zero'. Received '${buf}'`);
                }
                buf = "";
                if(operands[0] === undefined)
                    break;
                assert.strictEqual(operands[0], ",", `Expected ',' received '${operands[0]}'`);
                operands.shift();
            }
            opcode |= (flags.carry ? 1 : 0) << 11;
            opcode |= (flags.zero ? 1 : 0) << 10;
            break;
        case 6:
            opcode |= readRegister(operands) << 10;
            break;
        case 7:
            opcode |= readRegister(operands) << 10;
            skipSpacesAndNextArgument(operands);
            opcode |= readValue(operands);
            break;
    }
    endInstruction(operands);
    return opcode;
}
function registerNum2Register(register: 0 | 1 | 2 | 3){
    switch(register){
        case 0:
            return "null";
        case 1:
            return "x";
        case 2:
            return "y";
        case 3:
            return "z";
    }
}
function findLabel(labels: {[k: string]: number}, address: number): string | undefined{
    for(const [key, value] of Object.entries(labels)){
        if(value === address)
            return key;
    }
}
function decompile(instruction: number, labels: {[k: string]: number}){
    const opcode = (instruction & 0xF000) >> 12;
    const opcodeName = opcodes[opcode];
    const operands = mneonicType[opcodeName];
    assert.notStrictEqual(operands, undefined, "operands === undefined");
    let decompiled = opcodeName;
    switch(operands){
        case 0:
            break;
        case 1:
            decompiled += ` ${registerNum2Register(((instruction & 0x0C00) >> 10) as 0 | 1 | 2 | 3)}, ${registerNum2Register(((instruction & 0x0300) >> 8) as 0 | 1 | 2 | 3)}${Boolean(instruction & 0x0080) ? " carry" : ""}`;
            break;
        case 2:
            decompiled += ` ${registerNum2Register(((instruction & 0x0C00) >> 10) as 0 | 1 | 2 | 3)}, ${registerNum2Register(((instruction & 0x0300) >> 8) as 0 | 1 | 2 | 3)}`;
            break;
        case 3:
            const label = findLabel(labels, instruction & 0x0FFF);
            if(label){
                decompiled += ` ${label}`;
            }else{
                decompiled += ` $$${instruction & 0x0FFF}`;
            }
            break;
        case 4:
            decompiled += ` ${registerNum2Register(((instruction & 0x0C00) >> 10) as 0 | 1 | 2 | 3)}, $${instruction & 0x3FF}`;
            break;
        case 5:
            const flags: string[] = [];
            if(instruction & 0x0800){
                flags.push("CARRY");
            }
            if(instruction & 0x0400){
                flags.push("ZERO");
            }
            decompiled += ` ${flags.join(", ")}`;
            break;
        case 6:
            decompiled += ` ${registerNum2Register(((instruction & 0x0C00) >> 10) as 0 | 1 | 2 | 3)}`;
            break;
        case 7:
            decompiled += ` ${registerNum2Register(((instruction & 0x0C00) >> 10) as 0 | 1 | 2 | 3)}, #${instruction & 0xFF}`;
            break;
    }
    return decompiled;
}

export default compile;
export {compile, compileLine, getLabels, absolutefyLabels, decompile};