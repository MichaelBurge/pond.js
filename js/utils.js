littleEndian = true;

class Utils {
    static range(n) {
        return [...Array(n).keys()];
    }
    static getUint32_safe(dv, os) {
        if (os >= dv.bytelength) {
            return { result: 0, bytes: 0 };
        } else if (os+1 >= dv.bytelength) {
            return { result: dv.getUint8(dv, os), bytes: 1 };
        } else if (os+2 >= dv.bytelength) {
            return { result: dv.getUint16(dv, os), bytes: 2 };
        } else if (os+3 >= dv.bytelength) {
            return { result: dv.getUint16(dv, os) << 16 + dv.getUint16(dv, os+2), bytes: 3 };
        } else {
            return { result: dv.getUint32(dv, os), bytes: 4 };
        }
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
        return (x & 0xff000000) >> 24 +
               (x & 0x00ff0000) >> 8 +
               (x & 0x0000ff00) << 8 +
               (x & 0x000000ff) << 24;
    }
}
