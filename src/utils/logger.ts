import winston from 'winston';

export class Logger {
    private winston: winston.Logger;

    constructor(private component: string) {
        this.winston = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: {
                component: this.component,
                service: 'btp-sap-odata-to-mcp-server'
            },
            transports: [
                new winston.transports.Console({
                    stderrLevels: ['error', 'warn', 'info', 'debug'], // All logs to stderr for MCP compatibility
                })
            ]
        });
    }

    debug(message: string, meta?: unknown): void {
        this.winston.debug(message, meta);
    }

    info(message: string, meta?: unknown): void {
        this.winston.info(message, meta);
    }

    warn(message: string, meta?: unknown): void {
        this.winston.warn(message, meta);
    }

    error(message: string, meta?: unknown): void {
        this.winston.error(message, meta);
    }
}