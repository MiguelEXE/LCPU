# LCPU

Short for Lumber CPU

It's a 8-bit Harvard-based CPU that i'm planning to make on [Lumber Tycoon 2](https://www.roblox.com/games/13822889/Lumber-Tycoon-2)

## Technical behavior

### Addresses

The instruction memory address is stored as a 12-bit integer pointing to a word (16-bit value).

This means that the CPU is capable of loading 2^12 instructions on different addresses

Meanwhile the data memory address is stored as a 10-bit integer pointing to a byte (8-bit value).

### Flags

There is two flags on this CPU: Carry flag (C or CF) and Zero flag (Z or ZF)

Carry flag is enabled only in `ADD`, `SUB` or `CMP` (which is like `SUB` but the result is not saved)

Carry flag in `ADD` is turned on when the result value is greather than 255 (overflows the 8-bit limit)

Meanwhile in both `SUB` is turned on when the result becomes negative (look at [processor.ts](src/processor.ts) and search for `__processor_sub()` in `Processor` class to see why this happens).

Zero flag is calculated in every ALU operation, it's enabled when the result of the ALU is zero.

### Registers

There is four registers

- Null register (null) (read will always give zero, write doesn't do anything)

- X register (x, XR)

- Y register (y, YR)

- Z register (z, ZR)

### Notes

The flags in every ALU instruction is replaced with the new calculated by ALU

NAND is included since there is no space for other logical instructions (like AND, OR, XOR)



## Assembly syntax

| Type              | Syntax                                                   | Example                                                    |
|-------------------|----------------------------------------------------------|------------------------------------------------------------|
| Number            | b\<binary number\> x\<hex number\> (d)<\decimal number\> | b11 (3 in dec) xF (15 in dec), d104, 104 (both 104 in dec) |
| Literal           | #\<number\>                                              | ldi x, #240                                                |
| ROM address       | $$\<number\>                                             | jmp $$14 (note: this is 14 in decimal)                     |
| RAM address       | $\<number\>                                              | lod x, $10 (note: this is 10 in decimal)                   |
| Label declaration | anything in range of regex \w followed by ';'            | main: loop: ...etc                                         |
| Label operand     | anything in range of regex \w                            | main, loop, ...etc                                         |
| Register          | can be 'null', 'x', 'y' or 'z' (case insensitive)        | ldi x, #x2F                                                |
| Flags             | can be 'carry' or 'zero' (case insensitive)              | ctb carry, zero                                            |

| Instruction | OPCODE | Syntax                 | Explanation                               | Affected flags |
|-------------|--------|------------------------|-------------------------------------------|----------------|
| HLT         | 0000   | HLT                    | Halts the CPU                             |                |
| ADD         | 0001   | ADD  reg1, reg2, carry | (reg1 + reg2 -> reg1)                     | CF, ZF         |
| SUB         | 0010   | SUB  reg1, reg2, carry | (reg1 - reg2 -> reg1)                     | CF, ZF         |
| STB         | 0011   | STB  carry, zero       | Set specified bits                        | CF*, ZF*       |
| NAND        | 0100   | NAND reg1, reg2        | ((reg1 & reg2) ^ 255 -> reg1)             | ZF             |
| LDI         | 0101   | LDI  reg1, literal     | (literal -> reg1)                         |                |
| SHR         | 0110   | SHR  reg1              | (reg1 >> 1 -> reg1)                       | ZF             |
| CMP         | 0111   | CMP  reg1, reg2, carry | (reg1 - reg2 -> null)                     | CF, ZF         |
| JMP         | 1000   | JMP  address           | Modify PC to address                      |                |
| JC          | 1001   | JC   address           | Modify PC to address if carry flag is set |                |
| JZ          | 1010   | JZ   address           | Modify PC to address if zero flag is set  |                |
| LOD         | 1011   | LOD  address, reg      | Load value of address to reg              |                |
| STR         | 1100   | STR  address, reg      | Save value of reg to address              |                |
| CALL        | 1101   | CALL address           | Saves next IP and jumps to address        |                |
| RET         | 1110   | RET                    | Gets the last saved IP and jumps to it    |                |
| CLB         | 1111   | CLB  carry, zero       | Clear specified bits                      | CF*, ZF*       |

### Note
in `STB` and `CLB` instructions you can specify one flag, both flags or none of them (which is essencially a NO-OP)

Explanations that are enclosed in parentheses is a pseudo-code marking how it works ('->' meaning where the result is going)

`ADD`, `SUB`, `CMP` if has 'carry' operand after all other operands, it will use the carry flag on the ALU operation as +1 (for `ADD`) or -1 (for `SUB` and `CMP`). If however removed, it will ignore the previous carry flag.

## Machine code structure

| Register | Code (binary) |
|----------|---------------|
| null     | 00            |
| x        | 01            |
| y        | 10            |
| z        | 11            |

| Instruction | Wordcode          | Operand Meaning                                                |
|-------------|-------------------|----------------------------------------------------------------|
| EXAMPLE     | OPCD---- OPERANDS | Example instruction, everything after OPCD (opcode) is operand |
| HLT         | 00000000 00000000 |                                                                |
| ADD         | 0001XXYY C0000000 | (reg1 = XX, reg2 = YY, C = use carry)                          |
| SUB         | 0010XXYY C0000000 | (reg1 = XX, reg2 = YY, C = use carry)                          |
| STB         | 0011CZ00 00000000 | (C = clear carry flag, Z = clear zero flag)                    |
| NAND        | 0100XXYY 00000000 | (reg1 = XX, reg2 = YY)                                         |
| LDI         | 0101XX00 VVVVVVVV | (reg1 = XX, value = VVVVVVVV)                                  |
| SHR         | 0110XX00 00000000 | (reg1 = XX)                                                    |
| CMP         | 0111XXYY C0000000 | (reg1 = XX, reg2 = YY, C = use carry)                          |
| JMP         | 1000AAAA AAAAAAAA | (rom address = AAAAAAAAAAAA)                                   |
| JC          | 1001AAAA AAAAAAAA | (rom address = AAAAAAAAAAAA)                                   |
| JZ          | 1010AAAA AAAAAAAA | (rom address = AAAAAAAAAAAA)                                   |
| LOD         | 1011XXaa aaaaaaaa | (reg1 = XX, ram address = aaaaaaaaaa)                          |
| STR         | 1100XXaa aaaaaaaa | (reg1 = XX, ram address = aaaaaaaaaa)                          |
| CALL        | 1101AAAA AAAAAAAA | (rom address = AAAAAAAAAAAA)                                   |
| RET         | 11100000 00000000 |                                                                |
| CLB         | 1111CZ00 00000000 | (C = clear carry flag, Z = clear zero flag)                    |