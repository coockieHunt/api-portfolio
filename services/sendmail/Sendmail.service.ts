//middleware
import { logConsole, writeToLog } from '../../middlewares/log.middlewar.js';
import { SendmailHelper } from './Sendmail.helper.js';

interface SendMailResponse {
    success: boolean;
    message?: string;
    messageId?: string;
}

export class SendmailService {
    /**
     * Verifies the SMTP server connection
     * @returns Promise resolving to true if connection is successful
     * @throws {Error} If SMTP connection fails
     */
    static async verifySmtpConnection(): Promise<boolean> {
        return SendmailHelper.verifyConnection();
    }

    /**
     * Sends an email via SMTP
     * @param to - Recipient email address
     * @param subject - Email subject line
     * @param content - HTML email content
     * @returns Promise with success status and optional error message
     */
    static async sendmail(to: string, subject: string, content: string): Promise<SendMailResponse> {
        try {
            const mailOptions = SendmailHelper.createMailOptions(to, subject, content);
            const messageId = await SendmailHelper.sendEmail(mailOptions);

            writeToLog(`Email sent to [${to}] ID: ${messageId}`, 'mail');
            return { success: true, messageId: messageId };
        } catch (error: any) {
            const errorMsg = error.message || String(error);
            logConsole('POST', '/sendmail/', 'FAIL', 'Error sending email', { error: errorMsg });
            writeToLog(`Sendmail Error: ${errorMsg}`, 'mail');
            return { success: false, message: errorMsg };
        }
    }
}

export default SendmailService.sendmail;
