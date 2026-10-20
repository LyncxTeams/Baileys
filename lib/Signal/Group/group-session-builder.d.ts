/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class GroupSessionBuilder {
    constructor(senderKeyStore: any);
    senderKeyStore: any;
    process(senderKeyName: any, senderKeyDistributionMessage: any): Promise<void>;
    create(senderKeyName: any): Promise<SenderKeyDistributionMessage>;
}
import { SenderKeyDistributionMessage } from './sender-key-distribution-message.js';
