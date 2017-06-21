ITABLE = {
    "kill":    0x00,
    "jump":    0x01,
    "add":     0x02,
    "mov":     0x03,
    "write":   0x04,
    "birth":   0x05,
    "xor":     0x06,
    "and":     0x07,
    "or":      0x08,
    "gt":      0x09,
    "eq":      0x0a,
    "lt":      0x0b,
    "nz":      0x0c,
    "z":       0x0d,
    "noppatt": 0x0e
};

class Assembler {
    static enough_bytes_for_anyone { return 10000; }
    static assemble(text) {
        var buffer = new ArrayBuffer(enough_bytes_for_anyone());
        var dv = new DataView(buffer);
        var lines = text.split(/\n/);
        var os = 0;
        lines.forEach(function(line) {
            var tokens = line.split(/ /);
            os += assemble_instruction(dv, os, tokens);
        });
        return buffer;
    }
    static assemble_instruction(dv, os, tokens) {
        switch (tokens.shift()) {
            case "kill":
                dv.setUint8(os, 0x00);
                break;
            case "jump":
                dv.setUint8(os, 0x01);
                
                break;
        }
    }
    static assemble_expr(dv, os, token) {
        
    }
    static disassemble(bytes) {
    }
}
