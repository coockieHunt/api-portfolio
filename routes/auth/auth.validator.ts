//validators
import { body, param, query } from 'express-validator';
import { log } from 'node:console';

export const AuthValidator = {
    login: [body('password').notEmpty().withMessage('Password is required')],
    logout: []
};