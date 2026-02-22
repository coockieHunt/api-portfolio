import path, { resolve } from 'path';
import sharp from 'sharp';
import { logConsole } from '../../middlewares/log.middlewar.ts';

export class AssetHelper {
    private static rawPath = process.env.ASSET_DIR || './assets';
    private static assetsDirectory = resolve(process.cwd(), AssetHelper.rawPath);

    /**
     * Gets the assets directory path
     * @returns The full path to the assets directory
     */
    static getAssetsDirectory(): string {
        return this.assetsDirectory;
    }

    /**
     * Gets the full path for an asset file
     * @param filename - The asset filename
     * @returns The full path to the asset
     */
    static getAssetPath(filename: string): string {
        return path.join(this.assetsDirectory, filename);
    }

    /**
     * Converts image to WebP format
     * @param buffer - The image buffer
     * @param extension - The file extension
     * @returns The converted buffer and final extension
     */
    static async convertToWebP(buffer: Buffer, extension: string): Promise<{ buffer: Buffer; extension: string }> {
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'];
        const isImage = imageExtensions.includes(extension.toLowerCase());
        
        let finalBuffer = buffer;
        let finalExtension = extension;
        
        if (isImage) {
            try {
                finalBuffer = await sharp(buffer)
                    .webp({ quality: 80 })
                    .toBuffer();
                finalExtension = '.webp';
                logConsole("INFO", "ASSETS_SERVICE", "OK", "Image converted to WebP", { originalExtension: extension });
            } catch (conversionError: any) {
                logConsole("WARN", "ASSETS_SERVICE", "WARN", "WebP conversion failed, using original format", { error: conversionError.message });
            }
        }

        return { buffer: finalBuffer, extension: finalExtension };
    }

    /**
     * Formats filename from ID, name and extension
     * @param id - The asset ID
     * @param name - The asset name
     * @param extension - The file extension
     * @returns The formatted filename with timestamp
     */
    static formatFilename(id: string, name: string, extension: string): string {
        const timestamp = Date.now();
        const nameFormatted = name.replace(/\s+/g, '-').toLowerCase();
        return `${id}-${nameFormatted}-${timestamp}${extension}`;
    }

    /**
     * Extracts the asset ID from filename or Redis key
     * @param filename - The asset filename
     * @param redisKey - The Redis key (optional)
     * @returns The extracted asset ID or null
     */
    static extractId(filename: string, redisKey?: string): string | null {
        if (redisKey) {
            const parts = redisKey.split(':');
            return parts.length > 1 ? parts[parts.length - 1] : null;
        }

        const parts = filename.split('-');
        return parts.length > 0 ? parts[0] : null;
    }

    /**
     * Extracts the version (timestamp) from filename
     * @param filename - The asset filename
     * @returns The extracted version as number or null
     */
    static extractVersionFromFilename(filename: string): number | null {
        const nameWithoutExt = path.parse(filename).name; 
        const parts = nameWithoutExt.split('-');

        if (parts.length < 2) return null;

        const potentialTimestamp = parts[parts.length - 1];
        const parsedTs = parseInt(potentialTimestamp, 10);

        return !isNaN(parsedTs) ? parsedTs : null;
    }
}