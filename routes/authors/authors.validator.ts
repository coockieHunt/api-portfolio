import { body, param } from 'express-validator';

export const AuthorsValidator = {
    getAll: [],

    getById: [
        param('id').isInt().withMessage('Author ID must be an integer'),
    ],

    create: [
        body('name').notEmpty().withMessage('Author name is required').trim().isString().withMessage('Name must be a string'),
        body('describ').notEmpty().withMessage('Author description is required').trim().isString().withMessage('Description must be a string'),
    ],

    update: [
        param('id').isInt().withMessage('Author ID must be an integer'),
        body('name').optional().isString().trim().withMessage('Name must be a string'),
        body('describ').optional().isString().trim().withMessage('Description must be a string'),
    ],

    delete: [
        param('id').isInt().withMessage('Author ID must be an integer'),
    ]
};
