import { db } from '../../utils/sqllite.helper.ts';
import { tags } from '../../database/shema.ts';
import { eq } from 'drizzle-orm';
import { NotFoundError, ValidationError } from '../../utils/AppError.ts';
import { TagHelper } from './Tag.helper.ts';

export class TagService {
    /**
     * Retrieves all tags with their associated posts
     * @param isAuthenticated - Include unpublished posts if true
     * @returns Object with tags and metadata
     */
    static async getAllTags(isAuthenticated: boolean = false) {
        const result = await db.query.tags.findMany({
            with: {
                postTags: {
                    with: {
                        post: true
                    }
                }
            },
        });

        const tagsList = result.map(tag => ({
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            color: tag.color,
            postIds: TagHelper.filterPostIds(tag.postTags, isAuthenticated)
        }));

        return {
            meta: {
                total_count: tagsList.length,
            },
            tags: tagsList
        };
    }

    /**
     * Retrieves a tag by its slug
     * @param slug - The tag slug
     * @param isAuthenticated - Include unpublished posts if true
     * @returns Tag with metadata
     * @throws {NotFoundError} If tag not found
     */
    static async getTagBySlug(slug: string, isAuthenticated: boolean = false) {
        const tag = await TagHelper.findTagWithPosts(slug);

        if (!tag) {
            throw new NotFoundError(`Tag with slug "${slug}" not found`);
        }

        return {
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
            color: tag.color,
            postIds: TagHelper.filterPostIds(tag.postTags, isAuthenticated)
        };
    }

    /**
     * Deletes a tag by its slug
     * @param slug - The tag slug
     * @returns True if deleted, false if not found
     */
    static async deleteTagBySlug(slug: string) {
        const tag = await TagHelper.findTagBySlug(slug);

        if (!tag) {
            return false;
        }

        await db.delete(tags).where(eq(tags.id, tag.id));

        return true;
    }

    /**
     * Creates a new tag
     * @param name - Tag name
     * @param slug - Tag slug
     * @param color - Tag color
     * @returns Created tag
     */
    static async createTag(name: string, slug: string, color: string) {
        const newTag = await db.insert(tags).values({
            name,
            slug,
            color
        });

        return newTag;
    }

    /**
     * Updates a tag by its slug
     * @param slug - The tag slug
     * @param updateData - Fields to update (name and/or color)
     * @returns Updated tag
     * @throws {NotFoundError} If tag not found
     * @throws {ValidationError} If no fields provided
     */
    static async updateTagBySlug(slug: string, updateData: { name?: string; color?: string }) {
        const tag = await TagHelper.findTagBySlug(slug);

        if (!tag) {
            throw new NotFoundError(`Tag with slug "${slug}" not found`);
        }

        TagHelper.validateUpdateData(updateData);

        return TagHelper.updateTag(tag.id, updateData);
    }
}
