//helpers
import { db } from '../../utils/sqllite.helper.ts';

//shema
import { post_author, posts, postTags, tags } from '../../database/shema.ts'; 

//orm
import { desc, eq, sql, inArray, like, and} from 'drizzle-orm';

//services
import { RedisClient } from '../../services/Redis.service.ts';

//constants
import { AUTHORIZED_REDIS_PREFIXES } from '../../constants/redis.constant.ts';

//helpers
import { withCache } from '../../utils/cache.helper.ts'; 
import { validateKey } from '../../utils/redis.helper.ts';
import { writeToLog } from '../../middlewares/log.middlewar.ts';

//config
import cfg from '../../config/default.ts';

//errors
import { NotFoundError, ValidationError } from '../../utils/AppError.ts';

//helpers
import {BlogHelper} from './Blog.helper.ts';

export class BlogService {
    /**
     * Retrieves all blog posts with pagination
     * @param page - Page number (default: 1)
     * @param limit - Number of posts per page (default: 20)
     * @returns Promise with paginated posts and metadata
     */
    static async getAllPosts(page: number = 1, limit: number = 20, isAuthenticated: boolean = false) {
        const offset = (page - 1) * limit;

        const visibilityFilter = isAuthenticated ? undefined : eq(posts.published, 1);

        const totalCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(posts)
            .where(visibilityFilter)
            .get();
        const totalCount = totalCountResult ? totalCountResult.count : 0;

        const postsResults = await db.select({
            post: posts,
            author: {
                name: post_author.name,
            }
        })
        .from(posts)
        .where(visibilityFilter)
        .orderBy(desc(posts.createdAt))
        .leftJoin(post_author, eq(posts.authorId, post_author.id))
        .limit(limit)
        .offset(offset)
        .all();


        let tagsResults: Array<{ postId: number, tag: typeof tags.$inferSelect }> = [];
        if (postsResults.length > 0) {
            const postIds = postsResults.map(r => r.post.id);
            tagsResults = await db.select({
                postId: postTags.postId,
                tag: tags
            })
            .from(postTags)
            .innerJoin(tags, eq(postTags.tagId, tags.id))
            .where(inArray(postTags.postId, postIds))
            .all();
        }

        const results = postsResults.map(postResult => ({
            ...postResult,
            tags: tagsResults.filter(t => t.postId === postResult.post.id).map(t => t.tag)
        }));

        return {
            meta: {
                total_count: totalCount,
                page: page,
                limit: limit,
                total_pages: Math.ceil(totalCount / limit)
            },
            posts: results
        };
    }

    /**
     * Retrieves blog posts using offset-based pagination
     * @param min - Minimum offset position (default: 1)
     * @param max - Maximum offset position (default: 100)
     * @param tagsToFilter - Array of tag slugs to filter by (default: [])
     * @param titleContains - Substring that the title must contain (default: '')
     * @param onlyPublished - Whether to include only published posts (default: true)
     * @returns Promise with posts and cursor metadata
     */
    static async getPostOffset(
        min: number = 1, 
        max: number = 100, 
        tagsToFilter: string[] = [],
        titleContains: string = '',
        onlyPublished: boolean = true
    ) {
        const limit = max - min + 1;
        const offset = min - 1;
        const filters = [];
    
        if (titleContains) {
            filters.push(like(posts.title, `%${titleContains}%`)); 
        }
    
        if (tagsToFilter.length > 0) {
            const postsWithTagsSubquery = db
                .select({ postId: postTags.postId })
                .from(postTags)
                .innerJoin(tags, eq(postTags.tagId, tags.id))
                .where(inArray(tags.slug, tagsToFilter));
    
            filters.push(inArray(posts.id, postsWithTagsSubquery));
        }
    
        const postsResults = await db
            .select({
                post: posts,
                author: {
                    name: post_author.name,
                }
            })
            .from(posts)
            .leftJoin(post_author, eq(posts.authorId, post_author.id))
            .where(
                and(
                    ...filters, 
                    onlyPublished ? eq(posts.published, 1) : undefined 
                )
            )
            .orderBy(desc(posts.createdAt))
            .limit(limit)
            .offset(offset)
            .all();
        
        let tagsResults: Array<{ postId: number, tag: typeof tags.$inferSelect }> = [];

        if (postsResults.length > 0) {
            const postIds = postsResults.map(r => r.post.id);
            tagsResults = await db.select({
                postId: postTags.postId,
                tag: tags
            })
            .from(postTags)
            .innerJoin(tags, eq(postTags.tagId, tags.id))
            .where(inArray(postTags.postId, postIds))
            .all();
        }
    
        const results = postsResults.map(postResult => ({
            ...postResult,
            tags: tagsResults.filter(t => t.postId === postResult.post.id).map(t => t.tag)
        }));
    
        return {
            meta: {
                cursor_start: min,
                cursor_end: min + results.length,
                requested_limit: limit
            },
            posts: results
        };
    }

    /**
     * Retrieves a single blog post by its slug with caching
     * @param slug - The unique slug identifier for the post
     * @param isAuthenticated - Whether the requester is authenticated (true) or a guest (false)
     * @returns Promise with post data, cache status and details
     */
    static async getPostBySlug(slug: string, isAuthenticated: boolean) {
        if (isAuthenticated) {
            const result = await BlogHelper.fetchAllPost(slug);
            writeToLog(`BlogService GET POST slug=${slug} source=database client_version=fresh authenticated=true`, 'blog');
            return { 
                data: result, 
                cached: false,
                cacheStatus: 'no_send'
            };
        }
        
        try {
            const cached = await withCache(
                BlogHelper.getCacheKey(slug),
                async () => {
                    const result = await BlogHelper.fetchAllPost(slug);
                    
                    if (result.post.published === 0) {
                        throw new NotFoundError(`Post with slug "${slug}" is not published`);
                    }
                    
                    return result;
                },
                cfg.blog.cache_ttl
            );
            
            if (!cached.cached) {
                const version = new Date().toISOString();
                await BlogService.updatePostVersion(slug, version);
                writeToLog(`BlogService GET POST slug=${slug} source=database cache_status=created client_refresh=true version=${version}`, 'blog');
                return {
                    data: cached.data,
                    cached: false,
                    cacheStatus: 'cache_created'
                };
            } else {
                writeToLog(`BlogService GET POST slug=${slug} source=redis cache_status=hit client_refresh=false`, 'blog');
                return {
                    data: cached.data,
                    cached: true,
                    cacheStatus: 'cache_hit'
                };
            }
        } catch (error) {
            console.error(`Error retrieving post by slug ${slug}:`, error);
            throw error;
        }
    }

    /**
     * Creates a new blog post
     * @param data - Post data including title, content, summary, author ID, optional tags, and optional featuredImage
     * @returns Promise with the newly created post
     */
    static async createPost(data: { title: string; slug?: string; content: string; summary?: string, authorId?: number | null; tagIds?: number[]; featuredImage?: string; indexed?: number; published?: number; }) {
        const slug = data.slug || data.title.toLowerCase().replace(/ /g, '-');
        const { tagIds, ...postData } = data;

        if (postData.authorId !== undefined && postData.authorId !== null) {
            await BlogHelper.validateAuthor(postData.authorId);
        }
        await BlogHelper.validateTags(tagIds || []);

        const existingSlug = await db
            .select({ slug: posts.slug })
            .from(posts)
            .where(eq(posts.slug, slug))
            .get();

        if (existingSlug) {
            throw new ValidationError(`Post with slug "${slug}" already exists`);
        }
        
        const newPost = await db.insert(posts)
            .values({ ...postData, authorId: postData.authorId ?? null, slug, indexed: data.indexed ?? 0, published: data.published ?? 0 })
            .returning()
            .get();
        
        if (!newPost) {
            throw new ValidationError('Failed to create post in database');
        }

        await BlogHelper.updatePostTags(newPost.id, tagIds);

        if (newPost.published === 1) {
            try {
                await BlogHelper.updateCacheKey(slug);
                writeToLog(`BlogService CREATE POST ok slug=${slug} cached=true`, 'blog');
            } catch (error) {
                console.error(`Failed to create cache for new post slug=${slug}:`, error);
                writeToLog(`BlogService CREATE POST ok slug=${slug} cached=false (cache error)`, 'blog');
            }
        } else {
            writeToLog(`BlogService CREATE POST ok slug=${slug} published=false`, 'blog');
        }

        return newPost;
    }

    /**
     * Updates an existing blog post and updates its cache
     * @param slug - The post slug to update
     * @param updateData - Partial post data to update, including optional tags and optional featuredImage
     * @returns Promise with updated post or null if not found
     */
    static async updatePostBySlug(slug: string, updateData: { title?: string; content?: string; summary?: string; editedAt?: Date; authorId?: number | null; tagIds?: number[]; featuredImage?: string; indexed?: number; published?: number; slug?: string; }) {
        const key = BlogHelper.getCacheKey(slug);
        validateKey(key);

        if (updateData.authorId !== undefined && updateData.authorId !== null) {
            await BlogHelper.validateAuthor(updateData.authorId);
        }

        if (updateData.tagIds) {
            await BlogHelper.validateTags(updateData.tagIds);
        }

        updateData.editedAt = new Date();
        const { tagIds, ...postUpdateData } = updateData;

        const updatedPost =  await db.update(posts)
            .set(postUpdateData)
            .where(eq(posts.slug, slug))
            .returning()
            .get();

        if (!updatedPost) {
            throw new NotFoundError(`Post with slug "${slug}" not found`);
        }

        if (tagIds !== undefined) {
            await BlogHelper.updatePostTags(updatedPost.id, tagIds);
        }
        
        try {
            const author = updatedPost.authorId !== null && updatedPost.authorId !== undefined
                ? await db.select({
                    name: post_author.name,
                    describ: post_author.describ
                })
                .from(post_author)
                .where(eq(post_author.id, updatedPost.authorId))
                .get()
                : null;

            const tagsResults = await db.select({ tag: tags })
                .from(postTags)
                .innerJoin(tags, eq(postTags.tagId, tags.id))
                .where(eq(postTags.postId, updatedPost.id))
                .all();

            const cacheData = {
                post: updatedPost,
                author: {
                    name: author?.name || null,
                    describ: author?.describ || null
                },
                tags: tagsResults.map(t => t.tag)
            };

            await BlogHelper.updateCacheKey(slug, cacheData);
        } catch (error) {
            console.error(`Failed to update cache for slug ${slug} after update`, error);
        }
        return updatedPost;
    }

    /**
     * Updates the published status of a blog post
     * @param slug - The post slug to update
     * @param publish - True to publish, false to unpublish
     * @returns Promise with updated post or null if not found
     */
    static async publishedPostBySlug(slug: string, publish: boolean) {
        const key = BlogHelper.getCacheKey(slug);
        validateKey(key);

        const updatedPost =  await db.update(posts)
            .set({ published: publish ? 1 : 0, editedAt: new Date() })
            .where(eq(posts.slug, slug))
            .returning()
            .get();

        if (!updatedPost) {
            throw new NotFoundError(`Post with slug "${slug}" not found`);
        }

        try {
            await BlogHelper.updateCacheKey(slug);
            const action = publish ? 'published' : 'unpublished';
            writeToLog(`BlogService UPDATE POST slug=${slug} action=${action} cache_update=success`, 'blog');
        } catch (error) {
            const action = publish ? 'published' : 'unpublished';
            writeToLog(`BlogService UPDATE POST slug=${slug} action=${action} cache_update=failed post_no_cache_update`, 'blog');
            console.error(`Failed to update cache for slug ${slug} after publish update`, error);
        }
        return updatedPost;
    }

    /**
     * Updates the indexed status of a blog post
     * @param slug - The post slug to update
     * @param indexed - 0 or 1 to set indexed status
     * @returns Promise with updated post or null if not found
     */
    static async indexedPostBySlug(slug: string, indexed: number) {
        const key = BlogHelper.getCacheKey(slug);
        validateKey(key);

        const updatedPost =  await db.update(posts)
            .set({ indexed: indexed, editedAt: new Date() })
            .where(eq(posts.slug, slug))
            .returning()
            .get();

        if (!updatedPost) {
            throw new NotFoundError(`Post with slug "${slug}" not found`);
        }

        try {
            await BlogHelper.updateCacheKey(slug);
            const indexStatus = indexed === 1 ? 'indexed' : 'unindexed';
            writeToLog(`BlogService UPDATE POST slug=${slug} action=${indexStatus} cache_update=success`, 'blog');
        } catch (error) {
            const indexStatus = indexed === 1 ? 'indexed' : 'unindexed';
            writeToLog(`BlogService UPDATE POST slug=${slug} action=${indexStatus} cache_update=failed post_no_cache_update`, 'blog');
            console.error(`Failed to update cache for slug ${slug} after indexed update`, error);
        }
        return updatedPost;
    }

    /**
     * Deletes a blog post by slug and removes its cache
     * @param slug - The post slug to delete
     * @returns Promise resolving to true if deleted, false otherwise
     */
    static async deletePostBySlug(slug: string) {
        const key = BlogHelper.getCacheKey(slug);
        validateKey(key);

        const deletedPost = await db.delete(posts).where(eq(posts.slug, slug)).returning().get();
        
        if (!deletedPost) {
            throw new NotFoundError(`Post with slug "${slug}" not found`);
        }

        try {
            await BlogHelper.deleteCacheBySlug(slug);
        } catch (error) {
            console.error(`Failed to delete cache for slug ${slug} after DB deletion`, error);
        }
        return true;
    }

    /**
     * Deletes the cache entry for a specific blog post
     * @param slug - The post slug to remove from cache
     * @returns Promise resolving to true if cache was deleted
     * @throws {Error} If Redis client is not connected
     */
    static async deleteCacheBySlug(slug: string) {
        const key = BlogHelper.getCacheKey(slug);
        const versionKey = `${AUTHORIZED_REDIS_PREFIXES.BLOG_VER}${slug}`;
        validateKey(key);
        validateKey(versionKey);
        
        if (!RedisClient || !RedisClient.isReady) {
            throw new ValidationError("Redis client is not connected.");
        }

        try {
            await RedisClient.del([key, versionKey]);
            writeToLog(`BlogService CACHE DELETE ok slug=${slug}`, 'blog');
            return true;
        } catch (error) {
            console.error(`Error deleting cache for slug ${slug}:`, error);
            throw error;
        }
    }

    /**
     * Clears all blog post cache entries from Redis
     * @returns Promise with clearing statistics (total keys cleared, batches processed)
     * @throws {Error} If Redis client is not connected
     */
    static async clearAllCache() {
        if (!RedisClient || !RedisClient.isReady) {
            throw new ValidationError("Redis client is not connected.");
        }
        
        try {
            let cursor = '0';
            let totalKeysCleared = 0;
            let batchCount = 0;
            const keysDeleted: string[] = [];

            do {
                const reply = await RedisClient.scan(cursor, { MATCH: BlogHelper.getCacheKey('*'), COUNT: 100 });
                cursor = reply.cursor;
                const keys = reply.keys;

                if (keys.length > 0) {
                    await RedisClient.del(keys);
                    totalKeysCleared += keys.length;
                    batchCount++;
                    keysDeleted.push(...keys);
                    writeToLog(`BlogService CACHE CLEAR batch #${batchCount} count=${keys.length}`, 'blog');
                }
            } while (cursor !== '0');

            cursor = '0';
            do {
                const reply = await RedisClient.scan(cursor, { MATCH: `${AUTHORIZED_REDIS_PREFIXES.BLOG_VER}*`, COUNT: 100 });
                cursor = reply.cursor;
                const keys = reply.keys;

                if (keys.length > 0) {
                    await RedisClient.del(keys);
                    totalKeysCleared += keys.length;
                    batchCount++;
                    keysDeleted.push(...keys);
                    writeToLog(`BlogService CACHE CLEAR versions batch #${batchCount} count=${keys.length}`, 'blog');
                }
            } while (cursor !== '0');

            writeToLog(`BlogService CACHE CLEAR complete total=${totalKeysCleared} batches=${batchCount}`, 'blog');
            
            return {
                status: 'success',
                total_keys_cleared: totalKeysCleared,
                keys_deleted: keysDeleted,
                batches_processed: batchCount
            };
        } catch (error) {
            console.error("Error clearing all blog post caches:", error);
            throw error;
        }
    }  
    
    static async getPostVersion (slug: string) {
        const key = `${AUTHORIZED_REDIS_PREFIXES.BLOG_VER}${slug}`;
        validateKey(key);

        if (!RedisClient || !RedisClient.isReady) {
            throw new ValidationError("Redis client is not connected.");
        }

        try {
            const versionData = await RedisClient.get(key);
            return versionData;
        } catch (error) {
            console.error(`Error retrieving post version for slug ${slug}:`, error);
            throw error;
        }
    }

    static async updatePostVersion (slug: string, data: string) {
        const key = `${AUTHORIZED_REDIS_PREFIXES.BLOG_VER}${slug}`;
        validateKey(key);

        if (!RedisClient || !RedisClient.isReady) {
            throw new ValidationError("Redis client is not connected.");
        }

        try {
            await RedisClient.setEx(key, cfg.blog.cache_ttl, data);
        } catch (error) {
            console.error(`Error updating post version for slug ${slug}:`, error);
            throw error;
        }
    }
}