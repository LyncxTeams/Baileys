/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class SenderKeyDistributionMessage extends CiphertextMessage {
    constructor(id: any, iteration: any, chainKey: any, signatureKey: any, serialized: any);
    serialized: any;
    id: any;
    iteration: any;
    chainKey: any;
    signatureKey: any;
    intsToByteHighAndLow(highValue: any, lowValue: any): number;
    serialize(): any;
    getType(): number;
    getIteration(): any;
    getChainKey(): any;
    getSignatureKey(): any;
    getId(): any;
}
import { CiphertextMessage } from './ciphertext-message.js';
