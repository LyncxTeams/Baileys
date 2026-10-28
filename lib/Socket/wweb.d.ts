export interface WWebQrOptions { onQr?: (png: Buffer) => any }
export interface WWebApi {
    run(m: { chat: string; [k: string]: any }, opts?: { mode?: "chat" | "home" | "login" | "reset"; usedPrefix?: string; command?: string; name?: string }): Promise<any>;
    screenshotChat(chatId: string, opts?: WWebQrOptions & { name?: string }): Promise<Buffer>;
    screenshotHome(opts?: WWebQrOptions): Promise<Buffer>;
    login(opts?: WWebQrOptions): Promise<"already" | "ready">;
    reset(): Promise<void>;
    close(): Promise<void>;
    usePuppeteer(pkg: any): WWebApi;
    profileDir: string;
}
export declare function makeWWeb<T = any>(sock: T, config?: any): T;
export default makeWWeb;
