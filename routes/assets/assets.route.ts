import express, { Router } from 'express';
import multer from 'multer';
import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { authenticateToken } from '../../middlewares/authenticateToken.middlewar.ts';
import { allowOnlyFromIPs } from '../../middlewares/whiteList.middlewar.ts';
import AssetsController from './assets.controller.ts';
import { AssetsValidator } from './assets.validator.ts';

const AssetsRoute: Router = express.Router({ mergeParams: true });
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } 
});

AssetsRoute.post('/upload/',
    allowOnlyFromIPs,
    rateLimiter,
    authenticateToken,
    upload.single('file'),
    AssetsValidator.upload,
    validateRequest,
    AssetsController.upload
);

AssetsRoute.delete('/delete/:folder/:id',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    AssetsValidator.delete,
    validateRequest,
    AssetsController.delete
);

AssetsRoute.delete('/cache/clear/:id',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    AssetsValidator.clearCache,
    validateRequest,
    AssetsController.clearCache
);

AssetsRoute.delete('/cache/all',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    AssetsController.clearAllCache
);

AssetsRoute.get('/list',
    allowOnlyFromIPs,
    authenticateToken,
    rateLimiter,
    AssetsController.list
);

export default AssetsRoute;
