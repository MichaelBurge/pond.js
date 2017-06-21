class Test {
    static all() {
        this.test_assembler();
    }

    static test_assembler() {
        // assemble(disassemble(x)) == x
        Utils.range(1).forEach(function(i) {
            var expected = Test.arbitrary_buffer();
            var disassembled = Assembler.disassemble(expected);
            var actual = Assembler.assemble(disassembled)
            Assembler.assert_buffer_equal(expected, actual, disassembled);
        });
        // Ideally, we'd test disassemble(assemble(x :: Arbitrary BinaryAST)) == x, but code isn't structured for that.
    }
    // Utilities
    static arbitrary_buffer() {
        var size = this.arbitrary_uint8();
        var buffer = new ArrayBuffer(size);
        var dv = new DataView(buffer);
        Utils.range(size).forEach(function(os) {
            dv.setUint8(os, Test.arbitrary_uint8());
        });
        return buffer;
    }

    static arbitrary_uint8() {
        return this.getRandomIntInclusive(0, 256);
    }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
    static getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive 
    }
    static assert_buffer_equal(expected, actual, message) {
        this.assert_equal(expected.byteLength, actual.byteLength, "Byte lengths not equal(" + message + "):");
        for (var i = 0; i < expected.size; i++) {
            this.assert_equal(expected.byteLength, actual.byteLength, "Bytes at position" + i.toString() + " not equal(" + message + "):");
        }
    }
    static assert_equal(expected, actual, message) {
        if (expected != actual) {
            throw "Unequal values: (" + expected.toString() + " != " + actual.toString() + "): " + message;
        }
    }
}

