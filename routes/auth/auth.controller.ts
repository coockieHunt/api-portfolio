import { AuthService } from '../../services/auth/Auth.service.ts';
import type {Request, Response} from 'express';
import { writeToLog, logConsole } from '../../middlewares/log.middlewar.ts';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthError } from '../../utils/AppError.ts';
import { AuthHelper } from '../../services/auth/Auth.helper.ts';

class AuthController {
    async login(req: Request, res: Response) {
        const { password } = req.body;
        const match = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH as string);

        if (!match) {
            throw new AuthError('Invalid credentials');
        }

        const tokenSign = jwt.sign(
            { name: process.env.USER_ID || 'admin' }, 
            process.env.ACCESS_TOKEN_SECRET as string, 
            { expiresIn: '24h' }
        );

        const tokenTTL = Number(process.env.TOKEN_TTL_REVOCATION) || 86400;
        res.cookie('token', tokenSign, AuthHelper.buildAuthCookieOptions(tokenTTL * 1000));

        logConsole("POST", "/auth/login", "OK", "User logged in successfully");
        writeToLog("Login successful", "auth");
        return res.success({ token: tokenSign }, 'Login successful');
    }

    async me(req: Request, res: Response) {
        const token = req.cookies?.token;

        if (!token) {
            throw new AuthError('No token provided');
        }

        try {
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string);
            logConsole("GET", "/auth/me", "OK", "User authenticated", { user: decoded });
            return res.success(decoded, 'User authenticated');
        } catch (error) {
            throw new AuthError('Invalid token');
        }
    }

    async logout(req: Request, res: Response) {
        const token = req.headers['authorization']?.split(' ')[1];
        const cookieToken = req.cookies?.token;
        const usedToken = token || cookieToken;

        if (!usedToken) {
            throw new AuthError('No token provided');
        }

        jwt.verify(usedToken, process.env.ACCESS_TOKEN_SECRET as string);

        const isRevoked = await AuthService.isTokenRevoked(usedToken);
        if (isRevoked) {
            logConsole("POST", "/auth/logout", "WARN", "Token already revoked", { token: usedToken });
            throw new AuthError('Token already revoked');
        }

        await AuthService.revokeToken(usedToken);
        res.clearCookie('token', AuthHelper.buildAuthCookieOptions());
        logConsole("POST", "/auth/logout", "OK", "Token revoked successfully", { token: usedToken });
        writeToLog("Logout successful", "auth");
        return res.success({}, 'Logout successful');
    }
}

export default new AuthController();