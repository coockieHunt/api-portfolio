import { body, param, query } from 'express-validator';

export const BlogValidator = {
    getAll: [
        query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be a positive integer between 1 and 100'),
    ],

    getOffset: [
        query('min').optional().isInt({ min: 1 }).withMessage('Min must be a positive integer'),
        query('max').optional().isInt({ min: 1, max: 100 }).withMessage('Max must be a positive integer between 1 and 100'),

        query('tagsContains').optional().isString().withMessage('Each tag must be a string'),
        query('titleContains').optional().isString().withMessage('Title filter must be a string'),
    ],

    getBySlug: [
        param('slug').isString().withMessage('Slug must be a string'),
    ],

    create: [
        body('title').notEmpty().withMessage('Title is required').trim(),
        body('slug').notEmpty().withMessage('Slug is required').matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
        body('content').notEmpty().withMessage('Content is required'),
        body('summary').optional().isString().trim().withMessage('Summary must be a string'),
        body('authorId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Author ID must be an integer'),
        body('tagIds').optional().isArray().withMessage('Tag IDs must be an array'),
        body('tagIds.*').optional().isInt().withMessage('Each tag ID must be an integer'),
        body('indexed').optional().isInt({ min: 0, max: 1 }).withMessage('Indexed must be 0 or 1'),
        body('published').optional().isInt({ min: 0, max: 1 }).withMessage('Published must be 0 or 1'),
    ],

    update: [
        param('slug').notEmpty().withMessage('Slug is required'),
        body('title').optional().isString().trim(),
        body('content').optional().isString(),
        body('summary').optional().isString().trim(),
        body('authorId').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Author ID must be an integer'),
        body('tagIds').optional().isArray().withMessage('Tag IDs must be an array'),
        body('tagIds.*').optional().isInt().withMessage('Each tag ID must be an integer'),
        body('tags').optional().isArray().withMessage('Tags must be an array'),
        body('tags.*').optional().isInt().withMessage('Each tag ID must be an integer'),
        body('indexed').optional().isInt({ min: 0, max: 1 }).withMessage('Indexed must be 0 or 1'),
        body('published').optional().isInt({ min: 0, max: 1 }).withMessage('Published must be 0 or 1'),
        body('featuredImage').optional().isString().withMessage('Featured image must be a string'),
        body('slug').optional().matches(/^[a-z0-9-]+$/).withMessage('Slug must contain only lowercase letters, numbers, and hyphens'),
    ],

    updatePublish: [
        param('slug').notEmpty().withMessage('Slug is required'),
        body('publish').isBoolean().withMessage('Publish must be a boolean')
    ],

    updateIndexed: [
        param('slug').notEmpty().withMessage('Slug is required'),
        body('indexed').isInt({ min: 0, max: 1 }).withMessage('Indexed must be 0 or 1')
    ],

    delete: [
        param('slug').notEmpty().withMessage('Slug is required'),
    ],
};
