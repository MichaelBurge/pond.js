BUFFER = null

class Test {
    static all() {
        let test = this;
        test.test_instructions();
        test.test_opcodes();
        TestUtils.minimize(5000, function(size) {
            BUFFER = TestUtils.arbitrary_buffer(5000);
            test.test_assembler(size);
        });

    }
    static test_instructions() {
        let previously_problematic_instructions = [
            "xor 91 91\n",
        ];
        previously_problematic_instructions.forEach(function (expected) {
            let buffer = Assembler.assemble(expected);
            //console.log(new Uint8Array(buffer).join(' '));
            let actual = Assembler.disassemble(buffer);
            TestUtils.assert_equal(expected, actual, "");
        });
    }
    static test_opcodes() {
        let previously_problematic_opcodes = [
            [ 0x7 ],
        ];
        previously_problematic_opcodes.forEach(function (bytes) {
            let expected = new Uint8Array(bytes).buffer;
            let disassembled = Assembler.disassemble(expected);
            let actual = Assembler.assemble(disassembled).slice(0, expected.byteLength);
            TestUtils.assert_buffer_equal(expected, actual, disassembled);
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
}

