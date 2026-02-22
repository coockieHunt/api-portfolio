import { body, query, param } from 'express-validator';
import config from '../../config/default.ts';
import { AuthError } from '../../utils/AppError.ts';

const secretConfig = config.SecretSystem;

export const GuestBookValidator = {
	getAll: [
		query('password').custom((value) => {
			if (!value || value !== secretConfig.password) {
				throw new AuthError('Unauthorized access');
			}
			return true;
		}),
		query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
		query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
	],
    authorize: [
        param('id').notEmpty().withMessage('ID is required').isString(),
    ],
    unauthorize: [
        param('id').notEmpty().withMessage('ID is required').isString(),
    ],
	create: [
		body('password').custom((value) => {
			if (!value || value !== secretConfig.password) {
				throw new AuthError('Unauthorized access');
			}
			return true;
		}),
		body('name').notEmpty().withMessage('Name is required')
			.isLength({ max: 50 }).withMessage('Name length must not exceed 50 characters')
			.custom((value) => {
				const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]{2,}\.(com|net|org|fr|info|be)\b)/i;
				if (urlRegex.test(value)) {
					throw new Error('url detected in input');
				}
				const htmlRegex = /<[^>]*>/;
				if (htmlRegex.test(value)) {
					throw new Error('HTML tags detected in input');
				}
				return true;
			}),
		body('message').notEmpty().withMessage('Message is required')
			.isLength({ max: 500 }).withMessage('Message length must not exceed 500 characters')
			.custom((value) => {
				const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]{2,}\.(com|net|org|fr|info|be)\b)/i;
				if (urlRegex.test(value)) {
					throw new Error('url detected in input');
				}
				const htmlRegex = /<[^>]*>/;
				if (htmlRegex.test(value)) {
					throw new Error('HTML tags detected in input');
				}
				return true;
			})
	],
	delete: [
		query('password').custom((value) => {
			if (!value || value !== secretConfig.password) {
				throw new AuthError('Unauthorized access');
			}
			return true;
		}),
		param('id').notEmpty().withMessage('ID is required').isString()
	]
};
