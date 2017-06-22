/* class Program {
 *     constructor(psv) {
 *         this.program = psv;
 *         this.reg8s = new Uint8Array(16);
 *         this.reg16s = new Int16Array(this.reg8s.buffer);
 *     }
 *     evaluate_expression(exprclass, arg) {
 *         switch (exprclass) {
 *             case EXPRCLASS_IMM: return arg;
 *             case EXPRCLASS_REG: return this.reg8s[arg];
 *             case EXPRCLASS_REG16: return this.reg16s[arg];
 *             case EXPRCLASS_RELPTR: return this.psv.peek
 *         }
 *     }
 * }*/
