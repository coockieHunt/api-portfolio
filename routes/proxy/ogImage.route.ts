import React from 'react';
import express, {  Router } from 'express';
import type {Request, Response} from 'express';
import { query } from 'express-validator';
import { ImageResponse } from '@vercel/og';
import { AssetsService } from '../../services/asset/assets.service.ts';
import { hashGet, hashSet } from '../../utils/cache.helper.ts';
import { AUTHORIZED_REDIS_KEYS } from '../../constants/redis.constant.ts';
import { logConsole } from '../../middlewares/log.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import rateLimiter from '../../middlewares/rateLimiter.middlewar.ts';
import { BlogOgTemplate } from '../../templates/og/blog.OgTemplate.tsx';

const OpenGraphRouter: Router = express.Router({ mergeParams: true });
OpenGraphRouter.use(rateLimiter);

const FOLDER_NAME = 'og-blog';
const CacheEnabled = String(process.env.BLOG_OG_CACHE || 'true').toLowerCase() === 'true';
const getPublicId = (slug: string): string => slug.replace(/[^a-zA-Z0-9-_]/g, '-');
const generateImage = async (title: string, author?: string, date?: string): Promise<Buffer> => {
    const RenderedImage = React.createElement(BlogOgTemplate, { title, author, date });
    const imageResponse = new ImageResponse(RenderedImage as any, { width: 1200, height: 630 });
    return Buffer.from(await imageResponse.arrayBuffer());
};
const getOgMetaKey = (publicId: string): string => `${publicId}:meta`;

/**
 * GET /get - Generate or serve OG image for a blog post
 * @param req Express Request object
 * @param res Express Response object
 */
OpenGraphRouter.get(
    '/get',
    [
        query('slug').isString().notEmpty(),
        query('title').isString().notEmpty(),
        query('author').optional().isString(),
        query('date').optional().isISO8601(),
        query('lastEdit').optional().isISO8601(),
    ],
    validateRequest,
    async (req: Request, res: Response) => {
        try {
            const { slug, title, author, date, lastEdit } = req.query as {
                slug: string;
                title: string;
                author?: string;
                date?: string;
                lastEdit?: string;
            };
            const publicId = getPublicId(slug);
            const lastEditDate = lastEdit ? new Date(lastEdit) : null;
            if (CacheEnabled) {
                const existingFilename = await AssetsService.getAssetFilename(publicId, FOLDER_NAME);
                if (existingFilename) {
                    const metaKey = getOgMetaKey(publicId);
                    const createdAtStr = await hashGet(AUTHORIZED_REDIS_KEYS.OG_META, metaKey);
                    const imageCreatedAt = createdAtStr ? new Date(createdAtStr) : null;
                    if (lastEditDate && imageCreatedAt && imageCreatedAt < lastEditDate) {
                        try {
                            await AssetsService.deleteAsset(publicId, FOLDER_NAME);
                            logConsole('GET', 'og/blog', 'INFO', 'Image outdated, regenerating', { slug });
                        } catch (e: any) {
                            console.error('[OG] Error deleting old image:', e?.message || e);
                        }
                    } else {
                        const filePath = AssetsService.getAssetPath(existingFilename);
                        res.setHeader('Content-Type', 'image/png');
                        res.setHeader('Cache-Control', 'public, max-age=86400');
                        res.setHeader('X-Og-Source', 'cache');
                        logConsole('GET', 'og/blog', 'INFO', 'Served from local cache', { slug });
                        return res.sendFile(filePath);
                    }
                }
            } else {
                logConsole('GET', 'og/blog', 'INFO', 'Cache disabled, forcing generation', { slug });
            }
            const buffer = await generateImage(title, author, date);
            if (CacheEnabled) {
                try {
                    await AssetsService.uploadAsset(buffer, slug, publicId, FOLDER_NAME, '.png');
                    const metaKey = getOgMetaKey(publicId);
                    await hashSet(AUTHORIZED_REDIS_KEYS.OG_META, metaKey, new Date().toISOString());
                    logConsole('GET', 'og/blog', 'INFO', 'Generated and cached locally', { slug });
                } catch (e: any) {
                    console.error('[OG] Error saving to local storage:', e?.message || e);
                }
            }
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', CacheEnabled ? 'public, max-age=86400' : 'no-cache, no-store, must-revalidate');
            res.setHeader('X-Og-Source', CacheEnabled ? 'generated' : 'generated-no-cache');
            return res.send(buffer);
        } catch (error: any) {
            const errorMessage = error?.message || error?.toString() || 'Unknown error';
            console.error('[OG] Fatal error:', errorMessage, error?.stack);
            logConsole('GET', 'og/blog', 'FAIL', `Error: ${errorMessage}`, { slug: req.query.slug });
            return res.status(500).json({ error: 'Error generating OG image', details: errorMessage });
        }
    }
);

export default OpenGraphRouter;
