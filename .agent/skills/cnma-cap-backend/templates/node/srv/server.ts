import express from 'express';
import cors from 'cors';
import cds from '@sap/cds';
import path from 'path';
import dotenv from 'dotenv';
import { SecurityService } from './src/infrastructure/security/SecurityService';
import { Logger } from './src/common/util/Logger';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const logger = new Logger('Bootstrap');

/**
 * Custom CAP Bootstrap Server
 * Hooks into CDS bootstrap to add middleware, routes, and configuration.
 */
cds.on('bootstrap', async (app: express.Application) => {
    // ===== CORS =====
    app.use(cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true,
    }));

    // ===== BODY PARSING =====
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true }));

    // ===== REQUEST LOGGING =====
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
        });
        next();
    });

    // ===== JWT AUTHENTICATION (XSUAA) =====
    // Uncomment for production with BTP XSUAA:
    // const passport = require('passport');
    // const { JWTStrategy } = require('@sap/xssec');
    // const xsenv = require('@sap/xsenv');
    // const services = xsenv.getServices({ uaa: { tag: 'xsuaa' } });
    // passport.use(new JWTStrategy(services.uaa));
    // app.use(passport.initialize());
    // app.use(passport.authenticate('JWT', { session: false }));

    // ===== HEALTH CHECKS =====
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: process.env.SERVICE_NAME || 'cap-service',
        });
    });

    app.get('/health/ready', async (req, res) => {
        try {
            // Check DB connectivity
            await cds.connect.to('db');
            res.json({ status: 'ready', checks: { db: 'ok' } });
        } catch (error) {
            res.status(503).json({ status: 'not ready', error: error.message });
        }
    });

    // ===== CUSTOM API ROUTES =====
    // const CustomRouter = require('./src/routes/CustomRouter');
    // app.use('/api/v1', CustomRouter);

    logger.info('Custom bootstrap initialized');
});

/**
 * Server ready hook.
 */
cds.on('served', async () => {
    logger.info('All CDS services served successfully');

    // Initialize feature services here (constructor injection)
    // const featureService = new FeatureService(repository);
});

/**
 * Graceful shutdown handler.
 */
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    // Cleanup resources (DB connections, timers, etc.)
    process.exit(0);
});

export default cds.server;