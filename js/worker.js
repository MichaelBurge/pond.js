self.importScripts(
    'ring_view.js',
    'program.js',
    'executor.js',
    'assembler.js',
    'test_utils.js',
    'utils.js',
    'test.js',
    'main.js'
);
class ExecutorRunner {
    constructor() {
        let bytecode = Assembler.assemble(Test.copier_program());        
        this.executor = new PoolExecutor(bytecode);
    }
    on_message(e) {
        let [ msg, arg ] = e.data;
        let ex = this.executor;
        switch (msg) {
            case "step": ex.step(); break;
            case "run300": ex.run(300); break;
            case "runTime":
                {
                    let startTime = Date.now();
                    while ((Date.now() - startTime) < arg) {
                        ex.step();
                    }
                }
                break;
            default: throw "unknown event" + msg;
        }
        postMessage(this.serialize());
    }
    serialize() {
        let ex = this.executor;
        let program = ex.program();
        let inst = ex.rv.with_relptr(0, () => Assembler.disassemble_instruction(ex.rv));
        let r8 = n => { return program.reg8s[n].toString(); };
        let r16 = n => { return program.reg16s[n].toString(); };
        return {
            guid: program.guid.toString(10),
            inst: inst,
            registers: {
                pc: program.pc(),
                sp: program.sp(),
                cp: program.cp(),
                st: program.status(),
                rng: program.rng(),
                R4: r16(4),
                R5: r16(5),
                R6: r16(6),
                R7: r16(7)
            },
            disassembly: Assembler.disassemble(ex.rv.forward_slice(100)),
            memory: this.memory_view(ex.rv.buffer),
            child_memory: this.memory_view(ex.rv.buffer, program.original_cp, 256),
            programs: ex.programs().map(pr => { return {
                guid: pr.guid,
                id: ex.id(pr)
            }; })
        };
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
}
var runner = new ExecutorRunner();
onmessage = function(e) { runner.on_message(e); };
