/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class USyncStatusProtocol {
    name: string;
    getQueryElement(): {
        tag: string;
        attrs: {};
    };
    getUserElement(): null;
    parser(node: any): {
        status: any;
        setAt: Date;
    } | undefined;
}
