
import React, { useState, useMemo, useContext, useEffect, useRef } from 'react';
import { db } from '../services/supabaseDb';
import { Operation, Location, GensetStatus, UserRole, User, CustomerPrice, Invoice } from '../types';
import { LanguageContext, ThemeContext } from '../App';
import { translations, translateEntity, registerDynamicTranslation } from '../translations';
import { PORT_STYLING } from '../constants';
import { mapSpreadsheetToSchema } from '../services/aiService';
import InvoiceView from '../components/InvoiceView';

type SortConfig = {
  key: keyof Operation;
  direction: 'asc' | 'desc';
} | null;

interface StagingRow extends Partial<Operation> {
  quantity: number;
}

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  checkbox: 36,
  bookingNumber: 125,
  customerName: 140,
  trucker: 110,
  shipper: 110,
  clipOnPort: 85,
  clipOffPort: 85,
  destination: 150,
  containerNumber: 120,
  gensetNumber: 90,
  rate: 80,
  status: 110,
  operationDate: 100,
  clipOnDate: 100,
  commodity: 120,
  clipperName: 125,
  notes: 140,
  invoice: 130
};

const allPorts: string[] = ['DAM', 'ALEX', 'GOUDA', 'SOKHNA', 'SCCT', 'PSD'];
const STATUS_CYCLE: string[] = ['UNDER OPERATE', 'IN PROGRESS', 'DONE', 'HOLD', 'CANCEL'];

const getContrastColor = (bgClass: string, isDarkTerminal: boolean) => {
  if (isDarkTerminal) {
    if (bgClass.includes('slate-900') || bgClass.includes('slate-950') || bgClass.includes('blue-900')) return 'text-white';
    if (bgClass.includes('emerald-900')) return 'text-emerald-400';
    if (bgClass.includes('bg-[#001F3F]')) return 'text-[#C2A378]';
    return 'text-slate-100';
  }
  const lightColors = ['bg-white', 'bg-slate-50', 'bg-blue-50', 'bg-[#98FFD9]', 'bg-[#FFEB3B]', 'bg-amber-50', 'bg-emerald-50'];
  const isLight = lightColors.some(c => bgClass.includes(c));
  return isLight ? 'text-slate-900' : 'text-white';
};

const getDarkPortStyle = (loc: Location) => {
  const styles: Record<string, { backgroundColor: string; color: string; borderColor: string; boxShadow: string }> = {
    [Location.DAM]: { backgroundColor:'rgba(16,185,129,.22)',color:'#6EE7B7',borderColor:'#34D399',boxShadow:'0 0 10px rgba(52,211,153,.18)' },
    [Location.ALEX]: { backgroundColor:'rgba(234,179,8,.22)',color:'#FDE047',borderColor:'#FACC15',boxShadow:'0 0 10px rgba(250,204,21,.18)' },
    [Location.GOUDA]: { backgroundColor:'rgba(37,99,235,.24)',color:'#93C5FD',borderColor:'#60A5FA',boxShadow:'0 0 10px rgba(96,165,250,.18)' },
    [Location.SOKHNA]: { backgroundColor:'rgba(249,115,22,.24)',color:'#FDBA74',borderColor:'#FB923C',boxShadow:'0 0 10px rgba(251,146,60,.18)' },
    [Location.SCCT]: { backgroundColor:'rgba(14,165,233,.22)',color:'#7DD3FC',borderColor:'#38BDF8',boxShadow:'0 0 10px rgba(56,189,248,.18)' },
    [Location.PSD]: { backgroundColor:'rgba(124,58,237,.25)',color:'#C4B5FD',borderColor:'#A78BFA',boxShadow:'0 0 10px rgba(167,139,250,.18)' },
    [Location.MAL]: { backgroundColor:'rgba(34,197,94,.22)',color:'#86EFAC',borderColor:'#4ADE80',boxShadow:'0 0 10px rgba(74,222,128,.18)' },
    [Location.WORKSHOP]: { backgroundColor:'rgba(100,116,139,.28)',color:'#CBD5E1',borderColor:'#94A3B8',boxShadow:'0 0 10px rgba(148,163,184,.16)' }
  };
  return styles[loc] || { backgroundColor:'rgba(71,85,105,.28)',color:'#E2E8F0',borderColor:'#64748B',boxShadow:'none' };
};

interface EditableCellProps {
  value: string;
  onSave: (val: string) => void;
  type?: string;
  suggestions?: string[];
  options?: string[]; 
  placeholder?: string;
  className?: string;
  isError?: boolean;
  disabled?: boolean;
  strict?: boolean;
  isDark: boolean;
  renderValue?: (val: string) => React.ReactNode; 
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave, type, suggestions, options, placeholder, className, isError, disabled, strict, isDark, renderValue }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const listId = useMemo(() => `list-${Math.random().toString(36).substr(2, 9)}`, []);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (strict && suggestions && currentValue && !suggestions.includes(currentValue)) {
      setCurrentValue(value);
      return;
    }
    if (currentValue !== value) onSave(currentValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleBlur();
    else if (e.key === 'Escape') { setCurrentValue(value); setIsEditing(false); }
  };

  if (isEditing && !disabled) {
    if (options) {
      return (
        <select
          ref={inputRef as any}
          className={`w-full px-1 py-0.5 text-[10px] font-black uppercase rounded border-2 border-blue-500 outline-none shadow-sm ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-black'}`}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown as any}
        >
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    return (
      <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef as any}
          type={type || 'text'}
          list={listId}
          className={`w-full px-2 py-1 text-[10px] font-bold border-2 border-blue-500 rounded outline-none shadow-sm ${isDark ? 'bg-slate-950 text-white border-blue-400' : 'bg-white text-black'} ${className}`}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {suggestions && (
          <datalist id={listId}>
            {suggestions.map((s, idx) => <option key={idx} value={s} />)}
          </datalist>
        )}
      </div>
    );
  }

  return (
    <div 
      onClick={(e) => { if(!disabled) { e.stopPropagation(); setIsEditing(true); } }}
      className={`group min-h-[1.2rem] flex items-center px-1 rounded transition-colors ${!disabled ? 'cursor-pointer' : 'cursor-default'} ${isDark ? 'hover:bg-white/5 border-transparent' : 'hover:bg-black/5 border-transparent'} ${isError ? 'bg-red-600 text-white animate-pulse' : ''} ${className}`}
    >
      <div className="flex-1 whitespace-nowrap overflow-visible">
        {renderValue ? renderValue(value) : (value || <span className={`${isDark ? 'text-slate-600' : 'text-slate-300'} italic text-[9px]`}>{placeholder || '---'}</span>)}
      </div>
      {!disabled && <span className={`ml-1 opacity-0 group-hover:opacity-40 text-[7px] ${isDark ? 'text-white' : 'text-black'}`}>✎</span>}
    </div>
  );
};

interface MultiSelectDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  isDark: boolean;
}

export interface DateFilterConfig {
  startDate: string;
  endDate: string;
  field: 'operationDate' | 'clipOnDate' | 'any';
  preset: string;
}

const DateFilterDropdown = ({ 
  filter, 
  onChange, 
  isDark, 
  totalFilteredCount 
}: { 
  filter: DateFilterConfig; 
  onChange: (f: DateFilterConfig) => void; 
  isDark: boolean; 
  totalFilteredCount: number; 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang } = useContext(LanguageContext);
  const isAr = lang === 'ar';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const applyPreset = (presetKey: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let startDate = '';
    let endDate = '';

    if (presetKey === 'today') {
      startDate = formatYMD(now);
      endDate = formatYMD(now);
    } else if (presetKey === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      startDate = formatYMD(y);
      endDate = formatYMD(y);
    } else if (presetKey === 'last7days') {
      const st = new Date();
      st.setDate(st.getDate() - 6);
      startDate = formatYMD(st);
      endDate = formatYMD(now);
    } else if (presetKey === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = formatYMD(firstDay);
      endDate = formatYMD(lastDay);
    } else if (presetKey === 'lastMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = formatYMD(firstDay);
      endDate = formatYMD(lastDay);
    } else if (presetKey === 'thisYear') {
      startDate = `${now.getFullYear()}-01-01`;
      endDate = `${now.getFullYear()}-12-31`;
    } else if (presetKey === 'all') {
      startDate = '';
      endDate = '';
    }

    onChange({
      ...filter,
      preset: presetKey,
      startDate,
      endDate
    });
  };

  const handleCustomDateChange = (type: 'start' | 'end', val: string) => {
    onChange({
      ...filter,
      preset: 'custom',
      startDate: type === 'start' ? val : filter.startDate,
      endDate: type === 'end' ? val : filter.endDate
    });
  };

  const handleFieldChange = (field: 'operationDate' | 'clipOnDate' | 'any') => {
    onChange({
      ...filter,
      field
    });
  };

  const clearFilter = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange({
      startDate: '',
      endDate: '',
      field: 'operationDate',
      preset: 'all'
    });
  };

  const isActive = Boolean((filter.preset && filter.preset !== 'all') || filter.startDate || filter.endDate);

  const getButtonLabel = () => {
    if (!isActive) return isAr ? 'فلترة بالتاريخ' : 'Filter by Date';
    if (filter.preset === 'today') return isAr ? 'اليوم' : 'Today';
    if (filter.preset === 'yesterday') return isAr ? 'أمس' : 'Yesterday';
    if (filter.preset === 'last7days') return isAr ? 'آخر 7 أيام' : 'Last 7 Days';
    if (filter.preset === 'thisMonth') return isAr ? 'هذا الشهر' : 'This Month';
    if (filter.preset === 'lastMonth') return isAr ? 'الشهر الماضي' : 'Last Month';
    if (filter.preset === 'thisYear') return isAr ? 'هذا العام' : 'This Year';
    if (filter.startDate && filter.endDate) {
      return filter.startDate === filter.endDate ? filter.startDate : `${filter.startDate} ~ ${filter.endDate}`;
    }
    if (filter.startDate) return `≥ ${filter.startDate}`;
    if (filter.endDate) return `≤ ${filter.endDate}`;
    return isAr ? 'تاريخ محدد' : 'Custom Date';
  };

  const presets = [
    { key: 'all', labelAr: 'الكل (الكل)', labelEn: 'All Time' },
    { key: 'today', labelAr: 'اليوم', labelEn: 'Today' },
    { key: 'yesterday', labelAr: 'أمس', labelEn: 'Yesterday' },
    { key: 'last7days', labelAr: 'آخر 7 أيام', labelEn: 'Last 7 Days' },
    { key: 'thisMonth', labelAr: 'هذا الشهر', labelEn: 'This Month' },
    { key: 'lastMonth', labelAr: 'الشهر الماضي', labelEn: 'Last Month' },
    { key: 'thisYear', labelAr: 'هذا العام', labelEn: 'This Year' },
  ];

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm ${
            isActive
              ? (isDark ? 'bg-blue-950/80 border-blue-500 text-blue-300 ring-2 ring-blue-500/40' : 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/30')
              : (isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-blue-400' : 'bg-white border-slate-200 text-slate-800 hover:border-blue-400')
          }`}
          title={isAr ? "فلترة العمليات حسب التاريخ" : "Filter manifest operations by date range"}
        >
          <span className="text-xs">📅</span>
          <span className="truncate max-w-[130px] font-bold">{getButtonLabel()}</span>
          {isActive && (
            <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[8px] font-mono">
              {totalFilteredCount}
            </span>
          )}
          <svg className={`w-3 h-3 transition-transform text-slate-400 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isActive && (
          <button
            type="button"
            onClick={clearFilter}
            className={`p-1.5 ml-1 rounded-lg border text-[10px] font-bold transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-red-900/50 hover:text-red-300 hover:border-red-500' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300'}`}
            title={isAr ? "مسح فلتر التاريخ" : "Clear date filter"}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div 
          className={`absolute top-full ${isAr ? 'right-0' : 'left-0'} mt-2 w-80 shadow-2xl rounded-2xl z-[70] p-3.5 border animate-in fade-in zoom-in-95 duration-150 ${
            isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-slate-200'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">📅</span>
              <span className="font-black text-[11px] uppercase tracking-wider">
                {isAr ? 'فلترة سجل العمليات بالتاريخ' : 'Date Range Filter'}
              </span>
            </div>
            {isActive && (
              <button
                type="button"
                onClick={() => clearFilter()}
                className="text-[9px] text-red-400 hover:text-red-300 font-bold underline"
              >
                {isAr ? 'إلغاء الفلتر' : 'Clear'}
              </button>
            )}
          </div>

          {/* Target Date Field */}
          <div className="mb-3">
            <div className="text-[9px] font-black uppercase text-slate-400 mb-1.5">
              {isAr ? 'تطبيق الفلترة على حقل:' : 'Apply filter to field:'}
            </div>
            <div className="grid grid-cols-3 gap-1 bg-black/10 dark:bg-white/5 p-1 rounded-xl border border-white/5 text-[9px] font-bold">
              <button
                type="button"
                onClick={() => handleFieldChange('operationDate')}
                className={`py-1 px-1.5 rounded-lg text-center transition-all truncate ${filter.field === 'operationDate' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title={isAr ? "تاريخ التشغيل" : "Operation Date"}
              >
                {isAr ? 'تاريخ التشغيل' : 'Op Date'}
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('clipOnDate')}
                className={`py-1 px-1.5 rounded-lg text-center transition-all truncate ${filter.field === 'clipOnDate' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title={isAr ? "تاريخ التركيب" : "Clip On Date"}
              >
                {isAr ? 'تاريخ التركيب' : 'Clip On'}
              </button>
              <button
                type="button"
                onClick={() => handleFieldChange('any')}
                className={`py-1 px-1.5 rounded-lg text-center transition-all truncate ${filter.field === 'any' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                title={isAr ? "أي من التاريخين" : "Either Date"}
              >
                {isAr ? 'أي منهما' : 'Any Date'}
              </button>
            </div>
          </div>

          {/* Presets */}
          <div className="mb-3">
            <div className="text-[9px] font-black uppercase text-slate-400 mb-1.5">
              {isAr ? 'فترات سريعة جاهزة:' : 'Quick Presets:'}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {presets.map(p => {
                const isSelected = filter.preset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key)}
                    className={`py-1.5 px-2 rounded-xl text-[9px] font-bold transition-all border text-center ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md font-black'
                        : isDark
                        ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isAr ? p.labelAr : p.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Date Inputs */}
          <div className="pt-2 border-t border-white/10">
            <div className="text-[9px] font-black uppercase text-slate-400 mb-1.5">
              {isAr ? 'أو حدد نطاق التاريخ يدوياً:' : 'Or custom date range:'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[8px] font-bold text-slate-400 mb-1">
                  {isAr ? 'من تاريخ:' : 'From:'}
                </label>
                <input
                  type="date"
                  value={filter.startDate}
                  onChange={(e) => handleCustomDateChange('start', e.target.value)}
                  className={`w-full px-2 py-1.5 rounded-xl border text-[10px] font-bold outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold text-slate-400 mb-1">
                  {isAr ? 'إلى تاريخ:' : 'To:'}
                </label>
                <input
                  type="date"
                  value={filter.endDate}
                  onChange={(e) => handleCustomDateChange('end', e.target.value)}
                  className={`w-full px-2 py-1.5 rounded-xl border text-[10px] font-bold outline-none focus:border-blue-500 ${
                    isDark ? 'bg-slate-950 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Footer status & done */}
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[9px]">
            <div className="text-slate-400 font-bold">
              {isAr ? `العمليات المطابقة: ` : `Matching records: `}
              <span className="text-blue-400 font-mono font-black">{totalFilteredCount}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[9px] shadow"
            >
              {isAr ? 'تم' : 'Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MultiSelectDropdown = ({ label, options, selected, onChange, isDark }: MultiSelectDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang } = useContext(LanguageContext);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
    else onChange([...selected, opt]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-blue-400' : 'bg-white border-slate-200 text-black hover:border-blue-400'} ${selected.length > 0 ? `ring-1 ring-blue-500/30` : ''}`}
      >
        <span>{label}</span>
        {selected.length > 0 && <span className={`bg-blue-600 text-white px-1.5 rounded-full text-[8px]`}>{selected.length}</span>}
        <svg className={`w-3 h-3 transition-transform text-slate-500 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {isOpen && (
        <div className={`absolute top-full ${lang === 'ar' ? 'right-0' : 'left-0'} mt-1 w-48 shadow-2xl rounded-xl z-[60] py-2 animate-in fade-in zoom-in-95 duration-100 ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}>
          <div className="max-h-60 overflow-y-auto px-1">
            {options.map(opt => (
              <label key={opt} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer group ${isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} />
                <span className={`text-[10px] font-bold uppercase tracking-tight ${selected.includes(opt) ? (isDark ? 'text-blue-400' : 'text-blue-700') : (isDark ? 'text-slate-400' : 'text-black')}`}>{translateEntity(opt, lang)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MasterView: React.FC = () => {
  const { lang } = useContext(LanguageContext);
  const { theme, isDark } = useContext(ThemeContext);
  const t = translations[lang];
  const isAr = lang === 'ar';

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('user') || '{}') as User, []);
  const isReadOnly = currentUser.role === UserRole.VIEWER;
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const [operations, setOperations] = useState<Operation[]>(db.getOperations());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPorts, setSelectedPorts] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilterConfig>({
    startDate: '',
    endDate: '',
    field: 'operationDate',
    preset: 'all'
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [collapsedStatusGroups, setCollapsedStatusGroups] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Invoice state handlers
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'PAID' | 'UNPAID'>('UNPAID');
  const [editEtaStatus, setEditEtaStatus] = useState<'DRAFT' | 'SUBMITTED' | 'VALID' | 'INVALID'>('DRAFT');

  const handleOpenEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditAmount(inv.amount);
    setEditDate(inv.date);
    setEditDueDate(inv.dueDate || '');
    setEditStatus(inv.status);
    setEditEtaStatus(inv.etaStatus || 'DRAFT');
  };

  const handleSaveEditInvoice = () => {
    if (!editingInvoice) return;
    db.updateInvoice(editingInvoice.id, {
      amount: editAmount,
      date: editDate,
      dueDate: editDueDate || undefined,
      status: editStatus,
      etaStatus: editEtaStatus
    });
    setEditingInvoice(null);
    refresh();
  };

  const handleQuickGenerateInvoice = async (bookingNumber: string, customerName: string) => {
    const freshInvoice = await db.generateInvoiceFromBooking(bookingNumber, customerName);
    if (freshInvoice) {
      alert(isAr 
        ? `تم إنشاء الفاتورة بنجاح رقم ${freshInvoice.id} بمبلغ ${freshInvoice.amount.toLocaleString()} ج.م.`
        : `Invoice ${freshInvoice.id} generated successfully for EGP ${freshInvoice.amount.toLocaleString()}`
      );
      refresh();
    } else {
      alert(isAr
        ? 'حدث خطأ: تأكد من وجود عمليات مكتملة وغير مفوترة لهذا الحجز.'
        : 'Error: Make sure there are completed operations (status DONE) that have not been invoiced yet.'
      );
    }
  };
  
  const todayDate = new Date().toISOString().split('T')[0];

  const [stagedOps, setStagedOps] = useState<any[]>([
    { customerName: '', bookingNumber: '', gensetNumber: '', operationDate: todayDate, clipOnDate: todayDate, status: 'UNDER OPERATE', rate: '0', vat: '0', clipOnPort: Location.ALEX, clipOffPort: Location.ALEX, destination: '', trucker: '', beneficiaryName: '', quantity: 1 }
  ]);
  const [rawPasteBuffer, setRawPasteBuffer] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const [viewPrefs, setViewPrefs] = useState<{
    density: number;
    scale: number;
  }>(() => {
    try {
      const saved = localStorage.getItem(`master_prefs_v5_${currentUser.id}`);
      return saved ? { density: 4, scale: 100, ...JSON.parse(saved) } : { density: 4, scale: 100 };
    } catch {
      localStorage.removeItem(`master_prefs_v5_${currentUser.id}`);
      return { density: 4, scale: 100 };
    }
  });

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`master_col_widths_${currentUser.id}`);
      const parsed = saved ? JSON.parse(saved) : {};
      const safe: Record<string, number> = {};
      Object.keys(DEFAULT_COLUMN_WIDTHS).forEach(key => {
        const value = Number(parsed?.[key] ?? DEFAULT_COLUMN_WIDTHS[key]);
        safe[key] = Number.isFinite(value) ? Math.max(35, Math.min(500, value)) : DEFAULT_COLUMN_WIDTHS[key];
      });
      return safe;
    } catch {
      localStorage.removeItem(`master_col_widths_${currentUser.id}`);
      return { ...DEFAULT_COLUMN_WIDTHS };
    }
  });

  useEffect(() => {
    localStorage.setItem(`master_col_widths_${currentUser.id}`, JSON.stringify(colWidths));
  }, [colWidths, currentUser.id]);

  const duplicateContainerNumbers = useMemo(() => {
    const counts: Record<string, number> = {};
    operations.forEach(op => {
      const cnt = op.containerNumber?.trim().toUpperCase();
      if (cnt && cnt !== '---' && cnt !== 'N/A' && cnt !== 'NONE') {
        counts[cnt] = (counts[cnt] || 0) + 1;
      }
    });
    const set = new Set<string>();
    Object.entries(counts).forEach(([cnt, count]) => {
      if (count > 1) set.add(cnt);
    });
    return set;
  }, [operations]);

  const duplicateActiveGensets = useMemo(() => {
    const counts: Record<string, number> = {};
    operations.forEach(op => {
      const isInProgress = op.status === 'IN PROGRESS';
      const gen = op.gensetNumber?.trim().toUpperCase();
      if (gen && gen !== '---' && gen !== 'N/A' && gen !== 'NONE' && isInProgress) {
        counts[gen] = (counts[gen] || 0) + 1;
      }
    });
    const set = new Set<string>();
    Object.entries(counts).forEach(([gen, count]) => {
      if (count > 1) set.add(gen);
    });
    return set;
  }, [operations]);

  const resizingRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const resizeFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      resizingRef.current = null;
    };
  }, []);

  const handleMouseDownResize = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Always terminate a previous drag before starting another one.
    resizeCleanupRef.current?.();
    resizeCleanupRef.current = null;

    const startX = e.clientX;
    const startWidth = Number(colWidths[colKey] ?? DEFAULT_COLUMN_WIDTHS[colKey] ?? 100);
    const safeStartWidth = Number.isFinite(startWidth) ? Math.max(35, Math.min(500, startWidth)) : 100;
    const resizeColumnKey = colKey;
    const resizeStartX = startX;
    const resizeStartWidth = safeStartWidth;

    resizingRef.current = { colKey: resizeColumnKey, startX: resizeStartX, startWidth: resizeStartWidth };

    let lastWidth = resizeStartWidth;
    const finishResize = () => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
      resizeCleanupRef.current = null;
      resizingRef.current = null;
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const deltaX = moveEvent.clientX - resizeStartX;
      const actualDelta = isAr ? -deltaX : deltaX;
      lastWidth = Math.max(35, Math.min(500, resizeStartWidth + actualDelta));

      // Throttle React state updates to one per animation frame. This prevents
      // a rapid mousemove stream from overwhelming the Master View render cycle.
      if (resizeFrameRef.current === null) {
        resizeFrameRef.current = requestAnimationFrame(() => {
          resizeFrameRef.current = null;
          if (resizingRef.current) {
            setColWidths(prev => ({ ...prev, [resizeColumnKey]: lastWidth }));
          }
        });
      }
    };

    const handleMouseUp = () => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      setColWidths(prev => ({ ...prev, [resizeColumnKey]: lastWidth }));
      finishResize();
    };

    const handleWindowBlur = () => finishResize();

    resizeCleanupRef.current = finishResize;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleWindowBlur);
  };

  const shrinkColumn = (colKey: string, delta = 15) => {
    setColWidths(prev => ({
      ...prev,
      [colKey]: Math.max(35, (prev[colKey] || DEFAULT_COLUMN_WIDTHS[colKey] || 100) - delta)
    }));
  };

  const expandColumn = (colKey: string, delta = 15) => {
    setColWidths(prev => ({
      ...prev,
      [colKey]: Math.min(500, (prev[colKey] || DEFAULT_COLUMN_WIDTHS[colKey] || 100) + delta)
    }));
  };

  const shrinkAllColumns = () => {
    setColWidths(prev => {
      const updated: Record<string, number> = {};
      Object.keys(prev).forEach(k => {
        updated[k] = Math.max(35, Math.round(prev[k] * 0.8));
      });
      return updated;
    });
  };

  const expandAllColumns = () => {
    setColWidths(prev => {
      const updated: Record<string, number> = {};
      Object.keys(prev).forEach(k => {
        updated[k] = Math.min(500, Math.round(prev[k] * 1.25));
      });
      return updated;
    });
  };

  const resetColumnWidths = () => {
    setColWidths(DEFAULT_COLUMN_WIDTHS);
  };

  const getColStyle = (key: string) => {
    const w = colWidths[key] || DEFAULT_COLUMN_WIDTHS[key] || 100;
    return {
      width: `${w}px`,
      minWidth: `${w}px`,
      maxWidth: `${w}px`,
      boxSizing: 'border-box' as const,
      overflow: 'hidden' as const
    };
  };

  const [invoices, setInvoices] = useState<Invoice[]>(() => db.getInvoices());

  const refresh = () => {
    setOperations([...db.getOperations()]);
    setInvoices([...db.getInvoices()]);
  };

  useEffect(() => {
    const sync = () => refresh();
    window.addEventListener('db-undo-success', sync);
    window.addEventListener('db-change', sync);
    return () => {
      window.removeEventListener('db-undo-success', sync);
      window.removeEventListener('db-change', sync);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(`master_prefs_v5_${currentUser.id}`, JSON.stringify(viewPrefs));
  }, [viewPrefs, currentUser.id]);

  const handleBulkStatusChange = async (newStatus: 'IN PROGRESS' | 'UNDER OPERATE' | 'DONE' | 'HOLD' | 'CANCEL') => {
    if (isReadOnly) return;
    const ids = Array.from(selectedRowIds) as string[];
    const jobs = ids.map(id => {
      const op = operations.find(o => o.id === id);
      return op ? db.updateOperation({ ...op, status: newStatus }) : Promise.resolve(true);
    });
    const results = await Promise.all(jobs);
    const failed = results.filter(saved => saved === false).length;
    if (failed) {
      alert(isAr ? `فشل تحديث ${failed} عملية. ${db.getLastDbError() || ''}` : `Failed to update ${failed} operations. ${db.getLastDbError() || ''}`);
      return;
    }
    setSelectedRowIds(new Set());
    refresh();
    alert(isAr ? `تم تحديث حالة ${ids.length} عملية` : `Updated status for ${ids.length} operations.`);
  };

  const handleBulkDelete = async () => {
    if (!isAdmin) return;
    const ids = Array.from(selectedRowIds) as string[];
    if (confirm(isAr ? `هل أنت متأكد من حذف ${ids.length} عملية؟` : `Are you sure you want to delete ${ids.length} operations?`)) {
      await db.deleteOperationsBulk(ids);
      setSelectedRowIds(new Set());
      refresh();
    }
  };

  const handleSmartPaste = async (buffer: string) => {
    if (!buffer.trim()) return;
    setIsAiProcessing(true);
    try {
      // Fix: Call mapSpreadsheetToSchema and ensure result is treated as any[] for staging
      const rawResult = await mapSpreadsheetToSchema(buffer);
      // Added line: defensive cast to any[] to handle return from mapSpreadsheetToSchema
      const result = (rawResult as any[]) || [];
      
      if (result && result.length > 0) {
        result.forEach((row: any) => {
          if (row.customerNameAr) registerDynamicTranslation(row.customerName, row.customerNameAr);
          if (row.truckerAr) registerDynamicTranslation(row.trucker, row.truckerAr);
          if (row.beneficiaryNameAr) registerDynamicTranslation(row.beneficiaryName, row.beneficiaryNameAr);
        });
        // Fix: Explicitly use any[] type for the staging defaults call
        setStagingDataWithDefaults(result);
      } else {
        fallbackParse(buffer);
      }
    } catch (e) {
      fallbackParse(buffer);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const setStagingDataWithDefaults = (data: any[]) => {
    const processed = data.map(item => ({
      ...item,
      quantity: 1,
      operationDate: item.operationDate || todayDate,
      clipOnDate: item.operationDate || todayDate,
      status: item.status || 'UNDER OPERATE',
      clipOnPort: item.clipOnPort || Location.ALEX,
      clipOffPort: item.clipOffPort || Location.ALEX,
      destination: item.destination || '',
      rate: item.rate || '0',
      vat: '0'
    }));
    setStagedOps(processed);
  };

  const fallbackParse = (buffer: string) => {
    const lines = buffer.split('\n').filter(l => l.trim().length > 0);
    const newStaged: StagingRow[] = lines.map(line => {
      const parts = line.split(/[\t,]/).map(p => p.trim());
      return {
        customerName: parts[0] || '',
        bookingNumber: parts[1] || '',
        containerNumber: parts[2] || '',
        gensetNumber: parts[3] || '',
        rate: parts[4] || '0',
        beneficiaryName: parts[5] || '',
        trucker: parts[6] || '',
        operationDate: todayDate,
        clipOnDate: todayDate,
        status: 'UNDER OPERATE',
        clipOnPort: Location.ALEX,
        clipOffPort: Location.ALEX,
        destination: '',
        quantity: 1,
        vat: '0'
      };
    });
    if (newStaged.length > 0) setStagedOps(newStaged);
  };

  const updateStagedRow = (idx: number, field: keyof StagingRow, val: any) => {
    const copy = [...stagedOps];
    copy[idx] = { ...copy[idx], [field]: val };
    
    if ((field === 'customerName' || field === 'clipOnPort' || field === 'clipOffPort') && copy[idx].rate === '0' && copy[idx].customerName) {
        const foundPrice = db.getCustomerPrices().find(p => 
            p.customerName === copy[idx].customerName && 
            p.portIn === copy[idx].clipOnPort && 
            p.portOut === copy[idx].clipOffPort
        );
        if (foundPrice) {
            copy[idx].rate = foundPrice.price.toFixed(2);
            copy[idx].vat = foundPrice.includeVat ? (foundPrice.price * 0.14).toFixed(2) : '0.00';
        }
    }
    
    setStagedOps(copy);
  };

  const duplicateRow = (idx: number) => {
    const copy = [...stagedOps];
    const newRow = { ...copy[idx], quantity: 1 };
    copy.splice(idx + 1, 0, newRow);
    setStagedOps(copy);
  };

  const handleFinalInject = async () => {
    const toInject: Operation[] = [];
    stagedOps.forEach(s => {
      if (!s.customerName || !s.bookingNumber) return;
      for(let i = 0; i < (s.quantity || 1); i++) {
        toInject.push({
          id: `op-bulk-${Date.now()}-${i}-${Math.random()}`,
          internalSerial: '',
          customerName: s.customerName!,
          bookingNumber: s.bookingNumber!,
          containerNumber: s.containerNumber || '',
          gensetNumber: s.gensetNumber || '',
          commodity: s.commodity || '',
          clipperName: s.clipperName || '',
          operationDate: s.operationDate || todayDate,
          dateReceived: s.operationDate || todayDate,
          clipOnDate: s.clipOnDate || todayDate,
          clipOffDate: '',
          clipOnPort: (s.clipOnPort as Location) || Location.ALEX,
          clipOffPort: (s.clipOffPort as Location) || Location.ALEX,
          destination: s.destination || '',
          status: (s.status as any) || 'UNDER OPERATE',
          rate: s.rate || '0.00',
          vat: s.vat || '0.00',
          trucker: s.trucker || '',
          beneficiaryName: s.beneficiaryName || '',
          shipperAddress: '',
          invoiced: false,
          reviewedByManager: false
        });
      }
    });
    
    if (toInject.length > 0) {
      const saved = await db.addOperationsBulk(toInject);
      if (!saved) {
        alert(isAr
          ? `❌ فشل حفظ ${toInject.length} عملية في قاعدة البيانات.\n${db.getLastDbError() || 'خطأ غير معروف'}`
          : `❌ DATABASE SAVE FAILED for ${toInject.length} operations.\n${db.getLastDbError() || 'Unknown database error'}`
        );
        return;
      }
      const reloaded = await db.reloadOperations();
      if (!reloaded) {
        alert(isAr
          ? `⚠️ تم الحفظ لكن تعذر إعادة قراءة العمليات من قاعدة البيانات.\n${db.getLastDbError() || ''}`
          : `⚠️ SAVED, BUT OPERATIONS COULD NOT BE RELOADED FROM DATABASE.\n${db.getLastDbError() || ''}`
        );
        return;
      }
      const freshOps = db.getOperations();
      const missingBookings = Array.from(new Set(
        toInject.map(o => o.bookingNumber).filter(bk =>
          !freshOps.some(o => o.bookingNumber === bk)
        )
      ));
      if (missingBookings.length > 0) {
        alert(isAr
          ? `❌ تم الإدخال لكن السجلات غير ظاهرة بعد إعادة القراءة. الحجوزات المفقودة: ${missingBookings.join(', ')}\\nالسبب: ${db.getLastDbError() || 'مشكلة في صلاحيات أو قراءة قاعدة البيانات.'}`
          : `❌ INSERT COMPLETED BUT RECORDS ARE NOT VISIBLE AFTER DATABASE RELOAD. Missing bookings: ${missingBookings.join(', ')}\\nReason: ${db.getLastDbError() || 'Database permissions/RLS or read-path issue.'}`
        );
        return;
      }
      setOperations([...freshOps]);
      setShowAddModal(false);
      setStagedOps([{ customerName: '', bookingNumber: '', gensetNumber: '', operationDate: todayDate, clipOnDate: todayDate, status: 'UNDER OPERATE', rate: '0', vat: '0', clipOnPort: Location.ALEX, clipOffPort: Location.ALEX, destination: '', trucker: '', beneficiaryName: '', quantity: 1 }]);
      setRawPasteBuffer('');
      refresh();
      alert(isAr ? `تمت إضافة ${toInject.length} عملية بنجاح` : `Successfully injected ${toInject.length} operations.`);
    }
  };

  const systemSuggestions = useMemo(() => {
    const customerNames = Array.from(new Set(
      db.getUsers().filter(u => u.role === UserRole.CUSTOMER).map(u => (u.companyName || u.name || '').trim()).filter(Boolean)
    )) as string[];
    const suggestions: Record<string, string[]> = {
      customers: customerNames,
      shippers: Array.from(new Set(operations.map(o => o.beneficiaryName).filter((v): v is string => !!v))) as string[],
      truckers: Array.from(new Set(operations.map(o => o.trucker).filter((v): v is string => !!v))) as string[],
      gensets: Array.from(new Set(db.getStock().map(s => s.unitNumber))) as string[],
      containers: Array.from(new Set(operations.map(o => o.containerNumber).filter((v): v is string => !!v))) as string[],
      commodities: Array.from(new Set([...operations.map(o => o.commodity).filter((v): v is string => !!v), 'CITRUS', 'ORANGES', 'GRAPES', 'POTATOES', 'STRAWBERRIES', 'POMEGRANATE', 'FROZEN FISH', 'ONIONS', 'FROZEN VEGETABLES'])),
      clippers: Array.from(new Set([...operations.map(o => o.clipperName).filter((v): v is string => !!v), 'Mohamed Fawzy', 'Ahmed Ali', 'Mahmoud Hassan', 'Eslam Logistics', 'Ibrahim Said', 'Sherif Hegazy']))
    };
    return suggestions;
  }, [operations]);

  // Keep this outside the suggestions useMemo so the customer validation
  // set is available to the table renderer on every render.
  const customerNameKeys = useMemo(
    () => new Set(systemSuggestions.customers.map(name => name.trim().toLowerCase())),
    [systemSuggestions]
  );

  const filteredAndSortedOps = useMemo(() => {
    let result = [...operations].filter(op => {
      const searchStr = searchTerm.toLowerCase();
      const matchesSearch = (op.bookingNumber || '').toLowerCase().includes(searchStr) || 
                            (op.customerName || '').toLowerCase().includes(searchStr) || 
                            (op.containerNumber || '').toLowerCase().includes(searchStr) ||
                            (op.commodity && op.commodity.toLowerCase().includes(searchStr)) ||
                            (op.clipperName && op.clipperName.toLowerCase().includes(searchStr)) ||
                            (op.trucker && op.trucker.toLowerCase().includes(searchStr)) ||
                            (op.beneficiaryName && op.beneficiaryName.toLowerCase().includes(searchStr));
      const matchesPorts = selectedPorts.length === 0 || selectedPorts.includes(op.clipOnPort as string);
      const matchesStatuses = selectedStatuses.length === 0 || selectedStatuses.includes(op.status as string);
      
      const matchesDate = (() => {
        if (!dateFilter.startDate && !dateFilter.endDate) return true;
        
        const targetDates: string[] = [];
        if (dateFilter.field === 'clipOnDate') {
          if (op.clipOnDate) targetDates.push(op.clipOnDate);
        } else if (dateFilter.field === 'any') {
          if (op.operationDate) targetDates.push(op.operationDate);
          if (op.clipOnDate) targetDates.push(op.clipOnDate);
        } else {
          // default operationDate
          if (op.operationDate) targetDates.push(op.operationDate);
        }

        if (targetDates.length === 0) return false;

        return targetDates.some(d => {
          if (dateFilter.startDate && d < dateFilter.startDate) return false;
          if (dateFilter.endDate && d > dateFilter.endDate) return false;
          return true;
        });
      })();

      return matchesSearch && matchesPorts && matchesStatuses && matchesDate;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = (a[sortConfig.key] || '').toString(); const bVal = (b[sortConfig.key] || '').toString();
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      const statusOrder: Record<string, number> = { 'UNDER OPERATE': 1, 'IN PROGRESS': 2, 'DONE': 3, 'HOLD': 4, 'CANCEL': 5 };
      result.sort((a, b) => {
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        return b.operationDate.localeCompare(a.operationDate);
      });
    }
    return result;
  }, [operations, searchTerm, selectedPorts, selectedStatuses, dateFilter, sortConfig]);

  const handleUpdateCell = (op: Operation, field: keyof Operation, val: any) => {
    if (isReadOnly) return;
    db.updateOperation({ ...op, [field]: val });
    refresh();
  };

  const requestSort = (key: keyof Operation) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const dynamicCellStyle = { paddingTop: `${viewPrefs.density}px`, paddingBottom: `${viewPrefs.density}px` };
  const globalScaleStyle = { fontSize: `${(viewPrefs.scale / 100) * 10}px` };

  return (
    <div className={`w-full space-y-4 animate-in fade-in duration-500 pb-24 text-start ${isAr ? 'rtl font-cairo' : 'ltr'}`} style={globalScaleStyle}>
      <div className={`${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} p-3 rounded-2xl shadow-sm border flex flex-col xl:flex-row gap-3 items-center`}>
        <div className="flex-1 relative w-full">
          <input 
            type="text" 
            placeholder={isAr ? 'بحث في السجل التشغيلي...' : 'Operational manifest lookup...'} 
            className={`w-full ${isAr ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'} py-2 border-2 rounded-xl font-bold outline-none focus:border-blue-400 shadow-inner transition-all ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-transparent text-black'}`} 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          <svg className={`absolute ${isAr ? 'right-3' : 'left-3'} top-2.5 h-4 w-4 text-slate-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex items-center gap-1 bg-black/10 dark:bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={shrinkAllColumns}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-black uppercase flex items-center gap-1 transition-all shadow"
              title={isAr ? "تقليص عرض جميع الأعمدة لليسار" : "Shrink all columns left"}
            >
              <span>◄</span> {isAr ? 'تقليص الأعمدة' : 'Shrink All'}
            </button>
            <button
              type="button"
              onClick={expandAllColumns}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-black uppercase flex items-center gap-1 transition-all shadow"
              title={isAr ? "توسيع عرض جميع الأعمدة لليمين" : "Expand all columns right"}
            >
              {isAr ? 'توسيع الأعمدة' : 'Expand All'} <span>►</span>
            </button>
            <button
              type="button"
              onClick={resetColumnWidths}
              className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[9px] font-black uppercase transition-all"
              title={isAr ? "إعادة ضبط عرض الأعمدة الافتراضي" : "Reset column widths to default"}
            >
              ↺ {isAr ? 'إعادة ضبط' : 'Reset'}
            </button>
          </div>


          {!isReadOnly && (
            <button onClick={() => setShowAddModal(true)} className="bg-[#001F3F] text-[#C2A378] px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all whitespace-nowrap">
              + {isAr ? 'إدخال جديد' : 'New Entry'}
            </button>
          )}
          <DateFilterDropdown 
            filter={dateFilter} 
            onChange={setDateFilter} 
            isDark={isDark} 
            totalFilteredCount={filteredAndSortedOps.length} 
          />
          <MultiSelectDropdown label={t.port} options={allPorts} selected={selectedPorts} onChange={(vals: string[]) => setSelectedPorts(vals)} isDark={isDark} />
          <MultiSelectDropdown label={t.status} options={STATUS_CYCLE} selected={selectedStatuses} onChange={(vals: string[]) => setSelectedStatuses(vals)} isDark={isDark} />
        </div>
      </div>

      <div className={`rounded-3xl shadow-xl border overflow-hidden w-full ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto overflow-y-visible">
          <table className={`w-full ${isAr ? 'text-right' : 'text-left'} whitespace-nowrap border-collapse`}>
            <thead className={`text-white font-black uppercase tracking-widest sticky top-0 z-40 text-[9px] ${isDark ? 'bg-[#001224]' : 'bg-[#001F3F]'}`}>
              <tr>
                <th style={getColStyle('checkbox')} className="p-2 text-center border-r border-white/5 relative">
                  <input type="checkbox" className="rounded bg-transparent border-slate-500" checked={selectedRowIds.size === filteredAndSortedOps.length && filteredAndSortedOps.length > 0} onChange={() => {
                    if (selectedRowIds.size === filteredAndSortedOps.length) setSelectedRowIds(new Set());
                    else setSelectedRowIds(new Set(filteredAndSortedOps.map(op => op.id)));
                  }} disabled={isReadOnly} />
                </th>

                {[
                  { key: 'bookingNumber', label: t.bookingNum, sortable: true },
                  { key: 'customerName', label: t.client, sortable: true },
                  { key: 'trucker', label: t.trucker },
                  { key: 'shipper', label: t.shipper },
                  { key: 'clipOnPort', label: isAr ? 'دخول' : 'IN', extraClass: isDark ? 'bg-[#C2A378]/20' : 'bg-amber-100/50' },
                  { key: 'clipOffPort', label: isAr ? 'خروج' : 'OUT', extraClass: isDark ? 'bg-[#C2A378]/20' : 'bg-amber-100/50' },
                  { key: 'destination', label: isAr ? 'الوجهة' : 'DESTINATION', sortable: true },
                  { key: 'containerNumber', label: t.container },
                  { key: 'gensetNumber', label: isAr ? 'المولد' : 'Genset' },
                  { key: 'rate', label: t.rate, align: 'text-right' },
                  { key: 'status', label: t.status, align: 'text-center' },
                  { key: 'operationDate', label: isAr ? 'تاريخ التشغيل' : 'Op Date', align: 'text-center' },
                  { key: 'clipOnDate', label: isAr ? 'تاريخ التركيب' : 'Clip On', align: 'text-center', extraClass: isDark ? 'bg-emerald-950/20 text-emerald-400' : 'bg-emerald-600/10' },
                  { key: 'commodity', label: isAr ? 'البضاعة' : 'COMMODITY', sortable: true },
                  { key: 'clipperName', label: isAr ? 'فني التركيب' : 'CLIPPER ON', sortable: true },
                  { key: 'notes', label: t.notes },
                  { key: 'invoice', label: isAr ? 'فاتورة الحجز' : 'BOOKING INVOICE', align: 'text-center' }
                ].map(col => (
                  <th
                    key={col.key}
                    style={getColStyle(col.key)}
                    className={`p-2 border-r border-white/10 relative group/col select-none ${col.align || ''} ${col.extraClass || ''} ${col.sortable ? 'cursor-pointer hover:bg-white/10' : ''}`}
                    onClick={col.sortable ? () => requestSort(col.key as keyof Operation) : undefined}
                  >
                    <div className="flex items-center justify-between gap-1 w-full overflow-hidden">
                      <span className="truncate">{col.label}</span>
                      <div className="hidden group-hover/col:flex items-center gap-0.5 shrink-0 opacity-90 hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); shrinkColumn(col.key); }}
                          className="px-1 bg-black/40 hover:bg-blue-600 rounded text-[8px] font-black leading-tight text-white"
                          title={isAr ? "تقليص العرض" : "Shrink width"}
                        >
                          ◄
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); expandColumn(col.key); }}
                          className="px-1 bg-black/40 hover:bg-blue-600 rounded text-[8px] font-black leading-tight text-white"
                          title={isAr ? "توسيع العرض" : "Expand width"}
                        >
                          ►
                        </button>
                      </div>
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDownResize(e, col.key)}
                      className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/80 z-20"
                      title={isAr ? "اسحب لتغيير الحجم" : "Drag to resize"}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {STATUS_CYCLE.map(status => {
                const group = filteredAndSortedOps.filter(o => o.status === status);
                if (group.length === 0) return null;
                return (
                  <React.Fragment key={status}>
                    <tr className={`sticky z-30 shadow-sm ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`} style={{ top: '35px' }}>
                      <td colSpan={18} className={`px-4 py-1.5 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        <button type="button" onClick={() => setCollapsedStatusGroups(prev => { const next = new Set(prev); if (next.has(status)) next.delete(status); else next.add(status); return next; })} className="w-full flex items-center gap-3 text-start hover:bg-white/5 rounded-lg px-2 py-1 transition-all" aria-expanded={!collapsedStatusGroups.has(status)}>
                           <div className={`w-1.5 h-1.5 rounded-full ${status === 'DONE' ? 'bg-emerald-500' : status === 'IN PROGRESS' ? 'bg-blue-500' : status === 'UNDER OPERATE' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                           <span className={`font-black uppercase tracking-[0.2em] text-[9px] ${isDark ? 'text-[#C2A378]' : 'text-[#001F3F]'}`}>{translateEntity(status, lang)}</span>
                           <span className={`px-1.5 py-0.5 rounded text-[7px] font-black ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-[#001F3F] text-white'}`}>{group.length} {isAr ? 'وحدة' : 'UNITS'}</span>
                        <span className={`ml-auto text-[8px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{collapsedStatusGroups.has(status) ? (isAr ? 'فتح' : 'Expand') : (isAr ? 'طي' : 'Collapse')}</span>
                        </button>
                      </td>
                    </tr>
                    {!collapsedStatusGroups.has(status) && group.map((op) => {
                      const isSelected = selectedRowIds.has(op.id);
                      const isContainerDup = Boolean(op.containerNumber?.trim() && duplicateContainerNumbers.has(op.containerNumber.trim().toUpperCase()));
                      const isGensetDup = Boolean(
                        op.status === 'IN PROGRESS' &&
                        op.gensetNumber?.trim() &&
                        duplicateActiveGensets.has(op.gensetNumber.trim().toUpperCase())
                      );

                      const portBadgeStyle = (loc: Location) => {
                         const style = PORT_STYLING[loc];
                         if (!style) return { className: isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-900 border-slate-200', style: undefined };
                         if (isDark) return { className: 'border font-black text-[8px] px-2 py-0.5 rounded-md backdrop-blur-sm', style: getDarkPortStyle(loc) };
                         return { className: `${style.bg} ${getContrastColor(style.bg, false)} ${style.border} border px-2 py-0.5 rounded-md font-black text-[8px]`, style: undefined };
                      };
                      return (
                        <tr key={op.id} className={`transition-all duration-200 group ${isSelected ? 'selected-row ' + (isDark ? 'bg-blue-900/40 text-white' : 'bg-blue-600 text-white') : (isDark ? 'hover:bg-white/5' : 'hover:bg-blue-50/50')}`}>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('checkbox') }} className={`text-center border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <input type="checkbox" className="rounded bg-transparent border-slate-500" checked={isSelected} onChange={() => {
                              const newSet = new Set(selectedRowIds);
                              if (newSet.has(op.id)) newSet.delete(op.id);
                              else newSet.add(op.id);
                              setSelectedRowIds(newSet);
                            }} disabled={isReadOnly} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('bookingNumber') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={op.bookingNumber} onSave={(val) => handleUpdateCell(op, 'bookingNumber', val)} disabled={isReadOnly} isDark={isDark} className={`font-black ${isSelected ? 'text-white' : op.reviewedByManager ? 'text-emerald-500' : (isDark ? 'text-blue-400' : 'text-blue-600')}`} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('customerName') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={translateEntity(op.customerName, lang)} onSave={(val) => handleUpdateCell(op, 'customerName', val)} disabled={isReadOnly} suggestions={systemSuggestions.customers} isDark={isDark} className={`${isSelected ? 'text-white' : ((op.customerName || '').trim() && !customerNameKeys.has((op.customerName || '').trim().toLowerCase()) ? 'text-red-500 font-black' : (isDark ? 'text-slate-300' : 'text-slate-800'))} font-bold uppercase`} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('trucker') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={translateEntity(op.trucker, lang)} onSave={(val) => handleUpdateCell(op, 'trucker', val)} disabled={isReadOnly} isDark={isDark} className={`${isSelected ? 'text-white' : 'text-slate-500'} font-bold uppercase text-[9px]`} placeholder={t.trucker} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('shipper') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={translateEntity(op.beneficiaryName, lang)} onSave={(val) => handleUpdateCell(op, 'beneficiaryName', val)} disabled={isReadOnly} isDark={isDark} className={`${isSelected ? 'text-white' : 'text-slate-500'} font-bold uppercase text-[9px]`} placeholder={t.shipper} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('clipOnPort') }} className={`text-center border-r ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                             <EditableCell 
                                value={op.clipOnPort} 
                                options={allPorts}
                                onSave={(val) => handleUpdateCell(op, 'clipOnPort', val)} 
                                disabled={isReadOnly} 
                                isDark={isDark} 
                                renderValue={(v) => <span className={`${portBadgeStyle(v as Location).className} inline-block`} style={portBadgeStyle(v as Location).style}>{translateEntity(v, lang)}</span>}
                             />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('clipOffPort') }} className={`text-center border-r ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                             <EditableCell 
                                value={op.clipOffPort} 
                                options={allPorts}
                                onSave={(val) => handleUpdateCell(op, 'clipOffPort', val)} 
                                disabled={isReadOnly} 
                                isDark={isDark} 
                                renderValue={(v) => <span className={`${portBadgeStyle(v as Location).className} inline-block`} style={portBadgeStyle(v as Location).style}>{translateEntity(v, lang)}</span>}
                             />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('destination') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={op.destination || ''} onSave={(val) => handleUpdateCell(op, 'destination', val)} disabled={isReadOnly} isDark={isDark} className={`${isSelected ? 'text-white' : (isDark ? 'text-slate-300' : 'text-slate-800')} font-bold uppercase text-[9px]`} placeholder={isAr ? 'الوجهة' : 'DESTINATION'} />
                          </td>
                          <td 
                            style={{ ...dynamicCellStyle, ...getColStyle('containerNumber') }} 
                            className={`px-2 border-r transition-all duration-300 ${isContainerDup ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400 font-black shadow-lg' : isDark ? 'border-slate-800' : 'border-slate-50'}`}
                            title={isContainerDup ? (isAr ? 'تنبيه: رقم الحاوية مكرر في السجل!' : 'WARNING: Duplicate Container Number in manifest!') : undefined}
                          >
                            <div className="flex items-center gap-1">
                              {isContainerDup && <span className="text-[10px] shrink-0">⚠️</span>}
                              <EditableCell value={op.containerNumber} onSave={(val) => handleUpdateCell(op, 'containerNumber', val)} disabled={isReadOnly} isDark={isDark} className={`font-mono font-black ${isContainerDup ? 'text-white font-extrabold drop-shadow' : isSelected ? 'text-white' : (isDark ? 'text-slate-200' : 'text-slate-900')}`} placeholder="CONT#" />
                            </div>
                          </td>
                          <td 
                            style={{ ...dynamicCellStyle, ...getColStyle('gensetNumber') }} 
                            className={`px-2 border-r text-center transition-all duration-300 ${isGensetDup ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400 font-black shadow-lg' : isDark ? 'border-slate-800' : 'border-slate-50'}`}
                            title={isGensetDup ? (isAr ? 'تنبيه: المولد مستخدم في أكثر من عملية IN PROGRESS!' : 'WARNING: Genset unit assigned to multiple IN PROGRESS operations!') : undefined}
                          >
                            <div className="flex items-center justify-center gap-1">
                              {isGensetDup && <span className="text-[10px] shrink-0">⚡</span>}
                              <EditableCell value={op.gensetNumber} suggestions={systemSuggestions.gensets} onSave={(val) => handleUpdateCell(op, 'gensetNumber', val)} disabled={isReadOnly} className={`font-black ${isGensetDup ? 'text-white font-extrabold drop-shadow' : isSelected ? 'text-blue-100' : 'text-[#C2A378]'}`} placeholder="UNIT" isDark={isDark} />
                            </div>
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('rate') }} className={`border-r text-right px-2 font-bold ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                             <EditableCell 
                                value={op.rate} 
                                type="number"
                                onSave={(val) => handleUpdateCell(op, 'rate', val)} 
                                disabled={isReadOnly} 
                                isDark={isDark} 
                                className={`${isSelected ? 'text-white' : (isDark ? 'text-blue-300' : 'text-blue-800')}`} 
                             />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('status') }} className={`border-r text-center ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <select disabled={isReadOnly} className={`px-1.5 py-0.5 rounded font-black text-[7px] shadow-sm outline-none transition-all ${isDark ? 'bg-slate-800 text-[#C2A378] border-slate-700' : 'bg-white text-slate-900 border-slate-200'}`} value={op.status} onChange={(e) => handleUpdateCell(op, 'status', e.target.value as any)}>
                              {STATUS_CYCLE.map(s => <option key={s} value={s} className="bg-slate-900 text-white">{translateEntity(s, lang)}</option>)}
                            </select>
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('operationDate') }} className={`border-r text-center font-bold px-2 ${isDark ? 'border-slate-800' : 'border-slate-50'} ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                            <EditableCell 
                              value={op.operationDate} 
                              type="date"
                              onSave={(val) => handleUpdateCell(op, 'operationDate', val)} 
                              disabled={isReadOnly} 
                              isDark={isDark} 
                              className="font-bold text-center justify-center"
                            />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('clipOnDate') }} className={`border-r text-center font-bold px-2 ${isDark ? 'border-slate-800' : 'border-slate-50'} ${isSelected ? 'bg-blue-900/50' : (isDark ? 'bg-emerald-950/20 text-emerald-400' : 'bg-emerald-600/10')}`}>
                            <EditableCell 
                              value={op.clipOnDate || ''} 
                              type="date"
                              onSave={(val) => handleUpdateCell(op, 'clipOnDate', val)} 
                              disabled={isReadOnly} 
                              isDark={isDark} 
                              className="font-bold text-center justify-center"
                              placeholder="---"
                            />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('commodity') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell 
                              value={op.commodity || ''} 
                              suggestions={systemSuggestions.commodities} 
                              onSave={(val) => handleUpdateCell(op, 'commodity', val.toUpperCase())} 
                              disabled={isReadOnly} 
                              isDark={isDark} 
                              className={`${isSelected ? 'text-white' : (isDark ? 'text-amber-300' : 'text-amber-800')} font-bold uppercase text-[9px]`} 
                              placeholder={isAr ? 'البضاعة' : 'COMMODITY'} 
                            />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('clipperName') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell 
                              value={op.clipperName || ''} 
                              suggestions={systemSuggestions.clippers} 
                              onSave={(val) => handleUpdateCell(op, 'clipperName', val)} 
                              disabled={isReadOnly} 
                              isDark={isDark} 
                              className={`${isSelected ? 'text-white' : (isDark ? 'text-emerald-400' : 'text-emerald-700')} font-bold uppercase text-[9px]`} 
                              placeholder={isAr ? 'فني التركيب' : 'CLIPPER'} 
                            />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('notes') }} className={`px-2 border-r ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                            <EditableCell value={op.notes || ''} onSave={(val) => handleUpdateCell(op, 'notes', val)} disabled={isReadOnly} isDark={isDark} className={`${isSelected ? 'text-white/60' : 'text-slate-400'} italic`} />
                          </td>
                          <td style={{ ...dynamicCellStyle, ...getColStyle('invoice') }} className={`px-2 border-r text-center ${isDark ? 'border-slate-800 border-white/5' : 'border-slate-100'} text-xs font-bold`}>
                            {(() => {
                              const bookingInv = invoices.find(inv => inv.bookingNumber === op.bookingNumber);
                              if (bookingInv) {
                                return (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button 
                                      onClick={() => setSelectedInvoice(bookingInv)} 
                                      title={isAr ? "عرض الفاتورة" : "Show Invoice"}
                                      className="p-1 px-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-[9px] transition-all"
                                    >
                                      👁️ {isAr ? "عرض" : "Show"}
                                    </button>
                                    <button 
                                      onClick={() => handleOpenEditInvoice(bookingInv)} 
                                      title={isAr ? "تعديل الفاتورة" : "Edit Invoice Details"}
                                      className="p-1 px-1.5 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-[9px] transition-all"
                                    >
                                      ✏️ {isAr ? "تعديل" : "Edit"}
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setSelectedInvoice(bookingInv);
                                        setTimeout(() => {
                                          window.print();
                                        }, 300);
                                      }} 
                                      title={isAr ? "طباعة / تحميل PDF" : "Print / PDF"}
                                      className="p-1 px-1.5 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[9px] transition-all"
                                    >
                                      📥 {isAr ? "ملف" : "PDF"}
                                    </button>
                                  </div>
                                );
                              } else {
                                return (
                                  <button 
                                    onClick={() => handleQuickGenerateInvoice(op.bookingNumber, op.customerName)} 
                                    className="px-2 py-1 text-[8px] font-black uppercase tracking-wider rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                                  >
                                    + {isAr ? 'إصدار فاتورة' : 'Issue Invoice'}
                                  </button>
                                );
                              }
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRowIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-10 duration-500">
           <div className="bg-[#001F3F] text-white px-8 py-4 rounded-[2.5rem] shadow-2xl border-2 border-[#C2A378] flex items-center gap-10 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                 <span className="w-10 h-10 bg-[#C2A378] text-[#001F3F] rounded-full flex items-center justify-center font-black text-sm">{selectedRowIds.size}</span>
                 <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#C2A378]">{isAr ? 'وضع الإجراء المجمع' : 'Bulk Action Mode'}</p>
                    <p className="text-[9px] font-bold text-slate-400">{isAr ? 'عمليات مختارة' : 'Selected Entries'}</p>
                 </div>
              </div>
              <div className="h-10 w-px bg-white/10"></div>
              <div className="flex items-center gap-4">
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">{isAr ? 'تغيير الحالة لـ:' : 'Target Status:'}</p>
                 <select className="bg-white/10 text-white border border-white/20 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-[#C2A378] transition-all" onChange={(e) => handleBulkStatusChange(e.target.value as any)} defaultValue="">
                    <option value="" disabled>-- {isAr ? 'اختر الحالة' : 'Select Status'} --</option>
                    {STATUS_CYCLE.map(s => <option key={s} value={s} className="bg-slate-900">{translateEntity(s, lang)}</option>)}
                 </select>
              </div>
              {isAdmin && <button onClick={handleBulkDelete} className="bg-rose-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg">{isAr ? 'حذف إجباري' : 'Force Delete'}</button>}
              <button onClick={() => setSelectedRowIds(new Set())} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">{isAr ? 'إلغاء' : 'Clear'}</button>
           </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-[#001F3F]/95 backdrop-blur-2xl z-[500] flex items-center justify-center p-4">
          <div className={`rounded-[3.5rem] shadow-2xl max-w-[98vw] w-full h-[85vh] overflow-hidden border-[10px] border-slate-900 flex flex-col animate-in zoom-in-95 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-900'}`}>
             <div className={`p-8 flex justify-between items-center shrink-0 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-900 text-white'}`}>
                <div className="text-start">
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter text-[#C2A378]">{isAr ? 'حقن بيانات السجل المجمع' : 'Bulk Manifest Staging'}</h3>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-50 italic">{isAr ? 'سيتم جلب الأسعار وتوليد الترجمة تلقائياً.' : 'Rates and translations are auto-generated via AI Node.'}</p>
                </div>
                <div className="flex gap-4">
                   <textarea 
                     disabled={isAiProcessing}
                     className="w-48 h-10 p-2 bg-white/10 border border-white/20 rounded-xl text-[9px] font-black text-white outline-none focus:w-80 focus:h-20 focus:bg-white focus:text-black transition-all" 
                     placeholder={isAr ? 'الصق البيانات هنا للمطابقة الذكية...' : "PASTE DATA HERE FOR AI ALIGNMENT..."} 
                     value={rawPasteBuffer} 
                     onChange={(e) => { setRawPasteBuffer(e.target.value); handleSmartPaste(e.target.value); }} 
                   />
                   <button onClick={() => setShowAddModal(false)} className="text-white hover:text-rose-500 p-2">✕</button>
                </div>
             </div>
             <div className="flex-1 overflow-auto p-4 bg-current/5 relative">
                {isAiProcessing && (
                  <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-6">
                     <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                     <p className="font-black uppercase text-xs tracking-widest text-blue-600">AI Thinking: Translating & Aligning Manifest...</p>
                  </div>
                )}
                <table className="w-full text-start whitespace-nowrap border-collapse">
                   <thead className="bg-[#001F3F] text-white text-[9px] font-black uppercase tracking-widest sticky top-0 z-10">
                      <tr>
                        <th className="p-4 w-10">#</th>
                        <th className="p-4 w-16 text-center">{isAr ? 'الكمية' : 'Qty'}</th>
                        <th className="p-4 min-w-[150px]">{t.client}</th>
                        <th className="p-4">{t.bookingNum}</th>
                        <th className="p-4">{t.date}</th>
                        <th className="p-4">{isAr ? 'ميناء الدخول' : 'In Hub'}</th>
                        <th className="p-4">{isAr ? 'ميناء الخروج' : 'Out Hub'}</th>
                        <th className="p-4 min-w-[150px]">{isAr ? 'الوجهة' : 'Destination'}</th>
                        <th className="p-4 text-right">{t.rate}</th>
                        <th className="p-4 min-w-[120px]">{t.shipper}</th>
                        <th className="p-4 min-w-[120px]">{t.trucker}</th>
                        <th className="p-4 min-w-[110px]">{isAr ? 'البضاعة' : 'Commodity'}</th>
                        <th className="p-4 min-w-[120px]">{isAr ? 'وحدة المولد' : 'Genset Unit'}</th>
                        <th className="p-4 min-w-[110px]">{isAr ? 'فني التركيب' : 'Clipper On'}</th>
                        <th className="p-4 text-center w-32">{t.actions}</th>
                      </tr>
                   </thead>
                   <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {stagedOps.map((o, idx) => (
                        <tr key={idx} className={`${isDark ? 'hover:bg-white/5' : 'hover:bg-blue-50/50'}`}>
                           <td className="p-4 text-slate-400 font-black text-[9px]">{idx + 1}</td>
                           <td className="p-2"><input type="number" className="w-full p-2 rounded-xl border-2 font-black text-center text-[10px]" value={o.quantity} onChange={e => updateStagedRow(idx, 'quantity', parseInt(e.target.value) || 1)} /></td>
                           <td className="p-2">
                             <input list="partners" className="w-full p-2 rounded-xl border-2 font-black uppercase text-[10px]" value={o.customerName} onChange={e => updateStagedRow(idx, 'customerName', e.target.value.toUpperCase())} />
                             {isAr && <p className="text-[7px] font-black text-blue-600 mt-1">{translateEntity(o.customerName, 'ar')}</p>}
                           </td>
                           <td className="p-2"><input className="w-full p-2 rounded-xl border-2 font-black uppercase text-[10px]" value={o.bookingNumber} onChange={e => updateStagedRow(idx, 'bookingNumber', e.target.value.toUpperCase())} /></td>
                           <td className="p-2"><input type="date" className="w-full p-2 rounded-xl border-2 font-black text-[10px]" value={o.clipOnDate} onChange={e => updateStagedRow(idx, 'clipOnDate', e.target.value)} /></td>
                           <td className="p-2">
                              <select className="w-full p-2 rounded-xl border-2 font-black text-[10px]" value={o.clipOnPort} onChange={e => updateStagedRow(idx, 'clipOnPort', e.target.value as any)}>
                                {allPorts.map(p => <option key={p} value={p}>{translateEntity(p, lang)}</option>)}
                              </select>
                           </td>
                           <td className="p-2">
                              <select className="w-full p-2 rounded-xl border-2 font-black text-[10px]" value={o.clipOffPort} onChange={e => updateStagedRow(idx, 'clipOffPort', e.target.value as any)}>
                                {allPorts.map(p => <option key={p} value={p}>{translateEntity(p, lang)}</option>)}
                              </select>
                           </td>
                           <td className="p-2">
                             <input className="w-full p-2 rounded-xl border-2 font-black uppercase text-[10px]" placeholder={isAr ? 'الوجهة النهائية' : 'Final destination'} value={o.destination || ''} onChange={e => updateStagedRow(idx, 'destination', e.target.value)} />
                           </td>
                           <td className="p-2"><input type="number" className="w-full p-2 text-right rounded-xl border-2 font-black text-[10px]" value={o.rate} onChange={e => updateStagedRow(idx, 'rate', e.target.value)} /></td>
                           <td className="p-2">
                             <input list="shippers" className="w-full p-2 rounded-xl border-2 font-black uppercase text-[10px]" value={o.beneficiaryName} onChange={e => updateStagedRow(idx, 'beneficiaryName', e.target.value.toUpperCase())} />
                             {isAr && <p className="text-[7px] font-black text-blue-600 mt-1">{translateEntity(o.beneficiaryName, 'ar')}</p>}
                           </td>
                           <td className="p-2">
                             <input list="truckers" className="w-full p-2 rounded-xl border-2 font-black uppercase text-[10px]" value={o.trucker} onChange={e => updateStagedRow(idx, 'trucker', e.target.value.toUpperCase())} />
                             {isAr && <p className="text-[7px] font-black text-blue-600 mt-1">{translateEntity(o.trucker, 'ar')}</p>}
                           </td>
                           <td className="p-2"><input className="w-full p-2 rounded-xl border-2 font-black uppercase text-[10px]" placeholder="e.g. CITRUS" value={o.commodity || ''} onChange={e => updateStagedRow(idx, 'commodity', e.target.value.toUpperCase())} /></td>
                           <td className="p-2"><input list="gensets" className="w-full p-2 rounded-xl border-2 font-black uppercase text-[10px]" value={o.gensetNumber} onChange={e => updateStagedRow(idx, 'gensetNumber', e.target.value.toUpperCase())} /></td>
                           <td className="p-2"><input className="w-full p-2 rounded-xl border-2 font-black uppercase text-[10px]" placeholder="Technician" value={o.clipperName || ''} onChange={e => updateStagedRow(idx, 'clipperName', e.target.value)} /></td>
                           <td className="p-2 text-center flex items-center justify-center gap-2">
                              <button onClick={() => duplicateRow(idx)} className="text-blue-500 hover:scale-125 transition-transform p-2 bg-blue-50 rounded-lg shadow-sm" title="Duplicate Row">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                              </button>
                              <button onClick={() => setStagedOps(stagedOps.filter((_, i) => i !== idx))} className="text-rose-500 hover:scale-125 transition-transform p-2 bg-rose-50 rounded-lg shadow-sm">✕</button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
                <button onClick={() => setStagedOps([...stagedOps, { customerName: '', bookingNumber: '', gensetNumber: '', commodity: '', clipperName: '', operationDate: todayDate, clipOnDate: todayDate, status: 'UNDER OPERATE', rate: '0', vat: '0', clipOnPort: Location.ALEX, clipOffPort: Location.ALEX, trucker: '', beneficiaryName: '', quantity: 1 }])} className="mt-4 w-full py-4 border-2 border-dashed rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all hover:bg-white/5">{isAr ? '+ إضافة سطر فارغ' : '+ Add Empty Row'}</button>
             </div>
             <div className={`p-8 shrink-0 flex gap-4 border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <button type="button" onClick={() => setShowAddModal(false)} className="px-10 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest hover:text-rose-500 transition-colors">{t.cancel}</button>
                <button onClick={handleFinalInject} className="flex-1 bg-[#C2A378] text-[#001F3F] py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.4em] shadow-2xl active:scale-95 transition-all">
                  {isAr ? 'اعتماد حقن البيانات' : 'AUTHORIZE BATCH INJECTION'} ({stagedOps.reduce((sum, o) => sum + (o.bookingNumber && o.customerName ? (o.quantity || 1) : 0), 0)} {isAr ? 'وحدة' : 'UNITS'})
                </button>
             </div>
          </div>
        </div>
      )}

       {/* Show Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 overflow-y-auto no-print">
          <div className={`relative w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden p-6 ${isDark ? 'bg-slate-950 border-2 border-slate-800 text-white' : 'bg-white text-slate-900 border border-slate-200'}`}>
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-dashed border-slate-200 dark:border-white/10">
              <span className="text-sm font-black text-[#C2A378] tracking-widest uppercase">{isAr ? 'عرض تفاصيل الفاتورة' : 'INVOICE PREVIEW'}</span>
              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="p-1 px-3 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-black text-xs transition-all"
              >
                ✕ {isAr ? 'إغلاق' : 'CLOSE'}
              </button>
            </div>
            <div className="max-h-[80vh] overflow-y-auto">
              <InvoiceView 
                invoice={selectedInvoice} 
                onClose={() => setSelectedInvoice(null)} 
                settings={db.getUsers().find(u => u.role === UserRole.ADMIN)?.invoiceSettings} 
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-[110] p-4 no-print text-slate-900 dark:text-white">
          <div className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
              <h3 className="font-sans font-black uppercase text-xs tracking-widest text-slate-800 dark:text-white">
                {isAr ? 'تعديل بيانات الفاتورة' : 'EDIT INVOICE DETAILS'}
              </h3>
              <button onClick={() => setEditingInvoice(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                ✕
              </button>
            </div>

            <div className="space-y-5 text-left font-sans p-6">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'رقم مرجع الفاتورة' : 'Invoice Reference'}
                </label>
                <input 
                  type="text" 
                  disabled
                  value={editingInvoice.id} 
                  className="w-full px-4 py-3 rounded-xl border-2 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed border-slate-200 dark:border-white/5"
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'تاريخ الإصدار' : 'Issue Date'}
                </label>
                <input 
                  type="date" 
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-bold focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'تاريخ الاستحقاق' : 'Due Date'}
                </label>
                <input 
                  type="date" 
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-bold focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'إجمالي مبلغ الفاتورة (EGP)' : 'Invoice Grand Total (EGP)'}
                </label>
                <input 
                  type="number" 
                  value={editAmount}
                  onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-mono font-bold focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'الحالة المالية' : 'Financial Status'}
                </label>
                <select 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-bold focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="UNPAID">{isAr ? 'غير مدفوعة (مستحقة سريعة)' : 'UNPAID (Pending/Receivable)'}</option>
                  <option value="PAID">{isAr ? 'تم السداد وتسوية الحساب' : 'PAID (Fully Settled)'}</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
                  {isAr ? 'مستند مصلحة الضرائب الفاتورة الإلكترونية الموحدة' : 'ETA E-Invoice Compliance Status'}
                </label>
                <select 
                  value={editEtaStatus}
                  onChange={(e) => setEditEtaStatus(e.target.value as any)}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-xs font-bold focus:outline-none focus:border-[#C2A378] ${
                    isDark ? 'bg-slate-800 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="DRAFT">{isAr ? 'مسودة (لم تقدم بعد)' : 'DRAFT (Not Submitted)'}</option>
                  <option value="SUBMITTED">{isAr ? 'مستلم من مصلحة الضرائب (جارِ المعالجة)' : 'SUBMITTED (Pending validation)'}</option>
                  <option value="VALID">{isAr ? 'مقبول ونشط في المنصة الموحدة' : 'VALID (Fully Compliant)'}</option>
                  <option value="INVALID">{isAr ? 'مرفوض ويحتاج إعادة الفحص' : 'INVALID (Needs resolution)'}</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-950 flex gap-3">
              <button 
                onClick={() => setEditingInvoice(null)} 
                className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-[#94A3B8] hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {t.cancel}
              </button>
              <button 
                onClick={handleSaveEditInvoice} 
                className="flex-1 bg-[#001F3F] text-white dark:bg-[#C2A378] dark:text-[#001F3F] py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:opacity-95 active:scale-95 transition-all"
              >
                {isAr ? 'حفظ التعديلات' : 'SAVE CHANGES'}
              </button>
            </div>
          </div>
        </div>
      )}

      <datalist id="partners">{systemSuggestions.customers.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="shippers">{systemSuggestions.shippers.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="truckers">{systemSuggestions.truckers.map(c => <option key={c} value={c} />)}</datalist>
      <datalist id="gensets">{systemSuggestions.gensets.map(g => <option key={g} value={g} />)}</datalist>
      <datalist id="containers">{systemSuggestions.containers.map(c => <option key={c} value={c} />)}</datalist>
    </div>
  );
};

export default MasterView;
