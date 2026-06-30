import { Router } from 'express';
import { createBatch, getBatch } from '../controllers/batchesController.js';
import { handleMulterError, uploadBulk } from '../middleware/upload.js';

export const batchesRouter = Router();

batchesRouter.post('/', uploadBulk.array('files', 50), handleMulterError, createBatch);
batchesRouter.get('/:id', getBatch);
