# pond.js
Programs compete for CPU in the same memory space. Demo: https://michaelburge.github.io/pond.js/

## Interface
These are the available panes to interact with the pond:
* Gene Bank: Stores programs that have successfully copied themselves multiple times.
 * The act of pulling a program from the Gene Bank, copying it into memory, and spawning a process is called "seeding".
 * If there are no active programs, the executor will seed its memory.
 * Every reseed_clocks cycles, the executor will seed its memory.
 * Programs must maintain a 75% spawn/seed ratio to remain in the gene bank, to prevent lucky nonfunctional programs from forever being injected into memory.
 * "Disassemble" will pause the Executor and load a disassembly of the stored bytecode into the Disassembly area
* Active Programs: Shows a list of active processes.
 * "Debug" will switch the context to the selected process, allowing you to step through it or view detailed information with the debugger.
 * "Kill" will remove the program from the table
 * "Program Hash" shows the id attribute
 * "# cycles" shows the num_clocks attribute
 * "Lineage Depth" shows the lineage attribute
* Debugger: Allows you to see detailed information on a specific program, and step through it cycle-by-cycle.
 * "Run" will cause the executor to repeatedly run for WORKER_TIMESLICE(=50) milliseconds and update the UI.
 * "Step" will run the executor for a single cycle, which includes timeslicing between active programs.
 * "Pause" will stop automatically running the executor.
 * "Break on Birth" will run for WORKER_TIMESLICE milliseconds, or until a 'birth' instruction successfully creates a child process.
 * "Disassembly" shows a disassembly of the range [pc, pc+100), or of a chosen program from the Gene Bank.
* Memory: Shows a hexadecimal display of the entire 64kb memory. Addresses are shown every 16 bytes on the left.
* Child Memory: Shows a hexadecimal display of the current program's [cp_root, cp_root+256) region, which a subsequent 'birth' instruction will create a process from.
## Executor

The Executor maintains a 64kb memory space, a list of active programs, and a gene bank. It:

* Timeslices between the active programs
* Reaps old programs
* Seeds new programs
* Causes occasional "catastrophe" events that randomize all bytes, which usually kills off all active programs.

The memory space is in a 'ring buffer' that wraps around on overflow. The data structure that does this doesn't depend on 16-bit integer overflow, and will work for any sized buffer.

## Program

Programs have the following attributes:
* A memory space shared by all programs. Currently, this is 64kb, though if implemented the instruction set should support arbitrary sizes.
* 16 unsigned 8-bit registers, which can also be viewed as 8 signed 16-bit registers.
* id: The size of the bytecode in bytes, followed by a hash of that bytecode.
* guid: A globally unique identifier for a specific instance of a program.
* num_clocks: A cycle counter. Programs are terminated after 1000 clock cycles.
* lineage: Incremented by 1 each time a program spawns a child process.
* same_lineage: Incremented by 1 each time a program spawns an identical copy of itself.
* pc_root(aka original_pc): The center of a 64kb chunk that the program is capable of addressing, 32kb to the left and 32kb to the right of its starting point.
* cp_root(aka original_cp): Programs can request that memory be allocated for a child process, which sets cp_root and causes writes to the cp register to be relative to it.
* max_child_size: Child processes won't be created if a size greater than max_child_size is requested.
* max_nops: Kills the process after this many nop instructions have been run, which prevents stragglers from iterating over the entire memory pool and luckily copying themselves.

## Opcodes

To parse an instruction, refer to the below table. Arguments are described in the Expressions section.

* 0x00: kill - Removes pc from executor's active pool
* 0x01: jump expr:relptr - Adds expr to pc if TEST flag is set
* 0x02: add src:expr dest:lexpr - Writes sum of src and dest into &dest
* 0x03: mov src:expr dest:lexpr - Copies src into &dest
* 0x04: write src:expr dest:lexpr - Writes into the designated child cell's address space
* 0x05: birth size:expr - Releases child cell of a certain size to the executor. 
* 0x06: xor src:expr dest:lexpr
* 0x07: and src:expr dest:lexpr
* 0x08: or src:expr dest:lexpr
* 0x09: neg dest:lexpr
* 0x0a: gt a:expr b:expr - a > b, Sets TEST flag
* 0x0b: eq a:expr b:expr - a = b, Sets TEST flag
* 0x0c: lt a:expr b:expr - a < b, Sets TEST flag
* 0x0d: push a:expr - Assigns a into &sp and moves the stack pointer
* 0x0e: pop a:lexpr - Moves the stack pointer, and assigns sp into &a
* 0x0f: alloc - Sets cp_root,
* 0x0f-0xff: nop OPCODE - every byte is a different nop instruction. There is a setting to automatically terminate programs after N=10 of these nops.

## Expressions
An instruction may take arguments. These directly follow the instruction, and fall into these classes:

* 0x0: imm - 7-bit immediate. As an expr, evaluates to itself. As an lexpr, is interpreted as a relptr.
* 0x1: reg8 - 16 registers. As an expr, evaluates to the register contents. As an lexpr, writes to the register.
 * r0:r1=R0=pc is the program counter
 * r2:r3=R1=sp is the stack pointer
 * r4:r5=R2=cp is the child pc, set on program start and birth instruction
 * r6 is the status register. There is only 1 status, the TEST flag.
 * r7 is a new random number at each step
* 0x2: reg16 - 8 16-bit registers, acting as a different view of the 16 8-bit registers. expr/lexpr are read/write.
 * Rn = rn:r[n+1], so R14 = r14:r15
* 0x3: relptr - Followed by a byte x. As an expr, evaluates to *(pc+x). As an lexpr, evaluates to the memory at pc+x.
* 0x4: pattptr - Followed by a byte[4]. Does a linear search(max 256 bytes) in memory for the 4-byte pattern. As an expr, returns the value at that memory. As an lexpr, is a relptr pointing just past the pattern.
 * pattptrs are relative to the end of the pattern, while npattptrs are relative to the start of the instruction.
* 0x3: nrelptr - Followed by a byte. Negative relptr
* 0x5: npattptr - Followed by a byte[4]. Does a backward linear search(max 256), like pattptr.
* 0x6: absptr - One for each 16-bit register r16. If r16 is the cp register, points to [cp_root + r16]. Otherwise, points to [pc_root + r16].
* 0x7: stack - One for 84 addressible stack locations x. Refers to [pc_root + stack pointer + x].

To parse an expression, read a uint8 and match it below:
* imm:[0-128)
* reg8:[128:144)
* reg16:[144:152)
* relptr:152 + byte
* pattptr:153 + byte[4]
* nrelptr:154 + byte
* npattptr:155 + byte[4]
* absptr:[156:172)
* stack:[172:256)

## Worker

PoolJS uses the new "Workers" feature to run processing in the background. UI elements send commands to a worker, which executes them and sends the complete current state back.
