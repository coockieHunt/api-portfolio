import type { Request, Response } from "express";
import { logConsole, writeToLog } from '../../middlewares/log.middlewar.ts';
import { ProjectsService } from '../../services/projects/Projects.service.ts';

class ProjectsController {
    async getProjects(req: Request, res: Response) {
        try {
            const isAuthenticated = !!(req as any).user;
            const data = await ProjectsService.getAllProjects(isAuthenticated);
            
            logConsole('GET', '/projects', 'INFO', `Retrieved projects`, { count: data.length, auth: isAuthenticated });
            writeToLog(`ProjectsRoute READ ok count=${data.length} auth=${isAuthenticated}`, 'projects');
            
            return res.success(data);
        } catch (error) {
            logConsole('GET', '/projects', 'FAIL', `Error retrieving projects`, { error });
            writeToLog(`ProjectsRoute READ error`, 'projects');
            return res.error("error retrieving projects", 500, error);
        }
    }

    async getOffset(req: Request, res: Response) {
        try {
            const min = req.query.min ? parseInt(req.query.min as string) : 1;
            const max = req.query.max ? parseInt(req.query.max as string) : 100;
            const isAuthenticated = !!(req as any).user;

            const data = await ProjectsService.getProjectsOffset(
                min,
                max,
                !isAuthenticated
            );

            logConsole('GET', '/projects/offset', 'INFO', 'Retrieved projects offset', {
                count: data.projects.length,
                min,
                max,
                auth: isAuthenticated,
            });
            writeToLog(`ProjectsRoute READ OFFSET ok count=${data.projects.length} min=${min} max=${max} auth=${isAuthenticated}`, 'projects');

            return res.success(data);
        } catch (error) {
            logConsole('GET', '/projects/offset', 'FAIL', 'Error retrieving projects offset', { error });
            writeToLog('ProjectsRoute READ OFFSET error', 'projects');
            return res.error('error retrieving projects offset', 500, error);
        }
    }

    async create(req: Request, res: Response) {
        try {
            const data = await ProjectsService.create(req.body);
            
            logConsole('POST', '/projects', 'INFO', `Created project`, { id: data.id });
            writeToLog(`ProjectsRoute CREATE ok id=${data.id}`, 'projects');
            
            return res.success(data, 'Project created successfully', 201);
        } catch (error) {
            logConsole('POST', '/projects', 'FAIL', `Error creating project`, { error });
            writeToLog(`ProjectsRoute CREATE error`, 'projects');
            return res.error("error creating project", 500, error);
        }
    }

    async getProjectById(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string);
            const data = await ProjectsService.getProjectById(id);

            if (!data) {
                return res.idNotFound(id, "Project not found");
            }

            const isAuthenticated = !!(req as any).user;
            if (!isAuthenticated && data.published !== 1) {
                return res.idNotFound(id, "Project not found");
            }

            logConsole('GET', `/projects/${id}`, 'INFO', `Retrieved project`, { id, auth: isAuthenticated });
            writeToLog(`ProjectsRoute READ_ONE ok id=${id} auth=${isAuthenticated}`, 'projects');

            return res.success(data);
        } catch (error) {
            logConsole('GET', `/projects/${req.params.id}`, 'FAIL', `Error retrieving project`, { error });
            writeToLog(`ProjectsRoute READ_ONE error`, 'projects');
            return res.error("error retrieving project", 500, error);
        }
    }

    async update(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string);
            const data = await ProjectsService.update(id, req.body);
            
            if (!data) {
                return res.idNotFound(id, "Project not found");
            }

            logConsole('PUT', `/projects/${id}`, 'INFO', `Updated project`, { id });
            writeToLog(`ProjectsRoute UPDATE ok id=${id}`, 'projects');
            
            return res.success(data);
        } catch (error) {
            logConsole('PUT', `/projects/${req.params.id}`, 'FAIL', `Error updating project`, { error });
            writeToLog(`ProjectsRoute UPDATE error`, 'projects');
            return res.error("error updating project", 500, error);
        }
    }

    async updatePublish(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string);
            const { publish } = req.body;
            const data = await ProjectsService.publishProject(id, publish);
            
            if (!data) {
                return res.idNotFound(id, "Project not found");
            }

            logConsole('PUT', `/projects/publish/${id}`, 'INFO', `Updated project publish status`, { id, publish });
            writeToLog(`ProjectsRoute PUBLISH ok id=${id} publish=${publish}`, 'projects');
            
            return res.success(data);
        } catch (error) {
            logConsole('PUT', `/projects/publish/${req.params.id}`, 'FAIL', `Error updating project publish status`, { error });
            writeToLog(`ProjectsRoute PUBLISH error`, 'projects');
            return res.error("error updating project publish status", 500, error);
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string);
            await ProjectsService.delete(id);
            
            logConsole('DELETE', `/projects/${id}`, 'INFO', `Deleted project`, { id });
            writeToLog(`ProjectsRoute DELETE ok id=${id}`, 'projects');
            
            return res.success({ message: "Project deleted successfully" });
        } catch (error) {
            logConsole('DELETE', `/projects/${req.params.id}`, 'FAIL', `Error deleting project`, { error });
            writeToLog(`ProjectsRoute DELETE error`, 'projects');
            return res.error("error deleting project", 500, error);
        }
    }
}

export default new ProjectsController();
