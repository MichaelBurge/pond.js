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
        return (x & 0xff000000) >> 24 |
               (x & 0x00ff0000) >> 8 |
               (x & 0x0000ff00) << 8 |
               (x & 0x000000ff) << 24;
    }
    static split_uint32(x) {
        return [
            (x & 0xff000000) >> 24,
            (x & 0x00ff0000) >> 16,
            (x & 0x0000ff00) >> 8,
            (x & 0x000000ff) >> 0
        ];
    }
}
