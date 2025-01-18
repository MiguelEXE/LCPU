interface RAM {
    readByte(address: number): number;
    writeByte(address: number, val: number): void;
}
interface ROM {
    loadData(mem: Uint16Array): void;
    readWord(address: number): number;
}

class RAM_ARRAY extends Uint8Array implements RAM{
    constructor(){
        super(2 ** 10 - 1);
    }
    readByte(address: number): number{
        return this[address];
    }
    writeByte(address: number, val: number){
        this[address] = val;
    }
}
class ROM_ARRAY extends Uint16Array implements ROM{
    constructor(){
        super(2 ** 12 - 1);
    }
    loadData(mem: Uint16Array){
        this.fill(0);
        mem.forEach((v,i) => this[i] = v);
    }
    readWord(address: number){
        return this[address];
    }
}

export type {ROM, RAM};
export {ROM_ARRAY, RAM_ARRAY};