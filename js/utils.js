littleEndian = true;

class Utils {
    static range(n) {
        return [...Array(n).keys()];
    }
    static hex(n) {
        if (littleEndian) {
            return "0x" + this.swap_endian32(n).toString(16);
        } else {
            return "0x" + n.toString(16);
        }
    }
    static read_hex(token) {
        let base = parseInt(token, 16);
        if (littleEndian) {
            return this.swap_endian32(base);
        } else {
            return base;
        }
    }
    static swap_endian32(x) {
        return ((x & 0xff000000) >>> 24 |
                (x & 0x00ff0000) >>> 8 |
                (x & 0x0000ff00) << 8 |
                (x & 0x000000ff) << 24) >>> 0;
    }
    static split_uint32(x) {
        return [
            (x & 0xff000000) >>> 24,
            (x & 0x00ff0000) >>> 16,
            (x & 0x0000ff00) >>> 8,
            (x & 0x000000ff) >>> 0
        ];
    }
    static pad2(x) {
        if (x.length < 2) { return "0"+x; }
        else { return x; }
    }
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
    static random(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
    }

    static djb(buffer) {
        let hash = 5381;
        let arr = new Uint8Array(buffer);
        arr.forEach(x => {
            hash = ((hash << 5) + hash) + x;
        });
        return hash;
    }
}
