class Executor {
    constructor() {
        this.running = true;
        this.total_clocks = 0;
    }
    run(max_steps) {
        let num_steps = 0;
        while (num_steps++ < max_steps && this.running) {
            this.step();
        }
    }
    id(bytecode) { GeneBank.gene_id(bytecode); }
    // Required by children
    step() { this.total_clocks++; this.program().rng(Utils.random(0, 256)); }
    kill() {}
    birth(bytecode) {}
    guid(program ) {}
    set_pid() {}
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
        this.break_birth = false;
        // Settings
        this.max_programs = 10;
        this.timeslice_size = 10;
        this.max_clocks = 1000;
        this.reseed_clocks = 10000000;
        this.catastrophe_clocks = 1000000;
        
        this.seed();
    }
    step() {
        super.step();
        let pr = this.program();
        pr.step(this.rv);
        if (this.timeslice_cycle++ >= this.timeslice_size) { this.next_program(); }
        if (this.should_reap()) { this.reap(); }
        if (this._programs.length == 0 || this.total_clocks % this.reseed_clocks == 0) { this.seed(); }
        if (this.total_clocks % this.catastrophe_clocks == 0) { this.catastrophe(); }
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
    kill(pid) {
        if (pid == undefined) {
            this.reap();
        } else {
            this._programs.splice(pid, 1);
            if (this._programs.length == 0) { this.seed(); }
            this.next_program();
        }
    }
    spawn(pc, id) { let pr = new Program(this, id, this.guid++); pr.pc(pc); this._programs.push(pr); this.genebank.onspawn(pr);}
    get_default_cp() { return Utils.random(0, this.memory.byteLength); }
    birth(parent, bytecode) {
        if (this.break_birth) { this.running = false; }
        let pr = this.program();
        pr.lineage = parent.lineage+1;
        this.genebank.onbirth(pr,bytecode);
        this.spawn(pr.original_cp, GeneBank.gene_id(bytecode));
    }
    should_reap() {
        let pr = this.program();
        if (pr === undefined) { return false; }
        return this._programs.length > this.max_programs ||
               pr.num_clocks > this.max_clocks;
    }
    set_pid(pid) { this.pid = (pid + this._programs.length) % this._programs.length; }
    catastrophe() {
        Utils.range(this.rv.byteLength).forEach(n => {
            let rng = Utils.random(0, 256);
            this.rv.setUint8(rng);
        });
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
    step() { super.step(); this._program.step(this.rv); }
    kill(program) { this.running = false; }
    birth(bytecode) { this.child = bytecode; }
    program() { return this._program; }
    programs() { return [ this._program ];}
    get_default_cp() { return 9000; }
}

// Programs that successfully replicate themselves get added to a 'gene bank'
class GeneBank {
    constructor(seed_bytecode) {
        this.seed = seed_bytecode;
        this.reseed();
        // Settings
        this.max_genes = 1000;
        this.min_lineage = 5;
        this.min_spawn_pct = 0.75;
        this.autoprune = true;
    }
    add_gene(bytecode, lineage) {
        lineage = lineage || 0;
        let gene_id = GeneBank.gene_id(bytecode);
        this.pool.push(gene_id);
        let gene = { bytecode: bytecode, num_spawns: 0, num_gets: 0, deepest_lineage: lineage };
        this.genes[gene_id] = gene
        if (this.genes.length > this.max_genes) { this.delete_gene(); }
        return gene;
    }
    get_gene() {
        let gene_id = this.pool.shift();
        let gene = this.genes[gene_id];
        if (this.should_prune(gene)) { this.delete_gene(gene_id); return this.get_gene(); }
        gene.num_gets++;
        this.pool.push(gene_id);
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
    onspawn(program) {
        let gene_id = program.id;
        let gene = this.genes[gene_id];
        if (gene) { gene.num_spawns++; }
    }
    onbirth(program, bytecode) {
        let gene_id = GeneBank.gene_id(bytecode);
        let gene = this.genes[gene_id];
        let should_add = true;
        should_add &= (program.id == gene_id);
        should_add &= (gene === undefined);
        should_add &= (program.lineage >= this.min_lineage);
        if (should_add) { this.add_gene(bytecode, program.lineage); }
        if (gene) { gene.deepest_lineage =  Math.max(gene.deepest_lineage, program.lineage); }
    }
    should_prune(gene) {
        return this.autoprune &&
               gene.num_spawns > 100 &&
               gene.num_spawns * this.min_spawn_pct < gene.num_gets;
    }
    reseed() { this.genes = {}; this.pool = []; this.add_gene(this.seed); }
    static gene_id(bytecode) {
        return bytecode.byteLength.toString() + "~" + Utils.djb(bytecode).toString(16);
    }
}
