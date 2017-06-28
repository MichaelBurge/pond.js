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
    id(bytecode) { GeneBank.gene_id(bytecode); }
    // Required by children
    step() { }
    kill() {}
    birth(bytecode) {}
    guid(program ) {}
}

// Designed for executing a pool of related programs.
class PoolExecutor extends Executor {
    constructor(seed_bytecode) {
        super();
        this.memory = new ArrayBuffer(65536);
        this.rv = new RingView(this.memory, true);
        this._programs = [ ];
        this.timeslice_cycle = 0;
        this.pid = 0;
        this.guid = 0;
        this.genebank = new GeneBank(seed_bytecode);
        // Settings
        this.max_programs = 10;
        this.timeslice_size = 10;
        this.max_clocks = 1000;
        
        this.seed();
    }
    step() {
        let pr = this.program();
        pr.step(this.rv);
        if (this.timeslice_cycle++ >= this.timeslice_size) { this.next_program(); }
        if (this.should_reap()) { this.reap(); }
        if (this._programs.length == 0) { this.seed(); }
    }

    seed() {
        let bytecode = this.genebank.get_gene();
        let pc = Utils.random(0,this.memory.byteLength);
        this.rv.seek(pc);
        this.spawn(pc, GeneBank.gene_id(bytecode));
        this.inject(bytecode);
    }
    inject(bytecode) { new RingView(bytecode).copy(this.rv, bytecode.byteLength); }
    program() { return this._programs[this.pid]; }
    next_program() { this.pid = (this.pid + 1) % (this._programs.length || 1); this.timeslice_cycle = 0; }
    programs() { return this._programs; }
    reap() { this._programs.shift(); this.next_program(); }
    kill() { this.reap(); }
    spawn(pc, id) { let pr = new Program(this, id, this.guid++); pr.pc(pc); this._programs.push(pr); this.genebank.onspawn(id);}
    birth(bytecode) { let pr = this.program(); this.genebank.onbirth(pr,bytecode);this.spawn(pr.original_cp, GeneBank.gene_id(bytecode));}
    get_default_cp() { return Utils.random(0, this.memory.byteLength); }
    should_reap() {
        let pr = this.program();
        if (pr === undefined) { return false; }
        return this._programs.length > this.max_programs ||
               pr.num_clocks > this.max_clocks;
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
        this._program = new Program(this, this.id(bytecode), 0);
        this.child = null;
    }
    get_child() { return this.child; }
    step() { this._program.step(this.rv); }
    kill(program) { this.running = false; }
    birth(bytecode) { this.child = bytecode; }
    program() { return this._program; }
    programs() { return [ this._program ];}
    get_default_cp() { return 9000; }
}

// Programs that successfully replicate themselves get added to a 'gene bank'
class GeneBank {
    constructor(seed_bytecode) {
        this.genes = {}; // { gene_id: { bytecode:, num_spawns:, num_gets: } }
        this.pool = []; // [ gene_id ]
        this.max_genes = 1000;
        this.add_gene(seed_bytecode);
    }
    add_gene(bytecode) {
        let gene_id = GeneBank.gene_id(bytecode);
        this.pool.push(gene_id);
        this.genes[gene_id] = { bytecode: bytecode, num_spawns: 0, num_gets: 0 };
        if (this.genes.length > this.max_genes) { this.delete_gene(); }
    }
    get_gene() {
        let gene_id = this.pool.shift();
        this.pool.push(gene_id);
        let gene = this.genes[gene_id];
        gene.num_gets++;
        return gene.bytecode;
    }
    delete_gene(gene_id) {
        if (gene_id === undefined) {
            gene_id = this.pool.shift();
            delete this.genes[gene_id];
        } else {
            this.pool = this.pool.filter(x => x != gene_id);
            delete this.genes[gene_id];
        }
    }
    onspawn(gene_id) {
        let gene = this.genes[gene_id];
        if (gene) { gene.num_spawns++; }
    }
    onbirth(program, bytecode) {
        let gene_id = GeneBank.gene_id(bytecode);
        if (program.id == gene_id && this.genes[gene_id] === undefined) { this.add_gene(bytecode); }
    }
    static gene_id(bytecode) {
        return bytecode.byteLength.toString() + "~" + Utils.djb(bytecode).toString(16);
    }
}
