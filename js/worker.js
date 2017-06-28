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
        let ret = {
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
            memory: ex.rv.buffer,
            child_memory: ex.rv.slice(program.original_cp, 256),
            programs: ex.programs().map(pr => { return {
                pc: pr.pc(),
                cycles: pr.num_clocks,
                lineage: pr.lineage,
                guid: pr.guid,
                id: pr.id
            }; }),
            gene_bank: {
                genes: ex.genebank.genes,
                pool: ex.genebank.pool
            }
        };
        return ret;
    }
}
var runner = new ExecutorRunner();
onmessage = function(e) { runner.on_message(e); };
