WORKER_TIMESLICE = 50; // milliseconds

class Main {
    constructor() {
        this.executor = null;
        this.timer = null;
        this.running = true;
    }
    refresh(view) {
        let set = function(id,x) {
            document.getElementById(id).innerHTML = x;
        };
        let rg = view.registers;
        set("guid", view.guid.toString(10));
        set("pc", rg.pc.toString(16) + "(" + view.inst + ")");
        set("sp", rg.sp.toString(16));
        set("cp", rg.cp.toString(16));
        set("st", rg.st.toString(2));
        set("rng", rg.rng.toString());
        set("R4", rg.R4);
        set("R5", rg.R5);
        set("R6", rg.R6);
        set("R7", rg.R7);
        document.getElementById("assembler").value = view.disassembly;
        document.getElementById("memory").value = view.memory;
        document.getElementById("child-memory").value = view.child_memory;
        let programs = document.getElementById("programs");
        programs.innerHTML = '<tr><td>Program #</td><td>Program Hash</td></tr>';
        
        view.programs.forEach(prv => {
            let tr = document.createElement("tr");
            let td1 = document.createElement("td"); td1.innerText = prv.guid.toString();
            let td2 = document.createElement("td"); td2.innerText = prv.id.toString();
            tr.appendChild(td1);
            tr.appendChild(td2);
            programs.appendChild(tr);
        });
    }
    
    on_interval() {
        if (this.running) {
            this.worker.postMessage([ "runTime", WORKER_TIMESLICE ]);
        }
        
    }

    on_message(e) {
        let executor = e.data;
        this.executor = executor;
        this.refresh(e.data);
        window.requestAnimationFrame(() => { this.on_interval(); });
    }
    
    static bind() {
        main.worker = new Worker("js/worker.js");
        main.worker.onmessage = e => { main.on_message(e); };
        window.requestAnimationFrame(() => { main.on_interval(); });
        /* document.getElementById("btn-assemble").onclick = function() {
         *     let asm = document.getElementById("assembler").value;
         *     main.load_asm(asm);
         * };*/
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
