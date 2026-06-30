import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { badRequest } from '../errors/AppError.js';

export const ACCEPTED_EXTENSIONS = new Set(['.txt', '.pdf', '.docx']);
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const getUploadExtension = (filename) => path.extname(filename || '').toLowerCase();

export const extractTextFromUpload = async (file) => {
  if (!file) {
    throw badRequest('file is required', { field: 'file' });
  }

  const extension = getUploadExtension(file.originalname);
  if (!ACCEPTED_EXTENSIONS.has(extension)) {
    throw badRequest('file must be one of .txt, .pdf, .docx', { field: 'file', acceptedTypes: [...ACCEPTED_EXTENSIONS] });
  }

  if (extension === '.txt') {
    return file.buffer.toString('utf8');
  }

  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }

  if (extension === '.pdf') {
    const result = await pdfParse(file.buffer);
    return result.text;
  }

  throw badRequest('unsupported file type', { field: 'file' });
};
