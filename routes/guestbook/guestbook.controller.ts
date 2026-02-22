import { GuestBookService } from '../../services/guestbook/GuestBook.service.ts';
import type {Request, Response} from 'express';
import { logConsole, writeToLog } from '../../middlewares/log.middlewar.ts';

class GuestBookController {
	async getAll(req: Request, res: Response) {
		const user = (req as any).user;
        const isAuthenticated = !!user;

		console.log('GuestBookController.getAll - isAuthenticated:', isAuthenticated);

		const page = req.query.page ? parseInt(req.query.page as string) : 1;
		const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
		try {
			const guestBookResponse = await GuestBookService.getGuestBookEntries(page, limit, isAuthenticated);
			logConsole('GET', '/guestbook/', 'INFO', `Retrieved guestbook entries`, { count: guestBookResponse.entries.length, page });
			writeToLog(`GuestBookRoute READ ok page=${page} count=${guestBookResponse.entries.length}`, 'guestbook');
			return res.success(guestBookResponse);
		} catch (error) {
			logConsole('GET', '/guestbook/', 'FAIL', `Error retrieving guestbook entries`, { error });
			writeToLog(`GuestBookRoute READ error`, 'guestbook');
			return res.error('Error retrieving guestbook entries', 500, error);
		}
	}

    async authorize(req: Request<{ id: string }>, res: Response) {
        const { id } = req.params;
        try {
            const authorizedEntry = await GuestBookService.authorizeGuestBookEntry(id);
            logConsole('POST', `/guestbook/authorize/${id}`, 'OK', 'Authorized guestbook entry', { id });
            writeToLog(`GuestBookRoute AUTHORIZE ok id=${id}`, 'guestbook');
            return res.success({ id: authorizedEntry.id, entry: authorizedEntry }, 'Guestbook entry authorized successfully');
        } catch (error) {
            logConsole('POST', `/guestbook/authorize/${id}`, 'FAIL', 'Error authorizing guestbook entry', { error });
            writeToLog('GuestBookRoute AUTHORIZE error', 'guestbook');
            return res.error('Error authorizing guestbook entry', 500, error);
        }
    }

    async unauthorize(req: Request<{ id: string }>, res: Response) {
        const { id } = req.params;
        try {
            const unauthorizedEntry = await GuestBookService.unauthorizeGuestBookEntry(id);
            logConsole('POST', `/guestbook/unauthorize/${id}`, 'OK', 'Unauthorized guestbook entry', { id });
            writeToLog(`GuestBookRoute UNAUTHORIZE ok id=${id}`, 'guestbook');
            return res.success({ id: unauthorizedEntry.id, entry: unauthorizedEntry }, 'Guestbook entry unauthorized successfully');
        } catch (error) {
            logConsole('POST', `/guestbook/unauthorize/${id}`, 'FAIL', 'Error unauthorizing guestbook entry', { error });
            writeToLog('GuestBookRoute UNAUTHORIZE error', 'guestbook');
            return res.error('Error unauthorizing guestbook entry', 500, error);
        }
    }

	async create(req: Request, res: Response) {
		const { name, message } = req.body;
		try {
			const newEntry = await GuestBookService.addGuestBookEntry(name, message);
			logConsole('POST', '/guestbook/', 'OK', 'Added new guestbook entry', { by: name, len: message.length, id: newEntry.id });
			writeToLog(`GuestBookRoute WRITE ok by=${name} len=${message.length} id=${newEntry.id}`, 'guestbook');
			return res.success({ id: newEntry.id, new_entry: newEntry }, 'Guestbook entry added successfully');
		} catch (error) {
			logConsole('POST', '/guestbook/', 'FAIL', 'Error adding guestbook entry', { error });
			writeToLog('GuestBookRoute WRITE error', 'guestbook');
			return res.error('Error adding guestbook entry', 500, error);
		}
	}

	async delete(req: Request<{ id: string }>, res: Response) {
		const { id } = req.params;
		try {
			const deleted = await GuestBookService.deleteGuestBookEntry(id);
			logConsole('DELETE', `/guestbook/${id}`, 'OK', 'Deleted guestbook entry', { id });
			writeToLog(`GuestBookRoute DELETE ok id=${id}`, 'guestbook');
			return res.removed(id, 'Guestbook entry deleted successfully');
		} catch (error) {
			logConsole('DELETE', `/guestbook/${id}`, 'FAIL', 'Error deleting guestbook entry', { error });
			writeToLog('GuestBookRoute DELETE error', 'guestbook');
			return res.error('Error deleting guestbook entry', 500, error);
		}
	}
}

export default new GuestBookController();
