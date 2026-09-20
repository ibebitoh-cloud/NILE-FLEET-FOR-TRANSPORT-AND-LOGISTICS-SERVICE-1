/**
 * supabaseDb.ts
 * Drop-in replacement for mockDb.ts — identical public method signatures,
 * all backed by real Supabase tables instead of in-memory arrays.
 *
 * Usage: replace `import { db } from './services/mockDb'`
 *        with   `import { db } from './services/supabaseDb'`
 */

import { supabase } from './supabaseClient';
import {
  Genset, Reservation, Operation, Invoice, User, Location,
  UserRole, GensetStatus, ReservationStatus, AuditEntry,
  CustomerPrice, Procurement, GasTransaction, Employee,
  PayrollTransaction, Payment, FoodExpense, TransportExpense,
  PortRent, SystemNotification, SupportContact, FAQItem, PortInfo,
  GensetMaintenanceLog
} from '../types';

export type { User };

// ─── helpers ─────────────────────────────────────────────────────────────────

function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      snakeToCamel(v)
    ])
  );
}

function camelToSnake(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/([A-Z])/g, '_$1').toLowerCase(),
      camelToSnake(v)
    ])
  );
}

async function query<T>(table: string, options?: { filter?: Record<string, any>; order?: string; ascending?: boolean }): Promise<T[]> {
  let q = supabase.from(table).select('*');
  if (options?.filter) {
    Object.entries(options.filter).forEach(([k, v]) => { q = q.eq(k, v) as any; });
  }
  if (options?.order) {
    q = q.order(options.order, { ascending: options.ascending ?? false }) as any;
  }
  const { data, error } = await q;
  if (error) { console.error(`[supabaseDb] query ${table}:`, error.message); return []; }
  return snakeToCamel(data || []) as T[];
}

async function insert<T>(table: string, row: Partial<T>): Promise<T | null> {
  // The UI still generates placeholder ids like "G-ABC-123" or "op-man-172..." —
  // leftover from the old in-memory mock database. Every real table's id column
  // is a uuid with a default generator, so a non-UUID id here makes Postgres
  // reject the whole insert. Strip it and let the database assign the real id.
  const { id, ...rest } = row as any;
  const { data, error } = await supabase.from(table).insert(camelToSnake(rest)).select().single();
  if (error) { console.error(`[supabaseDb] insert ${table}:`, error.message); return null; }
  return snakeToCamel(data) as T;
}

async function upsert<T>(table: string, row: Partial<T>): Promise<T | null> {
  const { data, error } = await supabase.from(table).upsert(camelToSnake(row)).select().single();
  if (error) { console.error(`[supabaseDb] upsert ${table}:`, error.message); return null; }
  return snakeToCamel(data) as T;
}

async function update<T>(table: string, id: string, updates: Partial<T>): Promise<void> {
  const { error } = await supabase.from(table).update(camelToSnake(updates)).eq('id', id);
  if (error) console.error(`[supabaseDb] update ${table}:`, error.message);
}

async function remove(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) console.error(`[supabaseDb] delete ${table}:`, error.message);
}

function dispatchChange() {
  window.dispatchEvent(new CustomEvent('db-undo-success'));
}

async function auditLog(action: string, details: string) {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{"name":"System"}');
  await insert('audit_log', {
    timestamp: new Date().toISOString(),
    user: currentUser.name,
    action: action.split(':')[0],
    details,
  });
}

let internalSerialCounter = 2000;
function generateInternalSerial(): string {
  internalSerialCounter++;
  return `NF-${internalSerialCounter}`;
}

// ─── cache (so synchronous getters still work like mockDb) ────────────────────

let _stock: Genset[] = [];
let _reservations: Reservation[] = [];
let _operations: Operation[] = [];
let _invoices: Invoice[] = [];
let _payments: Payment[] = [];
let _users: User[] = [];
let _auditLogs: AuditEntry[] = [];
let _customerPrices: CustomerPrice[] = [];
let _procurements: Procurement[] = [];
let _gasTransactions: GasTransaction[] = [];
let _employees: Employee[] = [];
let _payrollTransactions: PayrollTransaction[] = [];
let _foodExpenses: FoodExpense[] = [];
let _transportExpenses: TransportExpense[] = [];
let _portRents: PortRent[] = [];
let _notifications: SystemNotification[] = [];
let _supportContacts: SupportContact[] = [];
let _faqs: FAQItem[] = [];
let _portsInfo: PortInfo[] = [];
let _maintenanceLogs: GensetMaintenanceLog[] = [];
let _loaded = false;

class SupabaseDB {

  // ─── bootstrap ─────────────────────────────────────────────────────────────

  async loadAll(): Promise<void> {
    if (_loaded) return;
    const [
      stock, reservations, operations, invoices, payments, users,
      auditLogs, customerPrices, procurements, gasTransactions,
      employees, payrollTransactions, foodExpenses, transportExpenses,
      portRents, notifications, supportContacts, faqs, portsInfo, maintenanceLogs
    ] = await Promise.all([
      query<Genset>('gensets', { order: 'created_at' }),
      query<Reservation>('reservations', { order: 'created_at' }),
      query<Operation>('operations', { order: 'created_at' }),
      query<Invoice>('invoices', { order: 'created_at' }),
      query<Payment>('payments', { order: 'created_at' }),
      query<User>('profiles', { order: 'created_at' }),
      query<AuditEntry>('audit_log', { order: 'timestamp' }),
      query<CustomerPrice>('customer_prices'),
      query<Procurement>('procurement', { order: 'created_at' }),
      query<GasTransaction>('gas_transactions', { order: 'date' }),
      query<Employee>('employees', { order: 'created_at' }),
      query<PayrollTransaction>('payroll_transactions', { order: 'date' }),
      query<FoodExpense>('food_expenses', { order: 'created_at' }),
      query<TransportExpense>('transport_expenses', { order: 'created_at' }),
      query<PortRent>('port_rents', { order: 'created_at' }),
      query<SystemNotification>('system_notifications', { order: 'timestamp' }),
      query<SupportContact>('support_contacts'),
      query<FAQItem>('faqs'),
      query<PortInfo>('ports_info'),
      query<GensetMaintenanceLog>('genset_maintenance_logs', { order: 'service_date' }),
    ]);

    _stock = stock;
    _reservations = reservations;
    _operations = operations;
    _invoices = invoices;
    _payments = payments;
    _users = users;
    _auditLogs = auditLogs;
    _customerPrices = customerPrices;
    _procurements = procurements;
    _gasTransactions = gasTransactions;
    _employees = employees;
    _payrollTransactions = payrollTransactions;
    _foodExpenses = foodExpenses;
    _transportExpenses = transportExpenses;
    _portRents = portRents;
    _notifications = notifications;
    _supportContacts = supportContacts;
    _faqs = faqs;
    _portsInfo = portsInfo;
    _maintenanceLogs = maintenanceLogs;
    _loaded = true;
    dispatchChange();
  }

  // ─── synchronous getters (return cached data) ───────────────────────────────

  getStock(): Genset[] { return _stock; }
  getReservations(): Reservation[] { return _reservations; }
  getOperations(): Operation[] { return _operations; }
  getInvoices(): Invoice[] { return _invoices; }
  getPayments(): Payment[] { return _payments; }
  getUsers(): User[] { return _users; }
  getAuditLogs(): AuditEntry[] { return _auditLogs; }
  getCustomerPrices(): CustomerPrice[] { return _customerPrices; }
  getProcurements(): Procurement[] { return _procurements; }
  getGasTransactions(): GasTransaction[] { return _gasTransactions; }
  getEmployees(): Employee[] { return _employees; }
  getPayrollTransactions(): PayrollTransaction[] { return _payrollTransactions; }
  getFoodExpenses(): FoodExpense[] { return _foodExpenses; }
  getTransportExpenses(): TransportExpense[] { return _transportExpenses; }
  getPortRents(): PortRent[] { return _portRents; }
  getSupportContacts(): SupportContact[] { return _supportContacts; }
  getFAQs(): FAQItem[] { return _faqs; }
  getPortsInfo(): PortInfo[] { return _portsInfo; }
  getMaintenanceLogs(): GensetMaintenanceLog[] {
    return [..._maintenanceLogs].sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
  }
  getMaintenanceLogsForGenset(unitNumber: string): GensetMaintenanceLog[] {
    return _maintenanceLogs
      .filter(l => l.gensetNumber?.toUpperCase() === unitNumber.toUpperCase())
      .sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
  }

  getGasBalance(): number {
    return _gasTransactions.reduce((sum, t) => t.type === 'TOPUP' ? sum + t.amount : sum - t.amount, 0);
  }

  getNotifications(user: User): SystemNotification[] {
    return _notifications.filter(n => {
      if (!n.targetUserId && !n.targetOrgName) return true;
      if (n.targetUserId === user.id) return true;
      const userOrg = user.companyName || user.name;
      if (n.targetOrgName === userOrg) return true;
      return false;
    });
  }

  getActiveNotifications(user: User): SystemNotification[] {
    return this.getNotifications(user).filter(n => n.active);
  }

  getGasByPort(): Record<string, number> {
    const map: Record<string, number> = {};
    _operations.forEach(op => {
      const fuel = parseFloat(op.gaz || '0');
      map[op.clipOnPort] = (map[op.clipOnPort] || 0) + fuel;
    });
    return map;
  }

  getGasByGenset(): { unit: string; gas: number }[] {
    const map: Record<string, number> = {};
    _operations.forEach(op => {
      if (!op.gensetNumber) return;
      const fuel = parseFloat(op.gaz || '0');
      map[op.gensetNumber] = (map[op.gensetNumber] || 0) + fuel;
    });
    return Object.entries(map).map(([unit, gas]) => ({ unit, gas }));
  }

  getOktanEstimate() {
    const balance = this.getGasBalance();
    const dailyAvg = 150;
    return {
      balance,
      estimatedLiters: balance / 18,
      dailyAvg,
      daysRemaining: Math.floor((balance / 18) / dailyAvg)
    };
  }

  getEmployeeBalance(empId: string, month: string) {
    const txs = _payrollTransactions.filter(t => t.employeeId === empId && t.month === month);
    const earnings = txs.filter(t => t.type === 'SALARY_BASE' || t.type === 'BONUS').reduce((s, t) => s + t.amount, 0);
    const deductions = txs.filter(t => t.type === 'ADVANCE').reduce((s, t) => s + t.amount, 0);
    return { earnings, deductions, balance: earnings - deductions };
  }

  // ─── operations ────────────────────────────────────────────────────────────

  async addOperation(op: Operation): Promise<void> {
    if (!op.internalSerial) op.internalSerial = generateInternalSerial();
    const row = { ...op, id: op.id || undefined };
    const saved = await insert<Operation>('operations', row);
    if (saved) {
      _operations = [saved, ..._operations];
      await this._syncGensetStatus(op);
      if (op.status === 'DONE' && !op.invoiced) {
        await this.generateInvoiceFromBooking(op.bookingNumber, op.customerName);
      }
      await auditLog('OPS', `Manual Entry ${op.bookingNumber}`);
      dispatchChange();
    }
  }

  async updateOperation(updatedOp: Operation): Promise<void> {
    await update('operations', updatedOp.id, updatedOp);
    _operations = _operations.map(o => o.id === updatedOp.id ? updatedOp : o);
    await this._syncGensetStatus(updatedOp);
    if (updatedOp.status === 'DONE' && !updatedOp.invoiced) {
      await this.generateInvoiceFromBooking(updatedOp.bookingNumber, updatedOp.customerName);
    }
    await auditLog('OPS', `Updated operation ${updatedOp.bookingNumber}`);
    dispatchChange();
  }

  async confirmOperation(id: string): Promise<void> {
    await update('operations', id, { reviewedByManager: true });
    _operations = _operations.map(o => o.id === id ? { ...o, reviewedByManager: true } : o);
    await auditLog('BOSS', `Verified record ${id}`);
    dispatchChange();
  }

  async confirmOperationsBulk(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => update('operations', id, { reviewedByManager: true })));
    _operations = _operations.map(o => ids.includes(o.id) ? { ...o, reviewedByManager: true } : o);
    await auditLog('BOSS', `Force Verified ${ids.length} records`);
    dispatchChange();
  }

  async addOperationsBulk(ops: Operation[]): Promise<void> {
    const prepared = ops.map(op => ({ ...op, internalSerial: op.internalSerial || generateInternalSerial() }));
    const rowsToInsert = prepared.map(op => { const { id, ...rest } = op as any; return camelToSnake(rest); });
    const { data, error } = await supabase.from('operations').insert(rowsToInsert).select();
    if (error) { console.error('[supabaseDb] bulk insert operations:', error.message); return; }
    const saved = snakeToCamel(data || []) as Operation[];
    _operations = [...saved, ..._operations];
    await Promise.all(prepared.map(op => this._syncGensetStatus(op)));
    const doneBookings = Array.from(new Set(prepared.filter(o => o.status === 'DONE').map(o => o.bookingNumber)));
    for (const bk of doneBookings) {
      const op = prepared.find(o => o.bookingNumber === bk);
      if (op) await this.generateInvoiceFromBooking(bk, op.customerName);
    }
    await auditLog('OPS', `Bulk deployment ${ops.length} units`);
    dispatchChange();
  }

  async deleteOperation(id: string): Promise<void> {
    await remove('operations', id);
    _operations = _operations.filter(o => o.id !== id);
    await auditLog('OPS', `Deleted operation ${id}`);
    dispatchChange();
  }

  async deleteOperationsBulk(ids: string[]): Promise<void> {
    await Promise.all(ids.map(id => remove('operations', id)));
    _operations = _operations.filter(o => !ids.includes(o.id));
    await auditLog('OPS', `Force deleted ${ids.length} manifest entries`);
    dispatchChange();
  }

  private async _syncGensetStatus(op: Operation): Promise<void> {
    if (!op.gensetNumber) return;
    const genset = _stock.find(s => s.unitNumber === op.gensetNumber);
    if (!genset) return;
    let updates: Partial<Genset> = {};
    if (op.status === 'IN PROGRESS') {
      updates.status = GensetStatus.CLIPPED_ON;
    } else if (op.status === 'DONE' || op.status === 'CANCEL') {
      updates.status = GensetStatus.IN_STOCK;
      if (op.status === 'DONE' && op.clipOffPort) updates.location = op.clipOffPort as Location;
    }
    if (Object.keys(updates).length > 0) {
      await update('gensets', genset.id, updates);
      _stock = _stock.map(s => s.id === genset.id ? { ...s, ...updates } : s);
    }
  }

  // ─── invoices ──────────────────────────────────────────────────────────────

  async generateInvoiceFromBooking(bookingNumber: string, customerName: string): Promise<Invoice | null> {
    const units = _operations.filter(o =>
      o.bookingNumber === bookingNumber &&
      o.customerName === customerName &&
      o.status === 'DONE' &&
      !o.invoiced
    );
    if (units.length === 0) return null;

    const amount = units.reduce((sum, u) => sum + (parseFloat(String(u.rate).replace(/,/g, '')) || 0) + (parseFloat(String(u.vat).replace(/,/g, '')) || 0), 0);
    const opIds = units.map(u => u.id);

    const matchedCustomer = _users.find(u =>
      (u.companyName || u.name)?.toUpperCase() === customerName.toUpperCase()
    );

    const invoice: Partial<Invoice> = {
      customerId: matchedCustomer?.id,
      customerName,
      bookingNumber,
      amount,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'UNPAID',
      containerNumbers: units.map(u => u.containerNumber),
      portIn: units[0].clipOnPort,
      portOut: units[0].clipOffPort,
      operationIds: opIds,
      etaStatus: 'DRAFT',
    };

    const saved = await insert<Invoice>('invoices', invoice);
    if (!saved) return null;

    _invoices = [..._invoices, saved];
    await Promise.all(opIds.map(id => update('operations', id, { invoiced: true })));
    _operations = _operations.map(o => opIds.includes(o.id) ? { ...o, invoiced: true } : o);
    await auditLog('FIN', `Created Invoice ${saved.id} (Automatic)`);
    dispatchChange();
    return saved;
  }

  async updateInvoice(id: string, updated: Partial<Invoice>): Promise<void> {
    await update('invoices', id, updated);
    _invoices = _invoices.map(i => i.id === id ? { ...i, ...updated } : i);
    await auditLog('FIN', `Updated Invoice ${id}`);
    dispatchChange();
  }

  async updateInvoiceEtaStatus(id: string, etaStatus: 'DRAFT' | 'SUBMITTED' | 'VALID' | 'INVALID'): Promise<void> {
    await update('invoices', id, { etaStatus });
    _invoices = _invoices.map(i => i.id === id ? { ...i, etaStatus } : i);
    await auditLog('ETA', `Status update for ${id} -> ${etaStatus}`);
    dispatchChange();
  }

  // ─── payments ──────────────────────────────────────────────────────────────

  async addPayment(payment: Payment, allocatedInvoiceIds: string[] = []): Promise<void> {
    await insert('payments', payment);
    _payments = [..._payments, payment];

    let remainingMoney = payment.amount;
    for (const invId of allocatedInvoiceIds) {
      const inv = _invoices.find(i => i.id === invId);
      if (inv && inv.status === 'UNPAID') {
        if (remainingMoney >= inv.amount) {
          await update('invoices', invId, { status: 'PAID' });
          _invoices = _invoices.map(i => i.id === invId ? { ...i, status: 'PAID' } : i);
          remainingMoney -= inv.amount;
        } else {
          await update('invoices', invId, { amount: inv.amount - remainingMoney });
          _invoices = _invoices.map(i => i.id === invId ? { ...i, amount: i.amount - remainingMoney } : i);
          remainingMoney = 0;
        }
      }
    }

    if (remainingMoney > 0) {
      const user = _users.find(u => u.id === payment.customerId);
      if (user) {
        const newBal = Math.max(0, (user.pastOutstandingAmount || 0) - remainingMoney);
        await update('profiles', user.id, { pastOutstandingAmount: newBal });
        _users = _users.map(u => u.id === user.id ? { ...u, pastOutstandingAmount: newBal } : u);
      }
    }

    await auditLog('FIN', `Recorded Payment ${payment.amount} from ${payment.customerName}`);
    dispatchChange();
  }

  // ─── gensets ───────────────────────────────────────────────────────────────

  async addGenset(genset: Genset): Promise<void> {
    const saved = await insert<Genset>('gensets', genset);
    if (saved) {
      _stock = [saved, ..._stock];
      await auditLog('STOCK', `Registered new unit ${genset.unitNumber}`);
      dispatchChange();
    }
  }

  async updateGenset(updatedGenset: Genset): Promise<void> {
    await update('gensets', updatedGenset.id, updatedGenset);
    _stock = _stock.map(s => s.id === updatedGenset.id ? updatedGenset : s);
    await auditLog('STOCK', `Updated unit ${updatedGenset.unitNumber}`);
    dispatchChange();
  }

  async deleteGenset(id: string): Promise<void> {
    await remove('gensets', id);
    _stock = _stock.filter(s => s.id !== id);
    await auditLog('STOCK', `Deleted unit ${id}`);
    dispatchChange();
  }

  // ─── users / customers ─────────────────────────────────────────────────────

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    await update('profiles', id, updates);
    _users = _users.map(u => u.id === id ? { ...u, ...updates } : u);
    await auditLog('USER', `Updated user access profile for ${id}`);
    dispatchChange();
  }

  async updateUserFinance(userId: string, updates: { pastOutstandingAmount?: number }): Promise<void> {
    await update('profiles', userId, updates);
    _users = _users.map(u => u.id === userId ? { ...u, ...updates } : u);
    await auditLog('FIN', `Updated ledger balance for ${userId}`);
    dispatchChange();
  }

  async deleteUser(id: string): Promise<void> {
    // The Supabase admin API (full account deletion) requires a service-role key,
    // which must never be exposed in browser code. So we revoke access instead —
    // this is a real, persisted change (blocks login), unlike a client-side admin call.
    await update('profiles', id, { revoked: true });
    _users = _users.filter(u => u.id !== id);
    await auditLog('USER', `Deleted user profile ${id}`);
    dispatchChange();
  }

  async addUser(user: User): Promise<void> {
    // Creating a user with a password must go through Supabase Auth
    // For now we insert the profile directly (auth user created separately)
    const saved = await insert<User>('profiles', { ...user, pastOutstandingAmount: user.pastOutstandingAmount || 0 });
    if (saved) {
      _users = [..._users, saved];
      await auditLog('USER', `Registered ${user.role} - ${user.name}`);
      dispatchChange();
    }
  }

  async addCustomer(customer: any): Promise<void> {
    const saved = await insert('profiles', { ...customer, role: UserRole.CUSTOMER, pastOutstandingAmount: customer.pastOutstandingAmount || 0 });
    if (saved) {
      _users = [..._users, snakeToCamel(saved) as User];
      await auditLog('USER', `Registered customer ${customer.companyName}`);
      dispatchChange();
    }
  }

  async syncCustomersFromOperations(): Promise<void> {
    const uniqueNames = Array.from(new Set(_operations.map(o => o.customerName)));
    const existing = new Set(_users.filter(u => u.role === UserRole.CUSTOMER).map(u => (u.companyName || u.name).toUpperCase()));
    let added = 0;
    for (const name of uniqueNames) {
      if (!existing.has(name.toUpperCase())) {
        await this.addCustomer({ name: name.toUpperCase(), companyName: name.toUpperCase(), email: `${name.toLowerCase().replace(/\s/g, '')}@portal.nilefleet.com`, role: UserRole.CUSTOMER });
        added++;
      }
    }
    if (added > 0) await auditLog('SYSTEM', `Sync ${added} customers from ops data`);
  }

  // ─── reservations ──────────────────────────────────────────────────────────

  async addReservation(res: Reservation): Promise<void> {
    const saved = await insert<Reservation>('reservations', res);
    if (saved) {
      _reservations = [saved, ..._reservations];
      await auditLog('RES', `Booking request ${res.bookingNumber}`);
      dispatchChange();
    }
  }

  async updateReservationStatus(id: string, status: ReservationStatus): Promise<void> {
    await update('reservations', id, { status });
    _reservations = _reservations.map(r => r.id === id ? { ...r, status } : r);
    dispatchChange();
  }

  async createOperationFromReservation(res: Reservation): Promise<void> {
    const newOperations: Operation[] = Array.from({ length: res.gensetsNeeded }).map((_, idx) => {
      const foundPrice = _customerPrices.find(p => p.customerName === res.customerName && p.portIn === res.portIn && p.portOut === res.portOut);
      return {
        id: `op-${Date.now()}-${idx}`,
        internalSerial: '',
        reservationId: res.id,
        customerName: res.customerName,
        dateReceived: res.dateReceived || new Date().toISOString().split('T')[0],
        operationDate: res.reservationDate,
        clipOnDate: res.reservationDate,
        clipOffDate: '',
        clipOnPort: res.portIn,
        clipOffPort: res.portOut,
        trucker: res.trucker || '',
        bookingNumber: res.bookingNumber,
        beneficiaryName: res.beneficiaryName || '',
        containerNumber: '',
        gensetNumber: '',
        gaz: '40',
        shipperAddress: res.shipperAddress || '',
        status: 'UNDER OPERATE',
        rate: foundPrice ? foundPrice.price.toFixed(2) : '0.00',
        vat: foundPrice?.includeVat ? (foundPrice.price * 0.14).toFixed(2) : '0.00',
        notes: `From Res ${res.id}`,
        invoiced: false,
        reviewedByManager: false,
      } as Operation;
    });
    await this.addOperationsBulk(newOperations);
    await this.updateReservationStatus(res.id, ReservationStatus.APPROVED);
  }

  // ─── customer prices ───────────────────────────────────────────────────────

  async setCustomerPrice(priceData: CustomerPrice): Promise<void> {
    const existing = _customerPrices.find(p => p.customerName === priceData.customerName && p.portIn === priceData.portIn && p.portOut === priceData.portOut);
    if (existing) {
      await update('customer_prices', existing.id, priceData);
      _customerPrices = _customerPrices.map(p => p.id === existing.id ? priceData : p);
    } else {
      const saved = await insert<CustomerPrice>('customer_prices', priceData);
      if (saved) _customerPrices = [..._customerPrices, saved];
    }
    await auditLog('RATE', `Rate update for ${priceData.customerName}`);
    dispatchChange();
  }

  // ─── maintenance logs ──────────────────────────────────────────────────────

  async addMaintenanceLog(log: GensetMaintenanceLog): Promise<void> {
    const saved = await insert<GensetMaintenanceLog>('genset_maintenance_logs', log);
    if (saved) {
      _maintenanceLogs = [saved, ..._maintenanceLogs];
      const unit = _stock.find(s => s.unitNumber.toUpperCase() === log.gensetNumber.toUpperCase());
      if (unit) {
        const updates: Partial<Genset> = { maintenanceCount: (unit.maintenanceCount || 0) + 1 };
        if (!unit.lastMaintenanceDate || new Date(log.serviceDate) >= new Date(unit.lastMaintenanceDate)) updates.lastMaintenanceDate = log.serviceDate;
        if (log.nextServiceDue) updates.nextMaintenanceDue = log.nextServiceDue;
        if (log.runningHours && (!unit.runningHours || log.runningHours > unit.runningHours)) updates.runningHours = log.runningHours;
        if (log.status === 'IN_PROGRESS') updates.status = GensetStatus.MAINTENANCE;
        else if (log.status === 'COMPLETED' && unit.status === GensetStatus.MAINTENANCE) updates.status = GensetStatus.IN_STOCK;
        await update('gensets', unit.id, updates);
        _stock = _stock.map(s => s.id === unit.id ? { ...s, ...updates } : s);
      }
      await auditLog('MAINTENANCE', `Logged ${log.serviceType} for ${log.gensetNumber}`);
      dispatchChange();
    }
  }

  async updateMaintenanceLog(log: GensetMaintenanceLog): Promise<void> {
    await update('genset_maintenance_logs', log.id, log);
    _maintenanceLogs = _maintenanceLogs.map(l => l.id === log.id ? log : l);
    await auditLog('MAINTENANCE', `Updated record for ${log.gensetNumber}`);
    dispatchChange();
  }

  async deleteMaintenanceLog(id: string): Promise<void> {
    await remove('genset_maintenance_logs', id);
    _maintenanceLogs = _maintenanceLogs.filter(l => l.id !== id);
    await auditLog('MAINTENANCE', `Deleted record ${id}`);
    dispatchChange();
  }

  // ─── notifications ─────────────────────────────────────────────────────────

  async addNotification(n: Omit<SystemNotification, 'id' | 'timestamp' | 'active'>): Promise<void> {
    const full = { ...n, timestamp: new Date().toISOString(), active: true };
    const saved = await insert<SystemNotification>('system_notifications', full);
    if (saved) {
      _notifications = [saved, ..._notifications];
      dispatchChange();
    }
  }

  async dismissNotification(id: string): Promise<void> {
    await update('system_notifications', id, { active: false });
    _notifications = _notifications.map(n => n.id === id ? { ...n, active: false } : n);
    dispatchChange();
  }

  async clearAllNotifications(): Promise<void> {
    await supabase.from('system_notifications').update({ active: false }).eq('active', true);
    _notifications = _notifications.map(n => ({ ...n, active: false }));
    dispatchChange();
  }

  // ─── support / FAQ / ports ─────────────────────────────────────────────────

  async updateSupportContact(contact: SupportContact): Promise<void> {
    await update('support_contacts', contact.id, contact);
    _supportContacts = _supportContacts.map(c => c.id === contact.id ? contact : c);
    dispatchChange();
  }
  async addSupportContact(contact: SupportContact): Promise<void> {
    const saved = await insert<SupportContact>('support_contacts', contact);
    if (saved) { _supportContacts = [..._supportContacts, saved]; dispatchChange(); }
  }
  async deleteSupportContact(id: string): Promise<void> {
    await remove('support_contacts', id);
    _supportContacts = _supportContacts.filter(c => c.id !== id);
    dispatchChange();
  }

  async updateFAQ(item: FAQItem): Promise<void> {
    await update('faqs', item.id, item);
    _faqs = _faqs.map(f => f.id === item.id ? item : f);
    dispatchChange();
  }
  async addFAQ(item: FAQItem): Promise<void> {
    const saved = await insert<FAQItem>('faqs', item);
    if (saved) { _faqs = [..._faqs, saved]; dispatchChange(); }
  }
  async deleteFAQ(id: string): Promise<void> {
    await remove('faqs', id);
    _faqs = _faqs.filter(f => f.id !== id);
    dispatchChange();
  }

  async updatePortInfo(info: PortInfo): Promise<void> {
    await update('ports_info', info.id, info);
    _portsInfo = _portsInfo.map(p => p.id === info.id ? info : p);
    dispatchChange();
  }
  async addPortInfo(info: PortInfo): Promise<void> {
    const saved = await insert<PortInfo>('ports_info', info);
    if (saved) { _portsInfo = [..._portsInfo, saved]; dispatchChange(); }
  }
  async deletePortInfo(id: string): Promise<void> {
    await remove('ports_info', id);
    _portsInfo = _portsInfo.filter(p => p.id !== id);
    dispatchChange();
  }

  // ─── procurement ───────────────────────────────────────────────────────────

  async addProcurement(p: Procurement): Promise<void> {
    const saved = await insert<Procurement>('procurement', p);
    if (saved) { _procurements = [..._procurements, saved]; await auditLog('EXP', `General Procurement ${p.itemDescription}`); dispatchChange(); }
  }
  async updateProcurement(p: Procurement): Promise<void> {
    await update('procurement', p.id, p);
    _procurements = _procurements.map(item => item.id === p.id ? p : item);
    dispatchChange();
  }
  async deleteProcurement(id: string): Promise<void> {
    await remove('procurement', id);
    _procurements = _procurements.filter(p => p.id !== id);
    dispatchChange();
  }
  async updateProcurementStatus(id: string, status: 'PENDING' | 'COMPLETED'): Promise<void> {
    await update('procurement', id, { status });
    _procurements = _procurements.map(p => p.id === id ? { ...p, status } : p);
    dispatchChange();
  }

  // ─── gas ───────────────────────────────────────────────────────────────────

  async addGasTransaction(t: GasTransaction): Promise<void> {
    const saved = await insert<GasTransaction>('gas_transactions', t);
    if (saved) { _gasTransactions = [..._gasTransactions, saved]; await auditLog('EXP', `Gas Topup ${t.amount}`); dispatchChange(); }
  }
  async updateGasTransaction(t: GasTransaction): Promise<void> {
    await update('gas_transactions', t.id, t);
    _gasTransactions = _gasTransactions.map(item => item.id === t.id ? t : item);
    dispatchChange();
  }
  async deleteGasTransaction(id: string): Promise<void> {
    await remove('gas_transactions', id);
    _gasTransactions = _gasTransactions.filter(t => t.id !== id);
    dispatchChange();
  }

  // ─── employees / payroll ───────────────────────────────────────────────────

  async addEmployee(e: Employee): Promise<void> {
    const saved = await insert<Employee>('employees', e);
    if (saved) { _employees = [..._employees, saved]; dispatchChange(); }
  }
  async updateEmployee(e: Employee): Promise<void> {
    await update('employees', e.id, e);
    _employees = _employees.map(item => item.id === e.id ? e : item);
    dispatchChange();
  }
  async deleteEmployee(id: string): Promise<void> {
    await remove('employees', id);
    _employees = _employees.filter(e => e.id !== id);
    dispatchChange();
  }
  async addPayrollTransaction(t: PayrollTransaction): Promise<void> {
    const saved = await insert<PayrollTransaction>('payroll_transactions', t);
    if (saved) { _payrollTransactions = [..._payrollTransactions, saved]; dispatchChange(); }
  }
  async updatePayrollTransaction(t: PayrollTransaction): Promise<void> {
    await update('payroll_transactions', t.id, t);
    _payrollTransactions = _payrollTransactions.map(item => item.id === t.id ? t : item);
    dispatchChange();
  }
  async deletePayrollTransaction(id: string): Promise<void> {
    await remove('payroll_transactions', id);
    _payrollTransactions = _payrollTransactions.filter(t => t.id !== id);
    dispatchChange();
  }

  // ─── food / transport / port rent ──────────────────────────────────────────

  async addFoodExpense(e: FoodExpense): Promise<void> {
    const saved = await insert<FoodExpense>('food_expenses', e);
    if (saved) { _foodExpenses = [..._foodExpenses, saved]; await auditLog('EXP', `Food Allowance ${e.amount}`); dispatchChange(); }
  }
  async updateFoodExpense(e: FoodExpense): Promise<void> {
    await update('food_expenses', e.id, e);
    _foodExpenses = _foodExpenses.map(item => item.id === e.id ? e : item);
    dispatchChange();
  }
  async deleteFoodExpense(id: string): Promise<void> {
    await remove('food_expenses', id);
    _foodExpenses = _foodExpenses.filter(e => e.id !== id);
    dispatchChange();
  }

  async addTransportExpense(e: TransportExpense): Promise<void> {
    const saved = await insert<TransportExpense>('transport_expenses', e);
    if (saved) { _transportExpenses = [..._transportExpenses, saved]; await auditLog('EXP', `Transport ${e.amount}`); dispatchChange(); }
  }
  async updateTransportExpense(e: TransportExpense): Promise<void> {
    await update('transport_expenses', e.id, e);
    _transportExpenses = _transportExpenses.map(item => item.id === e.id ? e : item);
    dispatchChange();
  }
  async deleteTransportExpense(id: string): Promise<void> {
    await remove('transport_expenses', id);
    _transportExpenses = _transportExpenses.filter(e => e.id !== id);
    dispatchChange();
  }

  async addPortRent(e: PortRent): Promise<void> {
    const saved = await insert<PortRent>('port_rents', e);
    if (saved) { _portRents = [..._portRents, saved]; await auditLog('EXP', `Port Rent ${e.amount} at ${e.port}`); dispatchChange(); }
  }
  async updatePortRent(e: PortRent): Promise<void> {
    await update('port_rents', e.id, e);
    _portRents = _portRents.map(item => item.id === e.id ? e : item);
    dispatchChange();
  }
  async deletePortRent(id: string): Promise<void> {
    await remove('port_rents', id);
    _portRents = _portRents.filter(e => e.id !== id);
    dispatchChange();
  }

  // ─── audit / history ───────────────────────────────────────────────────────

  async totalSystemWipe(): Promise<void> {
    const tables = ['operations', 'invoices', 'payments', 'procurement', 'gas_transactions',
      'payroll_transactions', 'food_expenses', 'transport_expenses', 'port_rents',
      'reservations', 'customer_prices', 'system_notifications'];
    await Promise.all(tables.map(t => supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')));
    await supabase.from('gensets').update({ status: GensetStatus.IN_STOCK }).neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('profiles').delete().eq('role', UserRole.CUSTOMER);
    _operations = []; _invoices = []; _payments = []; _procurements = [];
    _gasTransactions = []; _payrollTransactions = []; _foodExpenses = [];
    _transportExpenses = []; _portRents = []; _reservations = [];
    _customerPrices = []; _notifications = [];
    _users = _users.filter(u => u.role !== UserRole.CUSTOMER);
    _stock = _stock.map(s => ({ ...s, status: GensetStatus.IN_STOCK }));
    await auditLog('CRITICAL', 'TOTAL SYSTEM WIPE EXECUTED. DATA PURGED.');
    dispatchChange();
  }

  restartHistory(): void {
    _auditLogs = [];
    dispatchChange();
  }

  undo(): boolean {
    // Undo is not supported in a real database — no-op but keeps compatibility
    console.warn('[supabaseDb] undo() is not supported with a real database.');
    return false;
  }
}

export const db = new SupabaseDB();
