// Read/write values without keeping track of offset. 0 is read on out-of-range accesses
class PaddedSeqView {
    constructor(buffer) {
        this.buffer = buffer;
        this.dv = new DataView(buffer);
        this.os = 0;
    }
    truncate() {
        return this.buffer.slice(0, this.os);
    }
    is_done() {
        return this.os >= this.buffer.byteLength;
    }
    getUint8() {
        let ret;
        if (this.os >= this.buffer.byteLength) {
            ret = 0;
        } else {
            ret = this.dv.getUint8(this.os);
        }
        this.os += 1;
        return ret;
    }
        
    setUint8(value) {
        this.dv.setUint8(this.os, value);
        this.os += 1;
    }
    getUint32() {
        let ret;
        if (this.os >= this.buffer.byteLength) {
            ret = 0;
        } else if (this.os+1 >= this.buffer.byteLength) {
            ret = this.dv.getUint8(this.os) << 24;
        } else if (this.os+2 >= this.buffer.byteLength) {
            ret = this.dv.getUint16(this.os) << 16;
        } else if (this.os+3 >= this.buffer.byteLength) {
            ret = (this.dv.getUint16(this.os) << 16 + this.dv.getUint8(this.os+2)) << 8;
        } else {
            ret = this.dv.getUint32(this.os);
        }
        this.os += 4;
        return ret;
    }
    setUint32(value) {
        this.dv.setUint32(this.os, value);
        this.os += 4;
    }
}
