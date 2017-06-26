class Executor {
    constructor() {
        this.running = true;
    }
    run(max_steps) {
        let num_steps = 0;
        while (num_steps++ < max_steps && this.running) {
            this.step();
        }
    }
    id(bytecode) { return Utils.djb(bytecode).toString(16); }
    // Required by children
    step() { }
    kill() {}
    birth(bytecode) {}
}

// Designed for executing a pool of related programs.
class PoolExecutor extends Executor {
    constructor(seed_bytecode) {
        super();
        this.memory = new ArrayBuffer(65536);
        this.rv = new RingView(this.memory, true);
        this.pool = [ seed_bytecode ];
        this._programs = [ ];
        this.timeslice_cycle = 0;
        this.pid = 0;
        
        // Settings
        this.max_programs = 2;
        this.timeslice_size = 100;

        this.seed();
    }
    step() {
        let pr = this.program();
        pr.step(this.rv);
        if (this.timeslice_cycle >= this.timeslice_size) { this.next_program(); }
        if (this.should_reap()) { this.reap(); }
        if (this._programs.length == 0) { this.seed(); }
    }

    seed() { this.birth(this.seed_bytecode); this.pid = 0;}
    inject(bytecode) { new RingView(bytecode).copy(this.rv, bytecode.byteLength); }
    program() { return this._programs[this.pid]; }
    next_program() { this.pid = (this.pid + 1) % this._programs.length; this.timeslice_cycle = 0; }
    programs() { return this._programs; }
    reap() { this._programs.shift(); this.pid %= this._programs.length; }
    kill() { this.reap(); }
    birth(bytecode) { let pr = new Program(this, this.id(bytecode)); this._programs.push(pr);}
    should_reap() { return this._programs.length > this.max_programs; }
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
        this._program = new Program(this, this.id(bytecode));
        this._program.cp(9000);
        this.child = null;
    }
    get_child() { return this.child; }
    step() { this._program.step(this.rv); }
    kill(program) { this.running = false; }
    birth(bytecode) { this.child = bytecode; }
    program() { return this._program; }
    programs() { return [ this._program ];}
}
