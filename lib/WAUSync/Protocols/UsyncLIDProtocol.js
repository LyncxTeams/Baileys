/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class USyncLIDProtocol {
    constructor() {
        this.name = 'lid';
    }
    getQueryElement() {
        return {
            tag: 'lid',
            attrs: {}
        };
    }
    getUserElement(user) {
        if (user.lid) {
            return {
                tag: 'lid',
                attrs: { jid: user.lid }
            };
        }
        else {
            return null;
        }
    }
    parser(node) {
        if (node.tag === 'lid') {
            return node.attrs.val;
        }
        return null;
    }
}
