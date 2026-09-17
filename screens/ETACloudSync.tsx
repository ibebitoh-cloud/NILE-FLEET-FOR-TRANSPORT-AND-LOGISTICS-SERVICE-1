


import React, { useState, useContext, useEffect, useMemo } from 'react';
import { db } from '../services/supabaseDb';
import { User, UserRole } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';

const ETACloudSync: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  // Fix: Derive isDark by checking for 'black' theme, as 'dark' is not a valid ThemeMode.
  const isDark = theme === 'black';
  const t = translations[lang];
  const isAr = lang === 'ar';

  const [tokenStatus, setTokenStatus] = useState<'DISCONNECTED' | 'SEARCHING' | 'CONNECTED'>(
    (localStorage.getItem('NF_HSM_STATUS') as any) || 'DISCONNECTED'
  );
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [customers, setCustomers] = useState<User[]>([]);

  // Load local customers
  useEffect(() => {
    setCustomers(db.getUsers().filter(u => u.role === UserRole.CUSTOMER));
  }, []);

  // Update Global HSM State
  useEffect(() => {
    localStorage.setItem('NF_HSM_STATUS', tokenStatus);
  }, [tokenStatus]);

  const handleConnectHSM = () => {
    setTokenStatus('SEARCHING');
    setTimeout(() => setTokenStatus('CONNECTED'), 1500);
  };

  const handleBatchSync = async () => {
    if (tokenStatus !== 'CONNECTED') return;
    setIsSyncing(true);
    setSyncProgress(0);

    const pending = customers.filter(c => !c.isEtaVerified);
    const total = pending.length;

    if (total === 0) {
      alert(isAr ? 'جميع العملاء تمت مزامنتهم بالفعل' : 'All customers are already verified.');
      setIsSyncing(false);
      return;
    }

    for (let i = 0; i < total; i++) {
      const cust = pending[i];
      // Simulated cloud handshake per customer
      await new Promise(r => setTimeout(r, 400));
      db.updateUser(cust.id, { isEtaVerified: true });
      setSyncProgress(Math.round(((i + 1) / total) * 100));
    }

    setCustomers(db.getUsers().filter(u => u.role === UserRole.CUSTOMER));
    setIsSyncing(false);
    alert(isAr ? 'اكتملت مزامنة البيانات السحابية' : 'Cloud data synchronization complete.');
  };

  const stats = useMemo(() => {
    const total = customers.length;
    const verified = customers.filter(c => c.isEtaVerified).length;
    const pending = total - verified;
    return { total, verified, pending };
  }, [customers]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 text-start pb-24">
      
      {/* Synchronization Control Header */}
      <div className="bg-[#001F3F] rounded-[3rem] p-10 lg:p-16 text-white relative overflow-hidden shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-12">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-6">
               <div className={`w-3 h-3 rounded-full ${tokenStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-50'}`}></div>
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-300">
                 {isAr ? 'حالة التوقيع الإلكتروني' : 'HSM SECURITY STATUS'}
               </span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-black italic tracking-tighter mb-4 uppercase">
              {isAr ? 'مزامنة سحابة الضرائب' : 'ETA Cloud Link'}
            </h2>
            <p className="text-slate-300 font-medium text-sm lg:text-base max-w-2xl leading-relaxed">
              {isAr 
                ? 'قم بربط بيانات عملائك المحليين مع السجل الرسمي لمصلحة الضرائب المصرية باستخدام التوقيع الإلكتروني الخاص بك.' 
                : 'Bridge your local partner data with the official Egyptian Tax Authority registry using your hardware security module.'}
            </p>
          </div>
          
          <div className="shrink-0 flex flex-col gap-4">
            {tokenStatus !== 'CONNECTED' ? (
              <button 
                onClick={handleConnectHSM}
                className="bg-[#C2A378] text-[#001F3F] px-12 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 transition-all"
              >
                {tokenStatus === 'SEARCHING' ? (isAr ? 'جاري البحث...' : 'Scanning Hardware...') : (isAr ? 'ربط جهاز التوقيع' : 'Connect HSM Token')}
              </button>
            ) : (
              <button 
                onClick={handleBatchSync}
                disabled={isSyncing}
                className="bg-emerald-500 text-white px-12 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-600 transition-all flex items-center gap-4"
              >
                {isSyncing && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>}
                {isAr ? 'بدء المزامنة الشاملة' : 'Force Global Sync'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isAr ? 'إجمالي العملاء' : 'Total Partners'}</p>
          <p className="text-3xl font-black text-[#001F3F]">{stats.total}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isAr ? 'موثق في الضرائب' : 'ETA Verified'}</p>
          <p className="text-3xl font-black text-emerald-600">{stats.verified}</p>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{isAr ? 'بانتظار الربط' : 'Pending Link'}</p>
          <p className="text-3xl font-black text-rose-500">{stats.pending}</p>
        </div>
      </div>

      {isSyncing && (
        <div className="bg-white p-10 rounded-[3rem] border-2 border-blue-500 shadow-2xl animate-in zoom-in-95">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black uppercase italic text-blue-600">{isAr ? 'جاري تحديث السجل السحابي...' : 'Updating Cloud Registry...'}</h3>
              <span className="font-black text-blue-600">{syncProgress}%</span>
           </div>
           <div className="w-full bg-blue-50 h-4 rounded-full overflow-hidden border border-blue-100">
              <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${syncProgress}%` }}></div>
           </div>
           <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">
             {isAr ? 'لا تقم بفصل جهاز التوقيع أثناء العملية' : 'Do not disconnect hardware during encryption phase'}
           </p>
        </div>
      )}

      {/* Migration Grid */}
      <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
           <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{isAr ? 'سجل مطابقة البيانات' : 'Data Integrity Matrix'}</h3>
           {tokenStatus === 'CONNECTED' && (
             <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase">Secure Channel Open</span>
           )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#001F3F] text-white text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-10 py-6">{isAr ? 'الشريك' : 'ERP Identity'}</th>
                <th className="px-10 py-6">{isAr ? 'الرقم الضريبي' : 'Tax ID (RIN)'}</th>
                <th className="px-10 py-6">{isAr ? 'العنوان' : 'Registered Address'}</th>
                <th className="px-10 py-6 text-center">{isAr ? 'الحالة' : 'Link Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[11px]">
              {customers.map(cust => (
                <tr key={cust.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-10 py-6">
                    <p className="font-black text-slate-800 uppercase">{cust.companyName || cust.name}</p>
                    <p className="text-[9px] font-bold text-slate-400">{cust.email}</p>
                  </td>
                  <td className="px-10 py-6 font-mono font-black text-blue-600 tracking-widest">
                    {cust.taxpayerId || '---'}
                  </td>
                  <td className="px-10 py-6">
                    <p className="text-slate-500 font-medium uppercase italic max-w-xs truncate">{cust.addressLine || (isAr ? 'لم يتم إدخال عنوان' : 'No address provided')}</p>
                  </td>
                  <td className="px-10 py-6 text-center">
                    {cust.isEtaVerified ? (
                      <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-xl font-black text-[9px] uppercase border border-emerald-100 flex items-center justify-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                        {isAr ? 'تم التحقق' : 'VERIFIED'}
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-400 px-4 py-1.5 rounded-xl font-black text-[9px] uppercase border border-slate-200">
                        {isAr ? 'غير مرتبط' : 'UNLINKED'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ETACloudSync;
