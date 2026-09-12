
import React, { useState, createContext, useContext, useEffect } from 'react';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Operations from './screens/Operations';
import StockManagement from './screens/StockManagement';
import Reservations from './screens/Reservations';
import Customers from './screens/Customers';
import CustomerPrices from './screens/CustomerPrices';
import Financials from './screens/Financials';
import ExpenseHub from './screens/ExpenseHub';
import HistoryLog from './screens/HistoryLog';
import Intelligence from './screens/Intelligence';
import Reports from './screens/Reports';
import CustomerPortal from './screens/CustomerPortal';
import MasterView from './screens/MasterView';
import Analytics from './screens/Analytics';
import UserSettings from './screens/UserSettings';
import PortGateControl from './screens/PortGateControl';
import UserMgmt from './screens/UserMgmt';
import CustomerService from './screens/CustomerService';
import BookingInvoices from './screens/BookingInvoices';
import Notifications from './screens/Notifications';
import Layout from './components/Layout';
import { User, UserRole } from './types';
import { db } from './services/mockDb';
import { discoveryQueue, registerDynamicTranslations } from './translations';
import { translateBusinessEntities, getSafeApiKey } from './services/aiService';

type Language = 'en' | 'ar';
export type ThemeMode = 'black' | 'white' | 'yellow' | 'navy' | 'forest' | 'sahara' | 'cyber' | 'slate' | 'midnight' | 'rose' | 'emerald-vibrant' | 'ocean' | 'lava' | 'phantom' | 'mint' | 'copper' | 'arctic' | 'toxic' | 'custom';

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
}
export const LanguageContext = createContext<LanguageContextType>({ lang: 'en', setLang: () => {} });

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  scale: number;
  setScale: (s: number) => void;
  isMuted: boolean;
  setIsMuted: (m: boolean) => void;
  isDark: boolean;
  updateCustomTheme: (colors: {
    bg: string;
    text: string;
    textSec: string;
    card: string;
    accent: string;
    border: string;
    input: string;
    isDark: boolean;
    rowBg?: string;
    railBg?: string;
  }) => void;
}
export const ThemeContext = createContext<ThemeContextType>({ 
  theme: 'rose', 
  setTheme: () => {},
  scale: 0.85,
  setScale: () => {},
  isMuted: false,
  setIsMuted: () => {},
  isDark: false,
  updateCustomTheme: () => {}
});

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [theme, setTheme] = useState<ThemeMode>(() => {
    return (localStorage.getItem('theme') as ThemeMode) || 'rose';
  });

  const [scale, setScale] = useState<number>(() => {
    const saved = localStorage.getItem('app_scale');
    return saved ? parseFloat(saved) : 0.85;
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('app_muted') === 'true';
  });

  const [customThemeKey, setCustomThemeKey] = useState<number>(0);

  const [activeScreen, setActiveScreen] = useState<string>(user?.role === UserRole.GATE_OPERATOR ? 'port-gate' : 'dashboard');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app_lang');
    return (saved === 'ar' || saved === 'en') ? saved : 'en';
  });
  const [langUpdateKey, setLangUpdateKey] = useState(0);

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
  }, [lang]);

  const getIsDark = (currentTheme: ThemeMode): boolean => {
    if (currentTheme === 'custom') {
      return localStorage.getItem('custom_is_dark') === 'true';
    }
    const DARK_THEMES = ['black', 'navy', 'forest', 'sahara', 'cyber', 'slate', 'midnight', 'toxic', 'lava', 'copper', 'phantom'];
    return DARK_THEMES.includes(currentTheme);
  };

  const isDark = getIsDark(theme);

  const updateCustomTheme = (colors: {
    bg: string;
    text: string;
    textSec: string;
    card: string;
    accent: string;
    border: string;
    input: string;
    isDark: boolean;
    rowBg?: string;
    railBg?: string;
  }) => {
    localStorage.setItem('custom_bg_primary', colors.bg);
    localStorage.setItem('custom_text_primary', colors.text);
    localStorage.setItem('custom_text_secondary', colors.textSec);
    localStorage.setItem('custom_card_bg', colors.card);
    localStorage.setItem('custom_accent', colors.accent);
    localStorage.setItem('custom_border_primary', colors.border);
    localStorage.setItem('custom_input_bg', colors.input);
    localStorage.setItem('custom_is_dark', colors.isDark ? 'true' : 'false');
    if (colors.rowBg !== undefined) localStorage.setItem('custom_row_bg', colors.rowBg);
    if (colors.railBg !== undefined) localStorage.setItem('custom_rail_bg', colors.railBg);
    setCustomThemeKey(prev => prev + 1);
  };

  useEffect(() => {
    localStorage.setItem('app_muted', isMuted.toString());
  }, [isMuted]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const applyCustomThemeStyles = () => {
      if (theme === 'custom') {
        const customBg = localStorage.getItem('custom_bg_primary') || '#ffffff';
        const customText = localStorage.getItem('custom_text_primary') || '#0f172a';
        const customSec = localStorage.getItem('custom_text_secondary') || '#475569';
        const customCard = localStorage.getItem('custom_card_bg') || '#ffffff';
        const customAccent = localStorage.getItem('custom_accent') || '#3b82f6';
        const customBorder = localStorage.getItem('custom_border_primary') || '#e2e8f0';
        const customInput = localStorage.getItem('custom_input_bg') || '#f8fafc';
        const customRowBg = localStorage.getItem('custom_row_bg') || customCard;
        const customRailBg = localStorage.getItem('custom_rail_bg') || (localStorage.getItem('custom_is_dark') === 'true' ? '#001224' : '#ffffff');
        const customIsDarkVal = localStorage.getItem('custom_is_dark') === 'true';

        let styleEl = document.getElementById('theme-custom-style') as HTMLStyleElement;
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'theme-custom-style';
          document.head.appendChild(styleEl);
        }
        styleEl.innerHTML = `
          body.theme-custom {
              --bg-primary: ${customBg};
              --text-primary: ${customText};
              --text-secondary: ${customSec};
              --border-primary: ${customBorder};
              --card-bg: ${customCard};
              --accent: ${customAccent};
              --input-bg: ${customInput};
              --row-bg: ${customRowBg};
              --rail-bg: ${customRailBg};
          }
          body.theme-custom .bg-white, body.theme-custom .bg-slate-50, body.theme-custom .bg-slate-100 { 
              background-color: var(--card-bg) !important; 
              color: var(--text-primary) !important; 
          }
          body.theme-custom input, body.theme-custom select, body.theme-custom textarea {
              background-color: var(--input-bg) !important;
              color: var(--text-primary) !important;
              border-color: var(--border-primary) !important;
          }
        `;
      } else {
        const styleEl = document.getElementById('theme-custom-style');
        if (styleEl) {
          styleEl.remove();
        }
      }
    };

    applyCustomThemeStyles();
  }, [theme, customThemeKey]);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-scale', scale.toString());
    localStorage.setItem('app_scale', scale.toString());
  }, [scale]);

  /**
   * AI LINGUISTIC OBSERVER
   * Automatically monitors the UI for untranslated text andConsults Gemini
   */
  useEffect(() => {
    if (lang !== 'ar' || !getSafeApiKey()) return;

    let isProcessing = false;
    const observer = setInterval(async () => {
      if (isProcessing || discoveryQueue.size === 0) return;
      
      isProcessing = true;
      const wordsToTranslate = Array.from(discoveryQueue).slice(0, 10);
      discoveryQueue.clear(); // Clear so we don't double process

      try {
        console.debug("AI Translation Observer: Encountered new entities...", wordsToTranslate);
        const mappings = await translateBusinessEntities(wordsToTranslate);
        if (mappings && Object.keys(mappings).length > 0) {
          registerDynamicTranslations(mappings);
          setLangUpdateKey(prev => prev + 1); // Trigger UI Refresh
        }
      } catch (err) {
        console.error("Linguistic Node Failed:", err);
      } finally {
        isProcessing = false;
      }
    }, 2000);

    return () => clearInterval(observer);
  }, [lang]);

  // Handle refresh events from translations.ts
  useEffect(() => {
    const refresh = () => setLangUpdateKey(prev => prev + 1);
    window.addEventListener('lang-discovered', refresh);
    return () => window.removeEventListener('lang-discovered', refresh);
  }, []);

  // Sync current user if modified in DB
  useEffect(() => {
    const syncUser = () => {
      if (!user?.id) return;
      const refreshed = db.getUsers().find(u => u.id === user.id);
      if (refreshed) {
        if (refreshed.revoked) {
          alert('Your access permissions have been suspended or revoked by System Administration.');
          handleLogout();
          return;
        }
        setUser({ ...refreshed });
        localStorage.setItem('user', JSON.stringify(refreshed));
      }
    };
    window.addEventListener('db-undo-success', syncUser);
    return () => window.removeEventListener('db-undo-success', syncUser);
  }, [user?.id]);

  const handleLogin = (email: string, pass: string) => {
    const found = db.getUsers().find(u => u.email === email && u.password === pass);
    if (found) {
      if (found.revoked) {
        alert(lang === 'ar' ? 'تم تعليق هذا الحساب من قبل الإدارة' : 'This account access has been suspended/revoked by system administrator.');
        return;
      }
      const u: User = { ...found };
      setUser(u);
      localStorage.setItem('user', JSON.stringify(u));
      setActiveScreen(u.role === UserRole.GATE_OPERATOR ? 'port-gate' : (u.role !== UserRole.CUSTOMER ? 'dashboard' : 'cust-reservations'));
    } else {
      alert(lang === 'ar' ? 'فشل المصادقة' : 'Authentication failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const navigateTo = (screen: string, id?: string) => {
    setHighlightId(id || null);
    setActiveScreen(screen);
  };

  if (!user) {
    return (
      <LanguageContext value={{ lang, setLang }}>
        <ThemeContext value={{ theme, setTheme, scale, setScale, isMuted, setIsMuted, isDark, updateCustomTheme }}>
          <Login onLogin={handleLogin} />
        </ThemeContext>
      </LanguageContext>
    );
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard': return <Dashboard onNavigate={navigateTo} />;
      case 'analytics': return <Analytics />;
      case 'master-view': return <MasterView key={`mv-${langUpdateKey}`} />;
      case 'port-gate': return <PortGateControl key={`pg-${langUpdateKey}`} />;
      case 'operations': return <Operations highlightId={highlightId} clearHighlight={() => setHighlightId(null)} key={`ops-${langUpdateKey}`} />;
      case 'booking-invoices': return <BookingInvoices />;
      case 'intelligence': return <Intelligence />;
      case 'reports': return <Reports />;
      case 'stock': return <StockManagement />;
      case 'reservations': return <Reservations />;
      case 'customers': return <Customers key={`cust-${langUpdateKey}`} />;
      case 'user-mgmt': return <UserMgmt />;
      case 'customer-prices': return <CustomerPrices />;
      case 'financials': return <Financials key={`fin-${langUpdateKey}`} />;
      case 'expense-hub': return <ExpenseHub key={`exp-${langUpdateKey}`} />;
      case 'support': return <CustomerService />;
      case 'notifications': return <Notifications />;
      case 'system-log': return <HistoryLog />;
      case 'user-settings': return <UserSettings user={user} onUpdate={(updates) => {
        const updated = { ...user, ...updates };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
      }} />;
      case 'cust-reservations': return <CustomerPortal user={user} type="reservations" />;
      case 'cust-invoices': return <CustomerPortal user={user} type="invoices" />;
      default: return <Dashboard onNavigate={navigateTo} />;
    }
  };

  return (
    <LanguageContext value={{ lang, setLang }}>
      <ThemeContext value={{ theme, setTheme, scale, setScale, isMuted, setIsMuted, isDark, updateCustomTheme }}>
        <Layout 
          user={user} 
          onLogout={handleLogout} 
          activeScreen={activeScreen} 
          setActiveScreen={(s) => { setHighlightId(null); setActiveScreen(s); }}
        >
          {renderScreen()}
        </Layout>
      </ThemeContext>
    </LanguageContext>
  );
};

export default App;
