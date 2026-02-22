import { db } from '../../utils/sqllite.helper.ts';
import { projects } from '../../database/shema.ts';
import { and, desc, eq, sql } from 'drizzle-orm';

export class ProjectsService {
    /**
     * Retrieves all projects
     * @param isAuthenticated - If true, returns all projects (including unpublished)
     * @returns Promise with list of projects
     */
    static async getAllProjects(isAuthenticated: boolean = false) {
        const whereClause = isAuthenticated ? undefined : eq(projects.published, 1);
        
        const projectsResults = await db
            .select()
            .from(projects)
            .where(whereClause)
            .orderBy(desc(projects.id))
            .all();

        const results = projectsResults.map(ProjectsService.normalizeProject);

        return results;
    }

    /**
     * Retrieves a project by its ID
     * @param id - The ID of the project
     * @returns The project object or null if not found
     */
    static async getProjectById(id: number) {
        const result = await db
            .select()
            .from(projects)
            .where(eq(projects.id, id))
            .get();
        
        if (!result) return null;
        return ProjectsService.normalizeProject(result);
    }

    /**
     * Retrieves projects using offset-based pagination
     * @param min - Minimum offset position (default: 1)
     * @param max - Maximum offset position (default: 100)
     * @param onlyPublished - Whether to include only published projects (default: true)
     * @returns Promise with projects and cursor metadata
     */
    static async getProjectsOffset(
        min: number = 1,
        max: number = 100,
        onlyPublished: boolean = true
    ) {
        const limit = max - min + 1;
        const offset = min - 1;
        const visibilityFilter = onlyPublished ? eq(projects.published, 1) : undefined;

        const totalCountResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(projects)
            .where(visibilityFilter)
            .get();
        const totalCount = totalCountResult ? totalCountResult.count : 0;

        const projectsResults = await db
            .select()
            .from(projects)
            .where(visibilityFilter)
            .orderBy(desc(projects.id))
            .limit(limit)
            .offset(offset)
            .all();

        const results = projectsResults.map(ProjectsService.normalizeProject);

        return {
            meta: {
                cursor_start: min,
                cursor_end: min + results.length,
                requested_limit: limit,
                total_count: totalCount,
                total_pages: Math.ceil(totalCount / limit)
            },
            projects: results
        };
    }

    /**
     * Creates a new project
     * @param data 
     * @returns 
     */
    static async create(data: any) {
        const stackValue = Array.isArray(data.stack) ? JSON.stringify(data.stack) : data.stack;
        const galleryValue = Array.isArray(data.gallery) ? JSON.stringify(data.gallery) : (data.gallery || '[]');

        const result = await db.insert(projects).values({
            ...data,
            stack: stackValue,
            gallery: galleryValue,
            published: data.published ?? 0
        }).returning().get();

        return ProjectsService.normalizeProject(result);
    }

    static async update(id: number, data: any) {
        const updateData: any = { ...data };
        
        if (updateData.stack && Array.isArray(updateData.stack)) {
            updateData.stack = JSON.stringify(updateData.stack);
        }
        
        if (updateData.gallery && Array.isArray(updateData.gallery)) {
            updateData.gallery = JSON.stringify(updateData.gallery);
        }

        const result = await db.update(projects)
            .set(updateData)
            .where(eq(projects.id, id))
            .returning()
            .get();

        if (!result) return null;
        return ProjectsService.normalizeProject(result);
    }

    /**
     * Updates the published status of a project
     * @param id 
     * @param publish 
     * @returns 
     */
    static async publishProject(id: number, publish: boolean) {
        const result = await db.update(projects)
            .set({ published: publish ? 1 : 0 })
            .where(eq(projects.id, id))
            .returning()
            .get();

        if (!result) return null;
        return ProjectsService.normalizeProject(result);
    }

    static async delete(id: number) {
        return db.delete(projects).where(eq(projects.id, id)).run();
    }

    private static normalizeProject(project: any) {
        let parsedStack: string[] = [];
        let parsedGallery: string[] = [];
        
        try {
            parsedStack = JSON.parse(project.stack);
        } catch (e) {
             parsedStack = project.stack.split(',').map((s: string) => s.trim());
        }

        try {
            parsedGallery = JSON.parse(project.gallery || '[]');
        } catch (e) {
            parsedGallery = [];
        }

         if (!Array.isArray(parsedStack)) {
             parsedStack = [String(parsedStack)];
         }
         
         if (!Array.isArray(parsedGallery)) {
             parsedGallery = [String(parsedGallery)];
         }

        return {
            ...project,
            stack: parsedStack,
            gallery: parsedGallery
        }
    }
}
