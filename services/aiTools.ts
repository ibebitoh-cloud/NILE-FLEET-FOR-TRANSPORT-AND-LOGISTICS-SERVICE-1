/**
 * aiTools.ts
 * Deterministic, hallucination-proof data lookups against the real Nile
 * Fleet database. The local LLM never invents operational or financial
 * numbers — it only ever narrates/analyzes a data pack assembled HERE, by
 * plain JS code querying the actual database. This file is the "tool
 * layer": every number the model is allowed to talk about must come from
 * one of these functions.
 */

import { db } from './supabaseDb';

export function toolGetStockSummary() {
  const stock = db.getStock();
  const byLocation: Record<string, { inStock: number; clippedOn: number; maintenance: number; retired: number }> = {};
  stock.forEach(s => {
    if (!byLocation[s.location]) byLocation[s.location] = { inStock: 0, clippedOn: 0, maintenance: 0, retired: 0 };
    if (s.status === 'IN_STOCK') byLocation[s.location].inStock++;
    else if (s.status === 'CLIPPED_ON') byLocation[s.location].clippedOn++;
    else if (s.status === 'MAINTENANCE') byLocation[s.location].maintenance++;
    else if ((s.status as string) === 'RETIRED') byLocation[s.location].retired++;
  });
  return { totalUnits: stock.length, byLocation };
}

export function toolGetOperationsSummary() {
  const ops = db.getOperations();
  const byStatus: Record<string, number> = {};
  ops.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
  const activeCount = ops.filter(o => o.status === 'IN PROGRESS' || o.status === 'UNDER OPERATE').length;
  return { totalOperations: ops.length, byStatus, activeCount };
}

export function toolGetFinanceSummary() {
  const invoices = db.getInvoices();
  const payments = db.getPayments();
  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const unpaidCount = invoices.filter(i => i.status === 'UNPAID').length;
  const unpaidAmount = invoices.filter(i => i.status === 'UNPAID').reduce((s, i) => s + i.amount, 0);
  return {
    totalInvoiced: Math.round(totalInvoiced * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    unpaidCount,
    unpaidAmount: Math.round(unpaidAmount * 100) / 100,
    invoiceCount: invoices.length,
  };
}

export function toolGetFuelSummary() {
  const byPort = db.getGasByPort();
  const balance = db.getGasBalance();
  const oktan = db.getOktanEstimate();
  return { balanceLiters: balance, byPort, estimate: oktan };
}

export function toolGetExpenseSummary() {
  return {
    procurement: Math.round(db.getProcurements().reduce((s, p) => s + p.amount, 0) * 100) / 100,
    food: Math.round(db.getFoodExpenses().reduce((s, f) => s + f.amount, 0) * 100) / 100,
    transport: Math.round(db.getTransportExpenses().reduce((s, t) => s + t.amount, 0) * 100) / 100,
    rent: Math.round(db.getPortRents().reduce((s, r) => s + r.amount, 0) * 100) / 100,
  };
}

export function toolGetDuplicateGensetWarnings() {
  // Mirrors the (non-blocking) duplicate-assignment alert logic used in
  // Master View: two or more active (IN PROGRESS / UNDER OPERATE)
  // operations using the same genset is flagged for review, never blocked.
  const ops = db.getOperations();
  const counts: Record<string, number> = {};
  ops.forEach(op => {
    const active = op.status === 'IN PROGRESS' || op.status === 'UNDER OPERATE';
    const gen = op.gensetNumber?.trim().toUpperCase();
    if (gen && active) counts[gen] = (counts[gen] || 0) + 1;
  });
  return Object.entries(counts).filter(([, c]) => c > 1).map(([genset, count]) => ({ genset, count }));
}

export type ToolName = 'stock' | 'operations' | 'finance' | 'fuel' | 'expenses' | 'duplicates';

const ALL_TOOLS: Record<ToolName, () => any> = {
  stock: toolGetStockSummary,
  operations: toolGetOperationsSummary,
  finance: toolGetFinanceSummary,
  fuel: toolGetFuelSummary,
  expenses: toolGetExpenseSummary,
  duplicates: toolGetDuplicateGensetWarnings,
};

/**
 * Very small keyword router: decides which deterministic tools are relevant
 * to a free-text question, so the model gets a focused, accurate data pack
 * rather than either "everything" (slow, prone to model overreach) or
 * "the model guesses what data it needs" (which a 0.5B model cannot do
 * reliably — this app never lets the model choose what data to trust).
 */
export function selectRelevantTools(query: string): ToolName[] {
  const q = query.toLowerCase();
  const selected = new Set<ToolName>();

  if (/stock|genset|unit|maintenance|fleet|retired/.test(q)) selected.add('stock');
  if (/operation|clip|booking|trip|active|status/.test(q)) selected.add('operations');
  if (/invoice|payment|revenue|finance|money|unpaid|收|egp|outstanding/.test(q)) selected.add('finance');
  if (/fuel|gas|liter|oktan/.test(q)) selected.add('fuel');
  if (/expense|cost|procurement|rent|food|transport|payroll/.test(q)) selected.add('expenses');
  if (/duplicate|conflict|double.?book/.test(q)) selected.add('duplicates');

  // If nothing matched, give a broad-but-safe default pack rather than
  // nothing at all — an empty data pack would force the model to either
  // refuse or (worse) invent something.
  if (selected.size === 0) {
    selected.add('operations');
    selected.add('finance');
  }
  return Array.from(selected);
}

/** Runs the selected tools and returns their real output as a data pack. */
export function buildDataPack(tools: ToolName[]): Record<string, any> {
  const pack: Record<string, any> = {};
  tools.forEach(name => { pack[name] = ALL_TOOLS[name](); });
  return pack;
}
