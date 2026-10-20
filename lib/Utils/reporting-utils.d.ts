/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export function shouldIncludeReportingToken(message: any): boolean;
export function getMessageReportingToken(msgProtobuf: any, message: any, key: any): Promise<{
    tag: string;
    attrs: {};
    content: {
        tag: string;
        attrs: {
            v: string;
        };
        content: any;
    }[];
} | null>;
