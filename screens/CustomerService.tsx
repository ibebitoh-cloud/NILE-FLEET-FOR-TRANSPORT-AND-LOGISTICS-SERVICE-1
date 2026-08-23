
import React, { useContext, useState, useMemo, useEffect } from 'react';
import { LanguageContext, ThemeContext } from '../App';
import { translateEntity } from '../translations';
import { db } from '../services/mockDb';
import { SupportContact, FAQItem, PortInfo, Location, UserRole, User } from '../types';

const CustomerService: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme, isDark } = useContext(ThemeContext);
  const isAr = lang === 'ar';
  
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const [activeTab, setActiveTab] = useState<'CONTACTS' | 'FAQ' | 'PORTS'>('CONTACTS');
  const [contacts, setContacts] = useState<SupportContact[]>(db.getSupportContacts());
  const [faqs, setFaqs] = useState<FAQItem[]>(db.getFAQs());
  const [ports, setPorts] = useState<PortInfo[]>(db.getPortsInfo());

  const [showModal, setShowModal] = useState<'NONE' | 'CONTACT' | 'FAQ' | 'PORT'>('NONE');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});

  const refresh = () => {
    setContacts([...db.getSupportContacts()]);
    setFaqs([...db.getFAQs()]);
    setPorts([...db.getPortsInfo()]);
  };

  useEffect(() => {
    const sync = () => refresh();
    window.addEventListener('db-undo-success', sync);
    return () => window.removeEventListener('db-undo-success', sync);
  }, []);

  const openAdd = (type: typeof showModal) => {
    setEditingId(null);
    setFormData({});
    setShowModal(type);
  };

  const openEdit = (type: typeof showModal, item: any) => {
    setEditingId(item.id);
    setFormData({ ...item });
    setShowModal(type);
  };

  const handleDelete = (type: string, id: string) => {
    if (!isAdmin) return;
    if (!confirm(isAr ? 'حذف هذا العنصر نهائياً؟' : 'Purge this item permanently?')) return;
    if (type === 'CONTACT') db.deleteSupportContact(id);
    else if (type === 'FAQ') db.deleteFAQ(id);
    else if (type === 'PORT') db.deletePortInfo(id);
    refresh();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (showModal === 'CONTACT') {
      const data: SupportContact = {
        id: editingId || `c-${Date.now()}`,
        name: formData.name || 'Staff',
        nameAr: formData.nameAr || 'موظف',
        role: formData.role || 'Operator',
        roleAr: formData.roleAr || 'مشغل',
        avatar: formData.avatar || '👤',
        status: formData.status || 'ONLINE',
        whatsapp: formData.whatsapp || ''
      };
      editingId ? db.updateSupportContact(data) : db.addSupportContact(data);
    } else if (showModal === 'FAQ') {
      const data: FAQItem = {
        id: editingId || `f-${Date.now()}`,
        question: formData.question || '',
        questionAr: formData.questionAr || '',
        answer: formData.answer || '',
        answerAr: formData.answerAr || ''
      };
      editingId ? db.updateFAQ(data) : db.addFAQ(data);
    } else if (showModal === 'PORT') {
      const data: PortInfo = {
        id: editingId || `p-${Date.now()}`,
        location: formData.location || Location.ALEX,
        address: formData.address || '',
        addressAr: formData.addressAr || '',
        contactName: formData.contactName || '',
        contactPhone: formData.contactPhone || ''
      };
      editingId ? db.updatePortInfo(data) : db.addPortInfo(data);
    }

    refresh();
    setShowModal('NONE');
  };

  const labelClass = "text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest text-start px-1";
  const inputClass = "w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-sm font-bold outline-none focus:border-[#C2A378] text-black dark:text-white";

  return (
    <div className={`max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-32 text-start ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
      
      {/* HUB NAVIGATION */}
      <div className="bg-[#001F3F] p-8 rounded-[3rem] shadow-2xl flex flex-col lg:flex-row justify-between items-center gap-8 border border-white/10 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
         <div className="flex items-center gap-6 relative z-10">
            <div className="w-16 h-16 bg-[#C2A378] text-[#001F3F] rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg">🎧</div>
            <div>
               <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-none">{isAr ? 'مركز المساعدة' : 'Support Hub'}</h2>
               <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.4em] mt-2">Personal Assistance Matrix</p>
            </div>
         </div>
         <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/10 relative z-10 overflow-hidden flex-wrap">
            <button onClick={() => setActiveTab('CONTACTS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'CONTACTS' ? 'bg-[#C2A378] text-[#001F3F]' : 'text-slate-400 hover:text-white'}`}>{isAr ? 'الطاقم' : 'PERSONNEL'}</button>
            <button onClick={() => setActiveTab('PORTS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'PORTS' ? 'bg-[#C2A378] text-[#001F3F]' : 'text-slate-400 hover:text-white'}`}>{isAr ? 'المواقع' : 'PORTS'}</button>
            <button onClick={() => setActiveTab('FAQ')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'FAQ' ? 'bg-[#C2A378] text-[#001F3F]' : 'text-slate-400 hover:text-white'}`}>{isAr ? 'الإرشادات' : 'GUIDELINES'}</button>
         </div>
         {isAdmin && (
           <button onClick={() => openAdd(activeTab === 'CONTACTS' ? 'CONTACT' : activeTab === 'PORTS' ? 'PORT' : 'FAQ')} className="relative z-10 bg-white/10 hover:bg-white/20 text-[#C2A378] border border-[#C2A378]/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all">
             + {isAr ? 'إضافة' : 'Add New'}
           </button>
         )}
      </div>

      <div className="grid grid-cols-1 gap-8 items-start">
        
        {activeTab === 'CONTACTS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
             {contacts.map(c => (
               <div key={c.id} className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-xl group hover:scale-[1.02] transition-all relative">
                  {isAdmin && (
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit('CONTACT', c)} className="p-2 bg-blue-50 dark:bg-slate-800 text-blue-600 rounded-lg">✎</button>
                      <button onClick={() => handleDelete('CONTACT', c.id)} className="p-2 bg-rose-50 dark:bg-slate-800 text-rose-600 rounded-lg">✕</button>
                    </div>
                  )}
                  <div className="flex items-center gap-6 mb-8">
                     <div className="relative">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform">{c.avatar}</div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 ${isDark ? 'border-slate-900' : 'border-white'} ${c.status === 'ONLINE' ? 'bg-emerald-500' : c.status === 'BUSY' ? 'bg-amber-500' : 'bg-slate-300'}`}></div>
                     </div>
                     <div>
                        <h4 className="text-xl font-black uppercase italic tracking-tighter text-[#001F3F] dark:text-white">{isAr ? c.nameAr : c.name}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isAr ? c.roleAr : c.role}</p>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     <a href={`https://wa.me/${c.whatsapp}`} target="_blank" className="bg-emerald-500 text-white py-4 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-emerald-600 transition-all shadow-lg">
                        <span className="text-xl">💬</span>
                        <span className="text-[8px] font-black uppercase">WhatsApp</span>
                     </a>
                     <button className="bg-blue-600 text-white py-4 rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-blue-700 transition-all shadow-lg">
                        <span className="text-xl">📞</span>
                        <span className="text-[8px] font-black uppercase">Voice Link</span>
                     </button>
                  </div>
               </div>
             ))}
          </div>
        )}

        {activeTab === 'PORTS' && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4">
              {ports.map(p => (
                <div key={p.id} className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-white/5 shadow-xl group hover:shadow-2xl transition-all relative">
                   {isAdmin && (
                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit('PORT', p)} className="p-2 bg-blue-50 dark:bg-slate-800 text-blue-600 rounded-lg">✎</button>
                      <button onClick={() => handleDelete('PORT', p.id)} className="p-2 bg-rose-50 dark:bg-slate-800 text-rose-600 rounded-lg">✕</button>
                    </div>
                  )}
                   <div className="flex justify-between items-start mb-8">
                      <div className="bg-slate-900 text-[#C2A378] px-4 py-1.5 rounded-xl font-black uppercase text-[10px] tracking-widest">
                         {translateEntity(p.location, lang)} HUB
                      </div>
                   </div>
                   <div className="space-y-6">
                      <div className="flex gap-4">
                         <span className="text-2xl">📍</span>
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Terminal Address</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{isAr ? p.addressAr : p.address}</p>
                         </div>
                      </div>
                      <div className="flex gap-4">
                         <span className="text-2xl">👤</span>
                         <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Terminal Manager</p>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.contactName}</p>
                            <p className="text-blue-600 font-black tracking-widest text-xs mt-1">{p.contactPhone}</p>
                         </div>
                      </div>
                   </div>
                </div>
              ))}
              {ports.length === 0 && <div className="col-span-2 py-20 text-center opacity-30 italic font-black uppercase">No port locations logged</div>}
           </div>
        )}

        {activeTab === 'FAQ' && (
          <div className="animate-in slide-in-from-bottom-4 space-y-4">
             {faqs.map((f) => (
               <div key={f.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 group relative">
                  {isAdmin && (
                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit('FAQ', f)} className="p-2 bg-blue-50 dark:bg-slate-800 text-blue-600 rounded-lg">✎</button>
                      <button onClick={() => handleDelete('FAQ', f.id)} className="p-2 bg-rose-50 dark:bg-slate-800 text-rose-600 rounded-lg">✕</button>
                    </div>
                  )}
                  <h4 className="font-black text-blue-600 uppercase text-sm mb-2">Q: {isAr ? f.questionAr : f.question}</h4>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-xs">A: {isAr ? f.answerAr : f.answer}</p>
               </div>
             ))}
          </div>
        )}
      </div>

      {/* MODAL FOR ADD/EDIT */}
      {showModal !== 'NONE' && (
        <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-xl z-[600] flex items-center justify-center p-6">
           <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl max-w-2xl w-full overflow-hidden border-[10px] border-[#001F3F] animate-in zoom-in-95">
              <div className="p-8 bg-[#001F3F] text-white flex justify-between items-center text-start">
                 <h3 className="text-xl font-black uppercase italic tracking-widest">{editingId ? 'Edit Item' : 'Create Entry'}</h3>
                 <button onClick={() => setShowModal('NONE')} className="text-white hover:text-rose-500 font-bold text-2xl transition-colors">✕</button>
              </div>
              <form onSubmit={handleFormSubmit} className="p-10 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar text-start text-black dark:text-white">
                 
                 {showModal === 'CONTACT' && (
                   <>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Name (EN)</label><input className={inputClass} required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                        <div><label className={labelClass}>Name (AR)</label><input className={inputClass} required value={formData.nameAr || ''} onChange={e => setFormData({...formData, nameAr: e.target.value})} /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Role (EN)</label><input className={inputClass} required value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})} /></div>
                        <div><label className={labelClass}>Role (AR)</label><input className={inputClass} required value={formData.roleAr || ''} onChange={e => setFormData({...formData, roleAr: e.target.value})} /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Status</label>
                          <select className={inputClass} value={formData.status || 'ONLINE'} onChange={e => setFormData({...formData, status: e.target.value})}>
                            <option value="ONLINE">ONLINE</option>
                            <option value="BUSY">BUSY</option>
                            <option value="OFFLINE">OFFLINE</option>
                          </select>
                        </div>
                        <div><label className={labelClass}>WhatsApp (No prefix)</label><input className={inputClass} placeholder="2011..." value={formData.whatsapp || ''} onChange={e => setFormData({...formData, whatsapp: e.target.value})} /></div>
                     </div>
                     <div><label className={labelClass}>Emoji Avatar</label><input className={inputClass} value={formData.avatar || '👤'} onChange={e => setFormData({...formData, avatar: e.target.value})} /></div>
                   </>
                 )}

                 {showModal === 'FAQ' && (
                   <>
                     <div><label className={labelClass}>Question (EN)</label><input className={inputClass} required value={formData.question || ''} onChange={e => setFormData({...formData, question: e.target.value})} /></div>
                     <div><label className={labelClass}>Question (AR)</label><input className={inputClass} required value={formData.questionAr || ''} onChange={e => setFormData({...formData, questionAr: e.target.value})} /></div>
                     <div><label className={labelClass}>Answer (EN)</label><textarea className={`${inputClass} h-24`} required value={formData.answer || ''} onChange={e => setFormData({...formData, answer: e.target.value})} /></div>
                     <div><label className={labelClass}>Answer (AR)</label><textarea className={`${inputClass} h-24`} required value={formData.answerAr || ''} onChange={e => setFormData({...formData, answerAr: e.target.value})} /></div>
                   </>
                 )}

                 {showModal === 'PORT' && (
                   <>
                     <div>
                        <label className={labelClass}>Hub Identification</label>
                        <select className={inputClass} value={formData.location || Location.ALEX} onChange={e => setFormData({...formData, location: e.target.value as any})}>
                           {Object.values(Location).map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Address (EN)</label><input className={inputClass} required value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                        <div><label className={labelClass}>Address (AR)</label><input className={inputClass} required value={formData.addressAr || ''} onChange={e => setFormData({...formData, addressAr: e.target.value})} /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>Point of Contact Name</label><input className={inputClass} required value={formData.contactName || ''} onChange={e => setFormData({...formData, contactName: e.target.value})} /></div>
                        <div><label className={labelClass}>Contact Mobile</label><input className={inputClass} required value={formData.contactPhone || ''} onChange={e => setFormData({...formData, contactPhone: e.target.value})} /></div>
                     </div>
                   </>
                 )}

                 <button type="submit" className="w-full bg-[#001F3F] text-white py-6 rounded-[2.5rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all">
                    {isAr ? 'اعتماد التغييرات' : 'AUTHORIZE PROTOCOL UPDATE'}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CustomerService;
