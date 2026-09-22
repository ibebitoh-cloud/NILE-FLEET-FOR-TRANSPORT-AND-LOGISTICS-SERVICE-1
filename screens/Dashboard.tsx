import React, { useContext, useMemo, useEffect, useState } from 'react';
import { db } from '../services/supabaseDb';
import { UserRole, User } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';

interface DashboardProps {
  onNavigate: (screen: string, id?: string) => void;
}

const money = (value: number) => `${Math.round(value || 0).toLocaleString()} EGP`;

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { lang } = useContext(LanguageContext);
  const { isDark } = useContext(ThemeContext);
  const t = translations[lang];
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = currentUser.role === UserRole.VIEWER;
  const [, setDataVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setDataVersion(v => v + 1);
    window.addEventListener('db-change', refresh);
    window.addEventListener('db-undo-success', refresh);
    return () => {
      window.removeEventListener('db-change', refresh);
      window.removeEventListener('db-undo-success', refresh);
    };
  }, []);

  const stock = db.getStock();
  const ops = db.getOperations();
  const invoices = db.getInvoices();
  const reservations = db.getReservations();
  const customers = db.getUsers().filter(u => u.role === UserRole.CUSTOMER);
  const maintenanceLogs = db.getMaintenanceLogs();
  const todayStr = new Date().toISOString().slice(0, 10);

  const portData = useMemo(() => {
    const locations = ['DAM', 'ALEX', 'GOUDA', 'SOKHNA', 'SCCT', 'PSD', 'MAL', 'WORKSHOP'] as const;
    return locations.map(port => {
      const stockCount = stock.filter(g => g.location === port && g.status === 'IN_STOCK').length;
      const maintenanceCount = stock.filter(g => g.location === port && g.status === 'MAINTENANCE').length;
      const preorderCount =
        ops.filter(o => o.clipOnPort === port && (o.status === 'UNDER OPERATE' || o.status === 'HOLD')).length +
        reservations.filter(r => r.portIn === port && r.status === 'PENDING').length;
      const active = ops.filter(o => o.clipOnPort === port && o.status === 'IN PROGRESS').length;
      return { port, stockCount, maintenanceCount, preorderCount, active };
    });
  }, [stock, ops, reservations]);

  const customerFinancials = useMemo(() => {
    return customers.map(cust => {
      const name = cust.companyName || cust.name;
      const custInvoices = invoices.filter(i => i.customerName === name);
      const billed = custInvoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const paid = custInvoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
      const outstanding = billed - paid;
      const operations = ops.filter(o => o.customerName === name).length;
      return { id: cust.id, name, billed, paid, outstanding, operations };
    }).sort((a, b) => b.outstanding - a.outstanding);
  }, [customers, invoices, ops]);

  const financialTotals = useMemo(() => ({
    billed: customerFinancials.reduce((s, c) => s + c.billed, 0),
    paid: customerFinancials.reduce((s, c) => s + c.paid, 0),
    outstanding: customerFinancials.reduce((s, c) => s + Math.max(c.outstanding, 0), 0),
  }), [customerFinancials]);

  const maintenanceStats = useMemo(() => {
    const completed = maintenanceLogs.filter(l => l.status === 'COMPLETED').length;
    const inProgress = maintenanceLogs.filter(l => l.status === 'IN_PROGRESS').length;
    const scheduled = maintenanceLogs.filter(l => l.status === 'SCHEDULED').length;
    const total = maintenanceLogs.length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const dueSoon = stock.filter(g => g.nextMaintenanceDue && g.nextMaintenanceDue <= todayStr).length;
    return { completed, inProgress, scheduled, total, completionRate, dueSoon };
  }, [maintenanceLogs, stock, todayStr]);

  const smartAlerts = useMemo(() => {
    const alerts: { level: 'HIGH' | 'MEDIUM' | 'INFO'; text: string; action?: () => void }[] = [];
    portData.forEach(p => {
      if (p.preorderCount > p.stockCount) {
        alerts.push({
          level: 'HIGH',
          text: `${translateEntity(p.port, lang)}: ${p.preorderCount} preorder / ${p.stockCount} stock`,
          action: () => onNavigate('operations', p.port)
        });
      }
    });
    if (maintenanceStats.dueSoon > 0) {
      alerts.push({ level: 'MEDIUM', text: `${maintenanceStats.dueSoon} genset(s) due for maintenance`, action: () => onNavigate('maintenance') });
    }
    if (financialTotals.outstanding > 0) {
      alerts.push({ level: 'INFO', text: `${money(financialTotals.outstanding)} customer outstanding balance`, action: () => onNavigate('financials') });
    }
    if (!alerts.length) alerts.push({ level: 'INFO', text: 'Fleet is balanced — no critical dashboard exceptions detected.' });
    return alerts.slice(0, 5);
  }, [portData, maintenanceStats, financialTotals, lang, onNavigate]);

  const daliSummary = useMemo(() => {
    const totalUnits = stock.length;
    const active = ops.filter(o => o.status === 'IN PROGRESS').length;
    const preorder = ops.filter(o => o.status === 'UNDER OPERATE').length;
    const maintenance = stock.filter(g => g.status === 'MAINTENANCE').length;
    return { totalUnits, active, preorder, maintenance };
  }, [stock, ops]);

  return (
    <div className="space-y-5 lg:space-y-6 animate-in fade-in duration-500 pb-28 lg:pb-12 text-start">
      {/* DALI 1.0 — wide, short top command widget */}
      <button
        onClick={() => onNavigate('intelligence')}
        className="w-full bg-[#001F3F] dark:bg-slate-950 text-white rounded-[2rem] px-5 py-4 md:px-8 md:py-5 shadow-xl border border-blue-900/30 hover:shadow-2xl transition-all text-start relative overflow-hidden group"
      >
        <div className="absolute -right-10 -top-16 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#C2A378] text-[#001F3F] flex items-center justify-center font-black text-sm shrink-0">D1</div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[#C2A378] font-black tracking-[0.2em] text-xs uppercase">DALI 1.0</span>
                <span className="text-[8px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-black uppercase tracking-widest">Live</span>
              </div>
              <p className="text-sm md:text-base font-black uppercase italic truncate">Fleet Command Intelligence</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 md:gap-5 shrink-0">
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Units</span><b className="text-lg">{daliSummary.totalUnits}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Live</span><b className="text-lg text-emerald-400">{daliSummary.active}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Preorder</span><b className="text-lg text-amber-400">{daliSummary.preorder}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Maint.</span><b className="text-lg text-rose-400">{daliSummary.maintenance}</b></div>
          </div>
        </div>
      </button>

      {/* PORT WIDGETS */}
      <section>
        <div className="flex items-end justify-between mb-3 px-1">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-[#001F3F] dark:text-white uppercase italic tracking-tight">Port Control</h2>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.25em]">Stock • Maintenance • Preorder</p>
          </div>
          <button onClick={() => onNavigate('stock')} className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Fleet</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {portData.map(port => (
            <button
              key={port.port}
              onClick={() => onNavigate('operations', port.port)}
              className="text-start bg-white dark:bg-slate-800 rounded-[1.6rem] p-4 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="bg-[#001F3F] dark:bg-slate-700 text-[#C2A378] px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">{translateEntity(port.port, lang)}</span>
                <span className={`w-2 h-2 rounded-full ${port.preorderCount > port.stockCount ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><span className="block text-[8px] text-slate-400 font-black uppercase">Stock</span><b className="text-xl text-blue-600 dark:text-blue-400">{port.stockCount}</b></div>
                <div><span className="block text-[8px] text-slate-400 font-black uppercase">Maint.</span><b className="text-xl text-rose-500">{port.maintenanceCount}</b></div>
                <div><span className="block text-[8px] text-slate-400 font-black uppercase">Preorder</span><b className="text-xl text-amber-500">{port.preorderCount}</b></div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between text-[8px] font-black uppercase">
                <span className="text-slate-400">Live</span><span className="text-emerald-500">{port.active}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SMART WIDGET */}
      <section className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="font-black text-[#001F3F] dark:text-white uppercase italic">Smart Operations Watch</h2>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Automatic exception detection</p>
          </div>
          <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-full bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400">{smartAlerts.length} Signals</span>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
          {smartAlerts.map((alert, index) => (
            <button key={index} onClick={alert.action} className="text-start rounded-xl p-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${alert.level === 'HIGH' ? 'bg-rose-500' : alert.level === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                <span className="text-[8px] font-black uppercase text-slate-400">{alert.level}</span>
              </div>
              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 leading-relaxed">{alert.text}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* CUSTOMER FINANCIAL REPORT */}
        <section className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-[#001F3F] dark:text-white uppercase italic">Customer Financial Reports</h2>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Billed • Paid • Outstanding</p>
            </div>
            <button onClick={() => onNavigate('financials')} className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">{isReadOnly ? 'Ledger' : 'Financials'}</button>
          </div>
          <div className="grid grid-cols-3 gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Billed</span><b className="text-sm text-slate-700 dark:text-slate-200">{money(financialTotals.billed)}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Paid</span><b className="text-sm text-emerald-500">{money(financialTotals.paid)}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Outstanding</span><b className="text-sm text-rose-500">{money(financialTotals.outstanding)}</b></div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {customerFinancials.slice(0, 5).map(c => (
              <button key={c.id} onClick={() => onNavigate('customers')} className="w-full px-5 py-3 flex items-center justify-between gap-3 text-start hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                <div className="min-w-0"><p className="font-black text-xs text-[#001F3F] dark:text-slate-200 uppercase truncate">{c.name}</p><span className="text-[8px] text-slate-400 font-bold">{c.operations} operations</span></div>
                <div className="text-right shrink-0"><span className="block text-[8px] text-slate-400 uppercase">Outstanding</span><b className={`text-xs ${c.outstanding > 0 ? 'text-rose-500' : 'text-slate-400'}`}>{money(Math.max(c.outstanding, 0))}</b></div>
              </button>
            ))}
            {!customerFinancials.length && <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase">No customer financial data</div>}
          </div>
        </section>

        {/* MAINTENANCE PERFORMANCE + LOG */}
        <section className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-[#001F3F] dark:text-white uppercase italic">Maintenance Performance & Log</h2>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Service execution and latest records</p>
            </div>
            <button onClick={() => onNavigate('maintenance')} className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Maintenance</button>
          </div>
          <div className="grid grid-cols-4 gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Rate</span><b className="text-xl text-emerald-500">{maintenanceStats.completionRate}%</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Done</span><b className="text-xl text-blue-500">{maintenanceStats.completed}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Active</span><b className="text-xl text-amber-500">{maintenanceStats.inProgress}</b></div>
            <div><span className="block text-[8px] text-slate-400 uppercase font-black">Due</span><b className="text-xl text-rose-500">{maintenanceStats.dueSoon}</b></div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {maintenanceLogs.slice(0, 5).map(log => (
              <button key={log.id} onClick={() => onNavigate('maintenance', log.gensetNumber)} className="w-full px-5 py-3 flex items-center justify-between gap-3 text-start hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                <div className="min-w-0"><p className="font-black text-xs text-[#001F3F] dark:text-slate-200 uppercase">GENSET {log.gensetNumber}</p><span className="text-[8px] text-slate-400 font-bold">{log.serviceDate} • {log.serviceType.replace(/_/g, ' ')}</span></div>
                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${log.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : log.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{log.status.replace(/_/g, ' ')}</span>
              </button>
            ))}
            {!maintenanceLogs.length && <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase">No maintenance logs recorded</div>}
          </div>
        </section>
      </div>

      {/* COMPACT SYSTEM TOTALS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Gensets', value: stock.length, action: 'stock' },
          { label: 'In Operation', value: ops.filter(o => o.status === 'IN PROGRESS').length, action: 'operations' },
          { label: 'Preorders', value: ops.filter(o => o.status === 'UNDER OPERATE').length, action: 'operations' },
          { label: 'Maintenance', value: stock.filter(g => g.status === 'MAINTENANCE').length, action: 'maintenance' },
        ].map(item => (
          <button key={item.label} onClick={() => onNavigate(item.action)} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-start hover:shadow-lg transition-all">
            <span className="block text-[8px] text-slate-400 font-black uppercase tracking-widest">{item.label}</span>
            <b className="text-2xl text-[#001F3F] dark:text-white">{item.value}</b>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
