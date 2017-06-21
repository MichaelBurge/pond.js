ITABLE = [
    // [ opcode, arity, token ]
    [ 0x00, 0, "kill" ],
    [ 0x01, 1, "jump" ],
    [ 0x02, 2, "add" ],
    [ 0x03, 2, "mov" ],
    [ 0x04, 2, "write" ],
    [ 0x05, 0, "birth" ],
    [ 0x06, 2, "xor" ],
    [ 0x07, 2, "and" ],
    [ 0x08, 2, "or" ],
    [ 0x09, 1, "neg" ],
    [ 0x0a, 3, "gt" ],
    [ 0x0b, 3, "eq" ],
    [ 0x0c, 3, "lt" ],
    [ 0x0d, 2, "nz" ],
    [ 0x0e, 2, "z" ],
    [ 0x0f, 0, "noppatt" ]
];

ITABLE_BY_TOKEN = null;

EXPRCLASS_IMM = 0x0;
EXPRCLASS_REG = 0x1;
EXPRCLASS_REG16 = 0x2;
EXPRCLASS_RELPTR = 0x3;
EXPRCLASS_PATTPTR = 0x4;
EXPRCLASS_STACK = 0x5;

class Assembler {
    static enough_bytes_for_anybody() { return 10000; }
    static assemble(text) {
        var asm = this;
        var buffer = new ArrayBuffer(this.enough_bytes_for_anybody());
        var dv = new DataView(buffer);
        var lines = text.split(/\n/);
        var os = 0;
        lines.forEach(function(line) {
            var tokens = line.split(/ /).filter(function(token) { return token.length > 0; });
            if (tokens.length == 0) {
                return;
            } else {
                os += asm.assemble_instruction(dv, os, tokens);
            }
        });
        return buffer.slice(0, os);
    }
    static disassemble(buffer) {
        var output = "";
        var dv = new DataView(buffer);
        for (var os = 0; os < buffer.byteLength;) {
            let { result: line, bytes: bytes } = this.disassemble_instruction(dv, os);
            output += line;
            output += "\n";
            os += bytes;
        }
        return output;
    }
    static assemble_instruction(dv, os, tokens) {
        var asm = this;
        var original_os = os;
        var arityk = function(n, k) {
            dv.setUint8(os, n); os += 1;
            for (var i = 0; i < k; i++) {
                os += asm.assemble_expr(dv, os, tokens.shift());
            }
        };
        var token = tokens.shift();
        switch (token) {
            case "nop":
                var arg_token = tokens.shift();
                var arg = parseInt(arg_token, 16);
                dv.setUint8(os, arg); os += 1;
                break;
            case "noppatt":
                break;
            default:
                let [opcode, arity, ] = this.get_token_metadata(token);
                arityk(opcode, arity);
                break;
        }
        return os - original_os;
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
            for (var i = 0; i < ITABLE.length; i++) {
                let [opcode,arity,token] = ITABLE[i];
                ITABLE_BY_TOKEN[token] = ITABLE[i];
            }
        }
        return ITABLE_BY_TOKEN[token];
    }
    // op_act = function(opcode, opcode_args) { action(opcode_args); return result;}
    // expr_act = function(exprclass, exprclass_args) { action(exprclass_args); return result; }
    static isa_mapM(dv, os, expr_act, op_act) {
        var asm = this;
        var original_os = os;
        var opcode = dv.getUint8(os); os += 1;
        var arityk = function(k) {
            var args = Utils.range(k).map(function(x) {
                let {result, bytes} = asm.expr_mapM(dv, os, expr_act); os += bytes;
                return result;
            });
            return { result: op_act(opcode, args), bytes: os - original_os };
        };
        
        if (opcode == 0x0f) {
            return { result: op_act(0x0f, dv.getUint32(os)), bytes: 5 };
        } else {
            let [opcode2, arity, token] = this.get_opcode_metadata(opcode);
            return arityk(arity);
        }
    }

    static expr_mapM(dv, os, expr_act) {
        var arg1 = dv.getUint8(dv, os); os += 1;
        if (arg1 < 128) {
            return { result: expr_act(EXPRCLASS_IMM, arg1), bytes: 1 };
        } else if (arg1 < 144) {
            return { result: expr_act(EXPRCLASS_REG, arg1 - 128), bytes: 1 };
        } else if (arg1 < 152) {
            return { result: expr_act(EXPRCLASS_REG16, arg1 - 144), bytes: 1 };
        } else {
            switch (arg1) {
                case 152: return { result: expr_act(EXPRCLASS_RELPTR, dv.getUint8(os)), bytes: 2 };
                case 154: return { result: expr_act(EXPRCLASS_RELPTR, -dv.getUint8(os)), bytes: 2 };
                case 153: return { result: expr_act(EXPRCLASS_PATTPTR, dv.getUint32(os)), bytes: 5 };
                case 155: return { result: expr_act(EXPRCLASS_PATTPTR, -dv.getUint32(os)), bytes: 5 };
                default: return { result: expr_act(EXPRCLASS_STACK, arg1 - 148), bytes: 1 };
            }

        }
        throw "???";
    }
    
    static disassemble_instruction(dv, os) {
        var asm = this;
        return this.isa_mapM(dv,os, function(exprclass, arg) { return asm.disassemble_expr(exprclass, arg); }, function(opcode, tokens) {
            let [ opcode2, arity, token ] = asm.get_opcode_metadata(opcode);
            return [ token ].concat(tokens).join(' ');
        });
        
    }
    static assemble_expr(dv, os, token) {
        var arg;
        // imm
        if (/\d\d?\d?/.exec(token)) {
            dv.setUint8(dv, os, parseInt(token));
            return 1;
        }
        // reg
        else if (arg = /r(\d+)/.match(token)) {
            dv.setUint8(dv, os, 128 + parseInt(arg));
            return 1;
        }
        // reg16
        else if (arg = /R(\d)/.match(token)) {
            dv.setUint8(dv, os, 144 + parseInt(arg));
            return 1;
        }
        // relptr
        else if (arg = /\[pc+(\d+)\]/.match(token)) {
            dv.setUint(dv, os, 152);
            dv.setUint(dv, os+1, parseInt(arg));
            return 2;
        }
        // nrelptr
        else if (arg = /\[pc-(\d+)\]/.match(token)) {
            dv.setUint(dv, os, 154);
            dv.setUint(dv, os+1, parseInt(arg));
            return 2;
        }
        // pattptr
        else if (arg = /0x([0-9a-f]+)/.match(token)) {
            dv.setUint(dv, os, 153);
            dv.setUint32(dv, os+1, parseInt(arg));
            return 5;
        }
        // npattptr
        else if (arg = /-0x([0-9a-f]+)/.match(token)) {
            dv.setUint(dv, os, 155);
            dv.setUint32(dv, os+1, parseInt(arg));
            return 5;
        }
        // stack
        else if (arg = /[sp-([0-9a-f]+)/.match(token)) {
            dv.setUint(dv, os, 148 + parseInt(arg));
            return 1;
        }
        else {
            throw "unknown expr token: " + token;
        }
    }
    static disassemble_expr(exprclass, arg) {
        switch (exprclass) {
            case EXPRCLASS_IMM: return arg.toString();
            case EXPRCLASS_REG: return "r" + arg.toString();
            case EXPRCLASS_REG16: return "R" + (arg * 2).toString();
            case EXPRCLASS_RELPTR: return "[pc+" + arg.toString() + "]";
            case EXPRCLASS_PATTPTR: return (arg >= 0) ? "0x" + arg.toString(16) : "-0x" + (-arg).toString(16);
            case EXPRCLASS_STACK: return "[sp-" + arg.toString() + "]";
            default: throw "unknown exprclass: " + exprclass.toString();
        }
    }
}
