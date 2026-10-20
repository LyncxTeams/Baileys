/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class BinaryInfo {
    constructor(options = {}) {
        this.protocolVersion = 5;
        this.sequence = 0;
        this.events = [];
        this.buffer = [];
        Object.assign(this, options);
    }
}
