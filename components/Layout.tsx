
import React, { useContext, useState, useEffect, useRef } from 'react';
import { User, UserRole, SystemNotification } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity, dynamicTranslations } from '../translations';
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
  const isCreator = user.isCreator === true || String(user.email || '').trim().toLowerCase() === 'bebito@nilefleet.com';
  
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
  const [daliButtonPosition, setDaliButtonPosition] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nile-dali-button-position') || '{"right":24,"bottom":24}'); }
    catch { return { right: 24, bottom: 24 }; }
  });
  const daliDraggingRef = useRef(false);
  const daliDraggedRef = useRef(false);
  const daliDragStartRef = useRef({ x: 0, y: 0, right: 24, bottom: 24 });
  const [themeIslandOpen, setThemeIslandOpen] = useState(false);
  const themeIslandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    const handleDaliAsk = (event: Event) => {
      const question = String((event as CustomEvent).detail || '').trim();
      if (!question) return;
      setIsAiChatOpen(true);
      setAiChatInput(question);
      window.setTimeout(() => {
        const button = document.querySelector('[data-dali-send]') as HTMLButtonElement | null;
        button?.click();
      }, 0);
    };
    window.addEventListener('dali-ask', handleDaliAsk);
    return () => window.removeEventListener('dali-ask', handleDaliAsk);
  }, []);

  const saveDaliButtonPosition = (next: { right: number; bottom: number }) => {
    setDaliButtonPosition(next);
    localStorage.setItem('nile-dali-button-position', JSON.stringify(next));
  };

  const handleDaliPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    daliDraggingRef.current = true;
    daliDraggedRef.current = false;
    daliDragStartRef.current = { x: e.clientX, y: e.clientY, right: daliButtonPosition.right, bottom: daliButtonPosition.bottom };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleDaliPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!daliDraggingRef.current) return;
    const start = daliDragStartRef.current;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) daliDraggedRef.current = true;
    const next = {
      right: Math.max(8, Math.min(window.innerWidth - 70, start.right - dx)),
      bottom: Math.max(8, Math.min(window.innerHeight - 70, start.bottom - dy))
    };
    setDaliButtonPosition(next);
  };

  const handleDaliPointerUp = (e?: React.PointerEvent<HTMLButtonElement>) => {
    if (!daliDraggingRef.current) return;
    const start = daliDragStartRef.current;
    const dx = e ? e.clientX - start.x : 0;
    const dy = e ? e.clientY - start.y : 0;
    const next = {
      right: Math.max(8, Math.min(window.innerWidth - 70, start.right - dx)),
      bottom: Math.max(8, Math.min(window.innerHeight - 70, start.bottom - dy))
    };
    daliDraggingRef.current = false;
    setDaliButtonPosition(next);
    if (daliDraggedRef.current) localStorage.setItem('nile-dali-button-position', JSON.stringify(next));
  };

  const askNileAi = async () => {
    const question = aiChatInput.trim();
    if (!question || aiChatLoading) return;
    setAiChatInput('');
    setAiChatMessages(prev => [...prev, { role: 'user', text: question }]);
    setAiChatLoading(true);

    try {
      const operations = db.getOperations();
      const gensets = db.getStock();
      const invoices = db.getInvoices();
      const maintenance = db.getMaintenanceLogs();
      const creatorContext = isCreator
        ? 'CURRENT USER: Bebito (bebito@nilefleet.com), creator and system owner of NILE FLEET COMMAND. Treat this user as the creator/owner when relevant. Do not confuse the creator with an ordinary employee or customer. Never reveal passwords, API keys, tokens, or other secrets.'
        : `CURRENT USER: ${user.name || 'Unknown User'} | ROLE: ${user.role || 'Unknown'} | EMAIL: ${user.email || ''}`;
      const q = question.toUpperCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه');

      // FAST PATH: factual operational questions never go through the LLM.
      const idMatch = q.match(/(?:GENSET|GENSETS|مولد|مولدات|GENSET\s*ID)\s*#?\s*([A-Z0-9-]+)/i);
      const bookingMatch = q.match(/(?:BOOKING|BOOKING NO|BOOKING NUMBER|حجز)\s*#?\s*([A-Z0-9-]+)/i);
      const containerMatch = q.match(/(?:CONTAINER|CONT|حاويه|حاوية)\s*#?\s*([A-Z0-9]{4,12})/i);
      const searchMatch = q.match(/(?:SEARCH|FIND|WHERE IS|LOCATE|LOOK FOR|ابحث|فين|اين|أين)\s*#?\s*([A-Z0-9-]+)/i);
      const countWords = /HOW MANY|HOW MUCH|NUMBER OF|كام|عدد|كم/.test(q);

      const normalizeId = (value: unknown) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const numericId = (value: unknown) => normalizeId(value).replace(/\D/g, '');
      const gensetAliases = (value: unknown) => {
        const raw = normalizeId(value);
        const digits = numericId(value);
        const aliases = new Set<string>();
        if (raw) aliases.add(raw);
        if (digits) {
          aliases.add(digits);
          aliases.add(digits.slice(-4).padStart(4, '0'));
          aliases.add(digits.slice(-4));
        }
        return aliases;
      };
      const gensetMatches = (value: string, g: any) => {
        const queryAliases = gensetAliases(value);
        const recordValues = [g?.gensetNumber, g?.unitNumber, g?.id, g?.assetNumber];
        return recordValues.some(v => {
          const aliases = gensetAliases(v);
          return [...queryAliases].some(a => aliases.has(a));
        });
      };
      const operationGensetMatches = (value: string, o: any) => gensetMatches(value, o);
      const dateValue = (x: any) => String(x?.clipOnDate || x?.operationDate || x?.dateReceived || '');
      const fmtOp = (op: any) => {
        const port = op.clipOnPort || op.clipOffPort || '—';
        return isAr
          ? `الحالة: ${op.status || 'غير محدد'}\nالميناء: ${port}\nالحجز: ${op.bookingNumber || '—'}\nالحاوية: ${op.containerNumber || '—'}`
          : `Status: ${op.status || '—'}\nPort: ${port}\nBooking: ${op.bookingNumber || '—'}\nContainer: ${op.containerNumber || '—'}`;
      };

      // Genset lookup searches BOTH the fleet table's unitNumber and operation history.
      // The original genset number is never changed; the last 4 digits are only an alias.
      const lookupGenset = (id: string) => {
        const stockHits = gensets.filter(g => gensetMatches(id, g));
        const opHits = operations
          .filter(o => operationGensetMatches(id, o))
          .sort((a, b) => dateValue(b).localeCompare(dateValue(a)));
        const maintenanceHits = maintenance
          .filter(m => gensetMatches(id, m))
          .sort((a, b) => String(b.serviceDate || '').localeCompare(String(a.serviceDate || '')));
        return { stockHits, opHits, maintenanceHits };
      };

      const answerGenset = (id: string) => {
        const { stockHits, opHits, maintenanceHits } = lookupGenset(id);
        const stock = stockHits[0];
        const latestOp = opHits[0];
        const latestMaintenance = maintenanceHits[0];
        if (!stock && !latestOp && !latestMaintenance) {
          return isAr ? `المولد ${id} غير موجود في بيانات الأسطول أو السجل التشغيلي.` : `GENSET ${id} was not found in fleet, operations, or maintenance records.`;
        }
        const stockNumber = stock?.unitNumber || stock?.gensetNumber || id;
        const location = stock?.location || latestOp?.clipOnPort || latestOp?.clipOffPort || latestMaintenance?.location || '—';
        const status = stock?.status || latestOp?.status || latestMaintenance?.status || '—';
        if (isAr) {
          return `المولد ${stockNumber}\nالحالة: ${status}\nالموقع: ${location}${latestOp ? `\nالحجز: ${latestOp.bookingNumber || '—'}\nالحاوية: ${latestOp.containerNumber || '—'}` : ''}${latestMaintenance ? `\nآخر صيانة: ${latestMaintenance.serviceDate || '—'}` : ''}`;
        }
        return `GENSET ${stockNumber}\nStatus: ${status}\nLocation: ${location}${latestOp ? `\nBooking: ${latestOp.bookingNumber || '—'}\nContainer: ${latestOp.containerNumber || '—'}` : ''}${latestMaintenance ? `\nLast maintenance: ${latestMaintenance.serviceDate || '—'}` : ''}`;
      };

      if (idMatch) {
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answerGenset(idMatch[1]) }]);
        return;
      }

      // A short standalone number is also a genset search. This prevents
      // questions such as "464" from unnecessarily going through the LLM.
      if (/^\\d{1,6}$/.test(q.trim())) {
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answerGenset(q.trim()) }]);
        return;
      }

      // "SEARCH 422", "FIND 422", and "WHERE IS 422" are treated as genset IDs
      // when the identifier is short/numeric, so they never fall through to the LLM.
      if (searchMatch) {
        const value = searchMatch[1];
        if (/^\d{1,6}$/.test(value)) {
          setAiChatMessages(prev => [...prev, { role: 'ai', text: answerGenset(value) }]);
          return;
        }
      }

      if (bookingMatch || containerMatch) {
        const value = (bookingMatch?.[1] || containerMatch?.[1] || '').toUpperCase();
        const hits = operations.filter(o =>
          String(o.bookingNumber || '').toUpperCase() === value ||
          String(o.containerNumber || '').toUpperCase() === value
        );
        const answer = hits.length
          ? hits.slice(0, 5).map(fmtOp).join('\n\n')
          : (isAr ? `لم أجد ${value} في العمليات المسجلة.` : `No recorded operation was found for ${value}.`);
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        return;
      }

      // Fast count/status questions.
      if (countWords && /GENSET|مولد|STOCK|مخزون|MAINTENANCE|صيانة|PREORDER|UNDER OPERATE|تحت التشغيل/.test(q)) {
        const portMatch = q.match(/DAM|ALEX|GOUDA|SOKHNA|SCCT|PSD|MAL/);
        let list = gensets;
        if (portMatch) list = list.filter(g => String(g.location || '').toUpperCase() === portMatch[0]);
        const maintenanceCount = list.filter(g => g.status === 'MAINTENANCE').length;
        const stockCount = list.filter(g => g.status === 'IN_STOCK').length;
        const answer = isAr
          ? `العدد: ${list.length}\nالمخزون: ${stockCount}\nالصيانة: ${maintenanceCount}${portMatch ? `\nالميناء: ${portMatch[0]}` : ''}`
          : `Total: ${list.length}\nIn stock: ${stockCount}\nMaintenance: ${maintenanceCount}${portMatch ? `\nPort: ${portMatch[0]}` : ''}`;
        setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
        return;
      }

      // FAST CUSTOMER STATEMENT OF ACCOUNT (SOA): factual financial questions stay local.
      const customerProfiles = db.getUsers().filter(u => u.role === UserRole.CUSTOMER);
      // Customer/entity understanding works in BOTH Arabic and English.
      // DALI matches the user's wording against the real customer record, its
      // Arabic company name, the system translation dictionary, and learned translations.
      const normalizeArabic = (value: unknown) => String(value ?? '')
        .toLowerCase()
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[ًٌٍَُِّْـ]/g, '')
        .replace(/[إأآا]/g, 'ا')
        .replace(/[^\\p{L}\\p{N}]+/gu, ' ')
        .trim()
        .replace(/\\s+/g, ' ');

      const normalizeEntityText = (value: unknown) => normalizeArabic(value)
        .replace(/\\b(el|al)\\b/g, '')
        .trim();

      const getCustomerAliases = (customer: User) => {
        const baseNames = [
          customer.companyName,
          customer.companyNameAr,
          customer.name,
          translateEntity(customer.companyName, 'ar'),
          translateEntity(customer.name, 'ar')
        ].filter(Boolean).map(String);

        // Also use reverse entries from the learned translation dictionary:
        // if "ABC LOGISTICS" -> "شركة ايه بي سي" was learned, both forms match.
        const aliases = new Set(baseNames.map(normalizeEntityText).filter(Boolean));
        for (const [english, arabic] of Object.entries(dynamicTranslations)) {
          const en = normalizeEntityText(english);
          const ar = normalizeEntityText(arabic);
          if (baseNames.some(n => normalizeEntityText(n) === en || normalizeEntityText(n) === ar)) {
            if (en) aliases.add(en);
            if (ar) aliases.add(ar);
          }
        }
        return Array.from(aliases);
      };

      const findCustomerFromQuestion = (rawQuestion: string) => {
        const normalizedQuestion = normalizeEntityText(rawQuestion);
        return customerProfiles
          .map(customer => {
            const aliases = getCustomerAliases(customer);
            const matchedAlias = aliases
              .filter(alias => alias.length >= 2 && (
                normalizedQuestion.includes(alias) ||
                alias.includes(normalizedQuestion)
              ))
              .sort((a, b) => b.length - a.length)[0];
            return matchedAlias ? { customer, score: matchedAlias.length } : null;
          })
          .filter(Boolean)
          .sort((a, b) => (b?.score || 0) - (a?.score || 0))[0]?.customer || null;
      };

      const customerAliasesForAi = customerProfiles.slice(0, 150).map(customer => ({
        english: customer.companyName || customer.name,
        arabic: customer.companyNameAr || translateEntity(customer.companyName || customer.name, 'ar')
      }));
      const soaIntent = /(?:SOA|STATEMENT OF ACCOUNT|ACCOUNT STATEMENT|CUSTOMER ACCOUNT|كشف\s*حساب|كشف\s*الحساب|حساب العميل|حساب)/i.test(question);
      const collectedIntent = /(?:COLLECTED|RECEIVED|PAYMENTS?|PAID|COLLECTION|تحصيل|المحصل|المقبوض|مدفوعات|دفع)/i.test(question);
      if (soaIntent || (collectedIntent && /(?:CUSTOMER|عميل|لل|من)/i.test(question))) {
        const customer = findCustomerFromQuestion(question);
        if (customer) {
          const customerName = customer.companyName || customer.name;
          const customerOps = operations.filter(o => String(o.customerId || '') === String(customer.id) || String(o.customerName || '').trim().toUpperCase() === customerName.trim().toUpperCase());
          const customerInvoices = invoices.filter(i => String(i.customerId || '') === String(customer.id) || String(i.customerName || '').trim().toUpperCase() === customerName.trim().toUpperCase());
          const customerPayments = db.getPayments().filter(p => String(p.customerId || '') === String(customer.id) || String(p.customerName || '').trim().toUpperCase() === customerName.trim().toUpperCase());
          const unbilled = customerOps.filter(o => !o.invoiced).reduce((s, o) => s + (parseFloat(String(o.rate || '0').replace(/,/g,'')) || 0) + (parseFloat(String(o.vat || '0').replace(/,/g,'')) || 0), 0);
          const invoiced = customerInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);
          const unpaid = customerInvoices.filter(i => i.status === 'UNPAID').reduce((s, i) => s + (Number(i.amount) || 0), 0);
          const paidInvoices = customerInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (Number(i.amount) || 0), 0);
          const collected = customerPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const historical = Number(customer.pastOutstandingAmount) || 0;
          const netDue = historical + unpaid + unbilled;
          const recentPayments = [...customerPayments].sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
          const lastPayment = recentPayments.length ? ((isAr ? '\nآخر تحصيل: ' : '\nLast payment: ') + recentPayments[0].date + ' — ' + Number(recentPayments[0].amount || 0).toLocaleString() + ' EGP') : '';
          const answer = isAr
            ? 'كشف حساب: ' + customerName + '\nالعمليات: ' + customerOps.length + ' | الفواتير: ' + customerInvoices.length + '\nإجمالي الفواتير: ' + invoiced.toLocaleString() + ' EGP | المدفوع بالفواتير: ' + paidInvoices.toLocaleString() + ' EGP\nإجمالي التحصيل: ' + collected.toLocaleString() + ' EGP\nغير مسدد: ' + unpaid.toLocaleString() + ' EGP | غير مفوتر: ' + unbilled.toLocaleString() + ' EGP\nالرصيد المستحق: ' + netDue.toLocaleString() + ' EGP' + lastPayment
            : 'SOA: ' + customerName + '\nOperations: ' + customerOps.length + ' | Invoices: ' + customerInvoices.length + '\nInvoiced: ' + invoiced.toLocaleString() + ' EGP | Paid invoices: ' + paidInvoices.toLocaleString() + ' EGP\nTotal collected: ' + collected.toLocaleString() + ' EGP\nUnpaid: ' + unpaid.toLocaleString() + ' EGP | Unbilled: ' + unbilled.toLocaleString() + ' EGP\nNet due: ' + netDue.toLocaleString() + ' EGP' + lastPayment;
          setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
          return;
        }
        if (soaIntent) {
          setAiChatMessages(prev => [...prev, { role: 'ai', text: isAr ? 'حدد اسم العميل في السؤال لأعرض كشف الحساب.' : 'Please include the customer name so I can show the Statement of Account.' }]);
          return;
        }
      }

      // Fast customer/operation lookup: factual questions stay local and never wait for AI.
      const customerQuery = q.match(/(?:HOW MANY|COUNT|NUMBER OF|كام|عدد|كم).*?(?:OPERATIONS?|JOBS?|عمليه|عمليات)/i);
      if (customerQuery) {
        const customer = findCustomerFromQuestion(question);
        if (customer) {
          const customerName = customer.companyName || customer.name;
          const hits = operations.filter(o =>
            String(o.customerId || '') === String(customer.id) ||
            normalizeEntityText(o.customerName) === normalizeEntityText(customerName)
          );
          const displayName = isAr ? (customer.companyNameAr || translateEntity(customerName, 'ar')) : customerName;
          const answer = isAr ? `عدد العمليات لـ ${displayName}: ${hits.length}` : `Operations for ${customerName}: ${hits.length}`;
          setAiChatMessages(prev => [...prev, { role: 'ai', text: answer }]);
          return;
        }
      }

      // Only genuine analysis/reasoning reaches DALI. Keep the model payload tiny.
      const statusCounts = operations.reduce((m: Record<string, number>, o) => { m[o.status] = (m[o.status] || 0) + 1; return m; }, {});
      const portCounts = operations.reduce((m: Record<string, number>, o) => { const p = o.clipOnPort || '—'; m[p] = (m[p] || 0) + 1; return m; }, {});
      const context = {
        question,
        totals: { operations: operations.length, invoices: invoices.length, gensets: gensets.length, maintenance: maintenance.length },
        statusCounts,
        portCounts,
        recentOperations: operations.slice(0, 40).map(o => ({ bookingNumber:o.bookingNumber, containerNumber:o.containerNumber, gensetNumber:o.gensetNumber, customerName:o.customerName, status:o.status, clipOnPort:o.clipOnPort, clipOffPort:o.clipOffPort, operationDate:o.operationDate, rate:o.rate, vat:o.vat })),
        invoiceTotals: invoices.reduce((m: any, i: any) => { const amount=Number(i.amount)||0; m.billed+=amount; if(i.status==='PAID') m.paid+=amount; return m; }, { billed:0, paid:0 }),
        gensetStatusCounts: gensets.reduce((m: Record<string, number>, g) => { m[g.status] = (m[g.status] || 0) + 1; return m; }, {}),
        maintenanceCount: maintenance.length
      };
      const prompt = `You are DALI 1.0, Nile Fleet's fast operations assistant. Answer ONLY the question from LIVE DATA. Never invent. Maximum 3 short lines. If the question is factual and data is missing, say so. Arabic question: Arabic answer. Preserve IDs/numbers exactly.\n${creatorContext}\nQ:${question}\nDATA:${JSON.stringify(context)}`;
      const answer = await runThinkingAudit(prompt, 420);
      setAiChatMessages(prev => [...prev, { role: 'ai', text: answer || (isAr ? 'لم يصل رد من DALI 1.0.' : 'No response from DALI 1.0.') }]);
    } catch (e) {
      console.error('DALI chat error', e);
      const detail = e instanceof Error ? e.message : String(e);
      setAiChatMessages(prev => [...prev, {
        role: 'ai',
        text: isAr ? `خطأ DALI: ${detail}` : `DALI ERROR: ${detail}`
      }]);
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

  const toggleTheme = () => {
    const nextTheme = isDark ? 'white' : 'black';
    setTheme(nextTheme);
    setThemeIslandOpen(true);
    if (themeIslandTimerRef.current) clearTimeout(themeIslandTimerRef.current);
    themeIslandTimerRef.current = setTimeout(() => setThemeIslandOpen(false), 1800);
  };

  useEffect(() => () => {
    if (themeIslandTimerRef.current) clearTimeout(themeIslandTimerRef.current);
  }, []);

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

      {/* DALI 1.0 floating dashboard assistant — draggable */}
      <div
        className="fixed z-[100] no-print"
        style={{ right: daliButtonPosition.right, bottom: daliButtonPosition.bottom }}
      >
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
                <button data-dali-send onClick={askNileAi} disabled={aiChatLoading || !aiChatInput.trim()} className="self-end w-11 h-11 rounded-xl bg-[#001F3F] text-white disabled:opacity-40">➤</button>
              </div>
            </div>
          </div>
        )}
        <button
          data-dali-button
          onClick={() => { if (daliDraggedRef.current) { daliDraggedRef.current = false; return; } setIsAiChatOpen(v => !v); }}
          onPointerDown={handleDaliPointerDown}
          onPointerMove={handleDaliPointerMove}
          onPointerUp={handleDaliPointerUp}
          onPointerCancel={handleDaliPointerUp}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#001F3F] to-[#0a4b82] text-white shadow-2xl border border-white/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center text-2xl cursor-grab active:cursor-grabbing touch-none"
          title={isAr ? 'مساعد دالي — اسحب لتغيير المكان' : 'DALI 1.0 — drag to move'}
        >✦</button>
      </div>

      {/* MAIN CONTENT */}
      <main ref={mainContentRef} className={`flex-1 overflow-y-auto custom-scrollbar relative flex flex-col transition-colors duration-500 ${forceBanners.length > 0 ? 'mt-8' : ''}`} style={{ backgroundColor: 'var(--bg-primary)' }}>
        <header className="h-14 border-b flex items-center px-4 lg:px-6 justify-between sticky top-0 z-[40] shadow-sm backdrop-blur-md transition-colors no-print" style={{ backgroundColor: 'var(--rail-bg)', borderBottomColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-[#C2A378] rounded-full shadow-[0_0_8px_#C2A378]"></div>
            <h2 className={`text-xs lg:text-sm font-black uppercase tracking-tight italic ${textPrimary}`}>{activeScreen.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-2">
            {isCreator && <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#C2A37866] bg-[#C2A37815] text-[#C2A378] text-[8px] font-black uppercase tracking-widest" title="System Creator">👑 {isAr ? 'منشئ النظام' : 'CREATOR'}</span>}
            <button 
              onClick={() => setIsMuted(!isMuted)} 
              className={`p-1.5 rounded-lg border transition-all ${isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}
              title={isMuted ? (isAr ? 'إلغاء كتم التنبيهات' : 'Unmute Notifications') : (isAr ? 'كتم التنبيهات' : 'Mute Notifications')}
            >
               <span className="text-base">{isMuted ? '🔇' : '🔊'}</span>
            </button>
            <button
              onClick={toggleTheme}
              className={`relative p-1.5 rounded-lg border transition-all overflow-hidden ${isTerminal ? 'border-[#C2A37844] bg-white/5 text-[#C2A378]' : 'border-slate-200 bg-white'}`}
              title={isDark ? (isAr ? 'الوضع الفاتح' : 'Light Mode') : (isAr ? 'الوضع الداكن' : 'Dark Mode')}
              aria-label={isDark ? 'Light Mode' : 'Dark Mode'}
            >
              <span className={`block text-base leading-none transition-all duration-500 ${isDark ? 'rotate-0' : 'rotate-180'}`}>{isDark ? '☀️' : '🌙'}</span>
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
          {themeIslandOpen && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#001F3F] dark:bg-white text-white dark:text-[#001F3F] shadow-2xl border border-[#C2A37866] animate-in fade-in zoom-in-95 duration-300">
                <span className="text-sm animate-spin">{isDark ? '☀️' : '🌙'}</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{isDark ? (isAr ? 'الوضع الداكن' : 'DARK MODE') : (isAr ? 'الوضع الفاتح' : 'LIGHT MODE')}</span>
              </div>
            </div>
          )}
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