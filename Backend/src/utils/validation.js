import { badRequest } from '../errors/AppError.js';
import { PII_TYPES } from '../constants/pii.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value) => UUID_REGEX.test(String(value || ''));

export const requireUuid = (value, fieldName) => {
  if (!isUuid(value)) {
    throw badRequest(`${fieldName} must be a valid UUID`, { field: fieldName });
  }
};

export const validateSpanAction = (body) => {
  const action = body?.action;
  if (!['accept', 'reject', 'override'].includes(action)) {
    throw badRequest('action must be one of accept, reject, override', { field: 'action' });
  }

  if (action === 'override') {
    if (!body.overrideType || typeof body.overrideType !== 'string') {
      throw badRequest('overrideType is required when action is override', { field: 'overrideType' });
    }
    if (!PII_TYPES.includes(body.overrideType)) {
      throw badRequest(`overrideType must be one of ${PII_TYPES.join(', ')}`, { field: 'overrideType' });
    }
  }

  return {
    action,
    overrideType: body.overrideType,
    actor: typeof body.actor === 'string' && body.actor.trim() ? body.actor.trim() : null,
  };
};

export const validateBulkAction = (body) => {
  if (!Array.isArray(body?.spanIds) || body.spanIds.length === 0) {
    throw badRequest('spanIds must be a non-empty array of UUIDs', { field: 'spanIds' });
  }

  for (const spanId of body.spanIds) {
    requireUuid(spanId, 'spanIds');
  }

  if (!['accept', 'reject'].includes(body.action)) {
    throw badRequest('bulk action must be accept or reject', { field: 'action' });
  }

  return {
    spanIds: [...new Set(body.spanIds)],
    action: body.action,
    dryRun: body.dryRun !== false,
    actor: typeof body.actor === 'string' && body.actor.trim() ? body.actor.trim() : null,
  };
};
