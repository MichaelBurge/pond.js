BUFFER = null

class Test {
    static all() {
        let test = this;
        test.test_ringview();
        test.test_instructions();
        //test.test_copier_program();
        TestUtils.minimize(5000, function(size) {
            BUFFER = TestUtils.arbitrary_buffer(5000);
            //test.test_assembler(size);
        });

    }
    static test_ringview() {
        // Bug #1: Javascript bitwise operators are signed
        {
            let buf = new ArrayBuffer(4);
            let rv = new RingView(buf);
            let expected = 0xffffffff;
            rv.setUint32(expected);
            rv.seek(0);
            let actual = rv.getUint32();
            TestUtils.assert_equal(expected, actual, "");
        }
        // Bug #2: Forward slice
        {
            let buf = new ArrayBuffer(2);
            let rv = new RingView(buf, true);
            rv.setUint8(0xff);
            rv.setUint8(0xaa);
            let copy = new RingView(rv.forward_slice(2));
            let a = copy.getUint8();
            let b = copy.getUint8();
            TestUtils.assert_equal(0xff, a, "");
            TestUtils.assert_equal(0xaa, b, "");
        }
        // Check #3: Search
        {
            let buf = new Uint8Array([ -1,-1,-1,5,6,7,8,-1,-1,-1 ]).buffer;
            let rv = new RingView(buf);
            { // Forward
                let relptr = rv.search(10, [5,6,7,8], 1);
                TestUtils.assert_equal(3, relptr, "");
            }
            { // Backward
                rv.seek(7);
                let relptr = rv.search(10, [5,6,7,8], -1);
                TestUtils.assert_equal(-4, relptr, "");
            }
            
        }
    }
    static test_instructions() {
        let previously_problematic_instructions = [
            [ "xor 91 91\n", [ 0x06, 91, 91 ], true],
            [ "lit 05 ff 06 ff\n", [ 0x05, 0xff, 0x06, 0xff ], false],
            [ "jump -0xffffffff\n", [ 0x01, 155, 0xff, 0xff, 0xff, 0xff ], true],
            [ "mov [R5] [cp]\n", [ 0x03, 156+5, 156+2], true],
        ];
        
        previously_problematic_instructions.forEach(([ expected_asm, expected_bytecode, is_invertible ]) => {
            let expected_buffer = new Uint8Array(expected_bytecode).buffer;
            let actual_buffer = Assembler.assemble(expected_asm);
            //console.log(new Uint8Array(buffer).join(' '));
            // assemble(disassemble(assemble(x))) = x, but disassemble(assemble(y)) is not necessarily y.
            // additionally, the output buffer may be 1-3 bytes longer, because of multi-byte instructions
            if (is_invertible) {
                let actual_asm = Assembler.disassemble(actual_buffer);
                TestUtils.assert_buffer_equal(expected_buffer, actual_buffer, actual_asm);
                TestUtils.assert_equal(expected_asm, actual_asm, "");
            } else {
                let actual_asm = Assembler.disassemble(actual_buffer);
                let bytes = new Uint8Array(actual_buffer.buffer);
                TestUtils.assert_buffer_equal(expected_buffer, actual_buffer.slice(0, expected_buffer.byteLength), actual_asm);
                TestUtils.assert_buffer_equal(expected_buffer, Assembler.assemble(actual_asm).slice(0, expected_buffer.byteLength), "");
            }

        });
    }
    static test_assembler(size) {
        let test = this;
        // assemble(disassemble(x)) == x
        let expected = BUFFER.slice(0, size);
        let disassembled = Assembler.disassemble(expected);
        let actual = Assembler.assemble(disassembled)
        actual = actual.slice(0, size);
        TestUtils.assert_buffer_equal(expected, actual, disassembled);
        // Ideally, we'd test disassemble(assemble(x :: Arbitrary BinaryAST)) == x, but code isn't structured for that.
    }
    static copier_program() {
        return `
            mov pc R7
            jump 4
            lit ae ae ae ae
            mov 0 R6
            eq 0 0
            jump 4
            lit ff ff ff ff
            mov R7 R5
            add R6 R5
            mov [R5] [cp]
            add 1 R6
            add 1 cp
            lt R6 63
            jump -0xffffffff
            birth 0xc07fefe0
            eq 0 0
            jump -0xaeaeaeae
            lit c0 7f ef e0`;
    }
    static test_copier_program() {
        let copier = this.copier_program();
        let expected = Assembler.assemble(copier);
        //TestUtils.assert_equal(copier, Assembler.disassemble(expected));
        let executor = new ProgramExecutor(expected);
        executor.run(300);
        let actual = executor.get_child() || (()=>{throw "No child program";})();
        TestUtils.assert_buffer_equal(expected, actual, Assembler.disassemble(actual));
    }
}

