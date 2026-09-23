/**
 * containerOcr.ts
 * Fully local, offline OCR for shipping container codes.
 * No network call, no AI model — Tesseract.js runs entirely in the browser.
 *
 * A container BIC code is 11 characters: 4 letters (3-letter owner code +
 * 1 equipment category letter: U/J/Z) + 6 digits (serial) + 1 check digit.
 * The check digit is fully deterministic (ISO 6346 standard), so a code that
 * passes validation is very unlikely to be an OCR misread.
 */

// Dynamically imported so Tesseract's runtime only downloads when a container
// is actually scanned, not as part of the main app bundle.
async function getTesseract() {
  return import('tesseract.js');
}

// ISO 6346 letter -> numeric value table. Multiples of 11 (11, 22, 33) are
// deliberately skipped in the standard's numbering.
const LETTER_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
  K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
  U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

/**
 * Validates an 11-character container code's check digit per ISO 6346.
 * Returns true only if the 11th character matches the computed check digit.
 */
export function isValidContainerCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{4}\d{7}$/.test(c)) return false;

  const chars = c.slice(0, 10).split('');
  let sum = 0;
  chars.forEach((ch, idx) => {
    const value = /[A-Z]/.test(ch) ? LETTER_VALUES[ch] : parseInt(ch, 10);
    sum += value * Math.pow(2, idx);
  });

  const remainder = sum % 11;
  const expectedCheckDigit = remainder === 10 ? 0 : remainder;
  const actualCheckDigit = parseInt(c[10], 10);

  return expectedCheckDigit === actualCheckDigit;
}

let worker: any = null;
let workerLoading: Promise<any> | null = null;

async function getWorker(): Promise<any> {
  if (worker) return worker;
  if (workerLoading) return workerLoading;

  workerLoading = (async () => {
    const { createWorker } = await getTesseract();
    const w = await createWorker('eng');
    // Restrict to characters that actually appear in container codes —
    // dramatically improves accuracy over general-purpose OCR.
    await w.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    });
    worker = w;
    return w;
  })();

  return workerLoading;
}

export interface ContainerScanResult {
  code: string | null;
  valid: boolean;
  rawText: string;
  confidence: number;
}

/**
 * Runs local OCR on an image (data URL or base64) and extracts the best
 * candidate ISO 6346 container code. Tries every 11-character alphanumeric
 * run found in the OCR text and returns the first one that passes checksum
 * validation; if none validate, returns the best-looking candidate anyway
 * (marked invalid) so the operator can review/correct it manually.
 */
export async function scanContainerImage(imageDataUrlOrBase64: string): Promise<ContainerScanResult> {
  const w = await getWorker();
  const src = imageDataUrlOrBase64.startsWith('data:')
    ? imageDataUrlOrBase64
    : `data:image/jpeg;base64,${imageDataUrlOrBase64}`;

  const { data } = await w.recognize(src);
  const rawText = (data.text || '').toUpperCase();
  const confidence = data.confidence || 0;

  // Container codes are sometimes printed with a space between the 4 letters
  // and the 7 digits — normalize that out before searching.
  const compact = rawText.replace(/[^A-Z0-9]/g, ' ').replace(/([A-Z]{4})\s+(\d{7})/g, '$1$2');
  const candidates = compact.match(/[A-Z]{4}\d{7}/g) || [];

  for (const candidate of candidates) {
    if (isValidContainerCode(candidate)) {
      return { code: candidate, valid: true, rawText, confidence };
    }
  }

  // No candidate passed checksum — return the first match anyway (if any)
  // so the UI can show it for manual correction rather than nothing at all.
  return {
    code: candidates[0] || null,
    valid: false,
    rawText,
    confidence,
  };
}

/** Frees the OCR worker's resources. Call on app unmount if desired; optional. */
export async function terminateOcrWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
    workerLoading = null;
  }
}
