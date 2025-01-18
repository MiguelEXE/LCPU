import type {ROM, RAM} from "./memory";
type Instruction = (this: Processor, opcode: number) => void;
type RegisterCode = 0 | 1 | 2 | 3;
interface Flags{
    carry: boolean;
    zero: boolean;
}

const REG_NullRegister: RegisterCode = 0;
const REG_X: RegisterCode = 1;
const REG_Y: RegisterCode = 2;
const REG_Z: RegisterCode = 3;

const instructions: Instruction[] = [
    function HLT(opcode: number){ // HLT
        this.halted = true;
    },
    function ADD(opcode: number){ // ADD
        const reg1 = ((opcode & 0x0C00) >> 10) as RegisterCode;
        const reg2 = ((opcode & 0x0300) >> 8) as RegisterCode;
        const useCarry = Boolean(opcode & 0x0080);
        
        const result = this.__processor_add(this.__accessRegister(reg1), this.__accessRegister(reg2), useCarry && this.flags.carry);
        this.flags.carry = result.cout;
        this.flags.zero = result.zero;
        this.__writeRegister(reg1, result.result);
    },
    function SUB(opcode: number){ // SUB
        const reg1 = ((opcode & 0x0C00) >> 10) as RegisterCode;
        const reg2 = ((opcode & 0x0300) >> 8) as RegisterCode;
        const useCarry = Boolean(opcode & 0x0080);
        
        const result = this.__processor_sub(this.__accessRegister(reg1), this.__accessRegister(reg2), useCarry && this.flags.carry);
        this.flags.carry = result.cout;
        this.flags.zero = result.zero;
        this.__writeRegister(reg1, result.result);
    },
    function STB(opcode: number){ // STB
        const carry = opcode & 0x0800;
        const zero = opcode & 0x0400;
        if(carry){
            this.flags.carry = true;
        }
        if(zero){
            this.flags.zero = true;
        }
    },
    function NAND(opcode: number){ // NAND
        const reg1 = ((opcode & 0x0C00) >> 10) as RegisterCode;
        const reg2 = ((opcode & 0x0300) >> 8) as RegisterCode;
        
        const result = (this.__accessRegister(reg1) & this.__accessRegister(reg2)) ^ 0xFF;
        this.flags.zero = result === 0;
        this.__writeRegister(reg1, result);
    },
    function LDI(opcode: number){ // LDI
        const reg1 = ((opcode & 0x0C00) >> 10) as RegisterCode;
        const value = opcode & 0xFF;
        console.log(reg1, value, opcode.toString(2).padStart(16,"0"));
        this.__writeRegister(reg1, value);
    },
    function SHR(opcode: number){ // SHR
        const reg1 = ((opcode & 0x0C00) >> 10) as RegisterCode;
        
        const result = this.__accessRegister(reg1) >> 1;
        this.flags.zero = result === 0;
        this.__writeRegister(reg1, result);
    },
    function CMP(opcode: number){ // CMP
        const reg1 = ((opcode & 0x0C00) >> 10) as RegisterCode;
        const reg2 = ((opcode & 0x0300) >> 8) as RegisterCode;
        const useCarry = Boolean(opcode & 0x0080);
        
        const result = this.__processor_sub(this.__accessRegister(reg1), this.__accessRegister(reg2), useCarry && this.flags.carry);
        this.flags.carry = result.cout;
        this.flags.zero = result.zero;
    },
    function JMP(opcode: number){
        const address = opcode & 0x0FFF;
        this.ip = address;
    },
    function JC(opcode: number){
        const address = opcode & 0x0FFF;
        if(this.flags.carry)
            this.ip = address;
    },
    function JZ(opcode: number){
        const address = opcode & 0x0FFF;
        if(this.flags.zero)
            this.ip = address;
    },
    function LOD(opcode: number){
        const reg1 = ((opcode & 0x0C00) >> 10) as RegisterCode;
        const address = opcode & 0x03FF;
        this.__writeRegister(reg1, this.__readRam(address));
    },
    function STR(opcode: number){
        const reg1 = ((opcode & 0x0C00) >> 10) as RegisterCode;
        const address = opcode & 0x03FF;
        this.__writeRam(address, this.__accessRegister(reg1));    
    },
    function CALL(opcode: number){
        const address = opcode & 0x0FFF;
        this.__callPush(this.ip);
        this.ip = address;
    },
    function RET(opcode: number){
        this.ip = this.__callPop();
    },
    function CLB(opcode: number){
        const carry = opcode & 0x0800;
        const zero = opcode & 0x0400;
        if(carry){
            this.flags.carry = false;
        }
        if(zero){
            this.flags.zero = false;
        }
    }
];
class Processor {
    halted = false
    registers = new Uint8Array(3)
    ip = 0
    flags: Flags = {
        carry: false,
        zero: false
    }
    callStack = new Uint16Array(16)
    callSP = 0

    rom: ROM
    ram: RAM

    constructor(rom: ROM, ram: RAM){
        this.rom = rom;
        this.ram = ram;
    }

    step(){
        if(this.halted) return;
        const instruction = this.__readRom(this.ip++);
        this.__runInstruction(instruction);
    }
    reset(hard: boolean){
        this.registers.fill(0);
        this.callSP = 0;
        if(hard){
            this.callStack.fill(0);
        }
        this.ip = 0;
        this.halted = this.flags.carry = this.flags.zero = false;
    }
    __runInstruction(instruction: number){
        const opcode = (instruction & 0xF000) >> 12;
        instructions[opcode].call(this, instruction);
    }
    __accessRegister(reg: RegisterCode): number{
        if(reg === 0)
            return 0;
        return this.registers[reg - 1];
    }
    __writeRegister(reg: RegisterCode, value: number){
        if(reg === 0)
            return;
        this.registers[reg - 1] = value & 0xFF;
    }
    // Special addition
    __processor_add(v1: number, v2: number, cin: boolean = false){
        const result = v1 + v2 + (cin ? 1 : 0);
        return {
            result: result & 0xFF,
            cout: result > 0xFF,
            zero: (result & 0xFF) === 0
        }
    }
    // Special subtraction
    __processor_sub(v1: number, v2: number, cin: boolean = false){
        const result = v1 + (v2 ^ 0xFF) + (cin ? 0 : 1);
        return {
            result: result & 0xFF,
            cout: !(result > 0xFF), // reversed since subtraction is strange
            zero: (result & 0xFF) === 0
        }
    }
    __callPush(address: number){
        this.callStack[this.callSP] = address;
        if(this.callSP >= this.callStack.length){
            this.callSP = 0;
            return;
        }
        this.callSP++;
    }
    __callPop(): number{
        let newSP: number;
        if(this.callSP <= 0){
            newSP = this.callStack.length - 1;
        }else{
            newSP = this.callSP - 1;
        }
        this.callSP = newSP
        return this.callStack[newSP];
    }
    __readRam(address: number): number{
        return this.ram.readByte(address);
    }
    __writeRam(address: number, value: number){
        return this.ram.writeByte(address, value);
    }
    __readRom(address: number): number{
        return this.rom.readWord(address);
    }
}

export type {RegisterCode, Flags};
export {Processor, REG_NullRegister, REG_X, REG_Y, REG_Z};