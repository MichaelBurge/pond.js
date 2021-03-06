REG8_STATUS = 6;
REG8_RANDOM = 7;
REG16_PC = 0;
REG16_SP = 1;
REG16_CP = 2;
FLAG_TEST = 0x01;

class Program {
    constructor(executor, id, guid) {
        TestUtils.assert_def(id);
        this.executor = executor;
        this.rv = executor.rv;
        this.reg8s = new Uint8Array(16);
        this.reg16s = new Int16Array(this.reg8s.buffer);
        this.step_os = 0;
        this.id = id;
        this.guid = guid;
        this.num_clocks = 0;
        this.lineage = 0;
        this.same_lineage = 0;
        this.original_pc = 0;
        this.original_cp = null;
        // Settings
        this.max_child_size = 256;
        this.max_nops = 10;
    }
    step(rv) {
        this.rv.seek(this.pc());
        this.step_os = this.rv.os;
        Assembler.isa_mapM(rv, this.evaluate_expression.bind(this), this.evaluate_instruction.bind(this));
        this.reg16s[REG16_PC] += this.rv.os - this.step_os;
        this.num_clocks++;
    }
    
    evaluate_instruction(opcode, args) {
        switch (opcode) {
            case 0x00: return this.kill();
            case 0x01: return this.jump(args);
            case 0x02: return this.add(args);
            case 0x03: return this.move(args);
            case 0x04: return this.sub(args);
            case 0x05: return this.birth(args);
            case 0x06: return this.xor(args);
            case 0x07: return this.and(args);
            case 0x08: return this.or(args);
            case 0x09: return this.neg(args);
            case 0x0a: return this.gt(args);
            case 0x0b: return this.eq(args);
            case 0x0c: return this.lt(args);
            case 0x0d: return this.push(args);
            case 0x0e: return this.pop(args);
            case 0x0f: return this.alloc(args);
            default:
                if (this.max_nops-- > 0) {
                    return null;
                } else {
                    return this.kill();
                }
        }
    }    

    kill() { this.executor.kill(); }

    jump([ arg ]) {
        let [ exprclass, [x8, x16], relptr ] = arg;
        if ((this.status() & FLAG_TEST) > 0) {
            // Forward jumps count from end of instruction; backward counts from start of instruction.
            if (relptr >= 0) {
                this.rv.os = this.rv.eval_relptr(relptr);
            } else {
                this.rv.os = this.rv.with_absptr(this.step_os, () => { return this.rv.eval_relptr(relptr); });
            }
        }
    }

    birth([ arg ]) {
        if (this.original_cp == null) { return; }
        let cp = this.original_cp;
        let size = this.resolve_expr(arg);
        if (size === null || size <= 0 || size > this.max_child_size) {
            return;
        } else {
            let child = this.rv.slice(cp, size);
            this.executor.birth(this, child);
        }
    }
    
    add([src, dest]) { return this.binop_assign(src, dest, (a, b) => { return a + b; }); }
    move([src, dest]) { return this.binop_assign(src, dest, (a, b) => { return a; }); }
    sub([src, dest]) { return this.binop_assign(src, dest, (a, b) => { return b - a; }); }
    xor([src, dest]) { return this.binop_assign(src, dest, (a, b) => { return a ^ b; }); }
    and([src, dest]) { return this.binop_assign(src, dest, (a, b) => { return a & b; }); }
    or([src, dest]) { return this.binop_assign(src, dest, (a, b) => { return a | b; }); }
    neg([dest]) { return this.binop_assign(dest, dest, (a, b) => { return ~a; }); }
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
    push([ arg ]) {
        let [ exprclass, [ x8, x16], relptr ] = arg;
        this.sp(this.sp() - this.exprclass_size(exprclass));
        this.assign(exprclass, this.resolve_expr(arg), EXPRCLASS_STACK, 0);
    }
    pop([ arg ]) {
        let [ exprclass, [ x8, x16], relptr ] = arg;
        this.assign(EXPRCLASS_STACK, 0, exprclass, relptr);
    }
    alloc() { this.original_cp = this.executor.get_default_cp(); }
    binop([ src_exprclass, [ src8, src16], src_ref], [ dest_exprclass, [ dest8, dest16 ], dest_ref], combine) {
        let val;
        if (this.exprclass_size(src_exprclass) == 2 || this.exprclass_size(dest_exprclass) == 2) {
            TestUtils.assert_def(src16);
            TestUtils.assert_def(dest16);
            val = combine(src16, dest16);
        } else {
            TestUtils.assert_def(src8);
            TestUtils.assert_def(dest8);
            val = combine(src8, dest8);
        }
        return val;
    }
    binop_assign(src, dest, combine) {
        let val = this.binop(src, dest, combine);
        this.assign(src[0], val, dest[0], dest[2]);
    }

    resolve_expr([ exprclass, [x8, x16]]) { return (this.exprclass_size(exprclass) == 1) ? x8 : x16; }
    
    evaluate_expression(exprclass, arg) {
        let pr = this;
        let dup = x => { return [ x, x ]; };
        let get_values = function () {
            switch (exprclass) {
                case EXPRCLASS_IMM: return dup(arg);
                case EXPRCLASS_REG: return dup(pr.reg8s[arg]);
                case EXPRCLASS_REG16: return dup(pr.reg16s[arg]);
                case EXPRCLASS_RELPTR: return [
                    pr.rv.with_relptr(arg, () => { return pr.read_size(1); }),
                    pr.rv.with_relptr(arg, () => { return pr.read_size(2); }),
                ];
                case EXPRCLASS_PATTPTR:
                case EXPRCLASS_NPATTPTR:
                    let direction = (exprclass == EXPRCLASS_PATTPTR) ? 1 : -1;
                    let relptr = pr.search_patt(arg, direction);
                    arg = relptr;
                    return [
                        pr.rv.with_relptr(relptr, () => { return pr.read_size(1); }),
                        pr.rv.with_relptr(relptr, () => { return pr.read_size(2); }),
                    ];
                case EXPRCLASS_ABSPTR:
                    return [
                        pr.with_reg16ptr(arg, () => { return pr.read_size(1); }),
                        pr.with_reg16ptr(arg, () => { return pr.read_size(2); }),
                    ];
                case EXPRCLASS_STACK:
                    return [
                        pr.with_sp(arg, () => { return pr.read_size(1); }),
                        pr.with_sp(arg, () => { return pr.read_size(2); }),
                    ];
                default: throw "unknown exprclass";
            }
        };
        let [x,y] = get_values();
        TestUtils.assert_def(x); TestUtils.assert_def(y);
        return [ exprclass, [x,y], arg ];
    };
    assign(val_exprclass, val, dest_exprclass, dest) {
        TestUtils.assert_def(val);
        TestUtils.assert_def(dest);
        let program = this;
        let val_size = this.exprclass_size(val_exprclass);
        switch (dest_exprclass) {
            case EXPRCLASS_IMM: return this.rv.with_relptr(dest, () => { program.rv.setUint8(val); });
            case EXPRCLASS_REG: return this.reg8s[dest] = val;
            case EXPRCLASS_REG16: return this.reg16s[dest] = val;
            case EXPRCLASS_RELPTR: return this.rv.with_relptr(dest, () => { program.set_size(val_size, val); });
            case EXPRCLASS_PATTPTR:
            case EXPRCLASS_NPATTPTR:
                let direction = (dest_exprclass == EXPRCLASS_PATTPTR) ? 1 : -1;
                let relptr = this.search_patt(256, dest, direction);
                return this.rv.with_relptr(relptr, () => { program.set_size(val_size, val); });
            case EXPRCLASS_ABSPTR: return this.with_reg16ptr(dest, () => { program.set_size(val_size, val); });
            case EXPRCLASS_STACK: return this.with_sp(dest, () => { program.set_size(val_size, val); });
            default:
                throw "???";
        }
    }
    search_patt(patt, direction) {
        let search = () => { return this.rv.search(256, Utils.split_uint32(patt), direction); };
        let mRelptr;
        if (direction == -1) { mRelptr = this.rv.with_absptr(this.step_os, search); }
        else { mRelptr = search(); }
        if (mRelptr === null) { return 0; }
        mRelptr += 4; // Skip past pattern
        return mRelptr;
    }
    exprclass_size(exprclass) {
        switch (exprclass) {
            case EXPRCLASS_IMM: return 1;
            case EXPRCLASS_REG: return 1;
            case EXPRCLASS_REG16: return 2;
            case EXPRCLASS_RELPTR: return 1;
            case EXPRCLASS_PATTPTR: return 1;
            case EXPRCLASS_NPATTPTR: return 1;
            case EXPRCLASS_ABSPTR: return 1;
            case EXPRCLASS_STACK: return 1;
        }
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
            return this.rv.getUint8();
        } else {
            return this.rv.getInt16();
        }
    }
    set_flag(flag, value) {
        if (value > 0) { this.reg8s[REG8_STATUS] |= flag; }
        else { this.reg8s[REG8_STATUS] &= ~flag; }
    }
    pc(x) {
        if (x === undefined) { return this.eval_reg16ptr(REG16_PC); }
        else {
            this.original_pc = x;
            return this.reg16s[REG16_PC] = 0;
        }
    }
    cp(x) {
        if (x === undefined) { return this.reg16s[REG16_CP]; }
        else { this.reg16s[REG16_CP] = 0;
            this.original_cp = x;
        }
    }
    sp() { return this.reg16s[REG16_SP]; }
    status() { return this.reg8s[REG8_STATUS]; }
    rng(x) {
        if (x === undefined) { return this.reg8s[REG8_RANDOM]; }
        else { this.reg8s[REG8_RANDOM] = x; }
    }
    with_reg16ptr(r16, action) {
        return this.rv.with_absptr(this.eval_reg16ptr(r16), () => {
            return action();
        });
    }
    with_sp(os, action) { return this.with_reg16ptr(this.reg16s[REG16_SP] + os, () => { return action(); }); }
    eval_reg16ptr(r16) {
        if (r16 == REG16_CP) { return this.original_cp + this.reg16s[REG16_CP]; }
        else {  return this.original_pc + this.reg16s[r16]; }
    }
}
