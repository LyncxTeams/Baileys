/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export function makeMutex(): {
    mutex(code: any): any;
};
export function makeKeyedMutex(): {
    mutex(key: any, task: any): Promise<any>;
};
