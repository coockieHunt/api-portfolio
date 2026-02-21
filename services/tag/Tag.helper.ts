import { db } from '../../utils/sqllite.helper';
import { tags } from '../../database/shema';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '../../utils/AppError';

interface TagResult {
    id: number;
    name: string;
    slug: string;
    color: string;
}

/**
 * Tag Helper
 * 
 * Helper utilities for Tag Service operations.
 */
export class TagHelper {
    /**
     * Finds a tag by its slug in the database
     * @param slug - Tag slug to find
     * @returns Tag object or null if not found
     */
    static async findTagBySlug(slug: string): Promise<TagResult | null> {
        const tag = await db.query.tags.findFirst({
            where: (tags, { eq }) => eq(tags.slug, slug),
        });
        return tag ?? null;
    }

    /**
     * Finds a tag with all related posts
     * @param slug - Tag slug to find
     * @returns Tag with postTags relation or null
     */
    static async findTagWithPosts(slug: string) {
        return db.query.tags.findFirst({
            where: (tags, { eq }) => eq(tags.slug, slug),
            with: { 
                postTags: {
                    with: {
                        post: true
                    }
                } 
            },
        });
    }

    /**
     * Filters post IDs based on authentication status
     * @param postTags - Array of post tag relations
     * @param isAuthenticated - Whether user is authenticated
     * @returns Array of filtered post IDs
     */
    static filterPostIds(postTags: any[], isAuthenticated: boolean): number[] {
        return postTags
            .filter(pt => isAuthenticated || pt.post?.published === 1)
            .map(pt => pt.postId);
    }

    /**
     * Validates that at least one update field is provided
     * @param updateData - Update data object
     * @throws {ValidationError} If no fields to update
     */
    static validateUpdateData(updateData: { name?: string; color?: string }): void {
        if (!updateData.name && !updateData.color) {
            throw new Error('At least one field (name or color) must be provided');
        }
    }

    /**
     * Updates a tag in the database
     * @param tagId - Tag ID to update
     * @param updateData - Fields to update
     * @returns Updated tag
     */
    static async updateTag(tagId: number, updateData: { name?: string; color?: string }) {
        return db.update(tags)
            .set(updateData)
            .where(eq(tags.id, tagId))
            .returning()
            .get();
    }
}
