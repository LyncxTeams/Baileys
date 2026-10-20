/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export function handleIdentityChange(node: any, ctx: any): Promise<{
    action: string;
    device?: undefined;
    error?: undefined;
} | {
    action: string;
    device: number;
    error?: undefined;
} | {
    action: string;
    error: unknown;
    device?: undefined;
}>;
