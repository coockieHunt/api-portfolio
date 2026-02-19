import { AuthorService } from '../../services/author/Author.service';
import type { Request, Response } from 'express';
import { writeToLog, logConsole } from '../../middlewares/log.middlewar';

class AuthorsController {
    /**
     * Get all authors
     */
    async getAll(req: Request, res: Response) {
        try {
            const data = await AuthorService.getAllAuthors();
            
            logConsole('GET', '/authors', 'INFO', 'Retrieved all authors', { count: data.length });
            writeToLog(`AuthorsRoute READ all ok count=${data.length}`, 'authors');
            
            return res.success(data);
        } catch (error) {
            logConsole('GET', '/authors', 'FAIL', 'Error retrieving authors', { error });
            writeToLog('AuthorsRoute READ all error', 'authors');
            return res.error('Error retrieving authors', 500, error);
        }
    }

    /**
     * Get author by ID
     */
    async getById(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string);
            const data = await AuthorService.getAuthorById(id);

            if (!data) {
                return res.idNotFound(id, 'Author not found');
            }

            logConsole('GET', `/authors/${id}`, 'INFO', 'Retrieved author', { id });
            writeToLog(`AuthorsRoute READ_ONE ok id=${id}`, 'authors');

            return res.success(data);
        } catch (error) {
            logConsole('GET', `/authors/${req.params.id}`, 'FAIL', 'Error retrieving author', { error });
            writeToLog('AuthorsRoute READ_ONE error', 'authors');
            return res.error('Error retrieving author', 500, error);
        }
    }

    /**
     * Create a new author
     */
    async create(req: Request, res: Response) {
        try {
            const data = await AuthorService.create(req.body);
            
            logConsole('POST', '/authors', 'INFO', 'Created author', { id: data.id, name: data.name });
            writeToLog(`AuthorsRoute CREATE ok id=${data.id}`, 'authors');
            
            return res.success(data, 'Author created successfully', 201);
        } catch (error: any) {
            if (error?.message?.includes('UNIQUE constraint failed')) {
                logConsole('POST', '/authors', 'WARN', 'Author name already exists', { error });
                return res.error('Author name already exists', 409, error);
            }
            logConsole('POST', '/authors', 'FAIL', 'Error creating author', { error });
            writeToLog('AuthorsRoute CREATE error', 'authors');
            return res.error('Error creating author', 500, error);
        }
    }

    /**
     * Update an author by ID
     */
    async update(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string);
            const data = await AuthorService.update(id, req.body);
            
            if (!data) {
                return res.idNotFound(id, 'Author not found');
            }

            logConsole('PUT', `/authors/${id}`, 'INFO', 'Updated author', { id, name: data.name });
            writeToLog(`AuthorsRoute UPDATE ok id=${id}`, 'authors');
            
            return res.success(data, 'Author updated successfully');
        } catch (error: any) {
            if (error?.message?.includes('UNIQUE constraint failed')) {
                logConsole('PUT', `/authors/${req.params.id}`, 'WARN', 'Author name already exists', { error });
                return res.error('Author name already exists', 409, error);
            }
            logConsole('PUT', `/authors/${req.params.id}`, 'FAIL', 'Error updating author', { error });
            writeToLog('AuthorsRoute UPDATE error', 'authors');
            return res.error('Error updating author', 500, error);
        }
    }

    /**
     * Delete an author by ID
     */
    async delete(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string);
            const success = await AuthorService.delete(id);
            
            if (!success) {
                return res.idNotFound(id, 'Author not found');
            }

            logConsole('DELETE', `/authors/${id}`, 'INFO', 'Deleted author', { id });
            writeToLog(`AuthorsRoute DELETE ok id=${id}`, 'authors');
            
            return res.success({}, 'Author deleted successfully');
        } catch (error) {
            logConsole('DELETE', `/authors/${req.params.id}`, 'FAIL', 'Error deleting author', { error });
            writeToLog('AuthorsRoute DELETE error', 'authors');
            return res.error('Error deleting author', 500, error);
        }
    }
}

export default new AuthorsController();
