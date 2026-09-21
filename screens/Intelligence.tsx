
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { db } from '../services/supabaseDb';
import { LanguageContext, ThemeContext } from '../App';
import { translations } from '../translations';
import { runThinkingAudit, getSafeApiKey } from '../services/aiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

const Intelligence: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'black' || theme === 'midnight';
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const [activeView, setActiveView] = useState<'PORT' | 'UNIT' | 'SUPPLIER' | 'COSTS'>('PORT');
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const [advice, setAdvice] = useState<string>('');
  const [linkError, setLinkError] = useState(false);
  const [apiKeySet, setApiKeySet] = useState(!!getSafeApiKey());

  useEffect(() => {
    const checkStatus = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const has = await window.aistudio.hasSelectedApiKey();
        setApiKeySet(has || !!process.env.API_KEY);
      }
    };
    checkStatus();
  }, []);

  const phases = isAr 
    ? ["مسح قياسات الميناء...", "عزل إشارات التكلفة...", "تحليل سجلات الأسطول...", "توليد الرؤى الاستراتيجية..."]
    : ["SCANNING HUB TELEMETRY...", "ISOLATING COST SIGNALS...", "ANALYZING FLEET LOGS...", "GENERATING STRATEGIC INSIGHTS..."];

  const gasByPort = db.getGasByPort();
  const gasByUnit = db.getGasByGenset();
  const oktan = db.getOktanEstimate();
  const ops = db.getOperations();

  const expenseTotals = useMemo(() => ({
    procurement: db.getProcurements().reduce((s, p) => s + p.amount, 0),
    food: db.getFoodExpenses().reduce((s, f) => s + f.amount, 0),
    transport: db.getTransportExpenses().reduce((s, t) => s + t.amount, 0),
    rent: db.getPortRents().reduce((s, r) => s + r.amount, 0),
    fuel: oktan.balance
  }), [oktan.balance]);

  const runStrategicAdvisor = async () => {
    setIsThinking(true);
    setLinkError(false);
    setAdvice('');
    
    const phaseInterval = setInterval(() => {
      setThinkingPhase(prev => (prev + 1) % phases.length);
    }, 1200);

    try {
      const prompt = `You are the NILE FLEET Command Intel operational and financial auditor. LANGUAGE: ${isAr ? 'ARABIC ONLY' : 'ENGLISH'}. If Arabic is requested, your ENTIRE response must be professional Arabic: translate every heading, label, status, port name, entity name, section title, explanation, finding and recommendation. Do not leave English UI/business prose in the response. Preserve booking numbers, container numbers, genset numbers, dates and numeric values exactly. Never invent or translate codes, identifiers or numeric data. Use ONLY the supplied data. Total operations: ${ops.length}. Active operations: ${ops.filter(o => o.status === 'IN PROGRESS').length}. Expense totals EGP: food=${expenseTotals.food}, transport=${expenseTotals.transport}, procurement=${expenseTotals.procurement}, rent=${expenseTotals.rent}, fuelBalance=${expenseTotals.fuel}. Gas by port: ${JSON.stringify(gasByPort)}. Gas by genset: ${JSON.stringify(gasByUnit)}. Oktan estimate: ${JSON.stringify(oktan)}. Full operations data: ${JSON.stringify(ops)}. Analyze ALL supplied data for anomalies, duplicate active genset assignments, port/stock/fuel/cost issues and practical actions. Clearly separate factual findings from recommendations. If a value is missing, say it is missing rather than guessing.`;

      const result = await runThinkingAudit(prompt);
      setAdvice(result || (isAr ? 'لم يتم العثور على بيانات تشغيلية كافية.' : 'No telemetry data resolved.'));
    } catch (err) {
      setLinkError(true);
      setAdvice(isAr ? 'تعذر الاتصال بمحرك الذكاء الاصطناعي. أعد المحاولة.' : 'NETWORK INTEGRITY COMPROMISED. RE-LINK NODE.');
    } finally {
      clearInterval(phaseInterval);
      setIsThinking(false);
    }
  };

  const NavButton = ({ id, label }: { id: typeof activeView, label: string }) => (
    <button 
      onClick={() => setActiveView(id)}
      className={`relative px-6 py-4 transition-all duration-300 group ${activeView === id ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
    >
      <span className="relative z-10 font-black text-[10px] tracking-widest uppercase">{label}</span>
      {activeView === id && (
        <div className="absolute inset-0 bg-blue-600/20 border-b-2 border-[#C2A378] animate-in fade-in duration-300"></div>
      )}
    </button>
  );

  return (
    <div className={`min-h-screen space-y-8 animate-in fade-in duration-700 pb-32 text-start ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
      
      {/* Cinematic HUD Header */}
      <div className="bg-[#001F3F] p-8 rounded-b-[3rem] border-x border-b border-white/10 shadow-2xl relative overflow-hidden -mt-8 mx-[-2rem]">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
         <div className="flex flex-col lg:flex-row justify-between items-center gap-8 relative z-10">
            <div className="flex items-center gap-6">
               <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-2xl transition-all duration-500 ${apiKeySet ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse'}`}>
                  {apiKeySet ? '🛰️' : '📡'}
               </div>
               <div>
                  <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">ذكاء القيادة</h1>
                  <div className="flex items-center gap-3 mt-2">
                     <span className={`w-1.5 h-1.5 rounded-full ${apiKeySet ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`}></span>
                     <p className="text-[8px] font-black text-blue-400 uppercase tracking-[0.4em]">{isAr ? `اتصال المحرك: ${apiKeySet ? 'مستقر' : 'منقطع'}` : `Node Connectivity: ${apiKeySet ? 'STABLE' : 'LINK LOST'}`}</p>
                  </div>
               </div>
            </div>

            <div className="flex bg-black/40 rounded-2xl border border-white/10 overflow-hidden">
               <NavButton id="PORT" label={isAr ? "الموانئ" : "PORTS"} />
               <NavButton id="UNIT" label={isAr ? "أصول الأسطول" : "FLEET ASSETS"} />
               <NavButton id="SUPPLIER" label={isAr ? "سجل الوقود" : "FUEL LEDGER"} />
               <NavButton id="COSTS" label={isAr ? "العمليات" : "OPERATIONS"} />
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Telemetry Display */}
        <div className="xl:col-span-8 space-y-8">
          {activeView === 'PORT' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(gasByPort).map(([port, fuel]) => (
                <div key={port} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-xl relative group overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5 italic font-black text-6xl select-none group-hover:opacity-10 transition-opacity">{port}</div>
                   <div className="relative z-10">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{isAr ? 'المحطة' : 'Terminal Node'}</p>
                      <h4 className="text-2xl font-black text-[#001F3F] dark:text-white italic tracking-tighter">{port} HUB</h4>
                      <div className="mt-8 space-y-2">
                         <div className="flex justify-between items-end text-[10px] font-black uppercase text-blue-600">
                            <span>{isAr ? 'معدل استهلاك الوقود' : 'Fuel Burn Rate'}</span>
                            <span>{fuel} Liters</span>
                         </div>
                         <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${Math.min(100, (fuel/500)*100)}%` }}></div>
                         </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}

          {activeView === 'UNIT' && (
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-2xl">
               <h3 className="text-xl font-black text-[#001F3F] dark:text-white uppercase italic tracking-tighter mb-8">توزيع تشغيل الأصول</h3>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {gasByUnit.slice(0, 16).map(u => (
                    <div key={u.unit} className="p-4 bg-slate-50 dark:bg-slate-950 border border-transparent hover:border-[#C2A378] rounded-2xl transition-all">
                       <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{u.unit}</p>
                       <p className="text-sm font-black text-blue-600">{u.gas} L</p>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeView === 'SUPPLIER' && (
            <div className="bg-[#001F3F] p-12 rounded-[4rem] text-white relative overflow-hidden border border-white/10 shadow-2xl">
               <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl -mb-40 -mr-40"></div>
               <div className="relative z-10">
                  <h3 className="text-4xl font-black text-[#C2A378] uppercase italic tracking-tighter mb-12">مصفوفة لوجستيات الوقود</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                     <div className="space-y-6">
                        <div className="flex justify-between items-end"><span className="text-[10px] font-black uppercase text-slate-400">رصيد السجل</span><span className="text-2xl font-black">EGP {oktan.balance.toLocaleString()}</span></div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-[#C2A378]" style={{width: '65%'}}></div></div>
                     </div>
                     <div className="space-y-6">
                        <div className="flex justify-between items-end"><span className="text-[10px] font-black uppercase text-slate-400">حد استهلاك الوقود</span><span className="text-2xl font-black">{oktan.daysRemaining} {isAr ? 'دورات' : 'Cycles'}</span></div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: '80%'}}></div></div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeView === 'COSTS' && (
             <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-2xl">
                <h3 className="text-xl font-black text-[#001F3F] dark:text-white uppercase italic tracking-tighter mb-10">توزيع المصروفات</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                   <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie data={[
                               { name: 'Personnel', value: expenseTotals.food, color: '#3b82f6' },
                               { name: 'Transport', value: expenseTotals.transport, color: '#10b981' },
                               { name: 'Infrastructure', value: expenseTotals.rent, color: '#f59e0b' }
                            ]} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={10} dataKey="value">
                               {(entry, idx) => <Cell key={idx} fill={(entry as any).color} stroke="none" />}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '20px', background: '#001F3F', border: 'none', color: '#fff' }} />
                         </PieChart>
                      </ResponsiveContainer>
                   </div>
                   <div className="space-y-4">
                      {[
                        { label: 'بدلات الموظفين', value: expenseTotals.food, color: 'bg-blue-500' },
                        { label: 'أسطول النقل', value: expenseTotals.transport, color: 'bg-emerald-500' },
                        { label: 'دخول الميناء', value: expenseTotals.rent, color: 'bg-amber-500' }
                      ].map(item => (
                        <div key={item.label} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl">
                           <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                              <span className="text-[10px] font-black uppercase text-slate-500">{item.label}</span>
                           </div>
                           <span className="font-black text-xs">EGP {item.value.toLocaleString()}</span>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          )}
        </div>

        {/* Tactical AI Advisor Panel */}
        <div className="xl:col-span-4">
           <div className="bg-[#001F3F] rounded-[3.5rem] p-8 shadow-2xl border border-white/5 overflow-hidden sticky top-24 min-h-[600px] flex flex-col">
              <div className="flex items-center gap-4 mb-8">
                 <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-blue-500/20">🧠</div>
                 <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-white italic">المستشار الذكي</h4>
                    <p className="text-[7px] font-black text-blue-400 uppercase tracking-[0.4em]">محرك التحليل التشغيلي</p>
                 </div>
              </div>

              <div className="flex-1 bg-black/40 rounded-3xl p-6 border border-white/5 overflow-y-auto custom-scrollbar relative">
                 {isThinking ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-6">
                       <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                       <div>
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-2">{phases[thinkingPhase]}</p>
                          <p className="text-[8px] font-bold text-slate-600 uppercase">جاري مزامنة سجل الأسطول...</p>
                       </div>
                    </div>
                 ) : linkError ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 animate-in zoom-in-95">
                       <span className="text-4xl grayscale">📡</span>
                       <h5 className="text-rose-600 font-black uppercase tracking-tighter">فشل اتصال المحرك</h5>
                       <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed px-6">{advice}</p>
                       <button onClick={runStrategicAdvisor} className="mt-4 px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-white hover:bg-white/10">إعادة المحاولة</button>
                    </div>
                 ) : advice ? (
                    <div className="prose prose-sm dark:prose-invert text-[11px] font-bold leading-relaxed text-slate-300 font-mono whitespace-pre-wrap animate-in fade-in">
                       {advice}
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-20 py-20 grayscale">
                       <span className="text-6xl mb-6">🛰️</span>
                       <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white">مراقبة النظام نشطة</p>
                    </div>
                 )}
              </div>

              <div className="mt-8 space-y-4">
                 {!apiKeySet ? (
                    <button 
                       onClick={async () => { if (window.aistudio?.openSelectKey) await window.aistudio.openSelectKey(); setApiKeySet(true); }}
                       className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-2xl font-black uppercase text-[10px] tracking-[0.4em] shadow-xl transition-all"
                    >
                       تشغيل محرك الذكاء الاصطناعي
                    </button>
                 ) : (
                    <button 
                       onClick={runStrategicAdvisor}
                       disabled={isThinking}
                       className="w-full bg-white text-[#001F3F] py-6 rounded-2xl font-black uppercase text-[10px] tracking-[0.4em] shadow-xl hover:bg-slate-100 disabled:opacity-30 transition-all group"
                    >
                       <span className="group-hover:scale-105 transition-transform block">طلب تدقيق تشغيلي</span>
                    </button>
                 )}
                 <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                    <span className="text-[8px] font-black text-slate-500 uppercase">محرك الذكاء الاصطناعي</span>
                    <span className="text-[9px] font-black text-blue-500 italic uppercase">NILE AI — Llama</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Intelligence;
