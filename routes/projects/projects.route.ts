import { Router} from "express";
import type { Request, Response, NextFunction } from "express";
import { rateLimiter } from '../../middlewares/rateLimiter.middlewar.ts';
import { responseHandler } from '../../middlewares/responseHandler.middlewar.ts';
import { validateRequest } from '../../middlewares/validateRequest.middleware.ts';
import { asyncHandler } from '../../middlewares/errorHandler.middleware.ts';
import { authenticateToken, HybridAuthenticateToken } from '../../middlewares/authenticateToken.middlewar.ts';

import ProjectsController from './projects.controller.ts';
import { ProjectsValidator } from './projects.validator.ts';

const ProjectRoute: Router = Router({ mergeParams: true });

const normalizeProjectBody = (req: Request, res: Response, next: NextFunction) => {
    const body = req.body || {};

    if (body.tab_name && !body.tabName) body.tabName = body.tab_name;
    if (body.stacks && !body.stack) body.stack = body.stacks;
    if (body.url_github && !body.UrlGithub) body.UrlGithub = body.url_github;
    if (body.url_project && !body.UrlProject) body.UrlProject = body.url_project;

    next();
};

ProjectRoute.get(
    "/",
    rateLimiter,
    HybridAuthenticateToken, 
    responseHandler,
    ProjectsValidator.getProjects,
    validateRequest,
    asyncHandler(ProjectsController.getProjects)
);

ProjectRoute.get(
    "/offset",
    rateLimiter,
    HybridAuthenticateToken,
    responseHandler,
    ProjectsValidator.getOffset,
    validateRequest,
    asyncHandler(ProjectsController.getOffset)
);

ProjectRoute.get(
    "/:id",
    rateLimiter,
    HybridAuthenticateToken,
    responseHandler,
    ProjectsValidator.getProjectById,
    validateRequest,
    asyncHandler(ProjectsController.getProjectById)
);

ProjectRoute.post(
    "/",
    rateLimiter,
    authenticateToken,
    responseHandler,
    normalizeProjectBody,
    ProjectsValidator.create,
    validateRequest,
    asyncHandler(ProjectsController.create)
);

ProjectRoute.put(
    "/:id",
    rateLimiter,
    authenticateToken,
    responseHandler,
    normalizeProjectBody,
    ProjectsValidator.update,
    validateRequest,
    asyncHandler(ProjectsController.update)
);

ProjectRoute.put(
    "/edit/publish/:id",
    rateLimiter,
    authenticateToken,
    responseHandler,
    ProjectsValidator.updatePublish,
    validateRequest,
    asyncHandler(ProjectsController.updatePublish)
);

ProjectRoute.delete(
    "/:id",
    rateLimiter,
    authenticateToken,
    responseHandler,
    ProjectsValidator.delete,
    validateRequest,
    asyncHandler(ProjectsController.delete)
);

export default ProjectRoute;
