import express, { Router } from 'express';
import SitemapController from './sitemap.controller.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';
import rateLimiter from '../../middlewares/rateLimiter.middlewar.ts';

const RouteMap: Router = express.Router({ mergeParams: true });

RouteMap.get('/sitemap.xml',rateLimiter, asyncHandler(SitemapController.getSitemap));
RouteMap.get('/robots.txt', rateLimiter, SitemapController.getRobots);
RouteMap.get('/ai.txt', rateLimiter, SitemapController.getAiPolicy);
RouteMap.get('/manifest.json', rateLimiter, SitemapController.getManifest);

export default RouteMap;