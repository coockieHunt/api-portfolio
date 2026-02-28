import config from '../../config/default.ts';
import { BlogService } from '../../services/blog/Blog.service.ts';
import type {Request, Response} from 'express';
import { writeToLog, logConsole } from '../../middlewares/log.middlewar.ts';

       

class BlogController {
    async getTags(req: Request, res: Response) {
        try {
            const isAuthenticated = !!(req as any).user;
            const tagsQuery = req.query.tagsContains as string;
            const tagsContains = tagsQuery ? tagsQuery.split(',').map((tag: string) => tag.trim()) : [];
            const titleContains = req.query.titleContains ? (req.query.titleContains as string) : '';

            const data = await BlogService.getTagsWithCount({
                tagsContains,
                titleContains,
                isAuthenticated,
            });

            return res.success(data);
        } catch (error) {
            return res.error("error retrieving tags", 500, error);
        }
    }

    async getAll(req: Request, res: Response) {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
            const isAuthenticated = !!(req as any).user;
            const data = await BlogService.getAllPosts(page, limit, isAuthenticated);
            
            logConsole('GET', '/blog/', 'INFO', `Retrieved blog posts`, { count: data.posts.length, page, auth: isAuthenticated });
            writeToLog(`BlogRoute READ ok count=${data.posts.length} page=${page} auth=${isAuthenticated}`, 'blog');
            return res.success(data);
        } catch (error) {
            logConsole('GET', '/blog/', 'FAIL', `Error retrieving blog posts`, { error });
            writeToLog(`BlogRoute READ error`, 'blog');
            return res.error("error retrieving blog posts", 500, error);
        }
    }

    async getOffset(req: Request, res: Response) {
        try {
            const min = req.query.min ? parseInt(req.query.min as string) : 1;
            const max = req.query.max ? parseInt(req.query.max as string) : 100;
            const isAuthenticated = !!(req as any).user;

            const tagsQuery = req.query.tagsContains as string;
            const tagsContains = tagsQuery ? tagsQuery.split(',').map((tag: string) => tag.trim()) : [];
            
            const titleContains = req.query.titleContains ? (req.query.titleContains as string) : '';

            const data = await BlogService.getPostOffset(
                min,
                max,
                tagsContains,
                titleContains,
                !isAuthenticated,
                !isAuthenticated
            );
            
            logConsole('GET', '/blog/offset', 'INFO', `Retrieved blog posts with offset`, { count: data.posts.length, min, max, tagsContains, titleContains });
            writeToLog(`BlogRoute READ OFFSET ok count=${data.posts.length} min=${min} max=${max}`, 'blog');
            return res.success(data);
        } catch (error) {
            logConsole('GET', '/blog/offset', 'FAIL', `Error retrieving blog posts with offset`, { error });
            writeToLog(`BlogRoute READ OFFSET error`, 'blog');
            return res.error("error retrieving blog posts with offset", 500, error);
        }
    }

    async getBySlug(req: Request<{ slug: string }>, res: Response) {
        const user = (req as any).user;
        const isAuthenticated = !!user;
    
        res.setHeader('Vary', 'Authorization');
    
        let currentVersion = await BlogService.getPostVersion(req.params.slug);
        let logDetails = { slug: req.params.slug, cacheStatus: ''};
    
        if (!isAuthenticated && currentVersion) {
            const etag = `"${currentVersion}"`;
            res.setHeader('ETag', etag);
    
            if (req.headers['if-none-match'] === etag) {
                logDetails.cacheStatus = 'client_cache_hit';
                logConsole('GET', `/blog/${req.params.slug}`, 'OK', `Retrieved blog post slug=${req.params.slug} cache=${logDetails.cacheStatus} auth=false`, logDetails);
                writeToLog(`BlogRoute READ ok slug=${req.params.slug} cache=${logDetails.cacheStatus} auth=false status=304`, 'blog');
                return res.status(304).end(); 
            }
            
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
    
        
        const data = await BlogService.getPostBySlug(req.params.slug, isAuthenticated);
        
        if (!data || !data.data) {
            return res.error('Post not found', 404);
        }
    
        if (!isAuthenticated && !currentVersion) {
            currentVersion = new Date().toISOString();
            
            await BlogService.updatePostVersion(req.params.slug, currentVersion).catch(err => 
                console.error("Failed to auto-create version", err)
            );
    
            res.setHeader('ETag', `"${currentVersion}"`);
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (isAuthenticated) {
             res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        }
    
        logDetails.cacheStatus = data.cacheStatus;
        logConsole('GET', `/blog/${req.params.slug}`, 'OK', `Retrieved blog post slug=${req.params.slug} cache=${logDetails.cacheStatus} auth=${isAuthenticated}`);
        writeToLog(`BlogRoute READ ok slug=${req.params.slug} cache=${logDetails.cacheStatus} auth=${isAuthenticated}`, 'blog');
        
        return res.success({ 
            ...data.data, 
            cached: data.cached,
            version: currentVersion 
        });
    }

    async create(req: Request, res: Response) {
        const { title, slug, content, summary, authorId, tagIds, featuredImage, indexed, published } = req.body;

        try {
            const newPost = await BlogService.createPost({ title, slug, content, summary, authorId, tagIds, featuredImage, indexed, published });
            logConsole('POST', '/blog/', 'OK', `Created new blog post`, { slug });
            writeToLog(`BlogRoute CREATE ok slug=${slug}`, 'blog');

            return res.success({ post: newPost }, 'blog post created successfully')
        } catch (error) {
            const errMessage = (error as any).message || '';

            if (errMessage.startsWith('INVALID_TAG_IDS:')) {
                const missing = errMessage.replace('INVALID_TAG_IDS:', '');
                logConsole('POST', '/blog/', 'WARN', `Invalid tag ids`, { slug: req.body.slug, missing });
                writeToLog(`BlogRoute CREATE invalid tags slug=${req.body.slug} missing=${missing}`, 'blog');
                return res.error(`invalid tag ids: ${missing}`, 400);
            }

            if (errMessage === 'INVALID_AUTHOR') {
                logConsole('POST', '/blog/', 'WARN', `Invalid author id`, { slug: req.body.slug, authorId });
                writeToLog(`BlogRoute CREATE invalid author slug=${req.body.slug} author=${authorId}`, 'blog');
                return res.error('invalid author id', 400);
            }

            if(errMessage.includes('UNIQUE constraint failed')) {
                logConsole('POST', '/blog/', 'WARN', `Slug already exists`, { slug: req.body.slug });
                writeToLog(`BlogRoute CREATE duplicate slug=${req.body.slug}`, 'blog');

                return res.error("slug already exists", 409);
            }

            if (errMessage.includes('FOREIGN KEY constraint failed')) {
                logConsole('POST', '/blog/', 'WARN', `Foreign key constraint`, { slug: req.body.slug, authorId, tagIds });
                writeToLog(`BlogRoute CREATE foreign key fail slug=${req.body.slug}`, 'blog');
                return res.error('invalid authorId or tagIds', 400);
            }

            logConsole('POST', '/blog/', 'FAIL', `Error creating new blog post`, { error, slug: req.body.slug });
            writeToLog(`BlogRoute CREATE error slug=${req.body.slug}`, 'blog');

            return res.error("error creating blog post", 500, error);
        }
    }

    async update(req: Request<{ slug: string }>, res: Response) {
        let { title, content, summary, authorId, tagIds, tags, featuredImage, indexed, published, slug: newSlug } = req.body;
    
        if (!tagIds && tags) {
            tagIds = tags;
        }

        try {
            const updatedPost = await BlogService.updatePostBySlug(req.params.slug, { title, content, summary, authorId, tagIds, featuredImage, indexed, published, slug: newSlug });

            if (!updatedPost) {
                logConsole('PUT', `/blog/${req.params.slug}`, 'WARN', `Post not found`, { slug: req.params.slug });
                writeToLog(`BlogRoute UPDATE not found slug=${req.params.slug}`, 'blog');
                return res.idNotFound(req.params.slug, `post (${req.params.slug}) not found`);
            }

            logConsole('PUT', `/blog/${req.params.slug}`, 'OK', `Updated blog post`, { slug: req.params.slug });
            writeToLog(`BlogRoute UPDATE ok slug=${req.params.slug}`, 'blog');

            return res.success({ post: updatedPost }, `post (${req.params.slug}) updated successfully`);
        } catch (error) {
            const errMessage = (error as any).message || '';

            if (errMessage.startsWith('INVALID_TAG_IDS:')) {
                const missing = errMessage.replace('INVALID_TAG_IDS:', '');
                logConsole('PUT', `/blog/${req.params.slug}`, 'WARN', `Invalid tag ids`, { slug: req.params.slug, missing });
                writeToLog(`BlogRoute UPDATE invalid tags slug=${req.params.slug} missing=${missing}`, 'blog');
                return res.error(`invalid tag ids: ${missing}`, 400);
            }

            if (errMessage === 'INVALID_AUTHOR') {
                logConsole('PUT', `/blog/${req.params.slug}`, 'WARN', `Invalid author id`, { slug: req.params.slug, authorId });
                writeToLog(`BlogRoute UPDATE invalid author slug=${req.params.slug} author=${authorId}`, 'blog');
                return res.error('invalid author id', 400);
            }

            if (errMessage.includes('UNIQUE constraint failed')) {
                logConsole('PUT', `/blog/${req.params.slug}`, 'WARN', `Slug already exists`, { slug: req.params.slug, newSlug });
                writeToLog(`BlogRoute UPDATE duplicate newSlug=${newSlug}`, 'blog');
                return res.error('slug already exists', 409);
            }

            logConsole('PUT', `/blog/${req.params.slug}`, 'FAIL', `Error updating blog post`, { error, slug: req.params.slug });
            writeToLog(`BlogRoute UPDATE error slug=${req.params.slug}`, 'blog');

            return res.error("error updating blog post", 500, error);
        }
    }

    async updatePublish(req: Request<{ slug: string }>, res: Response) {
        const { publish } = req.body;
        try {
            const updatedPost = await BlogService.publishedPostBySlug(req.params.slug, publish);

            if (!updatedPost) {
                logConsole('PUT', `/blog/publish/${req.params.slug}`, 'WARN', `Post not found`, { slug: req.params.slug });
                writeToLog(`BlogRoute PUBLISH not found slug=${req.params.slug}`, 'blog');
                return res.idNotFound(req.params.slug, `post (${req.params.slug}) not found`);
            }

            logConsole('PUT', `/blog/publish/${req.params.slug}`, 'OK', `Updated publish status for blog post`, { slug: req.params.slug, publish });
            writeToLog(`BlogRoute PUBLISH ok slug=${req.params.slug}`, 'blog');

            return res.success({ post: updatedPost }, `post (${req.params.slug}) publish status updated successfully`);
        } catch (error) {
            logConsole('PUT', `/blog/publish/${req.params.slug}`, 'FAIL', `Error updating publish status for blog post`, { error, slug: req.params.slug });
            writeToLog(`BlogRoute PUBLISH error slug=${req.params.slug}`, 'blog');

            return res.error("error updating blog post publish status", 500, error);
        }
    }

    async updateIndexed(req: Request<{ slug: string }>, res: Response) {
        const { indexed } = req.body;
        try {
            const updatedPost = await BlogService.indexedPostBySlug(req.params.slug, indexed);

            if (!updatedPost) {
                logConsole('PUT', `/blog/indexed/${req.params.slug}`, 'WARN', `Post not found`, { slug: req.params.slug });
                writeToLog(`BlogRoute INDEXED not found slug=${req.params.slug}`, 'blog');
                return res.idNotFound(req.params.slug, `post (${req.params.slug}) not found`);
            }

            logConsole('PUT', `/blog/indexed/${req.params.slug}`, 'OK', `Updated indexed status for blog post`, { slug: req.params.slug, indexed });
            writeToLog(`BlogRoute INDEXED ok slug=${req.params.slug}`, 'blog');

            return res.success({ post: updatedPost }, `post (${req.params.slug}) indexed status updated successfully`);
        } catch (error) {
            logConsole('PUT', `/blog/indexed/${req.params.slug}`, 'FAIL', `Error updating indexed status for blog post`, { error, slug: req.params.slug });
            writeToLog(`BlogRoute INDEXED error slug=${req.params.slug}`, 'blog');

            return res.error("error updating blog post indexed status", 500, error);
        }
    }

    async delete(req: Request<{ slug: string }>, res: Response) {
        try {
            const deleted = await BlogService.deletePostBySlug(req.params.slug);
            if (!deleted) {
                logConsole('DELETE', `/blog/${req.params.slug}`, 'WARN', `Post not found`, { slug: req.params.slug });
                writeToLog(`BlogRoute DELETE not found slug=${req.params.slug}`, 'blog');
                return res.success({}, `post (${req.params.slug}) not found or already deleted`);
            }

            logConsole('DELETE', `/blog/${req.params.slug}`, 'OK', `Deleted blog post`, { slug: req.params.slug });
            writeToLog(`BlogRoute DELETE ok slug=${req.params.slug}`, 'blog');

            return res.removed(req.params.slug, `post (${req.params.slug}) deleted successfully`);
        } catch (error) {
            logConsole('DELETE', `/blog/${req.params.slug}`, 'FAIL', `Error deleting blog post`, { error, slug: req.params.slug });
            writeToLog(`BlogRoute DELETE error slug=${req.params.slug}`, 'blog');

            return res.error("error deleting blog post", 500, error);
        }
    }


    async CacheClear(req: Request<{ slug: string }>, res: Response) {
        try {
            const deleted = await BlogService.deleteCacheBySlug(req.params.slug);
            if (!deleted) {
                logConsole('DELETE', `/blog/cache/${req.params.slug}`, 'WARN', `Cache not found`, { slug: req.params.slug });
                writeToLog(`BlogRoute CACHE DELETE not found slug=${req.params.slug}`, 'blog');
                return res.idNotFound(req.params.slug, `cache for post (${req.params.slug}) not found`);
            }

            logConsole('DELETE', `/blog/cache/${req.params.slug}`, 'OK', `Deleted cache for blog post`, { slug: req.params.slug });
            writeToLog(`BlogRoute CACHE DELETE ok slug=${req.params.slug}`, 'blog');

            return res.removed(req.params.slug, `cache for post (${req.params.slug}) deleted successfully`);
        } catch (error) {
            logConsole('DELETE', `/blog/cache/${req.params.slug}`, 'FAIL', `Error deleting cache for blog post`, { error, slug: req.params.slug });
            writeToLog(`BlogRoute CACHE DELETE error slug=${req.params.slug}`, 'blog');

            return res.error("error while deleting blog post cache", 500, error);
        } 
    }

    async CacheClearAll(req: Request, res: Response) {
        try {
            const rslt = await BlogService.clearAllCache();

            logConsole('DELETE', `/blog/cache/clear/all`, 'OK', `Cleared all blog cache`);
            writeToLog(`BlogRoute CACHE CLEAR ALL ok`, 'blog');

            return res.success({
                batches_processed: rslt.batches_processed,
                total_keys_cleared: rslt.total_keys_cleared,
                keys_deleted: rslt.keys_deleted,
            }, `all blog cache cleared successfully`);
        } catch (error) {
            logConsole('DELETE', `/blog/cache/clear/all`, 'FAIL', `Error clearing all blog cache`, { error });
            writeToLog(`BlogRoute CACHE CLEAR ALL error`, 'blog');

            return res.error("error while clearing all blog cache", 500, error);
        }
    }

    async getPostVersion(req: Request<{ slug: string }>, res: Response) {
        try {
            const version = await BlogService.getPostVersion(req.params.slug);

            logConsole('GET', `/blog/version/${req.params.slug}`, 'INFO', `Retrieved blog post version`, { slug: req.params.slug, version: version });
            writeToLog(`BlogRoute GET VERSION ok slug=${req.params.slug}`, 'blog');

            return res.success({ version }, `blog post version retrieved successfully`);
        } catch (error) {
            logConsole('GET', `/blog/version/${req.params.slug}`, 'FAIL', `Error retrieving blog post version`, { error, slug: req.params.slug });
            writeToLog(`BlogRoute GET VERSION error slug=${req.params.slug}`, 'blog');

            return res.error("error retrieving blog post version", 500, error);
        }
    }

    async updatePostVersion(req: Request<{ slug: string }>, res: Response) {
        
        try {
            await BlogService.updatePostVersion(req.params.slug, new Date().toISOString());

            logConsole('PUT', `/blog/version/${req.params.slug}/update`, 'OK', `Updated blog post version`, { slug: req.params.slug, version: new Date().toISOString() });
            writeToLog(`BlogRoute UPDATE VERSION ok slug=${req.params.slug}`, 'blog');

            return res.success({}, `blog post version updated successfully`);
        } catch (error) {
            logConsole('PUT', `/blog/version/${req.params.slug}/update`, 'FAIL', `Error updating blog post version`, { error, slug: req.params.slug });
            writeToLog(`BlogRoute UPDATE VERSION error slug=${req.params.slug}`, 'blog');

            return res.error("error updating blog post version", 500, error);
        }
    }
}

export default new BlogController();

