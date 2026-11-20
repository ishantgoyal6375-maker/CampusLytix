import { Router } from 'express';
import multer from 'multer';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { desc, eq } from 'drizzle-orm';
import {
  requireAdmin,
  requireAuth,
  type AuthRequest,
} from '../middleware/auth.ts';
import { db } from '../db/index.ts';
import { storedFiles } from '../db/schema.ts';
import { logIntegrationEvent } from '../db/analytics.ts';

const router = Router();

const PRIVATE_STORAGE_DIR = resolve(process.cwd(), '.clubpulse-storage');
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls', '.pdf', '.json', '.txt']);
const ALLOWED_MIME_PREFIXES = [
  'text/csv',
  'text/plain',
  'application/pdf',
  'application/json',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(
        new Error(
          `File type "${ext || 'unknown'}" is not permitted. Allowed types: CSV, XLSX, XLS, PDF, JSON.`
        )
      );
    }
    if (!ALLOWED_MIME_PREFIXES.includes(file.mimetype)) {
      return cb(new Error(`Unsupported MIME type "${file.mimetype}".`));
    }
    cb(null, true);
  },
});

async function ensurePrivateDir() {
  if (!existsSync(PRIVATE_STORAGE_DIR)) {
    await mkdir(PRIVATE_STORAGE_DIR, { recursive: true });
  }
}

router.get('/files', requireAuth, async (_req, res) => {
  try {
    const files = await db
      .select()
      .from(storedFiles)
      .orderBy(desc(storedFiles.createdAt))
      .limit(50);

    res.json({
      files,
      gcsBucketConfigured: Boolean(process.env.GOOGLE_CLOUD_STORAGE_BUCKET),
      gcsBucketName: process.env.GOOGLE_CLOUD_STORAGE_BUCKET || null,
    });
  } catch (error) {
    console.error('Failed to list stored files:', error);
    res.status(500).json({ error: 'Unable to load file archive.' });
  }
});

router.post(
  '/upload',
  requireAuth,
  requireAdmin,
  (req, res, next) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Invalid file upload.' });
      }
      next();
    });
  },
  async (req: AuthRequest, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file attached.' });
    }

    const category = String(req.body?.category || 'Dataset').slice(0, 60);

    try {
      await ensurePrivateDir();
      const safeExt = extname(req.file.originalname).toLowerCase();
      const sanitizedBase = req.file.originalname
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 80);
      const uniqueName = `${Date.now()}_${sanitizedBase}`;
      const diskPath = join(PRIVATE_STORAGE_DIR, uniqueName);

      await writeFile(diskPath, req.file.buffer);

      const [record] = await db
        .insert(storedFiles)
        .values({
          fileName: uniqueName,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype || (safeExt === '.csv' ? 'text/csv' : 'application/octet-stream'),
          sizeBytes: req.file.size,
          category,
          storageBackend: process.env.GOOGLE_CLOUD_STORAGE_BUCKET
            ? 'gcs_ready_private'
            : 'local_private',
          storagePath: uniqueName,
          uploadedByUid: req.dbUser?.uid ?? null,
          uploadedByEmail: req.dbUser?.email ?? null,
        })
        .returning();

      await logIntegrationEvent({
        serviceKey: 'cloud_storage',
        action: 'upload_file',
        status: 'success',
        message: `Stored "${req.file.originalname}" (${(req.file.size / 1024).toFixed(1)} KB) in private archive.`,
        accountEmail: req.dbUser?.email,
      });

      res.status(201).json({ file: record });
    } catch (error: any) {
      console.error('Private file storage failed:', error);
      res.status(500).json({ error: 'Failed to store uploaded file securely.' });
    }
  }
);

router.get('/files/:id/download', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [file] = await db
      .select()
      .from(storedFiles)
      .where(eq(storedFiles.id, Number(req.params.id)))
      .limit(1);

    if (!file) {
      return res.status(404).json({ error: 'Archived file not found.' });
    }
    if (file.storageBackend === 'google_drive' && file.driveFileId) {
      return res.json({ redirectUrl: file.storagePath });
    }

    const fullPath = join(PRIVATE_STORAGE_DIR, file.storagePath);
    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: 'Stored file payload is unavailable.' });
    }

    const buffer = await readFile(fullPath);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.originalName.replace(/"/g, '')}"`
    );
    res.send(buffer);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Failed to download archived file.' });
  }
});

router.delete(
  '/files/:id',
  requireAuth,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const [file] = await db
        .select()
        .from(storedFiles)
        .where(eq(storedFiles.id, Number(req.params.id)))
        .limit(1);

      if (!file) {
        return res.status(404).json({ error: 'File not found.' });
      }

      if (file.storageBackend !== 'google_drive') {
        const fullPath = join(PRIVATE_STORAGE_DIR, file.storagePath);
        if (existsSync(fullPath)) {
          await unlink(fullPath);
        }
      }

      await db.delete(storedFiles).where(eq(storedFiles.id, file.id));
      res.json({ deleted: true, id: file.id });
    } catch (error) {
      console.error('File delete error:', error);
      res.status(500).json({ error: 'Failed to delete archived file.' });
    }
  }
);

export default router;
