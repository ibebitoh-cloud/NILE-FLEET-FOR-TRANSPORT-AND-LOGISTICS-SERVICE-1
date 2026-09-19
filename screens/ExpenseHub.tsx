
import React, { useState, useContext, useMemo } from 'react';
import { db } from '../services/supabaseDb';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';
import { Procurement, GasTransaction, Employee, PayrollTransaction, User, UserRole, FoodExpense, TransportExpense, PortRent, Location } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import * as XLSX from 'xlsx';

const ExpenseHub: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme, isDark } = useContext(ThemeContext);
  const t = translations[lang];
  const isAr = lang === 'ar';

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = currentUser.role === UserRole.VIEWER;

  const [activeTab, setActiveTab] = useState<'PROCURE' | 'GAS' | 'PAYROLL' | 'FOOD' | 'TRANSPORT' | 'RENT'>('PROCURE');
  
  const [procurements, setProcurements] = useState<Procurement[]>(db.getProcurements());
  const [gasTransactions, setGasTransactions] = useState<GasTransaction[]>(db.getGasTransactions());
  const [employees, setEmployees] = useState<Employee[]>(db.getEmployees());
  const [foodExpenses, setFoodExpenses] = useState<FoodExpense[]>(db.getFoodExpenses());
  const [transportExpenses, setTransportExpenses] = useState<TransportExpense[]>(db.getTransportExpenses());
  const [portRents, setPortRents] = useState<PortRent[]>(db.getPortRents());
  
  const [payrollMonth, setPayrollMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [showModal, setShowModal] = useState<'NONE' | 'PROCURE' | 'GAS' | 'EMP' | 'TX' | 'FOOD' | 'TRANSPORT' | 'RENT'>('NONE');
  const [formData, setFormData] = useState<any>({ selectedWorkers: [] as string[] });
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  // --- Command Center: filters ---
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState<string>(monthStart);
  const [dateTo, setDateTo] = useState<string>(today.toISOString().split('T')[0]);
  const [portFilter, setPortFilter] = useState<Location | 'ALL'>('ALL');

  const refresh = () => {
    setProcurements([...db.getProcurements()]);
    setGasTransactions([...db.getGasTransactions()]);
    setEmployees([...db.getEmployees()]);
    setFoodExpenses([...db.getFoodExpenses()]);
    setTransportExpenses([...db.getTransportExpenses()]);
    setPortRents([...db.getPortRents()]);
  };

  const handleDelete = (type: string, id: string) => {
    if (isReadOnly) return;
    if (!confirm(isAr ? 'تأكيد: هل أنت متأكد من حذف هذه العملية نهائياً؟' : 'Purge Authorization: Permanently delete this entry?')) return;
    
    switch (type) {
      case 'PROCURE': db.deleteProcurement(id); break;
      case 'GAS': db.deleteGasTransaction(id); break;
      case 'EMP': db.deleteEmployee(id); break;
      case 'TX': db.deletePayrollTransaction(id); break;
      case 'FOOD': db.deleteFoodExpense(id); break;
      case 'TRANSPORT': db.deleteTransportExpense(id); break;
      case 'RENT': db.deletePortRent(id); break;
    }
    refresh();
  };

  const openEdit = (type: typeof showModal, item: any) => {
    setEditingId(item.id);
    setShowModal(type);
    if (type === 'PROCURE') setFormData({ personName: item.personName, amount: item.amount, description: item.itemDescription, date: item.date });
    else if (type === 'GAS') setFormData({ amount: item.amount, date: item.date, reference: item.reference });
    else if (type === 'EMP') setFormData({ name: item.name, position: item.position, salary: item.baseSalary, date: item.startDate });
    else if (type === 'TX') setFormData({ empId: item.employeeId, type: item.type, amount: item.amount, date: item.date, month: item.month, notes: item.notes });
    else if (type === 'FOOD') setFormData({ amount: item.amount, fromDate: item.fromDate, toDate: item.toDate, notes: item.notes, selectedWorkers: item.workerNames ? item.workerNames.split(', ') : [] });
    else if (type === 'TRANSPORT') setFormData({ amount: item.amount, fromPort: item.fromPort, toPort: item.toPort, date: item.date, notes: item.notes, selectedWorkers: item.workerNames ? item.workerNames.split(', ') : [] });
    else if (type === 'RENT') setFormData({ port: item.port, amount: item.amount, date: item.date, period: item.period, notes: item.notes });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    const today = new Date().toISOString().split('T')[0];

    if (showModal === 'PROCURE') {
      const data = { id: editingId || `proc-${Date.now()}`, personName: formData.personName, itemDescription: formData.description, amount: parseFloat(formData.amount), date: formData.date || today, status: 'PENDING' as const };
      editingId ? db.updateProcurement(data) : db.addProcurement(data);
    } else if (showModal === 'GAS') {
      const data = { id: editingId || `gas-${Date.now()}`, date: formData.date || today, type: 'TOPUP' as const, amount: parseFloat(formData.amount), reference: formData.reference || 'Oktan Prepaid' };
      editingId ? db.updateGasTransaction(data) : db.addGasTransaction(data);
    } else if (showModal === 'EMP') {
      const data = { id: editingId || `emp-${Date.now()}`, name: formData.name, position: formData.position, baseSalary: parseFloat(formData.salary), startDate: formData.date || today };
      editingId ? db.updateEmployee(data) : db.addEmployee(data);
    } else if (showModal === 'TX') {
      const data = { id: editingId || `tx-${Date.now()}`, employeeId: formData.empId, type: formData.type, amount: parseFloat(formData.amount), date: formData.date || today, month: formData.month || payrollMonth, notes: formData.notes };
      editingId ? db.updatePayrollTransaction(data) : db.addPayrollTransaction(data);
    } else if (showModal === 'FOOD') {
      const data = { id: editingId || `food-${Date.now()}`, amount: parseFloat(formData.amount), fromDate: formData.fromDate, toDate: formData.toDate, workerCount: formData.selectedWorkers.length, workerNames: formData.selectedWorkers.join(', '), notes: formData.notes };
      editingId ? db.updateFoodExpense(data) : db.addFoodExpense(data);
    } else if (showModal === 'TRANSPORT') {
      const data = { id: editingId || `trans-${Date.now()}`, amount: parseFloat(formData.amount), fromPort: formData.fromPort, toPort: formData.toPort, date: formData.date || today, workerNames: formData.selectedWorkers.join(', '), notes: formData.notes };
      editingId ? db.updateTransportExpense(data) : db.addTransportExpense(data);
    } else if (showModal === 'RENT') {
      const data = { id: editingId || `rent-${Date.now()}`, port: formData.port, amount: parseFloat(formData.amount), date: formData.date || today, period: formData.period, notes: formData.notes };
      editingId ? db.updatePortRent(data) : db.addPortRent(data);
    }

    refresh(); 
    setShowModal('NONE'); 
    setFormData({ selectedWorkers: [] });
    setEditingId(null);
  };

  const payrollSummary = useMemo(() => {
    return employees.map(emp => {
      const { earnings, deductions, balance } = db.getEmployeeBalance(emp.id, payrollMonth);
      return { ...emp, earnings, deductions, balance };
    });
  }, [employees, payrollMonth, portRents]);

  // --- Command Center: unify every expense category into one comparable shape ---
  type UnifiedExpense = { id: string; category: string; date: string; amount: number; port: Location | null; label: string; };

  const allExpenses: UnifiedExpense[] = useMemo(() => {
    const list: UnifiedExpense[] = [];
    procurements.forEach(p => list.push({ id: p.id, category: 'PROCURE', date: p.date, amount: p.amount, port: null, label: p.itemDescription }));
    gasTransactions.forEach(t => { if (t.type === 'TOPUP') list.push({ id: t.id, category: 'GAS', date: t.date, amount: t.amount, port: null, label: t.reference }); });
    foodExpenses.forEach(e => list.push({ id: e.id, category: 'FOOD', date: e.toDate || e.fromDate, amount: e.amount, port: null, label: `${e.workerCount} staffers` }));
    transportExpenses.forEach(e => list.push({ id: e.id, category: 'TRANSPORT', date: e.date, amount: e.amount, port: e.fromPort, label: `${e.fromPort} -> ${e.toPort}` }));
    portRents.forEach(e => list.push({ id: e.id, category: 'RENT', date: e.date, amount: e.amount, port: e.port, label: e.period }));
    // Payroll: each transaction is a real cash movement
    employees.forEach(emp => {
      db.getPayrollTransactions().filter(tx => tx.employeeId === emp.id).forEach(tx => {
        list.push({ id: tx.id, category: 'PAYROLL', date: tx.date, amount: tx.amount, port: null, label: `${emp.name} - ${tx.type}` });
      });
    });
    return list;
  }, [procurements, gasTransactions, foodExpenses, transportExpenses, portRents, employees]);

  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(e => {
      if (e.date && dateFrom && e.date < dateFrom) return false;
      if (e.date && dateTo && e.date > dateTo) return false;
      if (portFilter !== 'ALL' && e.port !== null && e.port !== portFilter) return false;
      if (portFilter !== 'ALL' && e.port === null) return false; // port-less categories excluded when a specific port is chosen
      return true;
    });
  }, [allExpenses, dateFrom, dateTo, portFilter]);

  const CATEGORY_META: Record<string, { label: string; labelAr: string; color: string }> = {
    PROCURE: { label: 'Procurement', labelAr: 'مشتريات', color: '#6366F1' },
    GAS: { label: 'Fuel Ledger', labelAr: 'وقود', color: '#F59E0B' },
    PAYROLL: { label: 'Staff Hub', labelAr: 'رواتب', color: '#0EA5E9' },
    FOOD: { label: 'Allowances', labelAr: 'إعاشة', color: '#EF4444' },
    TRANSPORT: { label: 'Fleet Moves', labelAr: 'نقل', color: '#22C55E' },
    RENT: { label: 'Hub Rent', labelAr: 'إيجار', color: '#C2A378' },
  };

  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredExpenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
    return Object.entries(totals)
      .map(([category, value]) => ({ category, value, ...CATEGORY_META[category] }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const totalThisRange = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);

  // Previous period of equal length, immediately before dateFrom, for trend comparison
  const trendVsPrevious = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const rangeDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const prevTo = new Date(from.getTime() - 86400000);
    const prevFrom = new Date(prevTo.getTime() - (rangeDays - 1) * 86400000);
    const prevFromStr = prevFrom.toISOString().split('T')[0];
    const prevToStr = prevTo.toISOString().split('T')[0];
    const prevTotal = allExpenses
      .filter(e => e.date && e.date >= prevFromStr && e.date <= prevToStr && (portFilter === 'ALL' || e.port === portFilter))
      .reduce((s, e) => s + e.amount, 0);
    if (prevTotal === 0) return null;
    const pct = ((totalThisRange - prevTotal) / prevTotal) * 100;
    return { prevTotal, pct };
  }, [allExpenses, dateFrom, dateTo, portFilter, totalThisRange]);

  const handleExport = () => {
    const rows = filteredExpenses
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map(e => ({
        Date: e.date,
        Category: CATEGORY_META[e.category]?.label || e.category,
        Description: e.label,
        Port: e.port || '',
        'Amount (EGP)': e.amount,
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `Nile-Fleet-Expenses_${dateFrom}_to_${dateTo}.xlsx`);
  };

  const toggleWorker = (name: string) => {
    const current = formData.selectedWorkers || [];
    if (current.includes(name)) {
      setFormData({ ...formData, selectedWorkers: current.filter((n: string) => n !== name) });
    } else {
      setFormData({ ...formData, selectedWorkers: [...current, name] });
    }
  };

  const inputClass = "w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-bold outline-none focus:border-blue-400 text-black dark:text-white";
  const labelClass = "text-[10px] font-black uppercase text-slate-400 block mb-2 px-1 tracking-widest text-start";

  const ActionButtons = ({ onEdit, onDelete }: { onEdit: () => void, onDelete: () => void }) => (
    <div className="flex justify-end gap-2">
      <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-lg hover:scale-110 transition-transform">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 bg-rose-50 dark:bg-slate-800 text-rose-600 dark:text-rose-400 rounded-lg hover:scale-110 transition-transform">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  );

  return (
    <div className={`space-y-8 animate-in fade-in duration-500 text-start pb-24 max-w-7xl mx-auto ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
      <div className="flex flex-col gap-6">
        <div className="flex justify-between items-center">
           <div>
              <h2 className={`text-4xl font-black italic tracking-tighter uppercase mb-1 ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>{t.expenseCommand}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">{t.unifiedOutflow}</p>
           </div>
           {!isReadOnly && (
             <button onClick={() => { setEditingId(null); setFormData({ selectedWorkers: [] }); setShowModal(activeTab === 'PAYROLL' ? 'EMP' : activeTab as any); }} className="bg-[#C2A378] text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95">
               {isAr ? '+ إضافة إدخال' : `+ Add ${activeTab} Entry`}
             </button>
           )}
        </div>

        <div className="flex bg-white dark:bg-slate-800 p-2 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto custom-scrollbar no-wrap">
          {[
            { id: 'PROCURE', label: 'Procurement', icon: '📦' },
            { id: 'GAS', label: 'Fuel Ledger', icon: '⛽' },
            { id: 'PAYROLL', label: 'Staff Hub', icon: '👥' },
            { id: 'FOOD', label: 'Allowances', icon: '🍱' },
            { id: 'TRANSPORT', label: 'Fleet Moves', icon: '🚐' },
            { id: 'RENT', label: 'Hub Rent', icon: '🏢' },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setFormData({ selectedWorkers: [] }); setExpandedEmployee(null); }}
              className={`flex-1 min-w-[140px] px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${activeTab === tab.id ? 'bg-[#001F3F] text-white shadow-xl' : 'text-slate-400 hover:text-[#001F3F] dark:hover:text-white'}`}
            >
              <span className="text-lg">{tab.icon}</span>
              {translateEntity(tab.id, lang)}
            </button>
          ))}
        </div>
      </div>

      {/* ===== Command Center Dashboard ===== */}
      <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] shadow-2xl border border-slate-200 dark:border-slate-700 p-10 space-y-8">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">{isAr ? 'من تاريخ' : 'From'}</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-bold text-sm text-black dark:text-white outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">{isAr ? 'إلى تاريخ' : 'To'}</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-bold text-sm text-black dark:text-white outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block mb-2">{isAr ? 'الميناء' : 'Port'}</label>
            <select value={portFilter} onChange={e => setPortFilter(e.target.value as any)} className="p-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl font-bold text-sm text-black dark:text-white outline-none focus:border-blue-400">
              <option value="ALL">{isAr ? 'كل الموانئ' : 'All Ports'}</option>
              {Object.values(Location).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => { setDateFrom(monthStart); setDateTo(today.toISOString().split('T')[0]); setPortFilter('ALL'); }} className="px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-[#001F3F] dark:hover:text-white transition-colors">
              {isAr ? 'إعادة تعيين' : 'Reset'}
            </button>
            <button onClick={handleExport} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center gap-2">
              <span>⬇</span> {isAr ? 'تصدير إكسل' : 'Export Excel'}
            </button>
          </div>
        </div>

        {/* Summary cards + chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#001F3F] text-white rounded-[2rem] p-8">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-2">{isAr ? 'إجمالي المصروفات للفترة' : 'Total Spend (Selected Range)'}</p>
              <p className="text-4xl font-black">EGP {totalThisRange.toLocaleString()}</p>
              {trendVsPrevious && (
                <p className={`text-[10px] font-black mt-3 uppercase tracking-wider ${trendVsPrevious.pct > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {trendVsPrevious.pct > 0 ? '▲' : '▼'} {Math.abs(trendVsPrevious.pct).toFixed(1)}% {isAr ? 'مقارنة بالفترة السابقة' : 'vs previous period'}
                </p>
              )}
            </div>
            <div className="space-y-2">
              {categoryBreakdown.map(c => (
                <div key={c.category} className="flex items-center justify-between px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-300">{isAr ? c.labelAr : c.label}</span>
                  </div>
                  <span className="text-[11px] font-black text-slate-800 dark:text-white">EGP {c.value.toLocaleString()}</span>
                </div>
              ))}
              {categoryBreakdown.length === 0 && (
                <p className="text-center text-[10px] font-bold text-slate-400 uppercase py-6">{isAr ? 'لا توجد بيانات لهذه الفترة' : 'No expenses in this range'}</p>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 h-[340px]">
            {categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="category" innerRadius={70} outerRadius={120} paddingAngle={3}>
                    {categoryBreakdown.map((c) => <Cell key={c.category} fill={c.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `EGP ${v.toLocaleString()}`} />
                  <Legend formatter={(value: string) => isAr ? (CATEGORY_META[value]?.labelAr || value) : (CATEGORY_META[value]?.label || value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm font-bold uppercase">
                {isAr ? 'لا توجد رسوم بيانية للعرض' : 'Nothing to chart yet'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px]">
         <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
               <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest border-b">
                  <tr>
                    <th className="px-10 py-5">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-10 py-5">{isAr ? 'الوصف / الهوية' : 'Identity / Desc'}</th>
                    <th className="px-10 py-5">{isAr ? 'التفاصيل' : 'Context'}</th>
                    <th className="px-10 py-5 text-left">{isAr ? 'المبلغ (ج.م)' : 'Amount (EGP)'}</th>
                    <th className="px-10 py-5 text-right w-32">{isAr ? 'الإجراء' : 'Protocol'}</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeTab === 'PROCURE' && procurements.map(p => (
                    <tr key={p.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-10 py-6 font-bold text-slate-600">{p.date}</td>
                      <td className="px-10 py-6 font-black text-slate-800 dark:text-white uppercase">{p.itemDescription}</td>
                      <td className="px-10 py-6 font-bold text-slate-400 uppercase italic">{p.personName}</td>
                      <td className="px-10 py-6 text-left font-black text-slate-900 dark:text-white">EGP {p.amount.toLocaleString()}</td>
                      <td className="px-10 py-6"><ActionButtons onEdit={() => openEdit('PROCURE', p)} onDelete={() => handleDelete('PROCURE', p.id)} /></td>
                    </tr>
                  ))}
                  {activeTab === 'GAS' && gasTransactions.map(t => (
                    <tr key={t.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-10 py-6 font-bold text-slate-600">{t.date}</td>
                      <td className="px-10 py-6 font-bold text-slate-800 dark:text-white uppercase">{t.reference}</td>
                      <td className="px-10 py-6 font-bold text-slate-400 uppercase italic">{t.type}</td>
                      <td className="px-10 py-6 text-left font-black text-emerald-600">EGP {t.amount.toLocaleString()}</td>
                      <td className="px-10 py-6"><ActionButtons onEdit={() => openEdit('GAS', t)} onDelete={() => handleDelete('GAS', t.id)} /></td>
                    </tr>
                  ))}
                  {activeTab === 'PAYROLL' && payrollSummary.map(emp => (
                    <React.Fragment key={emp.id}>
                      <tr onClick={() => setExpandedEmployee(expandedEmployee === emp.id ? null : emp.id)} className={`group cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${expandedEmployee === emp.id ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-10 py-6 text-slate-300">{expandedEmployee === emp.id ? '▼' : '▶'}</td>
                        <td className="px-10 py-6">
                          <span className="font-black text-slate-800 dark:text-white uppercase block">{emp.name}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{emp.position}</span>
                        </td>
                        <td className="px-10 py-6 font-bold uppercase text-slate-400 italic">Net Flow:</td>
                        <td className="px-10 py-6 text-left font-black text-[#001F3F] dark:text-[#C2A378]">EGP {emp.balance.toLocaleString()}</td>
                        <td className="px-10 py-6"><ActionButtons onEdit={() => openEdit('EMP', emp)} onDelete={() => handleDelete('EMP', emp.id)} /></td>
                      </tr>
                      {expandedEmployee === emp.id && (
                        <tr>
                          <td colSpan={5} className="bg-slate-50/50 dark:bg-slate-900/50 p-6">
                             <div className="max-w-4xl mx-auto space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                   <h5 className="text-[10px] font-black uppercase text-blue-600 tracking-widest">Transaction Audit Node</h5>
                                   <button onClick={() => { setShowModal('TX'); setFormData({ empId: emp.id, type: 'SALARY_BASE', amount: '', date: '', month: payrollMonth, notes: '' }); }} className="bg-[#001F3F] text-white px-4 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg">+ Add TX</button>
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-white/5 overflow-hidden shadow-inner">
                                   <table className="w-full text-left text-[9px]">
                                      <thead className="bg-slate-50 dark:bg-slate-900 font-black uppercase text-slate-500">
                                         <tr>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">Type</th>
                                            <th className="p-3 text-right">Debit (-)</th>
                                            <th className="p-3 text-right">Credit (+)</th>
                                            <th className="p-3 text-right">Actions</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                         {db.getAuditLogs().slice(0, 1).map((_, i) => (
                                           <tr key={i} className="font-bold">
                                              <td className="p-3 text-slate-400">{payrollMonth}-01</td>
                                              <td className="p-3 text-blue-600 uppercase">MONTHLY_BASE</td>
                                              <td className="p-3 text-right text-slate-300">---</td>
                                              <td className="p-3 text-right text-emerald-600">{emp.baseSalary.toLocaleString()}</td>
                                              <td className="p-3 text-right opacity-30 italic">System Core</td>
                                           </tr>
                                         ))}
                                      </tbody>
                                   </table>
                                </div>
                             </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {activeTab === 'FOOD' && foodExpenses.map(e => (
                    <tr key={e.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-10 py-6 font-bold text-slate-600">{e.fromDate} → {e.toDate}</td>
                      <td className="px-10 py-6 font-black text-slate-800 dark:text-white uppercase">{e.workerCount} {isAr ? 'فرد' : 'Staffers'}</td>
                      <td className="px-10 py-6 text-slate-400 italic text-[10px]">{e.workerNames || 'Routine Provision'}</td>
                      <td className="px-10 py-6 text-left font-black text-rose-600">EGP {e.amount.toLocaleString()}</td>
                      <td className="px-10 py-6"><ActionButtons onEdit={() => openEdit('FOOD', e)} onDelete={() => handleDelete('FOOD', e.id)} /></td>
                    </tr>
                  ))}
                  {activeTab === 'TRANSPORT' && transportExpenses.map(e => (
                    <tr key={e.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-10 py-6 font-bold text-slate-600">{e.date}</td>
                      <td className="px-10 py-6 font-black text-slate-800 dark:text-white uppercase">{translateEntity(e.fromPort, lang)} → {translateEntity(e.toPort, lang)}</td>
                      <td className="px-10 py-6 text-slate-400 italic text-[10px]">{e.workerNames || 'Terminal Link'}</td>
                      <td className="px-10 py-6 text-left font-black text-blue-600">EGP {e.amount.toLocaleString()}</td>
                      <td className="px-10 py-6"><ActionButtons onEdit={() => openEdit('TRANSPORT', e)} onDelete={() => handleDelete('TRANSPORT', e.id)} /></td>
                    </tr>
                  ))}
                  {activeTab === 'RENT' && portRents.map(e => (
                    <tr key={e.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-10 py-6 font-bold text-slate-600">{e.date}</td>
                      <td className="px-10 py-6 font-black text-slate-800 dark:text-white uppercase">{translateEntity(e.port, lang)} - {e.period}</td>
                      <td className="px-10 py-6 text-slate-400 italic text-[10px]">{e.notes || 'Access Lease'}</td>
                      <td className="px-10 py-6 text-left font-black text-amber-600">EGP {e.amount.toLocaleString()}</td>
                      <td className="px-10 py-6"><ActionButtons onEdit={() => openEdit('RENT', e)} onDelete={() => handleDelete('RENT', e.id)} /></td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {showModal !== 'NONE' && (
        <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-xl z-[300] flex items-center justify-center p-4">
           <div className={`bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl max-w-xl w-full overflow-hidden border-[10px] border-[#001F3F] animate-in zoom-in-95 ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
              <div className="p-8 bg-[#001F3F] text-white flex justify-between items-center text-start">
                 <h3 className="text-xl font-black uppercase italic tracking-widest">{editingId ? (isAr ? 'تعديل السجل' : 'Modify Registry Node') : (isAr ? 'اعتماد عملية جديدة' : 'Authorize New Inflow')}</h3>
                 <button onClick={() => setShowModal('NONE')} className="text-white hover:text-rose-500 font-bold">✕</button>
              </div>
              <form onSubmit={handleFormSubmit} className="p-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar text-start text-black dark:text-white">
                 
                 {/* PROCUREMENT PERSONNEL SELECTION */}
                 {showModal === 'PROCURE' && (
                   <>
                     <div><label className={labelClass}>{isAr ? 'وصف الصنف' : 'Item Identifier'}</label><input required className={inputClass} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                     <div>
                        <label className={labelClass}>{isAr ? 'الطرف المستلم (زميل)' : 'Recipient Identity (Personnel)'}</label>
                        <select required className={inputClass} value={formData.personName} onChange={e => setFormData({...formData, personName: e.target.value})}>
                           <option value="">-- {isAr ? 'اختر الزميل' : 'Select Coworker'} --</option>
                           {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name} ({emp.position})</option>)}
                        </select>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>{t.rate}</label><input required type="number" className={inputClass} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                        <div><label className={labelClass}>{t.date}</label><input type="date" className={inputClass} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                     </div>
                   </>
                 )}

                 {/* FOOD PERSONNEL SELECTION */}
                 {showModal === 'FOOD' && (
                   <>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>{isAr ? 'من تاريخ' : 'Period From'}</label><input type="date" required className={inputClass} value={formData.fromDate} onChange={e => setFormData({...formData, fromDate: e.target.value})} /></div>
                        <div><label className={labelClass}>{isAr ? 'إلى تاريخ' : 'Period To'}</label><input type="date" required className={inputClass} value={formData.toDate} onChange={e => setFormData({...formData, toDate: e.target.value})} /></div>
                     </div>
                     <div><label className={labelClass}>{isAr ? 'إجمالي المبلغ' : 'Total Cost'}</label><input type="number" required className={inputClass} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                     
                     <div className="space-y-4">
                        <label className={labelClass}>{isAr ? 'الموظفين المشمولين' : 'Involved Personnel'}</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-slate-100 dark:border-slate-800">
                           {employees.map(emp => (
                              <button 
                                 type="button" 
                                 key={emp.id} 
                                 onClick={() => toggleWorker(emp.name)}
                                 className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all text-center border-2 ${formData.selectedWorkers?.includes(emp.name) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}
                              >
                                 {emp.name}
                              </button>
                           ))}
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase text-center italic">{formData.selectedWorkers?.length || 0} {isAr ? 'زملاء مختارين' : 'Coworkers Selected'}</p>
                     </div>

                     <div><label className={labelClass}>{isAr ? 'ملاحظات إضافية' : 'Additional Notes'}</label><input className={inputClass} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
                   </>
                 )}

                 {/* TRANSPORT PERSONNEL SELECTION */}
                 {showModal === 'TRANSPORT' && (
                   <>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>From Hub</label>
                          <select className={inputClass} value={formData.fromPort} onChange={e => setFormData({...formData, fromPort: e.target.value as any})}>
                            {Object.values(Location).map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>To Hub</label>
                          <select className={inputClass} value={formData.toPort} onChange={e => setFormData({...formData, toPort: e.target.value as any})}>
                            {Object.values(Location).map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                     </div>
                     <div><label className={labelClass}>Expense Total</label><input type="number" required className={inputClass} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                     
                     <div className="space-y-4">
                        <label className={labelClass}>{isAr ? 'المسافرين (زملاء)' : 'Passengers (Coworkers)'}</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-slate-100 dark:border-slate-800">
                           {employees.map(emp => (
                              <button 
                                 type="button" 
                                 key={emp.id} 
                                 onClick={() => toggleWorker(emp.name)}
                                 className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all text-center border-2 ${formData.selectedWorkers?.includes(emp.name) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400'}`}
                              >
                                 {emp.name}
                              </button>
                           ))}
                        </div>
                     </div>

                     <div><label className={labelClass}>Manifest Date</label><input type="date" className={inputClass} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                     <div><label className={labelClass}>Notes</label><input className={inputClass} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
                   </>
                 )}

                 {/* REST OF MODALS (GAS, EMP, TX, RENT) */}
                 {showModal === 'GAS' && (
                   <>
                     <div><label className={labelClass}>{isAr ? 'المورد / المرجع' : 'Supplier / Ref'}</label><input required className={inputClass} value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})} /></div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>{t.rate}</label><input required type="number" className={inputClass} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                        <div><label className={labelClass}>{t.date}</label><input type="date" className={inputClass} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                     </div>
                   </>
                 )}
                 {showModal === 'TX' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className={labelClass}>Type</label>
                            <select className={inputClass} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                               <option value="SALARY_BASE">SALARY</option>
                               <option value="BONUS">BONUS</option>
                               <option value="ADVANCE">ADVANCE</option>
                            </select>
                         </div>
                         <div><label className={labelClass}>Month</label><input type="month" className={inputClass} value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} /></div>
                      </div>
                      <div><label className={labelClass}>Amount</label><input type="number" className={inputClass} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                      <div><label className={labelClass}>Operational Note</label><input className={inputClass} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
                    </>
                 )}
                 {showModal === 'EMP' && (
                   <>
                     <div><label className={labelClass}>{isAr ? 'الاسم بالكامل' : 'Full Identity'}</label><input required className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                     <div><label className={labelClass}>{isAr ? 'المسمى الوظيفي' : 'Role Title'}</label><input required className={inputClass} value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})} /></div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>{isAr ? 'الراتب المعتمد' : 'Base Rate'}</label><input required type="number" className={inputClass} value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} /></div>
                        <div><label className={labelClass}>{isAr ? 'تاريخ البدء' : 'Onboard Date'}</label><input type="date" className={inputClass} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                     </div>
                   </>
                 )}
                 {showModal === 'RENT' && (
                   <>
                     <div>
                       <label className={labelClass}>Terminal Hub</label>
                       <select className={inputClass} value={formData.port} onChange={e => setFormData({...formData, port: e.target.value as any})}>
                         {Object.values(Location).map(l => <option key={l} value={l}>{l}</option>)}
                       </select>
                     </div>
                     <div><label className={labelClass}>Period</label><input required className={inputClass} value={formData.period} onChange={e => setFormData({...formData, period: e.target.value})} /></div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Rent Amount</label><input required type="number" className={inputClass} value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /></div>
                        <div><label className={labelClass}>{t.date}</label><input type="date" className={inputClass} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                     </div>
                     <div><label className={labelClass}>Notes</label><input className={inputClass} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
                   </>
                 )}
                 <button type="submit" className="w-full bg-[#001F3F] text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all">
                   {editingId ? (isAr ? 'تحديث البيانات' : 'Update Matrix') : (isAr ? 'تأكيد العملية' : 'Authorize Commit')}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseHub;
