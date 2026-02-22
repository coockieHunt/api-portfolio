import type { Request, Response } from 'express';
import sendmail from '../../services/sendmail/Sendmail.service.ts';
import { logConsole, writeToLog } from '../../middlewares/log.middlewar.ts';

class MailController {
	/**
	 * POST /sendEmail
	 * Handles sending contact emails from the portfolio.
	 * @param req Express Request object
	 * @param res Express Response object
	 */
	async sendEmail(req: Request, res: Response) {
		const { name, email, subject, message } = req.body;
		const adminEmail = process.env.MAIL_USER;

		if (!adminEmail) {
			logConsole('POST', '/sendEmail', 'FAIL', 'MAIL_USER not defined in environment variables');
			console.error("[Email] ERROR: MAIL_USER is not defined in environment variables.");
			return res.error("Server configuration error.", 500);
		}

		if (typeof sendmail !== 'function') {
			logConsole('POST', '/sendEmail', 'FAIL', 'sendmail is not a function. Check imports.');
			console.error("[Email] CRITICAL ERROR: sendmail is not a function. Check imports.");
			return res.error("Internal code error (Import).", 500);
		}

		try {
			const adminSubject = `[Portfolio] Contact de ${name}`;
			const adminContent = `
				<h3>Nouveau Message</h3>
				<p><strong>De:</strong> ${name} (${email})</p>
				<p><strong>Sujet:</strong> ${subject || 'Sans sujet'}</p>
				<hr/>
				<p>${message}</p>
			`;

			const result = await sendmail(adminEmail, adminSubject, adminContent);

			logConsole('POST', '/sendEmail', 'OK', 'Email sent to admin', { to: adminEmail, from: email });

			if (!result || !result.success) {throw new Error(result?.message || 'sendmail returned no result');}

			return res.success({ 
				messageId: result.messageId,
				info: 'Email sent successfully to admin.', 
				to: adminEmail,
				body: req.body
			});

		} catch (error: any) {
			const errorMsg = error.message || String(error);
			console.error("[Email] Exception in MailRoute:", error);
			writeToLog(`MailRoute Exception: ${errorMsg}`, 'mail');
            
			return res.error("Server error.", 500);
		}
	}
}

export default new MailController();
