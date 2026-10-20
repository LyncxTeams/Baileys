/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export class GroupCipher {
    constructor(senderKeyStore: any, senderKeyName: any);
    senderKeyStore: any;
    senderKeyName: any;
    encrypt(paddedPlaintext: any): Promise<any>;
    decrypt(senderKeyMessageBytes: any): Promise<any>;
    getSenderKey(senderKeyState: any, iteration: any): any;
    getPlainText(iv: any, key: any, ciphertext: any): Promise<any>;
    getCipherText(iv: any, key: any, plaintext: any): Promise<any>;
}
