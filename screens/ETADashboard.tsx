import React, { useState, useMemo, useContext } from 'react';
import { db } from '../services/supabaseDb';
import { LanguageContext, ThemeContext } from '../App';
import { translations } from '../translations';
import { Invoice, User, UserRole } from '../types';
import { etaService } from '../services/etaService';

const ETADashboard: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'black';
  const t = translations[lang];
  const [invoices, setInvoices] = useState<Invoice[]>(db.getInvoices());
  const [isThinking, setIsThinking] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSignatureConnected, setIsSignatureConnected] = useState(false);
  const [manualBypass, setManualBypass] = useState(false);
  const [viewMode, setViewMode] = useState<'LOCAL' | 'CLOUD'>('LOCAL');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}') as User;
  const isReadOnly = currentUser.role === UserRole.VIEWER;
  const refreshData = () => setInvoices([...db.getInvoices()]);

  const pendingInvoices = useMemo(() => invoices.filter(i => i.etaStatus === 'DRAFT' || i.etaStatus === 'SUBMITTED'), [invoices]);
  const syncReadyInvoices = useMemo(() => invoices.filter(i => i.etaStatus === 'DRAFT'), [invoices]);

  const submitInvoice = async (inv: Invoice) => {
    db.updateInvoiceEtaStatus(inv.id, 'SUBMITTED');
    refreshData();
    try {
      const result = await etaService.signAndSubmitToETA(inv);
      if (result.status === 'Valid') db.updateInvoiceEtaStatus(inv.id, 'VALID');
      else if (result.status === 'Invalid') db.updateInvoiceEtaStatus(inv.id, 'INVALID');
      refreshData();
      return true;
    } catch (e) {
      // Never claim VALID when ETA integration is unavailable.
      alert(lang === 'ar' ? 'لم يتم الإرسال إلى مصلحة الضرائب: تكامل ETA غير مُعد.' : 'Not submitted to ETA: ETA integration is not configured.');
      refreshData();
      return false;
    }
  };

  const handleFastSync = async () => {
    if (isReadOnly || (!isSignatureConnected && !manualBypass)) {
      alert(lang === 'ar' ? 'يرجى ربط جهاز التوقيع أولاً' : 'Please connect HSM token or enable manual bypass.');
      return;
    }
    if (syncReadyInvoices.length === 0) {
      alert(lang === 'ar' ? 'لا توجد فواتير معلقة للمزامنة' : 'No pending drafts in queue.');
      return;
    }
    setIsSyncingAll(true);
    try {
      for (const inv of syncReadyInvoices) await submitInvoice(inv);
      alert(lang === 'ar' ? 'انتهت محاولة المزامنة. راجع الحالات لكل فاتورة.' : 'Sync attempt finished. Review each invoice status.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleConnectSignature = () => {
    // Browser cannot establish a real USB-token/HSM connection by itself.
    setIsThinking(true);
    setTimeout(() => {
      setIsThinking(false);
      alert(lang === 'ar' ? 'لا يمكن التحقق من جهاز التوقيع من المتصفح. يلزم موصل محلي آمن.' : 'The browser cannot verify the signing token. A secure local connector is required.');
    }, 300);
  };

  const filteredInvoices = useMemo(() => invoices.filter(inv =>
    inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (inv.etaInternalId && inv.etaInternalId.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => b.id.localeCompare(a.id)), [invoices, searchTerm]);

  const stats = useMemo(() => ({
    total: invoices.length,
    valid: invoices.filter(i => i.etaStatus === 'VALID').length,
    draft: invoices.filter(i => i.etaStatus === 'DRAFT').length
  }), [invoices]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 text-start pb-20 transition-colors">
      <div className="bg-white dark:bg-slate-800 p-6 lg:p-8 rounded-[3rem] shadow-2xl border-4 border-blue-50 dark:border-slate-700 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-2xl shadow-inner ${isSignatureConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{isSignatureConnected ? 'HSM' : 'OFF'}</div>
            <div>
              <h2 className="text-2xl font-black text-[#001F3F] dark:text-white uppercase tracking-tighter italic">{lang === 'ar' ? 'بوابة مصلحة الضرائب' : 'ETA Gateway'}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{lang === 'ar' ? 'حالة الاتصال الفعلية' : 'Real integration status'}: {isSignatureConnected ? 'CONNECTED' : 'NOT CONNECTED'}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {!isSignatureConnected && <button onClick={() => setManualBypass(!manualBypass)} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${manualBypass ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>{lang === 'ar' ? 'وضع الاختبار اليدوي' : 'Test Mode'}</button>}
            <button onClick={handleConnectSignature} disabled={isThinking} className="bg-[#001F3F] text-[#C2A378] px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl">{isThinking ? '...' : (lang === 'ar' ? 'التحقق من جهاز التوقيع' : 'Verify Signing Token')}</button>
            <button onClick={handleFastSync} disabled={isSyncingAll || syncReadyInvoices.length === 0 || isReadOnly} className="bg-emerald-600 text-white px-8 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl disabled:opacity-40">{isSyncingAll ? '...' : (lang === 'ar' ? 'محاولة إرسال المسودات' : 'Attempt Draft Submission')}</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[['Ledger Total', stats.total, 'text-slate-600'], ['Cloud Confirmed', stats.valid, 'text-emerald-600'], ['Pending Signature', stats.draft, 'text-amber-600']].map(([label, value, color], i) => <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span><p className={`text-2xl font-black ${color} dark:text-white tracking-tighter italic`}>{value}</p></div>)}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden min-h-[500px]">
        <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50">
          <input type="text" placeholder={lang === 'ar' ? 'بحث برقم الحجز أو العميل...' : 'Search by BK# or Partner...'} className="flex-1 max-w-md px-6 py-3 bg-white dark:bg-slate-900 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-400" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <button onClick={refreshData} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">↻</button>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest"><tr><th className="px-8 py-5">Internal Ref</th><th className="px-8 py-5">ETA Serial</th><th className="px-8 py-5">Partner Account</th><th className="px-8 py-5 text-right">Amount (EGP)</th><th className="px-8 py-5 text-center">Status</th><th className="px-8 py-5 text-center">Action</th></tr></thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-700">{filteredInvoices.map(inv => <tr key={inv.id} className="hover:bg-slate-50/50"><td className="px-8 py-4 font-black text-xs text-slate-400">{inv.id}</td><td className="px-8 py-4 font-mono font-black text-blue-600">{inv.etaInternalId || '---'}</td><td className="px-8 py-4 font-bold text-slate-700 dark:text-slate-300 text-xs">{inv.customerName}</td><td className="px-8 py-4 text-right font-black text-slate-900 dark:text-white">EGP {inv.amount.toLocaleString()}</td><td className="px-8 py-4 text-center"><span className="px-3 py-1 rounded-full text-[8px] font-black uppercase border bg-slate-50 text-slate-500">{inv.etaStatus || 'NOT TAXABLE'}</span></td><td className="px-8 py-4 text-center">{inv.etaStatus === 'DRAFT' && (isSignatureConnected || manualBypass) ? <button onClick={() => submitInvoice(inv)} className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-[9px] font-black uppercase">Sign / Submit</button> : <span className="text-[10px] font-black text-slate-300 uppercase italic">—</span>}</td></tr>)}{filteredInvoices.length === 0 && <tr><td colSpan={6} className="py-20 text-center text-slate-300 font-black uppercase tracking-widest opacity-20">{lang === 'ar' ? 'لا توجد فواتير' : 'No invoice records found'}</td></tr>}</tbody></table></div>
      </div>
    </div>
  );
};
export default ETADashboard;
