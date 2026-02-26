import { body, param } from 'express-validator';
import { AUTHORIZED_FOLDER_NAMES } from '../../constants/asset.constant.ts';

export const AssetsValidator = {
    upload: [
        body('id')
            .isString().withMessage("Id must be a string")
            .matches(/^[A-Z][a-zA-Z0-9]*$/)
            .withMessage("Id must start with an uppercase letter and contain no spaces or special characters (e.g., MonID)"),
        body('name').isString().withMessage('Name must be a string'),
        body('folder')
            .optional()
            .isIn(AUTHORIZED_FOLDER_NAMES)
            .withMessage(`Folder must be one of: ${AUTHORIZED_FOLDER_NAMES.join(', ')}`),
    ],
    delete: [
        param('folder').isString().notEmpty(),
        param('id').isString().notEmpty(),
    ],
    clearCache: [
        param('id').isString().notEmpty(),
    ],
};
