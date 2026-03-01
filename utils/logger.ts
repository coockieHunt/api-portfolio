import consola from 'consola'
import path from 'path'
import fs from 'fs'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import cfg from '../config/default.ts'

const logDirectory = process.env.LOG_DIR || (cfg?.Log as any)?.directory || '../logs'
const dirPath = path.resolve(logDirectory)
if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })

const transport = new DailyRotateFile({
    dirname:      logDirectory,
    filename:     'system.log-%DATE%',
    datePattern:  'YYYY-WW',
    zippedArchive: true,
    frequency:    process.env.LOG_ROTATION_FREQUENCY || '7d',
    maxSize:      '20m',
    maxFiles:     process.env.LOG_MAX_FILES || '4w',
    createSymlink: true,
    symlinkName:  'system.log' 
})

const winstonLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, message }) => message as string)
    ),
    transports: [transport]
})

consola.addReporter({
    log: (logObj) => {
        winstonLogger.info(JSON.stringify({
            level:   logObj.type,
            message: logObj.args.map(String).join(' '),
            source:  'system',
            time:    new Date().toISOString(),
        }))
    }
})

export { consola as logger }