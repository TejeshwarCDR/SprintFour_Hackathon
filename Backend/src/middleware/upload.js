import multer from 'multer';
import { badRequest } from '../errors/AppError.js';
import { ACCEPTED_EXTENSIONS, getUploadExtension, MAX_UPLOAD_BYTES } from '../utils/textExtraction.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const extension = getUploadExtension(file.originalname);
  if (!ACCEPTED_EXTENSIONS.has(extension)) {
    cb(badRequest('file must be one of .txt, .pdf, .docx', {
      field: 'file',
      acceptedTypes: [...ACCEPTED_EXTENSIONS],
    }));
    return;
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter,
});

export const uploadBulk = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 50 },
  fileFilter,
});

export const handleMulterError = (err, req, res, next) => {
  if (!err) {
    next();
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      next(badRequest('file must be 5MB or smaller', { field: 'file', maxBytes: MAX_UPLOAD_BYTES }));
      return;
    }
    next(badRequest(err.message, { field: err.field || 'file', code: err.code }));
    return;
  }

  next(err);
};
