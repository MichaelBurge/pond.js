// Read/write values without keeping track of offset. Either reads 0 on out-of-range reads, or wraps around.
class RingView {
    constructor(buffer, is_ring) {
        this.buffer = buffer;
        this.dv = new DataView(buffer);
        this.os = 0;
        this.is_ring = (is_ring == undefined) ? false : ring;
    }
    truncate() {
        return this.buffer.slice(0, this.os);
    }
    is_done() {
        if (this.is_ring) {
            return false;
        } else {
            return this.os >= this.buffer.byteLength;
        }
    }
    maybe_wrap() {
        this.os = eval_relptr();
    }
    peekUint8() {
        let ret;
        if (this.os >= this.buffer.byteLength) {
            ret = 0;
        } else {
            ret = this.dv.getUint8(this.os);
        }
        return ret;
    }
    getUint8() {
        let ret = this.peekUint8();
        this.os = this.eval_relptr(1);
        return ret;
    }
        
    setUint8(value) {
        this.dv.setUint8(this.os, value);
        this.os = this.eval_relptr(1);
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
            ret = (this.dv.getUint16(this.os) << 16 + this.dv.getUint8(this.eval_relptr(2))) << 8;
        } else {
            ret = this.dv.getUint32(this.os);
        }
        this.os = this.eval_relptr(4);
        return ret;
    }
    setUint32(value) {
        this.dv.setUint32(this.os, value);
        this.os = this.eval_relptr(4);
    }
    eval_relptr(os) {
        if (this.is_ring) {
            return (this.os + os) % this.buffer.byteLength;
        } else {
            return this.os + os;
        }
    }
}
