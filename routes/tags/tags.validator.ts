import { body, param } from 'express-validator';

export const TagsValidator = {
    getAll: [],
	getBySlug: [
		param('slug').isString().notEmpty(),
	],

	delete: [
		param('slug').isString().notEmpty(),
	],

	update: [
		param('slug').isString().notEmpty(),
		body('name').optional().isString().notEmpty().trim(),
		body('color').optional().isString().trim(),
		body().custom((value) => {
			if (!value || (!value.name && !value.color)) {
				throw new Error('At least one field (name or color) must be provided');
			}
			return true;
		}),
	],
	
	create: [
		body('name').isString().notEmpty().trim(),
		body('slug').isString().notEmpty().trim().matches(/^[a-z0-9-]+$/),
		body('color').optional().isString().trim()
	]
};
