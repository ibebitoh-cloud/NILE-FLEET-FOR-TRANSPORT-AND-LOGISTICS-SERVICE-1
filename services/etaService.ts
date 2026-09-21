import { Invoice } from '../types';

export interface ETASubmissionResult {
  uuid?: string;
  longId?: string;
  internalId: string;
  dateTimeIssued: string;
  status: 'Valid' | 'Invalid' | 'Submitted';
}

/**
 * ETA integration boundary.
 * This module must never fabricate an ETA UUID/serial or claim an invoice is Valid.
 * A real ETA submission must be implemented behind the backend/secure integration layer.
 */
class ETAService {
  async signAndSubmitToETA(_invoice: Invoice): Promise<ETASubmissionResult> {
    throw new Error('ETA integration is not configured. No invoice was submitted to ETA.');
  }

  getNextETASerial() {
    return '—';
  }
}

export const etaService = new ETAService();
