export interface PrivateRelayOptions {
    /** "exclude": target TIDAK dapat kunci (default) | "include": HANYA target yang dapat kunci */
    mode?: "include" | "exclude";
    /** jid yang dipilih (boleh jid:device untuk device tertentu, PN atau LID) */
    target?: string[];
    /** true/false = paksa device milik bot sendiri ikut / tidak ikut */
    targetMe?: boolean;
    deviceMode?: "all" | "primary" | "secondary";
    hideDecryptFail?: boolean;
    messageId?: string;
    statusJidList?: string[];
    additionalAttributes?: Record<string, string>;
    additionalNodes?: any[];
    useUserDevicesCache?: boolean;
    useCachedGroupMetadata?: boolean;
}
export declare function sPR(conn: any, jid: string, message: any, options?: PrivateRelayOptions): Promise<string>;
export declare function makePrivateRelay<T = any>(sock: T, config?: any): T;
export declare function buildReportingNode(message: any, msgId: string, remoteJid: string): Promise<any>;
export declare function generateSigningKeyPair(): { privateKey: Buffer; publicKey: Buffer };
export declare function getMessageKey(seed: Buffer): { iv: Buffer; cipherKey: Buffer };
export declare function encryptGroupMessage(plaintext: Buffer, chainSeed: Buffer, privateKey: any, keyId: number): Buffer;
export declare function createSKDM(keyId: number, iteration: number, chainSeed: Buffer, signingPubKey: Buffer): Buffer;
export default sPR;
