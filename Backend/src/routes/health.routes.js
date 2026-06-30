import { Router } from 'express';
import { env } from '../config/env.js';
import { getLlmHealth } from '../services/detection/llmDiagnostics.js';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({ ok: true });
});

healthRouter.get('/llm', (req, res) => {
  if (env.nodeEnv === 'production') {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'No route found for GET /health/llm',
        details: {},
      },
    });
    return;
  }

  res.json(getLlmHealth());
});
