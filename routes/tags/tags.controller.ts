import type {Request, Response} from 'express';
import { TagService } from '../../services/tag/Tag.service.ts';
import { logConsole, writeToLog } from '../../middlewares/log.middlewar.ts';

class TagsController {
	/**
	 * GET / - Get all tags
	 * Retrieves all tags.
	 * @param req Express Request object
	 * @param res Express Response object
	 */
	async getAll(req: Request, res: Response) {
		try {
			const isAuthenticated = !!(req as any).user;
			const tags = await TagService.getAllTags(isAuthenticated);
			logConsole('TagRouter', 'GET /', 'OK', `Retrieved all tags. auth=${isAuthenticated}`);
			writeToLog(`Retrieved all tags. auth=${isAuthenticated}`, 'tags');
			return res.success(tags.tags);
		} catch (error: any) {
			logConsole('TagRouter', 'GET /', 'FAIL', error.message);
			writeToLog(`Failed to retrieve tags: ${error.message}`, 'tags');
			return res.error('Failed to retrieve tags.', 500);
		}
	}

	/**
	 * GET /:slug - Get tag by slug
	 * Retrieves a tag by its slug.
	 * @param req Express Request object
	 * @param res Express Response object
	 */
	async getBySlug(req: Request<{ slug: string }>, res: Response) {
		const { slug } = req.params;
		const isAuthenticated = !!(req as any).user;
		const tag = await TagService.getTagBySlug(slug, isAuthenticated);
		logConsole('TagRouter', `GET /${slug}`, 'OK', `Retrieved tag with slug: ${slug}. auth=${isAuthenticated}`);
		return res.success(tag);
	}

	/**
	 * DELETE /:slug - Delete tag by slug
	 * Deletes a tag by its slug.
	 * @param req Express Request object
	 * @param res Express Response object
	 */
	async delete(req: Request<{ slug: string }>, res: Response) {
		const { slug } = req.params;
		await TagService.deleteTagBySlug(slug);
		logConsole('TagRouter', `DELETE /${slug}`, 'OK', `Deleted tag with slug: ${slug}.`);
		writeToLog(`Deleted tag with slug: ${slug}.`, 'tags');
		return res.removed(slug, 'Tag deleted successfully.');
	}

	/**
	 * POST / - Create a new tag
	 * Creates a new tag.
	 * @param req Express Request object
	 * @param res Express Response object
	 */
	async create(req: Request, res: Response) {
		const { name, slug, color } = req.body;
		const newTag = await TagService.createTag(name, slug, color);
		logConsole('TagRouter', 'POST /', 'OK', `Created new tag: ${slug}`);
		writeToLog(`Created new tag: ${slug}`, 'tags');
		return res.success(newTag, 'Tag created successfully.');
	}

	/**
	 * PUT /:slug - Update tag by slug
	 * Updates tag properties by its slug.
	 * @param req Express Request object
	 * @param res Express Response object
	 */
	async update(req: Request<{ slug: string }>, res: Response) {
		const { slug } = req.params;
		const { name, color } = req.body;
		const updatedTag = await TagService.updateTagBySlug(slug, { name, color });
		logConsole('TagRouter', `PUT /${slug}`, 'OK', `Updated tag with slug: ${slug}.`);
		writeToLog(`Updated tag with slug: ${slug}.`, 'tags');
		return res.success(updatedTag, 'Tag updated successfully.');
	}
}

export default new TagsController();
