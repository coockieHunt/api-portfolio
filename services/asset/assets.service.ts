import * as fs from 'fs';
import { promises as fsPromises } from 'fs';

import { AUTHORIZED_REDIS_KEYS } from '../../constants/redis.constant.ts';
import { hashGet, hashSet, hashDel, hashGetAll, cacheDel, isRedisReady } from '../../utils/cache.helper.ts';
import { logConsole } from '../../middlewares/log.middlewar.ts';
import { AssetHelper } from './assets.helper.ts';

export interface AssetDetail {
    file: string;
    cached: boolean;
    id: string | null;
    version: number | null;
}

export class AssetsService {
    /**
        * Uploads an asset to the server and updates the Redis cache.
        * Images are automatically converted to WebP format.
        * @param buffer - The file buffer to upload
        * @param name - The original name of the file
        * @param id - The identifier for the asset
        * @param folder - The folder/category for the asset
        * @param extension - The original file extension (will be converted to .webp for images)
        * @returns The new filename if successful, null otherwise
     */
    static async uploadAsset(
        buffer: Buffer, 
        name: string,
        id: string,
        folder: string = "blog",
        extension: string = ".png" 
    ): Promise<string | null> { 
        if (!isRedisReady()) {
            throw new Error("Redis client is not connected.");
        }

        try {
            if (!fs.existsSync(AssetHelper.getAssetsDirectory())) {
                await fsPromises.mkdir(AssetHelper.getAssetsDirectory(), { recursive: true });
            }

            const assetField = `${folder}:${id}`;

            const currentCachedId = await hashGet(AUTHORIZED_REDIS_KEYS.ASSET_LIST, assetField);
            if (currentCachedId) {
                logConsole("INFO", "ASSETS_SERVICE", "INFO", "Asset already exists in cache", { existingFile: currentCachedId });
            }

            const { buffer: finalBuffer, extension: finalExtension } = await AssetHelper.convertToWebP(buffer, extension);
            const newPhysicalName = AssetHelper.formatFilename(id, name, finalExtension);
            const fullPath = AssetHelper.getAssetPath(newPhysicalName);

            await fsPromises.writeFile(fullPath, finalBuffer);
            logConsole("INFO", "ASSETS_SERVICE", "OK", "File written to disk", { path: fullPath });

            await hashSet(
                AUTHORIZED_REDIS_KEYS.ASSET_LIST,
                assetField,    
                newPhysicalName 
            );

            logConsole("INFO", "ASSETS_SERVICE", "OK", "Redis updated successfully");
            return newPhysicalName;

        } catch (error: any) {
            logConsole("ERROR", "ASSETS_SERVICE", "FAIL", "Error uploading asset", { error: error.message });
            return null;
        }
    }

    /**
        * Retrieves the filename of an asset based on its ID and folder.
        * @param id - The identifier of the asset
        * @param folder - The folder/category of the asset
        * @returns The filename if found, undefined otherwise
     */
    static async getAssetFilename(id: string, folder: string = "blog"): Promise<string | undefined> {
        const assetField = `${folder}:${id}`;
        
        const filename = await hashGet(AUTHORIZED_REDIS_KEYS.ASSET_LIST, assetField);

        if (filename) {
            return filename;
        }

        if (!fs.existsSync(AssetHelper.getAssetsDirectory())) {
            return undefined;
        }

        try {
            const files = await fsPromises.readdir(AssetHelper.getAssetsDirectory());

            const prefix = `${id}-`;
            
            const matchingFiles = files.filter(file => file.startsWith(prefix));

            if (matchingFiles.length === 0) {
                return undefined;
            }

            matchingFiles.sort(); 
            const foundFilename = matchingFiles[matchingFiles.length - 1];

            await hashSet(
                AUTHORIZED_REDIS_KEYS.ASSET_LIST,
                assetField,
                foundFilename
            );

            return foundFilename;

        } catch (error: any) {
            logConsole("ERROR", "ASSETS_SERVICE", "FAIL", "Error searching disk in getAssetFilename", { error: error.message });
            return undefined;
        }
    }
 
    /**
        * Deletes an asset from the server and removes its Redis cache entry.
        * @param id - The identifier of the asset
        * @param folder - The folder/category of the asset
        * @returns True if deletion was successful, false otherwise
     */
    static async deleteAsset(id: string, folder: string = "blog"): Promise<boolean> {
        const assetField = `${folder}:${id}`;
        
        let filename = await hashGet(AUTHORIZED_REDIS_KEYS.ASSET_LIST, assetField);

        if (!filename) {
             const manualSearch = await this.getAssetFilename(id, folder);
             if (manualSearch) filename = manualSearch;
        }

        if (!filename) {
            logConsole("WARN", "ASSETS_SERVICE", "FAIL", "Asset not found for deletion.");
            return false;
        }

        const filePath = this.getAssetPath(filename);

        try {
            try {
                await fsPromises.unlink(filePath);
                logConsole("INFO", "ASSETS_SERVICE", "OK", "File deleted from disk", { filename });
            } catch (err) {
                 logConsole("WARN", "ASSETS_SERVICE", "FAIL", "Physical file not found, deleting cache only.");
            }
            
            await hashDel(AUTHORIZED_REDIS_KEYS.ASSET_LIST, assetField);
            logConsole("INFO", "ASSETS_SERVICE", "OK", "Entry deleted from Redis cache");
            return true;
        } catch (error: any) {
            logConsole("ERROR", "ASSETS_SERVICE", "FAIL", "Error deleting asset", { error: error.message });
            return false;
        }
    }

    /**
        * Clears cached assets in Redis for a specific asset ID.
        * @param id - The identifier of the asset
        * @returns The number of cache entries deleted
    */
    static async clearAssetsCache(id: string): Promise<number> {
        const allAssets = await hashGetAll(AUTHORIZED_REDIS_KEYS.ASSET_LIST);
        const keysToDelete = Object.keys(allAssets).filter(key => key.endsWith(`:${id}`));

        let count = 0;
        for (const key of keysToDelete) {
            await hashDel(AUTHORIZED_REDIS_KEYS.ASSET_LIST, key);
            count++;
        }
        return count; 
    }

    /**
        * Clears all cached assets in Redis.
        * @returns void
    */
    static async clearAllAssets(): Promise<void> {
        await cacheDel(AUTHORIZED_REDIS_KEYS.ASSET_LIST);
        logConsole("INFO", "ASSETS_SERVICE", "OK", "All assets cache cleared.");
    }

    static async listAllAssets(): Promise<AssetDetail[]> {
        try {
            if (!fs.existsSync(AssetHelper.getAssetsDirectory())) {
                logConsole("WARN", "ASSETS_SERVICE", "FAIL", "Assets directory does not exist");
                return [];
            }

            const localFiles = await fsPromises.readdir(AssetHelper.getAssetsDirectory());
            const cleanFiles = localFiles.filter(f => !f.startsWith('.'));

            const redisAssets = await hashGetAll(AUTHORIZED_REDIS_KEYS.ASSET_LIST);

            const filenameToRedisKey = new Map<string, string>();
            if (redisAssets) {
                for (const [key, filename] of Object.entries(redisAssets)) {
                    filenameToRedisKey.set(filename as string, key);
                }
            }

            const results: AssetDetail[] = cleanFiles.map(filename => {
                const redisKey = filenameToRedisKey.get(filename);
                
                return {
                    file: filename,
                    cached: !!redisKey, 
                    id: AssetHelper.extractId(filename, redisKey),
                    version: AssetHelper.extractVersionFromFilename(filename)
                };
            });

            return results;

        } catch (error: any) {
            logConsole("ERROR", "ASSETS_SERVICE", "FAIL", "Error listing assets", { error: error.message });
            return [];
        }
    }


    static getAssetPath(filename: string): string {
        return AssetHelper.getAssetPath(filename);
    }
}