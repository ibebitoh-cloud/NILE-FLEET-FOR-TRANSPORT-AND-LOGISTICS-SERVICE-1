
import { Invoice } from '../types';

export interface ETASubmissionResult {
  uuid: string;
  longId: string;
  internalId: string;
  dateTimeIssued: string;
  status: 'Valid' | 'Invalid' | 'Submitted';
}

class ETAService {
  private currentETASerial: number = 100;

  private generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Simulates the canonicalization and signing process of the ETA SDK
   * using the connected USB Token/HSM.
   */
  async signAndSubmitToETA(invoice: Invoice): Promise<ETASubmissionResult> {
    // 1. Simulate "Canonicalization" of the JSON document
    // 2. Simulate "Signing" via the hardware token bridge
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Mocking a successful response from ETA Portal
        this.currentETASerial++;
        const year = new Date().getFullYear();
        
        resolve({
          uuid: this.generateUUID().toUpperCase(),
          longId: `ETA-${year}-${this.currentETASerial.toString().padStart(6, '0')}`,
          internalId: invoice.id,
          dateTimeIssued: new Date().toISOString(),
          status: 'Valid'
        });
      }, 2000);
    });
  }

  getNextETASerial() {
    return (this.currentETASerial + 1).toString().padStart(6, '0');
  }
}

export const etaService = new ETAService();
