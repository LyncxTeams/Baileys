/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class SenderChainKey {
    constructor(iteration: any, chainKey: any);
    MESSAGE_KEY_SEED: any;
    CHAIN_KEY_SEED: any;
    iteration: any;
    chainKey: any;
    getIteration(): any;
    getSenderMessageKey(): SenderMessageKey;
    getNext(): SenderChainKey;
    getSeed(): any;
    getDerivative(seed: any, key: any): any;
}
import { SenderMessageKey } from './sender-message-key.js';
