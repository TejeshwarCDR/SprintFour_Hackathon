import { Router } from 'express';
import {
  bulkSpans,
  commitDocument,
  createDocument,
  downloadRedactedDocument,
  getAudit,
  getDocument,
  getSummary,
  patchSpan,
} from '../controllers/documentsController.js';
import { handleMulterError, upload } from '../middleware/upload.js';

export const documentsRouter = Router();

documentsRouter.post('/', upload.single('file'), handleMulterError, createDocument);
documentsRouter.get('/:id', getDocument);
documentsRouter.get('/:id/summary', getSummary);
documentsRouter.patch('/:id/spans/:spanId', patchSpan);
documentsRouter.post('/:id/spans/bulk', bulkSpans);
documentsRouter.post('/:id/commit', commitDocument);
documentsRouter.get('/:id/download', downloadRedactedDocument);
documentsRouter.get('/:id/audit', getAudit);
