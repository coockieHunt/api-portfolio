import { db } from '../../utils/sqllite.helper.ts';
import { post_author, posts } from '../../database/shema.ts';
import { eq } from 'drizzle-orm';
import { BlogService } from '../blog/Blog.service.ts';

export class AuthorService {
    /**
     * Retrieves an author by ID
     * @param id - The ID of the author
     * @returns The author object or null if not found
     */
    static async getAuthorById(id: number) {
        const result = await db
            .select()
            .from(post_author)
            .where(eq(post_author.id, id))
            .get();
        
        if (!result) return null;
        return result;
    }

    /**
     * Retrieves an author by name
     * @param name - The name of the author
     * @returns The author object or null if not found
     */
    static async getAuthorByName(name: string) {
        const result = await db
            .select()
            .from(post_author)
            .where(eq(post_author.name, name))
            .get();
        
        if (!result) return null;
        return result;
    }

    /**
     * Retrieves all authors
     * @returns Promise with list of all authors
     */
    static async getAllAuthors() {
        const results = await db
            .select()
            .from(post_author)
            .all();
        
        return results;
    }

    /**
     * Updates an author by ID
     * @param id - The ID of the author
     * @param data - The data to update
     * @returns The updated author object or null if not found
     */
    static async update(id: number, data: any) {
        const updateData: any = { ...data };
        
        const result = await db.update(post_author)
            .set(updateData)
            .where(eq(post_author.id, id))
            .returning()
            .get();

        if (!result) return null;
        return result;
    }

    /**
     * Creates a new author
     * @param data - The author data
     * @returns The created author object
     */
    static async create(data: any) {
        const result = await db.insert(post_author)
            .values(data)
            .returning()
            .get();

        return result;
    }

    /**
     * Deletes an author by ID
     * @param id - The ID of the author
     * @returns true if deleted, false if not found
     */
    static async delete(id: number) {
        const slugs = await db
            .select({ slug: posts.slug })
            .from(posts)
            .where(eq(posts.authorId, id))
            .all();

        const result = await db.delete(post_author)
            .where(eq(post_author.id, id))
            .returning()
            .get();

        if (!result) return false;

        if (slugs.length > 0) {
            await Promise.allSettled(
                slugs.map(({ slug }) => BlogService.deleteCacheBySlug(slug))
            );
        }

        return true;
    }
}
