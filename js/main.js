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
        set("inst", view.inst);
        set("guid", view.guid.toString(10));
        set("pc", rg.pc.toString(16));
        set("sp", rg.sp.toString(16));
        set("cp", rg.cp.toString(16));
        set("st", rg.st.toString(2));
        set("rng", rg.rng.toString());
        set("R4", rg.R4);
        set("R5", rg.R5);
        set("R6", rg.R6);
        set("R7", rg.R7);
        document.getElementById("assembler").value = view.disassembly;
        document.getElementById("memory").value = this.memory_view(view.memory);
        document.getElementById("child-memory").value = this.memory_view(view.child_memory);
        let programs = document.getElementById("programs");
        programs.innerHTML = '<tr><td>Program #</td><td>Program Hash</td><td>pc</td><td># cycles</td></tr>';
        
        view.programs.forEach(prv => {
            let tr = document.createElement("tr");
            let td1 = document.createElement("td"); td1.innerText = prv.guid.toString();
            let td2 = document.createElement("td"); td2.innerText = prv.id.toString();
            let td3 = document.createElement("td"); td3.innerText = prv.pc.toString(16);
            let td4 = document.createElement("td"); td4.innerText = prv.cycles.toString();
            tr.appendChild(td1);
            tr.appendChild(td2);
            tr.appendChild(td3);
            tr.appendChild(td4);
            programs.appendChild(tr);
        });
    }
    memory_view(buffer, start, size) {
        let dv = new RingView(buffer, true);
        let output = "";
        start = (start === undefined) ? 0 : start;
        size = (size === undefined) ? buffer.byteLength : size;
        let padding = start % 16;
        start -= padding;
        size += padding;
        for (let os = start; size --> 0; os++) {
            if (os % 16 == 0) { output += Utils.pad2(os.toString(16)) +": " }
            let byte = dv.getUint8(os);
            output += Utils.pad2(byte.toString(16));
            if (os % 16 == 15) { output += "\n"; }
            else { output += " "; }
        }
        return output;
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
        document.getElementById("btn-pause").onclick = function() {
            main.running = false;
        };
        document.getElementById("btn-step").onclick = function() {
            main.worker.postMessage([ "step" ]);
        };
        document.getElementById("btn-run").onclick = function() {
            main.running = true;
            window.requestAnimationFrame(() => { main.on_interval(); });
        };
        document.getElementById("btn-run300").onclick = function() {
            main.worker.postMessage([ "run300" ]);
        };
    }
}

var main = new Main(); // Give Javascript console access to everything
