/**
 * Custom Application Error Class
 * 
 * Standardized error handling across the application.
 * Includes HTTP status codes and error details.
 */
export class AppError extends Error {
    public statusCode: number;
    public details?: any;

    constructor(
        statusCode: number,
        message: string,
        details?: any
    ) {
        super(message);
        
        this.statusCode = statusCode;
        this.details = details;
        
        Object.setPrototypeOf(this, AppError.prototype);
    }

    toJSON() {
        return {
            statusCode: this.statusCode,
            message: this.message,
            details: this.details
        };
    }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
        super(400, message, details);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

/**
 * Authentication Error
 */
export class AuthError extends AppError {
    constructor(message: string = 'Unauthorized') {
        super(401, message);
        Object.setPrototypeOf(this, AuthError.prototype);
    }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
    constructor(message: string = 'Resource not found') {
        super(404, message);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}