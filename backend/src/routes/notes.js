import { Router } from 'express';
import multer from 'multer';
import { analyzeNotes } from '../agents/notesAgent.js';
import { httpError } from '../middleware/errors.js';
import { NotesTextInput } from '../schemas/index.js';

export const router = Router();

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(httpError(400, 'Only PDF files are supported — try uploading a PDF, or paste the text instead.'));
    cb(null, true);
  },
});

async function extractPdfText(buffer) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text || '').trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// POST /api/notes/analyze — multipart with a `file` (PDF), or JSON { text }. Pure analysis: nothing is
// saved to the session here. The result is meant to be reviewed, then handed to POST /plan (via the
// Study Strategy form, pre-filled) to actually build a plan from it — the same flow onboarding uses.
router.post('/notes/analyze', upload.single('file'), async (req, res) => {
  let text;

  if (req.file) {
    let extracted;
    try {
      extracted = await extractPdfText(req.file.buffer);
    } catch {
      throw httpError(400, 'Could not read that PDF. Try a different file, or paste the text instead.');
    }
    if (!extracted || extracted.length < 20) {
      throw httpError(400, 'No readable text was found in that PDF (is it a scan or image?). Try pasting the text instead.');
    }
    text = extracted;
  } else {
    text = NotesTextInput.parse(req.body).text;
  }

  const analysis = await analyzeNotes(text);
  res.json(analysis);
});
