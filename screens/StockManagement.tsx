
import React, { useState, useMemo, useContext } from 'react';
import { db } from '../services/mockDb';
import { Location, GensetStatus, Genset, User, UserRole } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity } from '../translations';
import { PORT_STYLING } from '../constants';

const StockManagement: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'black';
  const t = translations[lang];
  const isAr = lang === 'ar';

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = currentUser.role === UserRole.VIEWER;
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStat, setFilterStat] = useState<string>('ALL');
  const [filterLoc, setFilterLoc] = useState<string>('ALL');
  const [editingGenset, setEditingGenset] = useState<Genset | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [newGenset, setNewGenset] = useState({
    unitNumber: '',
    location: Location.ALEX,
    status: GensetStatus.IN_STOCK
  });

  const stock = db.getStock();
  const ops = db.getOperations();

  const filteredStock = useMemo(() => {
    return stock.filter(s => {
      const matchesSearch = s.unitNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStat = filterStat === 'ALL' || s.status === filterStat;
      const matchesLoc = filterLoc === 'ALL' || s.location === filterLoc;
      return matchesSearch && matchesStat && matchesLoc;
    }).sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));
  }, [stock, searchTerm, filterStat, filterLoc]);

  const handleUpdateGenset = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !editingGenset) return;
    db.updateGenset(editingGenset);
    setEditingGenset(null);
  };

  const handleAddGenset = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !newGenset.unitNumber) return;
    
    db.addGenset({
      id: `G-${newGenset.unitNumber}-${newGenset.location}-${Date.now()}`,
      unitNumber: newGenset.unitNumber.toUpperCase(),
      location: newGenset.location,
      status: newGenset.status
    });
    
    setShowAddModal(false);
    setNewGenset({ unitNumber: '', location: Location.ALEX, status: GensetStatus.IN_STOCK });
  };

  const handleDeleteGenset = (id: string) => {
    if (!isAdmin) return;
    if (confirm(isAr ? 'هل أنت متأكد من حذف هذه الوحدة؟' : 'Are you sure you want to delete this asset?')) {
      db.deleteGenset(id);
    }
  };

  const handleBulkTransfer = (targetLoc: Location) => {
    if (isReadOnly) return;
    const ids = Array.from(selectedIds);
    ids.forEach(id => {
      const unit = stock.find(s => s.id === id);
      if (unit) db.updateGenset({ ...unit, location: targetLoc });
    });
    setSelectedIds(new Set());
    alert(lang === 'ar' ? `تم نقل ${ids.length} وحدة بنجاح` : `Successfully transferred ${ids.length} units.`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStock.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredStock.map(s => s.id)));
  };

  // Fix: Corrected function name from setSelectedRowIds to setSelectedIds to match the state hook definition
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    // Fix: Corrected function name from setSelectedRowIds to setSelectedIds
    setSelectedIds(newSet);
  };

  const getStatusBadge = (status: GensetStatus) => {
    switch (status) {
      case GensetStatus.IN_STOCK:
        return <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Available</span>;
      case GensetStatus.CLIPPED_ON:
        return <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">On Trip</span>;
      default:
        return <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Service</span>;
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 text-start pb-24 text-[10px]">
      
      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col xl:flex-row gap-3 items-center">
        <div className="flex-1 relative w-full">
          <input type="text" placeholder="Global Asset Search..." className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-50 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-black dark:text-white font-bold outline-none focus:border-blue-400 shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <svg className="absolute left-3 top-3.5 h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <div className="flex gap-2">
          <select className="bg-white dark:bg-slate-900 text-black dark:text-white border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 font-black uppercase text-[9px] outline-none focus:border-blue-400" value={filterLoc} onChange={e => setFilterLoc(e.target.value)}>
            <option value="ALL">All Hubs</option>
            {Object.values(Location).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="bg-white dark:bg-slate-900 text-black dark:text-white border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2 font-black uppercase text-[9px] outline-none focus:border-blue-400" value={filterStat} onChange={e => setFilterStat(e.target.value)}>
            <option value="ALL">All Status</option>
            {Object.values(GensetStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          {!isReadOnly && (
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-[#001F3F] text-[#C2A378] px-6 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg whitespace-nowrap"
            >
              + {isAr ? 'تسجيل جديد' : 'Register Asset'}
            </button>
          )}
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap border-collapse">
            <thead className="bg-[#001F3F] text-white font-black uppercase text-[9px]">
              <tr>
                <th className="p-4 w-10 text-center border-r border-white/5">
                  <input type="checkbox" className="rounded" checked={selectedIds.size === filteredStock.length && filteredStock.length > 0} onChange={toggleSelectAll} />
                </th>
                <th className="p-4 w-10 text-center">#</th>
                <th className="p-4">Unit Serial</th>
                <th className="p-4">Current Hub</th>
                <th className="p-4">Status</th>
                <th className="p-4">Active Deployment</th>
                <th className="p-4">Trip Date</th>
                <th className="p-4 text-center">Health</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filteredStock.map((unit, idx) => {
                const activeOp = ops.find(o => o.gensetNumber === unit.unitNumber && o.status === 'IN PROGRESS');
                const portStyle = PORT_STYLING[unit.location];
                const isSelected = selectedIds.has(unit.id);
                return (
                  <tr key={unit.id} className={`transition-colors group ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                    <td className="p-4 text-center border-r dark:border-slate-700">
                       <input type="checkbox" className="rounded" checked={isSelected} onChange={() => toggleSelect(unit.id)} />
                    </td>
                    <td className="p-4 text-center text-slate-300">{idx + 1}</td>
                    <td className="p-4 font-black text-blue-600 dark:text-blue-400 italic uppercase tracking-tighter text-xs">{unit.unitNumber}</td>
                    <td className="p-4">
                      <span className={`${portStyle.bg} ${portStyle.text} border ${portStyle.border} px-2 py-0.5 rounded font-black text-[8px]`}>{unit.location} HUB</span>
                    </td>
                    <td className="p-4">{getStatusBadge(unit.status)}</td>
                    <td className="p-4 font-bold text-slate-700 dark:text-slate-300">
                      {activeOp ? <span className="font-mono text-blue-600">#{activeOp.bookingNumber}</span> : <span className="text-slate-200">---</span>}
                    </td>
                    <td className="p-4 text-slate-400 font-medium">{activeOp?.clipOnDate || 'N/A'}</td>
                    <td className="p-4 text-center">
                       <div className="flex items-center justify-center gap-1">
                          <div className="w-1.5 h-3 rounded-full bg-emerald-500"></div>
                          <div className="w-1.5 h-3 rounded-full bg-emerald-500"></div>
                          <div className="w-1.5 h-3 rounded-full bg-emerald-500"></div>
                          <div className="w-1.5 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                       </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isReadOnly && (
                          <button onClick={() => setEditingGenset({...unit})} className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-blue-600 hover:text-white transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleDeleteGenset(unit.id)} className="p-1.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-600 hover:text-white transition-all">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10">
           <div className="bg-[#001F3F] text-white px-8 py-5 rounded-[2.5rem] shadow-2xl border-2 border-[#C2A378] flex items-center gap-10 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                 <span className="w-10 h-10 bg-[#C2A378] text-[#001F3F] rounded-full flex items-center justify-center font-black text-sm">{selectedIds.size}</span>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#C2A378]">Bulk Relocation</p>
                    <p className="text-[9px] font-bold text-slate-400">Assets Selected</p>
                 </div>
              </div>
              <div className="h-10 w-px bg-white/10"></div>
              <div className="flex items-center gap-4">
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Target Hub:</p>
                 <div className="flex gap-2">
                    {Object.values(Location).map(loc => (
                       <button 
                         key={loc}
                         onClick={() => handleBulkTransfer(loc)}
                         className="bg-white/10 hover:bg-[#C2A378] hover:text-[#001F3F] border border-white/20 rounded-xl px-4 py-2 text-[9px] font-black uppercase transition-all"
                       >
                         {loc}
                       </button>
                    ))}
                 </div>
              </div>
              <button onClick={() => setSelectedIds(new Set())} className="text-[9px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-500">Cancel</button>
           </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#001F3F]/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden border-[10px] border-slate-900 animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black italic uppercase">New Asset Identity</h3>
              <button onClick={() => setShowAddModal(false)} className="text-white hover:text-rose-500">✕</button>
            </div>
            <form onSubmit={handleAddGenset} className="p-8 space-y-6">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Unit Serial / ID</label>
                <input required placeholder="e.g. SZLG221-500" className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-sm outline-none focus:border-blue-400" value={newGenset.unitNumber} onChange={e => setNewGenset({...newGenset, unitNumber: e.target.value})} />
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Station Assignment</label>
                <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-xs outline-none" value={newGenset.location} onChange={e => setNewGenset({...newGenset, location: e.target.value as any})}>
                  {Object.values(Location).map(l => <option key={l} value={l}>{translateEntity(l, lang)} HUB</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Deploy Asset to Stock</button>
            </form>
          </div>
        </div>
      )}

      {editingGenset && (
        <div className="fixed inset-0 bg-[#001F3F]/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden border-[10px] border-slate-900 animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-xl font-black italic uppercase">Modify Asset</h3>
              <button onClick={() => setEditingGenset(null)} className="text-white hover:text-rose-500">✕</button>
            </div>
            <form onSubmit={handleUpdateGenset} className="p-8 space-y-6">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Location Assignment</label>
                <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-xs text-black dark:text-white outline-none focus:border-blue-400" value={editingGenset.location} onChange={e => setEditingGenset({...editingGenset, location: e.target.value as any})}>
                  {Object.values(Location).map(l => <option key={l} value={l}>{translateEntity(l, lang)} HUB</option>)}
                </select>
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-2">Service Status</label>
                <select className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-xs text-black dark:text-white outline-none focus:border-blue-400" value={editingGenset.status} onChange={e => setEditingGenset({...editingGenset, status: e.target.value as any})}>
                  {Object.values(GensetStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-4 bg-[#001F3F] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Apply Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagement;
