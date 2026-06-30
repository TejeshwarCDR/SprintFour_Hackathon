import { DocumentService } from '../services/documentService.js';
import { extractTextFromUpload } from '../utils/textExtraction.js';
import { requireUuid, validateBulkAction, validateSpanAction } from '../utils/validation.js';

const service = new DocumentService();

export const createDocument = async (req, res, next) => {
  try {
    const rawText = await extractTextFromUpload(req.file);
    const document = await service.ingest({
      originalFilename: req.file.originalname,
      rawText,
    });

    res.status(201).json({ id: document.id, status: 'pending' });
  } catch (error) {
    next(error);
  }
};

export const getDocument = async (req, res, next) => {
  try {
    requireUuid(req.params.id, 'id');
    res.json(await service.getDocument(req.params.id));
  } catch (error) {
    next(error);
  }
};

export const getSummary = async (req, res, next) => {
  try {
    requireUuid(req.params.id, 'id');
    res.json(await service.getSummary(req.params.id));
  } catch (error) {
    next(error);
  }
};

export const patchSpan = async (req, res, next) => {
  try {
    requireUuid(req.params.id, 'id');
    requireUuid(req.params.spanId, 'spanId');
    const payload = validateSpanAction(req.body);
    res.json(await service.updateSpan(req.params.id, req.params.spanId, payload));
  } catch (error) {
    next(error);
  }
};

export const bulkSpans = async (req, res, next) => {
  try {
    requireUuid(req.params.id, 'id');
    const payload = validateBulkAction(req.body);
    res.json(await service.bulkUpdateSpans(req.params.id, payload));
  } catch (error) {
    next(error);
  }
};

export const commitDocument = async (req, res, next) => {
  try {
    requireUuid(req.params.id, 'id');
    res.json(await service.commit(req.params.id));
  } catch (error) {
    next(error);
  }
};

export const downloadRedactedDocument = async (req, res, next) => {
  try {
    requireUuid(req.params.id, 'id');
    const output = await service.getRedactedDownload(req.params.id);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${output.filename}"`);
    res.status(200).send(output.text);
  } catch (error) {
    next(error);
  }
};

export const getAudit = async (req, res, next) => {
  try {
    requireUuid(req.params.id, 'id');
    res.json(await service.getAudit(req.params.id));
  } catch (error) {
    next(error);
  }
};
