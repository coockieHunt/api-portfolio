import { query } from 'express-validator';

export const LogsValidator = {
    GetFallBackList: [],
    PostFallBackForce: [],
    GetFallBackView: [],
    GetLogsList: [
        query('file')
            .optional()
            .isString()
            .trim()
            .isLength({ min: 1, max: 64 })
            .matches(/^[a-zA-Z0-9_-]+$/)
            .withMessage('file must contain only letters, numbers, underscore'),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 1000 })
            .withMessage('limit must be an integer between 1 and 1000'),
    ]
};
