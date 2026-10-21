// logger.ts
import { format } from 'date-fns';

class Logger {
    public log(message: string): void {
        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        console.log(`[${timestamp}] ${message}`);
    }
    public debug(category: string, message: string): void {
        if (process.env.NODE_ENV === 'development') {
            const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
            console.log(`[${timestamp}] [${category}] ${message}`);
        }
    }
    public info(category: string, message: string): void {
        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        console.log(`[${timestamp}] [${category}] ${message}`);
    }
    public warn(category: string, message: string, data?: any): void {
        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        console.warn(`[${timestamp}] [${category}] WARN: ${message}`, data || '');
    }
    public error(category: string, message: string, data?: any): void {
        const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
        console.error(`[${timestamp}] [${category}] ERROR: ${message}`, data || '');
    }
}

const logger = new Logger();
export { logger };
export default logger;
