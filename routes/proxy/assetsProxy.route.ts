import express, {Router } from 'express';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { writeToLog, logConsole } from '../../middlewares/log.middlewar.ts';
import { AssetsService } from '../../services/asset/assets.service.ts';
import { param } from 'express-validator';

const AssetsProxyRoute: Router = express.Router();

/**
 * GET /proxy/:folder/:id - Proxy image from local assets with folder as param
 * @param req Express Request object
 * @param res Express Response object
 */
AssetsProxyRoute.get('/proxy/:folder/:id',
    rateLimiter,
    param('folder').notEmpty().withMessage('folder is required'),
    param('id').notEmpty().withMessage('id is required'),
    async (req: Request<{ folder: string, id: string }>, res: Response) => {
        try {
            const { folder, id } = req.params;
            const filename = await AssetsService.getAssetFilename(id, folder);
            if (!filename) {
                logConsole('GET', `/proxy/${folder}/${id}`, 'FAIL', 'Image not found');
                return res.status(404).send('Image not found');
            }
            const filePath = AssetsService.getAssetPath(filename);
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
            logConsole('GET', `/proxy/${folder}/${id}`, 'OK', `Proxied local image ${id}`);
            writeToLog(`Proxied local image ${id} from folder ${folder}`, 'assets');
            return res.sendFile(filePath);
        } catch (error) {
            writeToLog(`Error proxying local image ${req.params.id}`, 'assets');
            logConsole('GET', `/proxy/${req.params.folder}/${req.params.id}`, 'FAIL', 'Error proxying image');
            return res.status(500).send('Error proxying image');
        }
    }
);

/**
 * GET /proxy/:public_id/ - Proxy image from local assets (folder via query param)
 * @param req Express Request object
 * @param res Express Response object
 */
AssetsProxyRoute.get('/proxy/:public_id/',
    rateLimiter,
    param('public_id').notEmpty().withMessage('public_id is required'),
    async (req: Request<{ public_id: string }>, res: Response) => {
        try {
            const folder = (req.query.folder as string) || 'blog';
            const filename = await AssetsService.getAssetFilename(req.params.public_id, folder);
            if (!filename) {
                logConsole('GET', `/proxy/${req.params.public_id}/`, 'FAIL', 'Image not found');
                return res.status(404).send('Image not found');
            }
            const filePath = AssetsService.getAssetPath(filename);
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
            logConsole('GET', `/proxy/${req.params.public_id}/`, 'OK', `Proxied local image ${req.params.public_id}`);
            writeToLog(`Proxied local image ${req.params.public_id}`, 'assets');
            return res.sendFile(filePath);
        } catch (error) {
            writeToLog(`Error proxying local image ${req.params.public_id}`, 'assets');
            logConsole('GET', `/proxy/${req.params.public_id}/`, 'FAIL', 'Error proxying image');
            return res.status(500).send('Error proxying image');
        }
    }
);

/**
 * GET /proxy/:public_id/size/:w/:h - Proxy image from local assets with size (resize using sharp)
 * @param req Express Request object
 * @param res Express Response object
 */
AssetsProxyRoute.get('/proxy/:public_id/size/:w/:h',
    rateLimiter,
    param('public_id').notEmpty().withMessage('public_id is required'),
    param('w').isInt({ gt: 0 }).withMessage('Width must be a positive integer'),
    param('h').isInt({ gt: 0 }).withMessage('Height must be a positive integer'),
    async (req: Request<{ public_id: string, w: string, h: string }>, res: Response) => {
        try {
            const folder = (req.query.folder as string) || 'blog';
            const width = parseInt(req.params.w, 10);
            const height = parseInt(req.params.h, 10);
            const filename = await AssetsService.getAssetFilename(req.params.public_id, folder);
            if (!filename) {
                logConsole('GET', `/proxy/${req.params.public_id}/size/${width}/${height}`, 'FAIL', 'Image not found');
                return res.status(404).send('Image not found');
            }
            const filePath = AssetsService.getAssetPath(filename);
            const resizedImage = await sharp(filePath)
                .resize(width, height, { fit: 'cover', position: 'center' })
                .webp({ quality: 80 })
                .toBuffer();
            res.setHeader('Content-Type', 'image/webp');
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
            writeToLog(`Proxied local image ${req.params.public_id} with size ${width}x${height}`, 'assets');
            logConsole('GET', `/proxy/${req.params.public_id}/size/${width}/${height}`, 'OK', `Proxied image with size ${width}x${height}`);
            return res.send(resizedImage);
        } catch (error) {
            writeToLog(`Error proxying local image ${req.params.public_id} with size ${req.params.w}x${req.params.h}`, 'assets');
            logConsole('GET', `/proxy/${req.params.public_id}/size/${req.params.w}/${req.params.h}`, 'FAIL', 'Error proxying image');
            return res.status(500).send('Error proxying image');
        }
    }
);

export default AssetsProxyRoute;
