import { BatchService } from '../services/batchService.js';
import { requireUuid } from '../utils/validation.js';
import { badRequest } from '../errors/AppError.js';

const service = new BatchService();

export const createBatch = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw badRequest('at least one file is required', { field: 'files' });
    }
    const result = await service.createBatch(req.files);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getBatch = async (req, res, next) => {
  try {
    requireUuid(req.params.id, 'id');
    res.json(await service.getBatch(req.params.id));
  } catch (error) {
    next(error);
  }
};
