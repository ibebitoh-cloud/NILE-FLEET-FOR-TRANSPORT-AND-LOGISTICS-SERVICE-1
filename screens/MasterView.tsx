  const styles: Record<string, { backgroundColor: string; color: string; borderColor: string; boxShadow: string }> = {
    [Location.DAM]: { backgroundColor: 'rgba(16,185,129,0.22)', color: '#6EE7B7', borderColor: '#34D399', boxShadow: '0 0 10px rgba(52,211,153,0.18)' },
    [Location.ALEX]: { backgroundColor: 'rgba(234,179,8,0.22)', color: '#FDE047', borderColor: '#FACC15', boxShadow: '0 0 10px rgba(250,204,21,0.18)' },
    [Location.GOUDA]: { backgroundColor: 'rgba(37,99,235,0.24)', color: '#93C5FD', borderColor: '#60A5FA', boxShadow: '0 0 10px rgba(96,165,250,0.18)' },
    [Location.SOKHNA]: { backgroundColor: 'rgba(249,115,22,0.24)', color: '#FDBA74', borderColor: '#FB923C', boxShadow: '0 0 10px rgba(251,146,60,0.18)' },
    [Location.SCCT]: { backgroundColor: 'rgba(14,165,233,0.22)', color: '#7DD3FC', borderColor: '#38BDF8', boxShadow: '0 0 10px rgba(56,189,248,0.18)' },
    [Location.PSD]: { backgroundColor: 'rgba(124,58,237,0.25)', color: '#C4B5FD', borderColor: '#A78BFA', boxShadow: '0 0 10px rgba(167,139,250,0.18)' },
    [Location.MAL]: { backgroundColor: 'rgba(34,197,94,0.22)', color: '#86EFAC', borderColor: '#4ADE80', boxShadow: '0 0 10px rgba(74,222,128,0.18)' },
    [Location.WORKSHOP]: { backgroundColor: 'rgba(100,116,139,0.28)', color: '#CBD5E1', borderColor: '#94A3B8', boxShadow: '0 0 10px rgba(148,163,184,0.16)' }
  };
  return styles[loc] || { backgroundColor: 'rgba(71,85,105,0.28)', color: '#E2E8F0', borderColor: '#64748B', boxShadow: 'none' };
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
  isDark?: boolean;
  disabled?: boolean;
}