/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class USyncDisappearingModeProtocol {
    name: string;
    getQueryElement(): {
        tag: string;
        attrs: {};
    };
    getUserElement(): null;
    parser(node: any): {
        duration: number;
        setAt: Date;
    } | undefined;
}
