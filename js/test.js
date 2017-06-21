class Test {
    static all() {
        this.test_assembler();
    }

    static test_assembler() {
        var test = this;
        // assemble(disassemble(x)) == x
        Utils.range(1).forEach(function(i) {
            var expected = TestUtils.arbitrary_buffer();
            var disassembled = Assembler.disassemble(expected);
            var actual = Assembler.assemble(disassembled)
            TestUtils.assert_buffer_equal(expected, actual, disassembled);
        });
        // Ideally, we'd test disassemble(assemble(x :: Arbitrary BinaryAST)) == x, but code isn't structured for that.
    }
}

