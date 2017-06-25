// Read/write big-endian values without keeping track of offset. Either reads 0 on out-of-range reads, or wraps around.
class RingView {
    constructor(buffer, is_ring) {
        this.buffer = buffer;
        this.dv = new DataView(buffer);
        this.os = 0;
        this.is_ring = (is_ring == undefined) ? false : is_ring;
        this.byteLength = buffer.byteLength;
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
    with_relptr(relptr, block) {
        let original_os = this.os;
        this.os = this.eval_relptr(relptr);
        let ret = block();
        this.os = original_os;
        return ret;
    }
    with_absptr(absptr, block) {
        let original_os = this.os;
        this.os = 0;
        this.os = this.eval_relptr(absptr);
        let ret = block();
        this.os = original_os;
        return ret;
    }
    peek_absptr8(absptr) {
        return this.with_absptr(absptr, () => { return program.rv.peekUint8() });
    }
    peek_relptr8(relptr) {
        return this.with_relptr(relptr, () => { return program.rv.peekUint8() });
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
        this.os = this.eval_relptr(0);
        let ret = this.peekUint8();
        this.os = this.eval_relptr(1);
        return ret;
    }
        
    setUint8(value) {
        this.pokeUint8(value);
        this.os = this.eval_relptr(1);
    }
    pokeUint8(value) {
        this.dv.setUint8(this.os, value);
    }
    peekInt16() {
        let rv = this;
        return this.with_relptr(0, () => {
            let a = rv.dv.getUint8(0);
            let b = rv.dv.getUint8(1);
            let x1 = rv.getUint8();
            let x2 = rv.getUint8();
            let ret = rv.dv.getInt16(0);
            rv.dv.setUint8(0, a);
            rv.dv.setUint8(1, b);
            return ret;
        });
    }
    setInt16(value) {
        let a = this.dv.getUint8(0);
        let b = this.dv.getUint8(1);
        this.dv.setInt16(0, value);
        this.setUint8(value, this.dv.getUint8(0));
        this.setUint8(value, this.dv.getUint8(1));
        this.dv.setUint8(0, a);
        this.dv.setUint8(1, b);
    }
    getInt16() {
        let x = this.peekInt16();
        this.os = this.eval_relptr(2);
        return x;
    }
    getUint32() {
        let a = this.getUint8();
        let b = this.getUint8();
        let c = this.getUint8();
        let d = this.getUint8();
        return ((a << 24) | (b << 16) | (c << 8) | (d << 0)) >>> 0;
    }
    setUint32(value) {
        this.setUint8((value & 0xff000000) >>> 24);
        this.setUint8((value & 0x00ff0000) >>> 16);
        this.setUint8((value & 0x0000ff00) >>> 8);
        this.setUint8((value & 0x000000ff) >>> 0);
    }
    eval_relptr(os) {
        if (this.is_ring) {
            return (this.os + this.buffer.byteLength + os) % this.buffer.byteLength;
        } else {
            return this.os + os;
        }
    }
    seek(x) { this.os = x; }
    search(max, patt, direction) {
        let rv = this;
        for (let os = 0; os < max; os++) {
            let success = this.with_relptr(os * direction, () => {
                let success = true;
                patt.forEach(x => {
                    let y = rv.getUint8();
                    if (y != x) {
                        success = false;
                    }
                });
                return success;
            });
            if (success) {
                return os * direction;
            }
        }
        return null;
    }
    slice(os, size) {
        let old_rv = this;
        let ret = new ArrayBuffer(size);
        let new_rv = new RingView(ret);
        old_rv.with_absptr(os, () => {
            Utils.range(size).forEach( () => {
                new_rv.setUint8(old_rv.getUint8());
            });
        });
        return ret;
    }
    copy(to, size) {
        let from = this;
        Utils.range(size).forEach( () => {
            to.setUint8(from.getUint8());
        });
    }
    forward_slice(size) {
        return this.slice(this.os, size);
    }
}
