
import React, { useContext, useMemo, useEffect, useState } from 'react';
import { db } from '../services/supabaseDb';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Location, GensetStatus, UserRole, User } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';

interface DashboardProps {
  onNavigate: (screen: string, id?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { lang } = useContext(LanguageContext);
  const { theme, isDark } = useContext(ThemeContext);
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
  const customers = db.getUsers().filter(u => u.role === UserRole.CUSTOMER);

  const todayStr = new Date().toISOString().slice(0, 10);
  const stats = [
    { label: t.totalUnits, value: stock.length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-white dark:bg-slate-800', target: 'stock' },
    { label: t.clippedOut, value: ops.filter(o => o.status === 'IN PROGRESS').length, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-white dark:bg-slate-800', target: 'operations' },
    { label: t.freeUnits, value: stock.filter(s => s.status === GensetStatus.IN_STOCK).length, color: 'text-[#C2A378]', bg: 'bg-white dark:bg-slate-800', target: 'stock' },
    { label: t.neededToday, value: ops.filter(o => o.status === 'UNDER OPERATE' && (o.operationDate === todayStr || o.clipOnDate === todayStr)).length, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-white dark:bg-slate-800', target: 'operations' },
  ];

  const locationData = Object.values(Location).map(loc => {
    const inStock = stock.filter(s => s.location === loc && s.status === GensetStatus.IN_STOCK).length;
    const inWork = ops.filter(o => o.clipOnPort === loc && o.status === 'IN PROGRESS').length;
    const preorders = ops.filter(o => o.clipOnPort === loc && o.status === 'UNDER OPERATE');
    return { name: loc, inStock, inWork, needed: preorders.length, preorders };
  });

  const customerFinancials = useMemo(() => {
    return customers.map(cust => {
      const custName = cust.companyName || cust.name;
      const custOps = ops.filter(o => o.customerName === custName);
      const custInvoices = invoices.filter(i => i.customerName === custName);
      const totalBilled = custInvoices.reduce((a, b) => a + b.amount, 0);
      const totalPaid = custInvoices.filter(i => i.status === 'PAID').reduce((a, b) => a + b.amount, 0);
      const outstanding = totalBilled - totalPaid;
      return { id: cust.id, name: custName, opCount: custOps.length, outstanding, totalPaid };
    }).sort((a, b) => b.outstanding - a.outstanding);
  }, [customers, ops, invoices]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-500 pb-28 lg:pb-12 text-start transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-xl border-4 border-blue-50 dark:border-slate-700 relative overflow-hidden transition-colors duration-300">
        {isReadOnly && <div className="absolute top-0 left-0 bg-blue-600 text-white text-[8px] font-black px-4 py-1 rounded-br-2xl uppercase tracking-widest z-20 shadow-lg animate-pulse">Surveillance Mode Active</div>}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 md:mb-10 relative z-10">
          <div>
            <h3 className="text-xl md:text-3xl font-black text-[#001F3F] dark:text-white uppercase tracking-tighter italic">Port Activity Hub</h3>
            <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.3em] mt-1">Live Multi-Terminal Fleet Command</p>
          </div>
          <button onClick={() => onNavigate('port-gate')} className="bg-[#001F3F] dark:bg-slate-700 text-[#C2A378] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all w-full sm:w-auto">
            {isReadOnly ? 'View Gate Control' : 'Access Gate Control'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 relative z-10">
          {locationData.map((port) => (
            <div key={port.name} onClick={() => onNavigate('operations', port.name)} className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] p-5 border-2 border-transparent hover:border-blue-400 dark:hover:border-blue-500 hover:bg-white dark:hover:bg-slate-800 hover:shadow-2xl transition-all cursor-pointer group flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                <span className="bg-slate-900 dark:bg-slate-700 text-white px-3 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase italic">{translateEntity(port.name, lang)}</span>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              </div>
              <div className="space-y-4 mb-4">
                <div className="flex justify-between items-baseline"><span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">{t.live}</span><span className="font-black text-emerald-600 dark:text-emerald-400 text-xl tracking-tighter">{port.inWork}</span></div>
                <div className="flex justify-between items-baseline"><span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">Preorder</span><span className="font-black text-amber-600 dark:text-amber-400 text-xl tracking-tighter">{port.needed}</span></div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center"><span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase">{t.freeUnits}</span><span className="font-black text-blue-700 dark:text-blue-400 text-base italic">{port.inStock}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {stats.map((stat, i) => (
          <button key={i} onClick={() => onNavigate(stat.target)} className={`${stat.bg} p-4 md:p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-xl active:scale-95 group relative overflow-hidden text-start`}>
            <p className="text-slate-400 dark:text-slate-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-1 truncate">{stat.label}</p>
            <p className={`text-2xl md:text-4xl font-black ${stat.color} tracking-tighter italic`}>{stat.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="px-6 py-6 sm:px-8 border-b border-slate-50 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/30 dark:bg-slate-900/10">
            <div><h3 className="font-black text-[#001F3F] dark:text-white uppercase tracking-tight text-xl italic">Partner Liquidity Hub</h3><p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Global Outstanding vs Realized Revenue</p></div>
            <button onClick={() => onNavigate('financials')} className="bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 px-5 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest border border-blue-100 dark:border-slate-600 w-full sm:w-auto">{isReadOnly ? 'Financial Ledger' : 'Manage Financials'}</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/80 dark:bg-slate-900/30 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b dark:border-slate-700">
                <tr><th className="px-6 sm:px-8 py-4">Account Partner</th><th className="px-6 sm:px-8 py-4 text-center">Ops</th><th className="px-6 sm:px-8 py-4 text-right">Settled (EGP)</th><th className="px-6 sm:px-8 py-4 text-right">Outstanding (EGP)</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {customerFinancials.slice(0, 6).map(cust => (
                  <tr key={cust.id} onClick={() => onNavigate('customers')} className="group hover:bg-blue-50/50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors">
                    <td className="px-6 sm:px-8 py-5"><p className="font-black text-[#001F3F] dark:text-slate-200 text-xs uppercase italic group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate max-w-[100px] sm:max-w-none">{cust.name}</p></td>
                    <td className="px-6 sm:px-8 py-5 text-center"><span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px] font-black text-slate-500 dark:text-slate-400">{cust.opCount}</span></td>
                    <td className="px-6 sm:px-8 py-5 text-right font-bold text-emerald-600 dark:text-emerald-400 text-xs">{cust.totalPaid.toLocaleString()}</td>
                    <td className="px-6 sm:px-8 py-5 text-right"><span className={`font-black text-sm ${cust.outstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-300 dark:text-slate-600'}`}>{cust.outstanding.toLocaleString()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Dashboard Signature Footer */}
          <div className="mt-auto p-6 sm:p-8 border-t border-slate-50 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-900/20">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#001F3F] rounded-lg flex items-center justify-center text-[#C2A378] text-xs font-black">B</div>
                <div>
                   <p className="text-[10px] font-black text-[#001F3F] dark:text-white uppercase tracking-widest leading-none">SYSTEM BY BEBITO</p>
                   <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Mohamed A-Alawy | +20 114 647 5759</p>
                </div>
             </div>
             <button onClick={() => onNavigate('intelligence')} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-50 transition-colors w-full sm:w-auto">AI Intelligence</button>
          </div>
        </div>

        <div className="bg-[#001F3F] dark:bg-slate-950 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter mb-1 italic text-[#C2A378]">Fleet Pulse</h3>
            <p className="text-[10px] text-blue-300 dark:text-blue-500 font-bold uppercase tracking-widest mb-6">Real-time Asset Saturation</p>
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: t.freeUnits, value: stock.filter(s => s.status === GensetStatus.IN_STOCK).length }, { name: t.live, value: ops.filter(o => o.status === 'IN PROGRESS').length }, { name: t.needed, value: ops.filter(o => o.status === 'UNDER OPERATE').length }]} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={8} dataKey="value" stroke="none">
                    {COLORS.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', background: isDark ? '#1e293b' : '#fff', fontSize: '10px', color: isDark ? '#fff' : '#000' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-3 mt-8">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> <span>Ready Stock</span></div><span className="text-blue-400">{stock.filter(s => s.status === GensetStatus.IN_STOCK).length} Units</span></div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> <span>Generating</span></div><span className="text-emerald-400">{ops.filter(o => o.status === 'IN PROGRESS').length} Units</span></div>
          </div>
          <div className="mt-8 py-4 bg-[#C2A378] rounded-2xl flex flex-col items-center justify-center text-center">
             <p className="text-[10px] font-black text-[#001F3F] uppercase tracking-[0.4em] leading-none">POWERED BY BEBITO</p>
             <p className="text-[8px] font-black text-[#001F3F] uppercase tracking-widest opacity-60 mt-1">Mohamed A-Alawy | +20 114 647 5759</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
