/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class SenderMessageKey {
    constructor(iteration: any, seed: any);
    iv: any;
    cipherKey: any;
    iteration: any;
    seed: any;
    getIteration(): any;
    getIv(): any;
    getCipherKey(): any;
    getSeed(): any;
}
