import cors from 'cors';
import express from 'express';
import { documentsRouter } from './routes/documents.routes.js';
import { batchesRouter } from './routes/batches.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use('/documents', documentsRouter);
  app.use('/batches', batchesRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
