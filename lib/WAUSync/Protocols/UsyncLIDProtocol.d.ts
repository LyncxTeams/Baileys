/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class USyncLIDProtocol {
    name: string;
    getQueryElement(): {
        tag: string;
        attrs: {};
    };
    getUserElement(user: any): {
        tag: string;
        attrs: {
            jid: any;
        };
    } | null;
    parser(node: any): any;
}
