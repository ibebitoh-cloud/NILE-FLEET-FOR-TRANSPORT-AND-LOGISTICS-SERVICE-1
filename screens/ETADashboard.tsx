
import React, { useState, useMemo, useContext } from 'react';
import { db } from '../services/mockDb';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';
import { Invoice, User, UserRole } from '../types';
import { etaService } from '../services/etaService';

const ETADashboard: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  // Fix: Check for 'black' theme as the dark variant
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

  const refreshData = () => {
    setInvoices([...db.getInvoices()]);
  };

  const pendingInvoices = useMemo(() => invoices.filter(i => i.etaStatus === 'DRAFT' || i.etaInternalId), [invoices]);
  const syncReadyInvoices = useMemo(() => invoices.filter(i => i.etaStatus === 'DRAFT'), [invoices]);

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
      for (const inv of syncReadyInvoices) {
        db.updateInvoiceEtaStatus(inv.id, 'SUBMITTED');
        refreshData();
        // Simulate ETA API call
        await etaService.signAndSubmitToETA(inv);
        db.updateInvoiceEtaStatus(inv.id, 'VALID');
        refreshData();
      }
      alert(lang === 'ar' ? 'تمت المزامنة بنجاح' : 'Success! Cloud synchronization complete.');
    } catch (e) {
      alert(lang === 'ar' ? 'حدث خطأ في المزامنة' : 'Sync process interrupted. Check internet integrity.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleConnectSignature = () => {
    setIsThinking(true);
    // Simulate ePass2003 Handshake
    setTimeout(() => {
      setIsSignatureConnected(true);
      setIsThinking(false);
      setManualBypass(false);
    }, 1200);
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => 
      inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.etaInternalId && inv.etaInternalId.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => b.id.localeCompare(a.id));
  }, [invoices, searchTerm]);

  const stats = useMemo(() => {
    const total = invoices.length;
    const valid = invoices.filter(i => i.etaStatus === 'VALID').length;
    const draft = invoices.filter(i => i.etaStatus === 'DRAFT').length;
    return { total, valid, draft };
  }, [invoices]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 text-start pb-20 transition-colors">
      
      {/* HARDWARE INTERFACE BAR */}
      <div className="bg-white dark:bg-slate-800 p-6 lg:p-8 rounded-[3rem] shadow-2xl border-4 border-blue-50 dark:border-slate-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
           <span className="text-8xl font-black italic select-none">EPASS</span>
        </div>
        
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-inner transition-all duration-500 ${isSignatureConnected ? 'bg-emerald-100 text-emerald-600 scale-110' : 'bg-slate-100 text-slate-400'}`}>
              {isSignatureConnected ? 'HSM' : 'OFF'}
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#001F3F] dark:text-white uppercase tracking-tighter italic">ETA Cloud Link</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Security Node: {isSignatureConnected ? 'ENCRYPTED' : (manualBypass ? 'MANUAL OVERRIDE' : 'DISCONNECTED')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {!isSignatureConnected && (
              <button 
                onClick={() => setManualBypass(!manualBypass)}
                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase border-2 transition-all ${manualBypass ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
              >
                {lang === 'ar' ? 'تجاوز الهاردوير' : 'Bypass Hardware'}
              </button>
            )}

            {!isSignatureConnected ? (
              <button 
                onClick={handleConnectSignature}
                disabled={isThinking}
                className="bg-[#001F3F] text-[#C2A378] px-10 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-3"
              >
                {isThinking ? (
                  <div className="w-4 h-4 border-2 border-[#C2A378]/20 border-t-[#C2A378] rounded-full animate-spin"></div>
                ) : 'Detect ePass2003 Token'}
              </button>
            ) : (
              <>
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl">
                  <button onClick={() => setViewMode('LOCAL')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${viewMode === 'LOCAL' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Local Queue</button>
                  <button onClick={() => setViewMode('CLOUD')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${viewMode === 'CLOUD' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>ETA Feed</button>
                </div>
                <button 
                  onClick={handleFastSync}
                  disabled={isSyncingAll || syncReadyInvoices.length === 0}
                  className="bg-emerald-600 text-white px-8 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl hover:bg-emerald-700 active:scale-95 transition-all flex items-center gap-4"
                >
                  {isSyncingAll ? (
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  ) : 'Sign & Sync All'}
                </button>
              </>
            )}

            {manualBypass && !isSignatureConnected && (
              <button 
                onClick={handleFastSync}
                disabled={isSyncingAll || syncReadyInvoices.length === 0}
                className="bg-blue-600 text-white px-8 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl"
              >
                Manual Sync
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ledger Total', value: stats.total, color: 'text-slate-600', code: '[T]' },
          { label: 'Cloud Confirmed', value: stats.valid, color: 'text-emerald-600', code: '[V]' },
          { label: 'Pending Signature', value: stats.draft, color: 'text-amber-600', code: '[D]' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                <span className="text-[10px] font-black opacity-40">{s.code}</span>
            </div>
            <p className={`text-2xl font-black ${s.color} dark:text-white tracking-tighter italic`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden min-h-[500px]">
        <div className="p-4 border-b border-slate-50 dark:border-slate-700 flex justify-between items-center bg-slate-50/50">
          <input 
              type="text" 
              placeholder="Search by BK# or Partner..." 
              className="flex-1 max-w-md px-6 py-3 bg-white dark:bg-slate-900 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-400"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={refreshData} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-8 py-5">Internal Ref</th>
                <th className="px-8 py-5">ETA Serial</th>
                <th className="px-8 py-5">Partner Account</th>
                <th className="px-8 py-5 text-right">Amount (EGP)</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {filteredInvoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4 font-black text-xs uppercase text-slate-400">{inv.id}</td>
                  <td className="px-8 py-4">
                    <span className="bg-blue-50 dark:bg-slate-900 px-3 py-1 rounded-lg font-black text-blue-600 dark:text-blue-400 font-mono text-[11px] border border-blue-100">{inv.etaInternalId || '---'}</span>
                  </td>
                  <td className="px-8 py-4 font-bold uppercase text-slate-700 dark:text-slate-300 text-xs">{inv.customerName}</td>
                  <td className="px-8 py-4 text-right font-black text-slate-900 dark:text-white">EGP {inv.amount.toLocaleString()}</td>
                  <td className="px-8 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                      inv.etaStatus === 'VALID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      inv.etaStatus === 'SUBMITTED' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {inv.etaStatus || 'NOT TAXABLE'}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-center">
                    {inv.etaStatus === 'DRAFT' && (isSignatureConnected || manualBypass) ? (
                      <button 
                        onClick={() => {
                          db.updateInvoiceEtaStatus(inv.id, 'SUBMITTED');
                          refreshData();
                          etaService.signAndSubmitToETA(inv).then(() => {
                            db.updateInvoiceEtaStatus(inv.id, 'VALID');
                            refreshData();
                          });
                        }} 
                        className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-[9px] font-black uppercase hover:bg-blue-700"
                      >
                        Sign
                      </button>
                    ) : (
                      <span className="text-[10px] font-black text-slate-300 uppercase italic">Archived</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-300 font-black uppercase tracking-widest opacity-20">No invoice records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ETADashboard;