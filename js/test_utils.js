class TestUtils {
    static arbitrary_buffer() {
        var test = this;
        var size = this.arbitrary_uint8();
        var buffer = new ArrayBuffer(size);
        var dv = new DataView(buffer);
        Utils.range(size).forEach(function(os) {
            dv.setUint8(os, test.arbitrary_uint8());
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
