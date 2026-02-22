import nodemailer from 'nodemailer';
import type { Transporter, SendMailOptions } from 'nodemailer';


/**
 * Sendmail Helper
 * 
 * Helper utilities for Sendmail Service SMTP operations.
 */
export class SendmailHelper {
    private static transporter: Transporter | null = null;

    /**
     * Initializes and returns the Nodemailer transporter
     * @returns Configured Nodemailer transporter instance
     */
    static getTransporter(): Transporter {
        if (!this.transporter) {
            this.transporter = nodemailer.createTransport({
                host: process.env.MAIL_HOST,
                port: parseInt(process.env.MAIL_PORT || '465', 10),
                secure: process.env.MAIL_SECURE === 'true',
                auth: {
                    user: process.env.MAIL_USER,
                    pass: process.env.MAIL_PASS,
                },
            });
        }
        return this.transporter;
    }

    /**
     * Gets the sender email address
     * @returns Formatted sender email string
     */
    static getSenderEmail(): string {
        return `"Portfolio" <${process.env.MAIL_USER}>`;
    }

    /**
     * Creates mail options object
     * @param to - Recipient email
     * @param subject - Email subject
     * @param content - HTML content
     * @returns SendMailOptions object
     */
    static createMailOptions(to: string, subject: string, content: string): SendMailOptions {
        return {
            from: this.getSenderEmail(),
            to: to,
            subject: subject,
            html: content,
        };
    }

    /**
     * Verifies SMTP connection
     * @returns Promise resolving to true if connection succeeds
     * @throws {Error} If verification fails
     */
    static async verifyConnection(): Promise<boolean> {
        try {
            await this.getTransporter().verify();
            return true;
        } catch (error: any) {
            throw new Error(`SMTP Connection failed: ${error.message}`);
        }
    }

    /**
     * Sends email using transporter
     * @param mailOptions - SendMailOptions object
     * @returns Promise with message ID
     */
    static async sendEmail(mailOptions: SendMailOptions): Promise<string> {
        const info = await this.getTransporter().sendMail(mailOptions);
        return info.messageId;
    }
}
