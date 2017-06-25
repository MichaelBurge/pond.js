class Main {
    constructor() {
        this.executor = null;
    }
    refresh() {
        let set = function(id,x) {
            document.getElementById(id).innerHTML = x;
        };
        let ex = this.executor;
        let program = ex.program;
        let pc = program.pc();
        let inst = ex.rv.with_relptr(0, () => Assembler.disassemble_instruction(ex.rv));
        let r8 = n => { return program.reg8s[n].toString(); };
        let r16 = n => { return program.reg16s[n].toString(); };
        set("pc", pc.toString(16) + "(" + inst + ")");
        set("sp", program.sp().toString(16));
        set("cp", program.cp().toString(16));
        set("st", program.status().toString(2));
        set("rng", program.rng().toString());
        set("R4", r8(8) + ":" + r8(9) + "(" + r16(4) + ")");
        set("R5", r8(10) + ":" + r8(11) + "(" + r16(5) + ")");
        set("R6", r8(12) + ":" + r8(13) + "(" + r16(6) + ")");
        set("R7", r8(14) + ":" + r8(15) + "(" + r16(7) + ")");
        document.getElementById("assembler").value = Assembler.disassemble(ex.rv.forward_slice(100));
        document.getElementById("memory").value = this.memory_view(ex.rv.buffer);
        document.getElementById("child-memory").value = this.memory_view(ex.rv.buffer, program.original_cp, 256);
    }
    memory_view(buffer, start, size) {
        let dv = new DataView(buffer);
        let output = "";
        start = (start === undefined) ? 0 : start;
        size = (size === undefined) ? buffer.byteLength : size;
        let padding = start % 16;
        start -= padding;
        size += padding;
        let end = start + size;
        for (let os = start; os < end; os++) {
            if (os % 16 == 0) { output += Utils.pad2(os.toString(16)) +": " }
            let byte = dv.getUint8(os);
            output += Utils.pad2(byte.toString(16));
            if (os % 16 == 15) { output += "\n"; }
            else { output += " "; }
        }
        return output;
    }
    load_asm(asm) {
        let bytecode = Assembler.assemble(asm);
        this.executor = new ProgramExecutor(bytecode);
        this.refresh();        
    }
    static bind() {
        main.load_asm(Test.copier_program());
        document.getElementById("btn-assemble").onclick = function() {
            let asm = document.getElementById("assembler").value;
            main.load_asm(asm);
        };
        document.getElementById("btn-step").onclick = function() {
            main.executor.step();
            main.refresh();
        };
        document.getElementById("btn-run").onclick = function() {
            main.executor.run(300);
            main.refresh();
        };
    }
}

var main = new Main(); // Give Javascript console access to everything
