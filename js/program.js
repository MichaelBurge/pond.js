REG8_STATUS = 6;
REG8_RANDOM = 7;
REG16_PC = 0;
REG16_SP = 1;
REG16_CP = 2;
FLAG_TEST = 0x01;

class Program {
    constructor(rv, executor) {
        this.rv = rv;
        this.executor = executor;
        this.reg8s = new Uint8Array(16);
        this.reg16s = new Int16Array(this.reg8s.buffer);
    }
    evaluate_instruction(opcode, args) {
        switch (opcode) {
            case 0x00: return this.kill();
            case 0x01: return this.jump(args);
            case 0x02: return this.add(args);
            case 0x03: return this.move(args);
            case 0x04: return this.sub(args);
            case 0x05: return this.birth();
            case 0x06: return this.xor(args);
            case 0x07: return this.and(args);
            case 0x08: return this.or(args);
            case 0x09: return this.neg(args);
            case 0x0a: return this.gt(args);
            case 0x0b: return this.eq(args);
            case 0x0c: return this.lt(args);
            default: return null;
        }
    }   

    kill() {
        this.executor.kill(this);
    }

    jump([ exprclass, val ]) {
        if ((this.status() & FLAG_JUMP) > 0) {
            this.reg16s[REG16_PC] += val;
        }
    }

    add([src, dest]) {
        return this.binop_assign(src, dest, (a, b) => { return a + b; });
    }

    move([src, dest]) {
        return this.binop_assign(src, dest, (a, b) => { return a; });
    }

    sub([src, dest]) {
        return this.binop_assign(src, dest, (a, b) => { return b - a; });
    }
    
    birth() {
        this.executor.birth(this);
    }

    xor([src, dest]) {
        return this.binop_assign(src, dest, (a, b) => { return a ^ b; });
    }

    and([src, dest]) {
        return this.binop_assign(src, dest, (a, b) => { return a & b; });
    }
    
    or([src, dest]) {
        return this.binop_assign(src, dest, (a, b) => { return a | b; });
    }

    neg([dest]) {
        return this.binop_assign(dest, dest, (a, b) => { return ~a; });
    }

    gt([x,y]) {
        let val = this.binop(x, y, (a,b) => { return a > b; });
        this.set_flag(FLAG_TEST, val);
    }

    eq([x,y]) {
        let val = this.binop(x,y,(a,b) => { return a == b; });
        this.set_flag(FLAG_TEST, val);
    }

    lt([x,y]) {
        let val = this.binop(x,y,(a,b) => { return a < b; });
        this.set_flag(FLAG_TEST, val);
    }

    binop([ src_exprclass, [ src8, src16], src_ref], [ dest_exprclass, [ dest8, dest16 ], dest_ref], combine) {
        let val;
        if (this.exprclass_size(src_exprclass) == 2 || this.exprclass_size(dest_exprclass) == 2) {
            val = combine(src16, dest16);
        } else {
            val = combine(src8, dest8);
        }
        return val;
    }
    binop_assign(src, dest, combine) {
        let val = binop(src, dest, combine);
        this.assign(src[0], val, dest[0], dest[2]);
    }
                
    evaluate_expression(exprclass, arg) {
        let program = this;
        let dup = x => { return [ x, x ]; };
        let get_values = function () {
            switch (exprclass) {
                case EXPRCLASS_IMM: return dup(arg);
                case EXPRCLASS_REG: return dup(this.reg8s[arg]);
                case EXPRCLASS_REG16: return dup(this.reg16s[arg]);
                case EXPRCLASS_RELPTR: return [
                    this.rv.with_relptr(relptr, () => { return program.read_size(1); }),
                    this.rv.with_relptr(relptr, () => { return program.read_size(2); })
                ];
                case EXPRCLASS_PATTPTR:
                case EXPRCLASS_NPATTPTR:
                    let direction = (exprclass == EXPRCLASS_PATTPTR) ? 1 : -1;
                    let relptr = this.search_patt(arg, direction);
                    return [
                        this.rv.with_relptr(relptr, () => { return program.read_size(1); }),
                        this.rv.with_relptr(relptr, () => { return program.read_size(2); })
                    ];
                case EXPRCLASS_STACK:
                    return [
                        this.with_sp(arg, () => { return program.read_size(1); }),
                        this.with_sp(arg, () => { return program.read_size(2); })
                    ];
            }
        };
        return [ exprclass, get_value(), arg ];
    };
    assign(val_exprclass, val, dest_exprclass, dest_ref) {
        let program = this;
        switch (dest_exprclass) {
            case EXPRCLASS_IMM: return this.rv.with_absptr(dest, () => { program.rv.setUint8(val); });
            case EXPRCLASS_REG: return this.reg8s[dest] = val;
            case EXPRCLASS_REG16: return this.reg16s[dest] = val;
            case EXPRCLASS_PATTPTR:
            case EXPRCLASS_NPATTPTR:
                let direction = (exprclass == EXPRCLASS_PATTPTR) ? 1 : -1;
                let relptr = this.search_patt(256, dest, direction);
                return this.rv.with_relptr(relptr, () => { program.set_size(program.exprclass_size(val_exprclass), val); });
            case EXPRCLASS_STACK: return this.with_sp(dest, () => { program.set_size(program.exprclass_size(val_exprclass), val); });
            default:
                throw "???";
        }
    }
    search_patt(patt, direction) {
        let mRelptr = this.rv.search(256, Utils.split_uint32(patt), direction);
        if (mRelptr === null) {
            return direction;
        }
        return mRelptr;
    }
    exprclass_size(exprclass) {
        switch (exprclass) {
            case EXPRCLASS_IMM: return 1;
            case EXPRCLASS_REG: return 1;
            case EXPRCLASS_REG16: return 2;
            case EXPRCLASS_PATTPTR: return 1;
            case EXPRCLASS_NPATTPTR: return 1;
            case EXPRCLASS_STACK: return 1;
        }
    }
    with_sp(os, block) {
        let program = this;
        return this.rv.with_absptr(this.reg16s[REG16_SP], () => {
            return program.rv.with_relptr(os, () => {
                block();
            });
        });
    }
    set_size(size, x) {
        if (size == 1) {
            this.rv.setUint8(x);
        } else {
            this.rv.setInt16(x);
        }
    }
    read_size(size) {
        if (size == 1) {
            this.rv.getUint8(x);
        } else {
            this.rv.getInt16(x);
        }
    }
    status() {
        return this.reg8s[REG_STATUS];
    }
    set_flag(flag, value) {
        if (value > 0) {
            this.reg8s[REG_STATUS] |= flag;
        } else {
            this.reg8s[REG_STATUS] &= ~flag;
        }
    }
}
