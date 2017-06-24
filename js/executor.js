class Executor {
    constructor() {
        this.settings = {
        };
    }
}

// Designed for executing single programs
class ProgramExecutor extends Executor {
    constructor(bytecode) {
        super();
        this.memory = new ArrayBuffer(10000);
        this.rv = new RingView(this.memory);
        let bytecode_rv = new RingView(bytecode);
        bytecode_rv.copy(this.rv, bytecode.byteLength);
        this.rv.seek(0);
        this.program = new Program(this);
        this.program.cp(9000);
        this.running = true;
        this.child = null;
    }
    get_child() { return this.child; }
    step() {
        this.rv.seek(this.program.pc());
        this.program.step(this.rv);
    }
    run(max_steps) {
        let num_steps = 0;
        while (num_steps++ < max_steps && this.running) {
            this.step();
        }
    }
    kill(program) {
        this.running = false;
    }
    birth(bytecode) {
        this.child = bytecode;
    }
}
