/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class USyncBotProfileProtocol {
    name: string;
    getQueryElement(): {
        tag: string;
        attrs: {};
        content: {
            tag: string;
            attrs: {
                v: string;
            };
        }[];
    };
    getUserElement(user: any): {
        tag: string;
        attrs: {};
        content: {
            tag: string;
            attrs: {
                persona_id: any;
            };
        }[];
    };
    parser(node: any): {
        isDefault: boolean;
        jid: any;
        name: any;
        attributes: any;
        description: any;
        category: any;
        personaId: any;
        commandsDescription: any;
        commands: {
            name: any;
            description: any;
        }[];
        prompts: string[];
    };
}
