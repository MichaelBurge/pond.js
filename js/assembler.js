ITABLE = [
    // [ opcode, arity, token ]
    [ 0x00, 0, "kill" ],
    [ 0x01, 1, "jump" ],
    [ 0x02, 2, "add" ],
    [ 0x03, 2, "mov" ],
    [ 0x04, 2, "sub" ],
    [ 0x05, 0, "birth" ],
    [ 0x06, 2, "xor" ],
    [ 0x07, 2, "and" ],
    [ 0x08, 2, "or" ],
    [ 0x09, 1, "neg" ],
    [ 0x0a, 2, "gt" ],
    [ 0x0b, 2, "eq" ],
    [ 0x0c, 2, "lt" ],
    // [ 0x0d, 1, "nz" ],
    // [ 0x0e, 1, "z" ],
];

ITABLE_BY_TOKEN = null;

EXPRCLASS_IMM = 0x0;
EXPRCLASS_REG = 0x1;
EXPRCLASS_REG16 = 0x2;
EXPRCLASS_RELPTR = 0x3;
EXPRCLASS_PATTPTR = 0x4;
EXPRCLASS_NPATTPTR = 0x5;
EXPRCLASS_ABSPTR = 0x6;
EXPRCLASS_STACK = 0x7;

class Assembler {
    static enough_bytes_for_anybody() { return 10000; }
    static assemble(text) {
        let asm = this;
        let buffer = new ArrayBuffer(this.enough_bytes_for_anybody());
        let dv = new RingView(buffer);
        let lines = text.split(/\n/);
        lines.forEach(line => {
            let tokens = line.split(/ /).filter(function(token) { return token.length > 0; });
            if (tokens.length == 0) {
                return;
            } else {
                asm.assemble_instruction(dv, tokens);
            }
        });
        return dv.truncate();
    }
    static disassemble(buffer, max) {
        let output = "";
        let dv = new RingView(buffer);
        max = (max === undefined) ? 1000 : max;
        while (! dv.is_done() && max --> 0) {
            let line = this.disassemble_instruction(dv);
            output += line;
            output += "\n";
        }
        return output;
    }
    static assemble_instruction(dv, tokens) {
        let asm = this;
        let arityk = function(n, k) {
            dv.setUint8(n);
            for (let i = 0; i < k; i++) {
                asm.assemble_expr(dv, tokens.shift());
            }
        };
        let token = tokens.shift();
        switch (token) {
            case "nop":
                {
                    let arg_token = tokens.shift();
                    let arg = Utils.read_hex(arg_token);
                    dv.setUint8(arg);
                }
                break;
            case "lit":
                {
                    tokens.forEach(x => {
                        dv.setUint8(parseInt(x, 16));
                    });
                }
                break;
            case "birth":
                {
                    let arg_token = tokens.shift();
                    let arg = parseInt(arg_token, 16);
                    let [opcode, arity, ] = this.get_token_metadata(token);
                    dv.setUint8(opcode);
                    dv.setUint32(arg);
                }
                break;
            default:
                let [opcode, arity, ] = this.get_token_metadata(token);
                arityk(opcode, arity);
                break;
        }
    }
    static get_opcode_metadata(opcode) {
        if (opcode >= ITABLE.length) {
            return [ opcode, 0, "nop " + opcode.toString(16) ];
        } else {
            return ITABLE[opcode];
        }
    }
    static get_token_metadata(token) {
        if (token == "nop") {
            throw "don't call get_token_metadata() on nop instructions";
        }
        if (ITABLE_BY_TOKEN == null) {
            ITABLE_BY_TOKEN = {};
            for (let i = 0; i < ITABLE.length; i++) {
                let [opcode,arity,token] = ITABLE[i];
                ITABLE_BY_TOKEN[token] = ITABLE[i];
            }
        }
        return ITABLE_BY_TOKEN[token];
    }
    // op_act = function(opcode, opcode_args) { action(opcode_args); return result;}
    // expr_act = function(exprclass, exprclass_args) { action(exprclass_args); return result; }
    static isa_mapM(dv, expr_act, op_act) {
        let asm = this;
        let opcode = dv.getUint8();
        let arityk = function(k) {
            let args = Utils.range(k).map(x => {
                let result = asm.expr_mapM(dv, expr_act);
                return result;
            });
            return op_act(opcode, args);
        };
        
        let [opcode2, arity, token] = this.get_opcode_metadata(opcode);
        if (token == "birth") {
            let arg = dv.getUint32();
            return op_act(opcode, arg);
        } else {
            return arityk(arity);
        }
    }

    static expr_mapM(dv, expr_act) {
        let arg1 = dv.getUint8();
        if (arg1 < 128) {
            return expr_act(EXPRCLASS_IMM, arg1);
        } else if (arg1 < 144) {
            return expr_act(EXPRCLASS_REG, arg1 - 128);
        } else if (arg1 < 152) {
            return expr_act(EXPRCLASS_REG16, arg1 - 144);
        } else {
            switch (arg1) {
                case 152: return expr_act(EXPRCLASS_RELPTR, dv.getUint8());
                case 154: return expr_act(EXPRCLASS_RELPTR, -dv.getUint8());
                case 153: return expr_act(EXPRCLASS_PATTPTR, dv.getUint32());
                case 155: return expr_act(EXPRCLASS_NPATTPTR, dv.getUint32());
                case 156: 
                default:
                    if (arg1 < 172) {
                        return expr_act(EXPRCLASS_ABSPTR, arg1 - 156);
                    } else {
                        return expr_act(EXPRCLASS_STACK, arg1 - 172);
                    }
            }
        }
        throw "???";
    }
    
    static disassemble_instruction(dv) {
        let asm = this;
        return this.isa_mapM(dv, function(exprclass, arg) { return asm.disassemble_expr(exprclass, arg); }, function(opcode, args) {
            let [ opcode2, arity, token ] = asm.get_opcode_metadata(opcode);
            if (token == "birth") {
                args = args.toString(16);
            }
            return [ token ].concat(args).join(' ');
        });
        
    }
    static assemble_expr(dv, token) {
        let arg;
        token = token.replace("pc", "R0");
        token = token.replace("sp", "R1");
        token = token.replace("cp", "R2");
        // imm
        if (/^\d\d?\d?$/.exec(token)) {
            dv.setUint8(parseInt(token));
            return 1;
        }
        // reg
        else if (arg = /^r(\d+)$/.exec(token)) {
            let [ text, reg_id ] = arg;
            dv.setUint8(128 + parseInt(reg_id));
            return 1;
        }
        // reg16
        else if (arg = /^R(\d)$/.exec(token)) {
            let [ text, reg_id ] = arg;
            dv.setUint8(144 + parseInt(reg_id));
            return 1;
        }
        // relptr
        else if (arg = /^\[pc\+(\d+)\]$/.exec(token)) {
            let [ text, os ] = arg;
            dv.setUint8(152);
            dv.setUint8(parseInt(os));
            return 2;
        }
        // nrelptr
        else if (arg = /^\[pc-(\d+)\]$/.exec(token)) {
            let [ text, os ] = arg;
            dv.setUint8(154);
            dv.setUint8(parseInt(os));
            return 2;
        }
        // pattptr
        else if (arg = /^0x[0-9a-f]+$/.exec(token)) {
            let [,patt] = arg;
            dv.setUint8(153);
            dv.setUint32(Utils.read_hex(patt));
            return 5;
        }
        // npattptr
        else if (arg = /^-0x([0-9a-f]+$)/.exec(token)) {
            let [,patt] = arg;
            dv.setUint8(155);
            dv.setUint32(Utils.read_hex(patt));
            return 5;
        }
        // absptr
        else if (arg = /^\[R([0-9])\]$/.exec(token)) {
            let [,reg16] = arg;
            dv.setUint8(156 + parseInt(reg16));
            return 1;
        }
        // stack
        else if (arg = /^\[sp-([0-9a-f]+)\]$/.exec(token)) {
            let [ text, os ] = arg;
            dv.setUint8(172 + parseInt(os));
            return 1;
        }
        else {
            throw "unknown expr token: " + token;
        }
    }
    static disassemble_expr(exprclass, arg) {
        let reg16 = n => {
            switch (arg) {
                case 0: return "pc";
                case 1: return "sp";
                case 2: return "cp";
                default: return "R" + arg.toString();

            };
        };
        switch (exprclass) {
            case EXPRCLASS_IMM: return arg.toString();
            case EXPRCLASS_REG: return "r" + arg.toString();
            case EXPRCLASS_REG16: return reg16(arg);
            case EXPRCLASS_RELPTR: return "[pc+" + arg.toString() + "]";
            case EXPRCLASS_PATTPTR: return "0x" + arg.toString(16);
            case EXPRCLASS_NPATTPTR: return "-0x" + arg.toString(16);
            case EXPRCLASS_ABSPTR: return "[" + reg16(arg) + "]";
            case EXPRCLASS_STACK: return "[sp-" + arg.toString() + "]";
            default: throw "unknown exprclass: " + exprclass.toString();
        }
    }
}
