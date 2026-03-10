"use strict";

const winston = require("winston");

const logger = winston.createLogger({
  // BUG FIX: "info" level (2) drops Morgan HTTP logs (level 3). Default to "http".
  level: process.env.LOG_LEVEL || "http",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level}] ${message}${extras}`;
        })
      ),
    }),
  ],
});

module.exports = { logger };
