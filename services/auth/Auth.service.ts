import { RedisClient } from '../../services/Redis.service.ts';
import { AuthHelper } from './Auth.helper.ts';


export class AuthService {
    /**
     * Revokes an authentication token by storing it in Redis blacklist
     * @param token - The token to revoke
     * @returns Promise resolving to true when revocation succeeds
     * @throws {Error} If Redis client is not connected
     */
    static async revokeToken(token: string): Promise<boolean> {
        if (!AuthHelper.isRedisReady()) {
            throw new Error("Redis client is not connected.");
        }

        const key = AuthHelper.getValidatedTokenKey(token);
        const ttl = AuthHelper.getTokenTTL();

        await AuthHelper.setRevokedToken(key, ttl);
        return true;
    }

    /**
     * Checks if a token has been revoked
     * @param token - The token to verify
     * @returns Promise resolving to true if token is revoked, false otherwise
     */
    static async isTokenRevoked(token: string): Promise<boolean> {
        if (!AuthHelper.isRedisReady()) {
            return false;
        }

        const key = AuthHelper.getTokenKey(token);
        const result = await AuthHelper.getRevokedToken(key);
        return result !== null;
    }
}
