/* Elaina Baileys maintained distribution. Upstream notices and license are preserved in LICENSE and NOTICE.md. */
export function getUrlInfo(text: any, opts?: {
    thumbnailWidth: number;
    fetchOpts: {
        timeout: number;
    };
}): Promise<{
    'canonical-url': any;
    'matched-text': any;
    title: any;
    description: any;
    originalThumbnailUrl: any;
} | undefined>;
