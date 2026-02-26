import type { Request, Response } from 'express';
import { AssetsService } from '../../services/asset/assets.service.ts';
import { logConsole } from '../../middlewares/log.middlewar.ts';

class AssetsController {
    async upload(req: Request, res: Response) {
        if (!req.file) {
            logConsole("POST", "/assets/upload", "FAIL", "No file uploaded");
            return res.error('No file uploaded', 400);
        }
        const uploadedFilename = await AssetsService.uploadAsset(
            req.file.buffer,
            req.body.name || req.file.originalname,
            req.body.id,
            req.body.folder || 'blog'
        );
        if (!uploadedFilename) {
            logConsole("POST", "/assets/upload", "FAIL", "Upload failed in service");
            return res.error('Upload failed', 500);
        }
        logConsole("POST", "/assets/upload", "OK", "File uploaded successfully", { file: req.file.originalname, path: uploadedFilename });
        return res.success({ path: uploadedFilename }, 'File uploaded successfully');
    }

    async delete(req: Request, res: Response) {
        const { folder, id } = req.params;
        const deletionResult = await AssetsService.deleteAsset(id as string, folder as string);
        if (!deletionResult) {
            logConsole("DELETE", `/assets/delete/${folder}/${id}`, "FAIL", "Asset not found or could not be deleted", { id, folder });
            return res.idNotFound(id as string, 'Asset not found or could not be deleted');
        }
        logConsole("DELETE", `/assets/delete/${folder}/${id}`, "OK", "Asset deleted successfully", { id, folder });
        return res.removed(id as string, 'Asset deleted successfully');
    }

    async clearCache(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const keysDeleted = await AssetsService.clearAssetsCache(id as string);
            logConsole("DELETE", `/assets/cache/clear/${id}`, "OK", "Cache cleared successfully", { id, keysDeleted });
            return res.removed(id as string, 'Cache cleared successfully');
        } catch (error) {
            logConsole("DELETE", `/assets/cache/clear/${id}`, "FAIL", "Error clearing cache", { error });
            return res.error('Error clearing cache', 500);
        }
    }

    async clearAllCache(req: Request, res: Response) {
        try {
            await AssetsService.clearAllAssets();
            logConsole("DELETE", `/assets/cache/clear-all`, "OK", "All assets cache cleared successfully");
            return res.success({}, 'All assets cache cleared successfully');
        } catch (error) {
            logConsole("DELETE", `/assets/cache/clear-all`, "FAIL", "Error clearing all assets cache", { error });
            return res.error('Error clearing all assets cache', 500);
        }
    }

    async list(req: Request, res: Response) {
        try {
            const assetList = await AssetsService.listAllAssets();
            logConsole("GET", `/assets/list`, "OK", "Asset list retrieved successfully", { count: assetList.length });
            return res.success({ assets: assetList }, 'Asset list retrieved successfully');
        } catch (error) {
            logConsole("GET", `/assets/list`, "FAIL", "Error retrieving asset list", { error });
            return res.error('Error retrieving asset list', 500);
        }
    }
}

export default new AssetsController();
