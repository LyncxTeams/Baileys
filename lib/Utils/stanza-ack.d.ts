/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
/**
 * Builds an ACK stanza for a received node.
 * Pure function -- no I/O, no side effects.
 *
 * Mirrors WhatsApp Web's ACK construction:
 * - WAWebHandleMsgSendAck.sendAck / sendNack
 * - WAWebCreateNackFromStanza.createNackFromStanza
 */
export function buildAckStanza(node: any, errorCode: any, meId: any): {
    tag: string;
    attrs: {
        id: any;
        to: any;
        class: any;
    };
};
