import express, { Router } from 'express';
import type {Request, Response} from 'express';
import MailController from './mail.controller.ts';
import { MailValidator } from './mail.validator.ts';
import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { responseHandler } from '../../middlewares/responseHandler.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';

const MailRoute: Router = express.Router({ mergeParams: true });

/**
 * POST /sendEmail
 * Handles sending contact emails from the portfolio.
 * @param req Express Request object
 * @param res Express Response object
 */
MailRoute.post(
	'/sendEmail',
	rateLimiter,
	MailValidator.sendEmail,
	validateRequest,
	asyncHandler(MailController.sendEmail),
	responseHandler
);

export default MailRoute;
