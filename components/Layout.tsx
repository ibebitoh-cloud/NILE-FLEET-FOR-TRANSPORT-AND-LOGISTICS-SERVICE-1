
import React, { useContext, useState, useEffect, useRef } from 'react';
import { User, UserRole, SystemNotification } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations } from '../translations';
import { db } from '../services/supabaseDb';
import { runThinkingAudit } from '../services/aiService';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, activeScreen, setActiveScreen, children }) => {
  const { lang, setLang } = useContext(LanguageContext);
  const { theme, setTheme, isMuted, setIsMuted, isDark } = useContext(ThemeContext);
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>(db.getActiveNotifications(user));
  const mainContentRef = useRef<HTMLElement>(null);
  const [activePortGateTab, setActivePortGateTab] = useState<'GATE' | 'TRANSIT' | 'UPCOMING'>(() => (sessionStorage.getItem('portGateTab') as any) || 'GATE');
  const [isPortGateSubmenuCollapsed, setIsPortGateSubmenuCollapsed] = useState<boolean>(() => sessionStorage.getItem('portGateSubmenuCollapsed') === 'true');
  const [activeInvoicesTab, setActiveInvoicesTab] = useState<'ALL' | 'NEED_ISSUE' | 'PAST_DUE'>(() => (sessionStorage.getItem('invoicesTab') as any) || 'ALL');
  const [isInvoicesSubmenuCollapsed, setIsInvoicesSubmenuCollapsed] = useState<boolean>(() => sessionStorage.getItem('invoicesSubmenuCollapsed') === 'true');
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatMessages, setAiChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as any;
      const isCurrentlyFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      setIsFullscreen(isCurrentlyFs);
      if (isCurrentlyFs) {
        setIsPseudoFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);
    
    const updateNotifs = () => setNotifications(db.getActiveNotifications(user));
    window.addEventListener('db-undo-success', updateNotifs);
    window.addEventListener('db-change', updateNotifs);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
      window.removeEventListener('db-undo-success', updateNotifs);
      window.removeEventListener('db-change', updateNotifs);
    };
  }, [user]);

  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<'GATE' | 'TRANSIT' | 'UPCOMING'>;
      if (customEvent.detail) {
        setActivePortGateTab(customEvent.detail);
      }
    };
    window.addEventListener('port-gate-tab-change', handleTabChange);
    return () => {
      window.removeEventListener('port-gate-tab-change', handleTabChange);
    };
  }, []);

  useEffect(() => {
    const handleInvoicesTabChange = (e: Event) => {
      const customEvent = e as CustomEvent<'ALL' | 'NEED_ISSUE' | 'PAST_DUE'>;
      if (customEvent.detail) {
        setActiveInvoicesTab(customEvent.detail);
      }
    };
    window.addEventListener('invoices-tab-change', handleInvoicesTabChange);
    return () => {
      window.removeEventListener('invoices-tab-change', handleInvoicesTabChange);
    };
  }, []);

  const askNileAi = async () => {
    const question = aiChatInput.trim();
    if (!question || aiChatLoading) return;
    setAiChatInput('');
    setAiChatMessages(prev => [...prev, { role: 'user', text: question }]);
    setAiChatLoading(true);

    try {
      const operations = db.getOperations();
      const invoices = db.getInvoices();
      const gensets = db.getStock();
      const reservations = db.getReservations();
      const maintenance = db.getMaintenanceLogs();

      // Deterministic lookup for short factual questions. Do not make the LLM
      // guess a number that the application can calculate exactly.
      const normalize = (value: unknown) => String(value ?? '')
        .toUpperCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/[ة]/g, 'ه')
        .replace(/[^A-Z0-9\u0600-\u06FF]+/g, '');

      const questionTokens = question
        .split(/\s+/)
        .map(token => normalize(token))
        .filter(token => token.length >= 4 && ![
          'HOW', 'MANY', 'MUCH', 'WORK', 'HAVE', 'HAS', 'THE', 'THIS',
          'WHAT', 'TOTAL', 'NUMBER', 'OPERATIONS', 'OPERATION', 'SHOW',
          'TELL', 'ABOUT', 'FOR', 'FROM', 'WITH', 'ARE', 'IS', 'DOES'
        ].includes(token));

      const fieldNames = ['customerName', 'beneficiaryName', 'trucker', 'shipperAddress', 'bookingNumber', 'containerNumber', 'gensetNumber'];
      const matches = operations.filter(op => questionTokens.some(token =>
        fieldNames.some(field => normalize((op as any)[field]).includes(token))
      ));

      const asksForWork = /\\b(work|works|operations?|ops)\\b/i.test(question) ||
        /how many/i.test(question) || /كام|عدد|شغل|عمليات/i.test(question);

      if (asksForWork && questionTokens.length > 0 && matches.length > 0) {
        const byStatus = matches.reduce<Record<string, number>>((acc, op) => {
          const status = String(op.status || 'UNKNOWN').toUpperCase();
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        const totalValue = matches.reduce((sum, op) => {
          const rate = Number.parseFloat(String(op.rate ?? '').replace(/,/g, '')) || 0;
          const vat = Number.parseFloat(String(op.vat ?? '').replace(/,/g, '')) || 0;
          return sum + rate + vat;
        }, 0);
        const matchedNames = Array.from(new Set(matches.flatMap(op =>
          fieldNames
            .filter(field => questionTokens.some(token => normalize((op as any)[field]).includes(token)))
            .map(field => String((op as any)[field] || '').trim())
            .filter(Boolean)
        ))).slice(0, 4);

        const statusText = Object.entries(byStatus).map(([status, count]) => `${status}: ${count}`).join(' | ');
        const answer = isAr
          ? `وجدت ${matches.length} عملية مسجلة مطابقة لـ ${matchedNames.join(' / ')}. الحالة: ${statusText}. إجمالي قيمة العمليات المسجلة (السعر + الضريبة): ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP.`
          : `I found ${matches.length} recorded operations matching ${matchedNames.join(' / ')}. Status: ${statusText}. Recorded operation value (rate + VAT): ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP.`;

        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        return;
      }

      const context = {
        user: { role: user.role, name: user.name },
        // Compact summaries make the model reason over facts instead of drowning
        // in thousands of raw fields.
        totals: {
          operations: operations.length,
          invoices: invoices.length,
          gensets: gensets.length,
          reservations: reservations.length,
          maintenance: maintenance.length
        },
        operations,
        invoices,
        gensets,
        reservations,
        maintenance,
        gasByPort: db.getGasByPort(),
        gasByGenset: db.getGasByGenset(),
        gasBalance: db.getGasBalance(),
        customers: db.getCustomerPrices(),
        ports: db.getPortsInfo()
      };

      const prompt = `You are DALI 1.0, the Nile Fleet dashboard assistant.
Answer the user's exact question FIRST. You are not allowed to reply with generic instructions when the supplied data can answer the question.

RULES:
1. For Nile Fleet data questions, calculate the answer from LIVE DATA yourself.
2. Never invent, estimate, or ask the user to provide data that is already in LIVE DATA.
3. "How much work / how many operations does [name] have?" means count matching operations and give a status breakdown. Search customerName, beneficiaryName, trucker, shipperAddress, bookingNumber, containerNumber, and gensetNumber.
4. "How much does [name] owe / unpaid / outstanding" means filter invoices for that name and calculate the exact outstanding amount from invoice status/amount.
5. If a name matches multiple fields, state which field(s) matched.
6. Show the exact number and amount first, then a short explanation. Do not output Python code.
7. If the data does not contain the requested entity, say that clearly and do not invent a result.
8. Arabic question -> professional Arabic only. Preserve IDs, dates, and numbers exactly.

USER QUESTION: ${question}
LIVE DATA: ${JSON.stringify(context)}`;
      const answer = await runThinkingAudit(prompt, 1600);
      setAiChatMessages(prev => [...prev, { role: 'ai', text: answer || (isAr ? 'لم يصل رد من DALI 1.0.' : 'No response from DALI 1.0.') }]);
    } catch (e) {
      setAiChatMessages(prev => [...prev, { role: 'ai', text: isAr ? 'تعذر الاتصال بـ DALI 1.0 حالياً.' : 'DALI 1.0 is unavailable right now.' }]);
    } finally {
      setAiChatLoading(false);
    }
  };

  const handlePortGateTabClick = (tab: 'GATE' | 'TRANSIT' | 'UPCOMING') => {
    sessionStorage.setItem('portGateTab', tab);
    setActivePortGateTab(tab);
    setActiveScreen('port-gate');
    window.dispatchEvent(new CustomEvent('port-gate-tab-change', { detail: tab }));
  };

  const handleInvoicesTabClick = (tab: 'ALL' | 'NEED_ISSUE' | 'PAST_DUE') => {
    sessionStorage.setItem('invoicesTab', tab);
    setActiveInvoicesTab(tab);
    setActiveScreen('booking-invoices');
    window.dispatchEvent(new CustomEvent('invoices-tab-change', { detail: tab }));
  };

  const toggleFullscreen = async () => {
    try {
      const docEl = document.documentElement as any;
      const doc = document as any;

      if (!document.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !doc.msFullscreenElement) {
        if (isPseudoFullscreen) {
          setIsPseudoFullscreen(false);
          return;
        }
        
        const requestMethod = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
        if (requestMethod) {
          await requestMethod.call(docEl);
        } else {
          setIsPseudoFullscreen(true);
        }
      } else {
        const exitMethod = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (exitMethod) {
          await exitMethod.call(doc);
        }
        setIsPseudoFullscreen(false);
      }
    } catch (e) {
      console.warn("Standard fullscreen failed or was blocked. Falling back to pseudo-fullscreen mode.", e);
      setIsPseudoFullscreen(prev => !prev);
    }
  };

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  }, [activeScreen]);

  const isInternal = user.role === UserRole.ADMIN || user.role === UserRole.VIEWER;
  const isGate = user.role === UserRole.GATE_OPERATOR;
  
  const dashboardId = isInternal ? 'dashboard' : (isGate ? 'port-gate' : 'cust-reservations');
  const isHome = activeScreen === dashboardId;

  const allPossibleMenuItems = [
    { id: 'dashboard', label: t.dashboard, icon: '📊' },
    { id: 'port-gate', label: t.portGate, icon: '🚧' },
    { id: 'master-view', label: t.masterView, icon: '📑' },
    { id: 'operations', label: t.operations, icon: '🚛' },
    { id: 'notifications', label: isAr ? 'التنبيهات' : 'NOTIFICATIONS', icon: '🔔' },
    { id: 'booking-invoices', label: lang === 'ar' ? 'فواتير الحجوزات' : 'BOOKING INVOICES', icon: '🧾' },
    { id: 'intelligence', label: t.intelligence, icon: '🧠' },
    { id: 'reports', label: t.reports, icon: '📝' },
    { id: 'stock', label: t.gensetStock, icon: '⚡' },
    { id: 'reservations', label: t.reservations, icon: '📅' },
    { id: 'customers', label: t.customers, icon: '🤝' },
    { id: 'user-mgmt', label: t.userMgmt, icon: '👤' },
    { id: 'customer-prices', label: t.customerPrices, icon: '💰' },
    { id: 'financials', label: t.financials, icon: '🏦' },
    { id: 'support', label: t.support, icon: '🎧' },
    { id: 'system-log', label: t.systemLog, icon: '🕒' },
    { id: 'cust-reservations', label: t.reservations, icon: '📅' },
    { id: 'cust-invoices', label: t.financials, icon: '🏦' },
    { id: 'user-settings', label: t.userSettings, icon: '⚙️' },
  ];

  const defaultMenu = isInternal ? [
    { id: 'dashboard', label: t.dashboard, icon: '📊' },
    { id: 'port-gate', label: t.portGate, icon: '🚧' },
    { id: 'master-view', label: t.masterView, icon: '📑' },
    { id: 'operations', label: t.operations, icon: '🚛' },
    { id: 'notifications', label: isAr ? 'التنبيهات' : 'NOTIFICATIONS', icon: '🔔' },
    { id: 'booking-invoices', label: lang === 'ar' ? 'فواتير الحجوزات' : 'BOOKING INVOICES', icon: '🧾' },
    { id: 'intelligence', label: t.intelligence, icon: '🧠' },
    { id: 'reports', label: t.reports, icon: '📝' },
    { id: 'stock', label: t.gensetStock, icon: '⚡' },
    { id: 'reservations', label: t.reservations, icon: '📅' },
    { id: 'customers', label: t.customers, icon: '🤝' },
    { id: 'user-mgmt', label: t.userMgmt, icon: '👤' },
    { id: 'customer-prices', label: t.customerPrices, icon: '💰' },
    { id: 'financials', label: t.financials, icon: '🏦' },
    { id: 'support', label: t.support, icon: '🎧' },
    { id: 'system-log', label: t.systemLog, icon: '🕒' },
  ] : (isGate ? [
    { id: 'port-gate', label: t.portGate, icon: '🚧' },
    { id: 'notifications', label: isAr ? 'التنبيهات' : 'NOTIFICATIONS', icon: '🔔' },
    { id: 'support', label: t.support, icon: '🎧' },
    { id: 'user-settings', label: t.userSettings, icon: '⚙️' },
  ] : [
    { id: 'cust-reservations', label: t.reservations, icon: '📅' },
    { id: 'notifications', label: isAr ? 'التنبيهات' : 'NOTIFICATIONS', icon: '🔔' },
    { id: 'cust-invoices', label: t.financials, icon: '🏦' },
    { id: 'support', label: t.support, icon: '🎧' },
  ]);

  const menu = (user.allowedScreens && Array.isArray(user.allowedScreens) && user.allowedScreens.length > 0)
    ? allPossibleMenuItems.filter(item => user.allowedScreens?.includes(item.id))
    : defaultMenu;

  const isTerminal = isDark;
  
  const sidebarBg = isTerminal ? 'bg-[#001224]' : 'bg-white shadow-xl';
  const mainBg = isTerminal ? 'bg-[#000b14]' : 'bg-slate-50';
  const borderClass = isTerminal ? 'border-[#C2A37822]' : 'border-slate-200';
  const textPrimary = isTerminal ? 'text-white' : 'text-[#001F3F]';
  const textSecondary = isTerminal ? 'text-[#C2A37888]' : 'text-slate-400';
  const headerBg = isTerminal ? 'bg-[#001224bb] border-[#C2A37822]' : 'bg-white/80 border-slate-200';

  const getNavItemClass = (itemId: string) => {
    const isActive = activeScreen === itemId;
    if (isTerminal) return isActive ? 'bg-[#C2A378] text-[#001F3F] shadow-[0_0_20px_rgba(194,163,120,0.4)]' : 'text-[#C2A378aa] hover:bg-white/5 hover:text-white';
    return isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200';
  };

  const forceBanners = notifications.filter(n => n.forceBanner);

  return (
    <div className={`flex flex-col lg:flex-row h-screen overflow-hidden ${lang === 'ar' ? 'rtl' : 'ltr'} transition-colors duration-500 ${isPseudoFullscreen ? 'fixed inset-0 w-screen h-screen z-[99999]' : ''}`} style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      
      {/* FORCE NOTIFICATION BANNERS */}
      {forceBanners.length > 0 && !isMuted && (
        <div className="fixed top-0 left-0 right-0 z-[1000] no-print">
          {forceBanners.map(n => (
            <div key={n.id} className={`flex items-center justify-between px-6 py-2 text-white font-black uppercase text-[9px] tracking-widest animate-in slide-in-from-top-full duration-500 shadow-xl ${n.type === 'CRITICAL' ? 'bg-rose-600' : n.type === 'WARNING' ? 'bg-amber-600' : 'bg-blue-600'}`}>
               <div className="flex items-center gap-3">
                  <span className="text-xs">⚠️</span>
                  <span>{isAr ? n.messageAr : n.message}</span>
               </div>
               <button onClick={() => db.dismissNotification(n.id)} className="hover:scale-110 transition-transform font-bold p-1 text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* SIDEBAR (Desktop) */}
      <aside className={`hidden lg:flex ${isSidebarCollapsed ? 'w-16' : 'w-56'} flex-col border-r transition-all duration-300 relative shrink-0 z-50 no-print`} style={{ backgroundColor: 'var(--rail-bg)', borderRightColor: 'var(--border-primary)' }}>
        <div className={`p-4 border-b ${borderClass} flex flex-col items-center justify-center relative overflow-hidden`}>
          {!isSidebarCollapsed ? (
            <h1 className={`text-lg font-black ${textPrimary} tracking-widest uppercase italic`}>
              NILE <span className="text-[#C2A378]">FLEET</span>
            </h1>
          ) : (
            <span className="text-xl font-black text-[#C2A378]">N</span>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar text-start">
          {menu.map(item => (
            <React.Fragment key={item.id}>
              <button 
                title={item.label} 
                onClick={() => {
                  if (item.id === 'port-gate') {
                    handlePortGateTabClick(activePortGateTab);
                  } else if (item.id === 'booking-invoices') {
                    handleInvoicesTabClick(activeInvoicesTab);
                  } else {
                    setActiveScreen(item.id);
                  }
                }} 
                className={`w-full flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group ${getNavItemClass(item.id)} ${isSidebarCollapsed ? 'justify-center px-0' : 'gap-3'}`}
              >
                <span className="text-base">{(item as any).icon}</span>
                {!isSidebarCollapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="font-black text-[9px] uppercase tracking-widest truncate">{item.label}</span>
                    {item.id === 'port-gate' && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextState = !isPortGateSubmenuCollapsed;
                          setIsPortGateSubmenuCollapsed(nextState);
                          sessionStorage.setItem('portGateSubmenuCollapsed', String(nextState));
                        }}
                        className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-xs transition-all cursor-pointer ml-1 text-[#C2A378] font-bold leading-none select-none"
                        title={isPortGateSubmenuCollapsed ? (isAr ? "توسيع" : "Expand shortcuts") : (isAr ? "تقليص" : "Minimize shortcuts")}
                      >
                        {isPortGateSubmenuCollapsed ? '▼' : '▲'}
                      </span>
                    )}
                    {item.id === 'booking-invoices' && (
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextState = !isInvoicesSubmenuCollapsed;
                          setIsInvoicesSubmenuCollapsed(nextState);
                          sessionStorage.setItem('invoicesSubmenuCollapsed', String(nextState));
                        }}
                        className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-xs transition-all cursor-pointer ml-1 text-[#C2A378] font-bold leading-none select-none"
                        title={isInvoicesSubmenuCollapsed ? (isAr ? "توسيع" : "Expand shortcuts") : (isAr ? "تقليص" : "Minimize shortcuts")}
                      >
                        {isInvoicesSubmenuCollapsed ? '▼' : '▲'}
                      </span>
                    )}
                  </div>
                )}
              </button>
              
              {item.id === 'port-gate' && !isSidebarCollapsed && !isPortGateSubmenuCollapsed && (
                <div className="pl-6 pr-2 my-1.5 space-y-1.5 border-l border-dashed border-[#C2A37855] ml-4 text-start font-mono">
                  {[
                    { tab: 'GATE' as const, label: isAr ? 'البوابة' : 'GATE', icon: '🚪' },
                    { tab: 'TRANSIT' as const, label: isAr ? 'النشطة' : 'ACTIVE', icon: '🟢' },
                    { tab: 'UPCOMING' as const, label: isAr ? 'القادمة' : 'NEXT', icon: '⏳' }
                  ].map(sub => {
                    const isSubActive = activeScreen === 'port-gate' && activePortGateTab === sub.tab;
                    const subClass = isSubActive 
                      ? (isTerminal ? 'text-[#C2A378] font-bold' : 'text-blue-600 font-bold') 
                      : 'text-[#C2A378aa] hover:text-white dark:hover:text-white';
                    return (
                      <button 
                        key={sub.tab} 
                        onClick={() => handlePortGateTabClick(sub.tab)} 
                        className={`w-full flex items-center gap-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-all ${subClass}`}
                      >
                        <span className="text-xs">{sub.icon}</span>
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {item.id === 'booking-invoices' && !isSidebarCollapsed && !isInvoicesSubmenuCollapsed && (
                <div className="pl-6 pr-2 my-1.5 space-y-1.5 border-l border-dashed border-[#C2A37855] ml-4 text-start font-mono">
                  {[
                    { tab: 'ALL' as const, label: isAr ? 'جميع الفواتير' : 'ALL INVOICES', icon: '🧾' },
                    { tab: 'NEED_ISSUE' as const, label: isAr ? 'تحتاج إصدار' : 'NEED ISSUE', icon: '⚡' },
                    { tab: 'PAST_DUE' as const, label: isAr ? 'تجاوز الاستحقاق' : 'DUE PASSES', icon: '⚠️' }
                  ].map(sub => {
                    const isSubActive = activeScreen === 'booking-invoices' && activeInvoicesTab === sub.tab;
                    const subClass = isSubActive 
                      ? (isTerminal ? 'text-[#C2A378] font-bold' : 'text-blue-600 font-bold') 
                      : 'text-[#C2A378aa] hover:text-white dark:hover:text-white';
                    return (
                      <button 
                        key={sub.tab} 
                        onClick={() => handleInvoicesTabClick(sub.tab)} 
                        className={`w-full flex items-center gap-2.5 py-1 text-[8px] font-black uppercase tracking-widest transition-all ${subClass}`}
                      >
                        <span className="text-xs">{sub.icon}</span>
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </React.Fragment>
          ))}
        </nav>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`absolute -right-3 top-16 bg-[#C2A378] text-[#001F3F] w-6 h-6 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-50 border-2 border-[#001224]`}>
          <span className="text-[10px] font-bold">{isSidebarCollapsed ? '→' : '←'}</span>
        </button>
        <div className={`p-3 border-t ${borderClass} ${isTerminal ? 'bg-black/40' : 'bg-slate-50'}`}>
          <div className={`mb-3 flex items-center gap-2 px-1 ${isSidebarCollapsed ? 'flex-col px-0' : ''}`}>
            <div className={`w-8 h-8 rounded-lg bg-[#C2A378] overflow-hidden flex items-center justify-center text-[#001F3F] text-[10px] font-black border border-white/20 cursor-pointer uppercase`} onClick={() => setActiveScreen('user-settings')}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt="profile" className="w-full h-full object-cover" /> : user.name[0]}
            </div>
            {!isSidebarCollapsed && <div className="flex-1 min-w-0 text-start leading-tight"><p className={`text-[8px] font-black ${textSecondary} uppercase`}>{user.role}</p><p className={`text-[10px] font-bold ${textPrimary} truncate uppercase`}>{user.name}</p></div>}
          </div>
          <button onClick={onLogout} className={`w-full px-3 py-2 rounded-lg text-[9px] font-black transition-all border uppercase tracking-widest ${isTerminal ? 'bg-rose-900/20 hover:bg-rose-600 text-rose-100 border-rose-900/50' : 'bg-rose-50 hover:bg-rose-600 text-rose-500 border-rose-100'}`}>{isSidebarCollapsed ? 'OUT' : t.signOut}</button>
        </div>
      </aside>

      {/* MOBILE MENU OVERLAY (More menu) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] bg-[#001224]/95 backdrop-blur-2xl animate-in fade-in duration-300 p-4 flex flex-col no-print">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-black text-white tracking-widest uppercase italic">NILE <span className="text-[#C2A378]">FLEET</span></h1>
            <button onClick={() => setIsMobileMenuOpen(false)} className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center text-lg">✕</button>
          </div>
          
          {/* User Info Card in Menu */}
          <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-[#C2A378] overflow-hidden">
                {user.avatarUrl && <img src={user.avatarUrl} alt="profile" className="w-full h-full object-cover" />}
             </div>
             <div className="text-start">
                <p className="text-white font-black text-xs uppercase tracking-tight">{user.name}</p>
                <p className="text-[#C2A378] font-bold text-[8px] uppercase tracking-widest">{user.role} LEVEL</p>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {menu.map(item => (
              <React.Fragment key={item.id}>
                <button 
                  onClick={() => {
                    if (item.id === 'port-gate') {
                      handlePortGateTabClick(activePortGateTab);
                      setIsMobileMenuOpen(false);
                    } else {
                      setActiveScreen(item.id);
                      setIsMobileMenuOpen(false);
                    }
                  }} 
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${activeScreen === item.id ? 'bg-[#C2A378] text-[#001F3F]' : 'bg-white/5 text-[#C2A378aa]'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-lg">{(item as any).icon}</span>
                    <span className="font-black text-[10px] uppercase tracking-widest">{item.label}</span>
                  </div>
                  {item.id === 'port-gate' && (
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextState = !isPortGateSubmenuCollapsed;
                        setIsPortGateSubmenuCollapsed(nextState);
                        sessionStorage.setItem('portGateSubmenuCollapsed', String(nextState));
                      }}
                      className="p-2 rounded-lg bg-black/10 text-[10px] text-[#C2A378] font-black leading-none select-none"
                    >
                      {isPortGateSubmenuCollapsed ? '▼' : '▲'}
                    </span>
                  )}
                </button>
                
                {item.id === 'port-gate' && !isPortGateSubmenuCollapsed && (
                  <div className="pl-8 pr-4 py-2 space-y-3 border-l border-dashed border-[#C2A37855] ml-6 text-start font-mono flex flex-col">
                    {[
                      { tab: 'GATE' as const, label: isAr ? 'البوابة' : 'GATE', icon: '🚪' },
                      { tab: 'TRANSIT' as const, label: isAr ? 'النشطة' : 'ACTIVE', icon: '🟢' },
                      { tab: 'UPCOMING' as const, label: isAr ? 'القادمة' : 'NEXT', icon: '⏳' }
                    ].map(sub => {
                      const isSubActive = activeScreen === 'port-gate' && activePortGateTab === sub.tab;
                      const subClass = isSubActive 
                        ? 'text-[#C2A378] font-black' 
                        : 'text-slate-400 hover:text-white';
                      return (
                        <button 
                          key={sub.tab} 
                          onClick={() => {
                            handlePortGateTabClick(sub.tab);
                            setIsMobileMenuOpen(false);
                          }} 
                          className={`flex items-center gap-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all ${subClass}`}
                        >
                          <span className="text-sm">{sub.icon}</span>
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Persistent Sign Out in Mobile Menu */}
          <div className="mt-4 pt-4 border-t border-white/10">
             <button 
              onClick={onLogout} 
              className="w-full py-5 rounded-2xl bg-rose-600/20 border border-rose-600/50 text-rose-500 font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
             >
                <span>👋</span>
                {t.signOut}
             </button>
          </div>
        </div>
      )}

      {/* DALI 1.0 floating dashboard assistant */}
      <div className="fixed bottom-6 right-6 z-[100] no-print">
        {isAiChatOpen && (
          <div className={`absolute bottom-16 right-0 w-[min(92vw,420px)] h-[min(70vh,620px)] rounded-[2rem] overflow-hidden border shadow-2xl flex flex-col ${isTerminal ? 'bg-[#001224] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="px-5 py-4 bg-gradient-to-r from-[#001F3F] to-[#073b6d] text-white flex items-center justify-between">
              <div><p className="text-[8px] font-black tracking-[0.3em] text-[#C2A378]">DALI 1.0</p><p className="text-sm font-black">{isAr ? 'DALI 1.0' : 'DALI 1.0'}</p></div>
              <button onClick={() => setIsAiChatOpen(false)} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {aiChatMessages.length === 0 && <div className={`rounded-2xl p-4 text-xs leading-6 ${isTerminal ? 'bg-white/5 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>{isAr ? 'اسألني عن العمليات، المخزون، الحجوزات، الفواتير، الوقود، أو أي سؤال عام.' : 'Ask me about operations, stock, bookings, invoices, fuel, logistics, or any general question.'}</div>}
              {aiChatMessages.map((m, i) => <div key={i} className={`rounded-2xl p-3 text-xs leading-6 whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white ml-8' : (isTerminal ? 'bg-white/5 text-slate-200 mr-4' : 'bg-slate-100 text-slate-700 mr-4')}`}>{m.text}</div>)}
              {aiChatLoading && <div className="text-[9px] font-black uppercase tracking-widest text-blue-500 animate-pulse">{isAr ? 'جاري التفكير...' : 'DALI 1.0 IS THINKING...'}</div>}
            </div>
            <div className={`p-3 border-t ${isTerminal ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="flex gap-2">
                <textarea value={aiChatInput} onChange={e => setAiChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askNileAi(); } }} placeholder={isAr ? 'اكتب سؤالك...' : 'Ask DALI 1.0 anything...'} className={`flex-1 resize-none rounded-xl border px-3 py-2 text-xs outline-none min-h-[44px] ${isTerminal ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                <button onClick={askNileAi} disabled={aiChatLoading || !aiChatInput.trim()} className="self-end w-11 h-11 rounded-xl bg-[#001F3F] text-white disabled:opacity-40">➤</button>
              </div>
            </div>
          </div>
        )}
        <button onClick={() => setIsAiChatOpen(v => !v)} className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#001F3F] to-[#0a4b82] text-white shadow-2xl border border-white/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center text-2xl" title={isAr ? 'مساعد DALI 1.0' : 'DALI 1.0 Assistant'}>✦</button>
      </div>

      {/* MAIN CONTENT */}
      <main ref={mainContentRef} className={`flex-1 overflow-y-auto custom-scrollbar relative flex flex-col transition-colors duration-500 ${forceBanners.length > 0 ? 'mt-8' : ''}`} style={{ backgroundColor: 'var(--bg-primary)' }}>
        <header className="h-14 border-b flex items-center px-4 lg:px-6 justify-between sticky top-0 z-[40] shadow-sm backdrop-blur-md transition-colors no-print" style={{ backgroundColor: 'var(--rail-bg)', borderBottomColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-[#C2A378] rounded-full shadow-[0_0_8px_#C2A378]"></div>
            <h2 className={`text-xs lg:text-sm font-black uppercase tracking-tight italic ${textPrimary}`}>{activeScreen.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className={`p-1.5 rounded-lg border transition-all ${isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}
              title={isMuted ? (isAr ? 'إلغاء كتم التنبيهات' : 'Unmute Notifications') : (isAr ? 'كتم التنبيهات' : 'Mute Notifications')}
            >
               <span className="text-base">{isMuted ? '🔇' : '🔊'}</span>
            </button>
            <button onClick={() => setActiveScreen('notifications')} className={`p-1.5 rounded-lg border relative transition-all ${isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}>
               <span className="text-base">🔔</span>
               {notifications.length > 0 && <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>}
            </button>
            <button 
              onClick={toggleFullscreen} 
              className={`p-1.5 rounded-lg border transition-all ${(isFullscreen || isPseudoFullscreen) ? 'border-rose-500/50 bg-rose-500/10 text-rose-500' : (isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white')}`}
              title={(isFullscreen || isPseudoFullscreen) ? (isAr ? 'خروج من ملء الشاشة' : 'Exit Fullscreen') : (isAr ? 'ملء الشاشة' : 'Fullscreen')}
            >
              {(isFullscreen || isPseudoFullscreen) ? '✕' : '⛶'}
            </button>
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className={`px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all ${isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}><span className="font-black text-[9px] uppercase">{lang === 'en' ? 'AR' : 'EN'}</span></button>
            {!isHome && (
              <button 
                onClick={() => setActiveScreen(dashboardId)} 
                className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-1 border border-rose-500"
              >
                <span>{isAr ? 'إغلاق' : 'CLOSE'}</span>
                <span className="text-xs">✕</span>
              </button>
            )}
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-1.5 rounded-lg border border-slate-200 bg-white">
              <span className="text-lg">☰</span>
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-6 flex-1">
          {children}
          
          <div className="mt-16 mb-8 flex flex-col items-center gap-3 opacity-30 hover:opacity-100 transition-opacity duration-700 pointer-events-none no-print text-center">
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-[#C2A378] to-transparent"></div>
            <div>
              <p className={`text-[8px] font-black uppercase tracking-[0.5em] ${textSecondary} mb-1`}>
                 POWERED BY BEBITO
              </p>
              <p className={`text-[9px] font-black italic tracking-widest ${textSecondary}`}>
                Mohamed A-Alawy <span className="opacity-30 px-2">|</span> +20 114 647 5759
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* MOBILE NAV (Bottom Bar) */}
      <nav className={`lg:hidden fixed bottom-0 left-0 right-0 border-t px-2 py-2 z-40 flex justify-around items-center transition-all ${isTerminal ? 'bg-[#001224] border-white/5' : 'bg-white border-slate-200'} backdrop-blur-xl pb-6 no-print`}>
        <button onClick={() => setActiveScreen(dashboardId)} className="flex flex-col items-center gap-1">
          <span className="text-base">🏠</span>
          <span className={`text-[7px] font-black uppercase ${activeScreen === dashboardId ? 'text-blue-500' : textSecondary}`}>HOME</span>
        </button>
        <button onClick={() => {
          if (isGate) {
            handlePortGateTabClick(activePortGateTab);
          } else {
            setActiveScreen('port-gate');
          }
        }} className="flex flex-col items-center gap-1">
          <span className="text-base">🚧</span>
          <span className={`text-[7px] font-black uppercase ${activeScreen === 'port-gate' ? 'text-blue-500' : textSecondary}`}>GATE</span>
        </button>
        {/* Added Settings to Bottom Nav */}
        <button onClick={() => setActiveScreen('user-settings')} className="flex flex-col items-center gap-1">
          <span className="text-base">⚙️</span>
          <span className={`text-[7px] font-black uppercase ${activeScreen === 'user-settings' ? 'text-blue-500' : textSecondary}`}>ACCOUNT</span>
        </button>
        <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center gap-1">
          <span className="text-base">☰</span>
          <span className={`text-[7px] font-black uppercase ${isMobileMenuOpen ? 'text-blue-500' : textSecondary}`}>MORE</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;