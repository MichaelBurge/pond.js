SEED1 = 12351235; // RNG seeds
SEED2 = 7190181;

M_W = SEED1;
M_Z = SEED2;
MASK = 0xffffffff;

class TestUtils {
    static arbitrary_buffer(size) {
        let test = this;
        let buffer = new ArrayBuffer(size);
        let dv = new DataView(buffer);
        Utils.range(size).forEach(function(os) {
            dv.setUint8(os, test.arbitrary_uint8(256));
        });
        return buffer;
    }

    static arbitrary_uint8(size) {
        return Math.min(size, this.getRandomIntInclusive(0, 256));
    }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
    static getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(this.seedable_random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive 
    }
    static assert_buffer_equal(expected, actual, message) {
        this.assert_equal(expected.byteLength, actual.byteLength, "Byte lengths not equal(" + message + "):");
        for (let i = 0; i < expected.size; i++) {
            this.assert_equal(expected.byteLength, actual.byteLength, "Bytes at position" + i.toString() + " not equal(" + message + "):");
        }
    }
    static assert_equal(expected, actual, message) {
        if (expected != actual) {
            throw "Unequal values: (" + expected.toString() + " != " + actual.toString() + "): " + message;
        }
    }
    static minimize(max_size, test) {
        let testutils = this;
        let check_size = function(size, passthrough) {
            testutils.reseed();
            if (passthrough) {
                test(size);
            } else {
                try {
                    test(size);
                } catch (e) {
                    return e;
                }
            }
            return null;
        };
        check_size(0, true); // Unable to minimize if it can't pass through
        let size = max_size;
        while (check_size(size, false) != null) {
            size -= 1;
        }
        check_size(size+1, true); // Should throw an exception, with browser debugging enabled
    }

    static reseed() {
        M_W = SEED1;
        M_Z = SEED2;
    }
    // https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
    static seedable_random() {
        M_Z = (36969 * (M_Z & 65535) + (M_Z >> 16)) & MASK;
        M_W = (18000 * (M_W & 65535) + (M_W >> 16)) & MASK;
        var result = ((M_Z << 16) + M_W) & MASK;
        result /= 4294967296;
        return result + 0.5;
    }
}
