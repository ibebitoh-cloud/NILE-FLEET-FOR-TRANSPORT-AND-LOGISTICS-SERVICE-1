
import React, { useMemo, useContext } from 'react';
import { db } from '../services/supabaseDb';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { Location } from '../types';
import { LanguageContext } from '../App';
import { translations } from '../translations';

const Analytics: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const t = translations[lang];
  const stock = db.getStock();
  const operations = db.getOperations();
  const invoices = db.getInvoices();

  const COLORS = ['#001F3F', '#C2A378', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'];

  const metrics = useMemo(() => {
    const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const activeUnits = operations.filter(o => o.status === 'IN PROGRESS').length;
    const utilizationRate = stock.length > 0 ? (activeUnits / stock.length) * 100 : 0;
    const avgRate = totalRevenue / (invoices.length || 1);

    return { totalRevenue, utilizationRate, activeUnits, avgRate };
  }, [stock, operations, invoices]);

  const unitPerformanceData = useMemo(() => {
    return stock.map(unit => {
      const unitOps = operations.filter(o => o.gensetNumber === unit.unitNumber || unit.unitNumber.includes(o.gensetNumber));
      const rev = unitOps.reduce((sum, op) => sum + (parseFloat(op.rate.replace(/,/g, '')) || 0), 0);
      const trips = unitOps.length;
      const days = trips * 4.5;
      const baseHealth = 100;
      const trips_degradation = trips * 1.5;
      const health = Math.max(40, baseHealth - trips_degradation);
      const totalFuel = unitOps.reduce((sum, op) => sum + (parseFloat(String(op.gaz || '0').replace(/,/g, '')) || 0), 0);
      const fuelEfficiency = trips > 0 ? totalFuel / trips : 0;
      const maintenanceDays = Math.max(0, 30 - (trips % 5) * 6);

      return {
        unit: unit.unitNumber,
        revenue: rev,
        days: Math.round(days),
        health: Math.round(health),
        trips: trips,
        lastPort: unit.location,
        fuel: fuelEfficiency.toFixed(1),
        maintenanceDays: maintenanceDays
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [stock, operations]);

  const topPerformer = unitPerformanceData[0];
  const rentalTrends = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    return days.map(d => {
      const key = d.toISOString().slice(0, 10);
      const dayOps = operations.filter(o => o.operationDate === key);
      const revenue = dayOps.reduce((sum, o) => sum + (parseFloat(String(o.rate).replace(/,/g, '')) || 0) + (parseFloat(String(o.vat).replace(/,/g, '')) || 0), 0);
      return { day: d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'short' }), revenue, volume: dayOps.length };
    });
  }, [operations, lang]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 text-start transition-colors duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#001F3F] uppercase tracking-tighter">
            {lang === 'ar' ? 'ذكاء الأسطول التشغيلي' : 'Fleet Intelligence Dashboard'}
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
            {lang === 'ar' ? 'تحليل الأداء التقني والمالي المعمق' : 'Deep-dive technical & financial performance analytics'}
          </p>
        </div>
        <div className="flex gap-2">
           <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                {lang === 'ar' ? 'تحديث البيانات: فوري' : 'Data Refresh: Real-time'}
              </span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-50 group-hover:bg-blue-100 rounded-full transition-colors duration-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{lang === 'ar' ? 'استخدام الأسطول' : 'Utilization'}</p>
          <h4 className="text-3xl font-black text-blue-600 relative z-10">{metrics.utilizationRate.toFixed(1)}%</h4>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden relative z-10">
            <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${metrics.utilizationRate}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 group-hover:bg-slate-100 rounded-full transition-colors duration-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{t.revenue}</p>
          <h4 className="text-3xl font-black text-[#001F3F] relative z-10">EGP {metrics.totalRevenue.toLocaleString()}</h4>
          <p className="text-[8px] font-bold text-slate-400 mt-2">{lang === 'ar' ? 'حسب الفواتير المسجلة' : 'Based on recorded invoices'}</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-50 group-hover:bg-emerald-100 rounded-full transition-colors duration-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{lang === 'ar' ? 'التأجيرات النشطة' : 'Active Units'}</p>
          <h4 className="text-3xl font-black text-emerald-600 relative z-10">{metrics.activeUnits}</h4>
          <p className="text-[8px] font-bold text-slate-400 mt-2">Currently on-trip</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-50 group-hover:bg-amber-100 rounded-full transition-colors duration-500"></div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{lang === 'ar' ? 'قيمة الرحلة' : 'Avg Trip Value'}</p>
          <h4 className="text-3xl font-black text-[#C2A378] relative z-10">EGP {metrics.avgRate.toFixed(0)}</h4>
          <p className="text-[8px] font-bold text-slate-400 mt-2">Per booking unit</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-[#001F3F] uppercase tracking-tight text-xl flex items-center gap-3">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">📊</span>
              {lang === 'ar' ? 'تحليل أداء الوحدات' : 'Detailed Unit Performance'}
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right whitespace-nowrap">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-4 px-2">{t.unit}</th>
                  <th className="pb-4 px-2 text-center">{lang === 'ar' ? 'الموقع' : 'Hub'}</th>
                  <th className="pb-4 px-2 text-center">{lang === 'ar' ? 'الرحلات' : 'Trips'}</th>
                  <th className="pb-4 px-2 text-center">{lang === 'ar' ? 'وقود/رحلة' : 'Fuel / Trip'}</th>
                  <th className="pb-4 px-2 text-center">{t.healthScore}</th>
                  <th className="pb-4 px-2 text-center">{lang === 'ar' ? 'الصيانة' : 'Service In'}</th>
                  <th className="pb-4 px-2 text-right">{t.revenue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {unitPerformanceData.slice(0, 10).map((data, idx) => (
                  <tr key={idx} className="group hover:bg-slate-50/50 transition-all duration-200">
                    <td className="py-4 px-2">
                      <div className="flex flex-col">
                        <span className="font-black text-[#001F3F] text-xs">{data.unit}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">SN: {data.unit.split('-').pop()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-center">
                       <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{data.lastPort}</span>
                    </td>
                    <td className="py-4 px-2 text-center font-bold text-slate-700 text-xs">{data.trips}</td>
                    <td className="py-4 px-2 text-center">
                       <span className={`text-[10px] font-bold ${parseFloat(data.fuel) > 2.6 ? 'text-amber-600' : 'text-emerald-600'}`}>{data.fuel}</span>
                    </td>
                    <td className="py-4 px-2">
                      <div className="flex items-center justify-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-700 ${data.health > 85 ? 'bg-emerald-500' : data.health > 70 ? 'bg-blue-500' : data.health > 55 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                            style={{ width: `${data.health}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-black text-slate-500">{data.health}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-center">
                       <span className={`text-[9px] font-black uppercase ${data.maintenanceDays < 7 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}>
                         {data.maintenanceDays}d
                       </span>
                    </td>
                    <td className="py-4 px-2 text-right font-black text-slate-900 text-xs">EGP {data.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <div className="bg-[#001F3F] p-8 rounded-[2.5rem] shadow-xl text-white relative overflow-hidden flex flex-col justify-between h-full">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
            <div>
              <div className="flex items-center gap-2 mb-8">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5z"/></svg>
                </div>
                <h3 className="font-black uppercase tracking-widest text-xs">{lang === 'ar' ? 'تحليلات الوحدة النخبة' : 'Top Asset Spotlight'}</h3>
              </div>
              {topPerformer && (
                <div className="space-y-6">
                  <div className="flex justify-between items-end border-b border-blue-800/50 pb-4">
                    <div>
                      <h4 className="text-3xl font-black italic tracking-tighter text-[#C2A378]">{topPerformer.unit}</h4>
                      <p className="text-[9px] font-bold text-blue-300 uppercase tracking-widest mt-1">{lang === 'ar' ? 'أعلى أصل حسب الإيراد المسجل' : 'Top asset by recorded revenue'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-900/30 p-4 rounded-2xl border border-blue-800/50">
                       <p className="text-[8px] font-black text-blue-300 uppercase mb-1">{lang === 'ar' ? 'إجمالي الرحلات' : 'Recorded Trips'}</p>
                       <p className="text-lg font-black">{topPerformer.trips}</p>
                    </div>
                    <div className="bg-blue-900/30 p-4 rounded-2xl border border-blue-800/50">
                       <p className="text-[8px] font-black text-blue-300 uppercase mb-1">{lang === 'ar' ? 'وقود/رحلة' : 'Fuel / Trip'}</p>
                       <p className="text-lg font-black">{topPerformer.fuel}L</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => window.print()} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all mt-6 shadow-lg shadow-blue-900/20">
               Generate Full Fleet PDF
            </button>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex-1">
             <h3 className="font-black text-[#001F3F] uppercase tracking-tight mb-4 text-xs">{lang === 'ar' ? 'أداء الموانئ' : 'Port Performance Index'}</h3>
             <div className="h-48">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                      data={Object.values(Location).map((loc, i) => ({ 
                        name: loc, 
                        value: stock.filter(s => s.location === loc).length 
                      }))}
                      innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value"
                    >
                      {Object.values(Location).map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '10px', backgroundColor: '#fff', border: 'none', color: '#000' }} />
                 </PieChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="font-black text-[#001F3F] uppercase tracking-tight mb-8">{lang === 'ar' ? 'تحليل تدفق الإيرادات' : 'Revenue Stream Analysis'}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rentalTrends}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#fff', color: '#000' }} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
           <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-[#001F3F] uppercase tracking-tight">{lang === 'ar' ? 'اتجاهات الطلب' : 'Deployment Volume Trends'}</h3>
           </div>
           <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={rentalTrends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#fff', color: '#000' }} />
                  <Bar dataKey="volume" fill="#001F3F" radius={[4, 4, 0, 0]} barSize={24} />
               </BarChart>
            </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
