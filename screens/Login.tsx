
import React, { useState, useContext } from 'react';
import { ThemeContext, LanguageContext } from '../App';
import { translations } from '../translations';

interface LoginProps { onLogin: (email: string, pass: string) => void; }

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { theme, isDark } = useContext(ThemeContext);
  const { lang, setLang } = useContext(LanguageContext);
  const t = translations[lang];
  const isAr = lang === 'ar';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  const AnimatedText = ({ text, colorClass = "text-white", baseDelay = 0 }: { text: string, colorClass?: string, baseDelay?: number }) => {
    return (
      <span className="inline-block">
        {text.split('').map((char, i) => (
          <span 
            key={i} 
            className={`inline-block letter-anim ${colorClass} ${char === ' ' ? 'mr-3' : ''}`}
            style={{ animationDelay: `${baseDelay + (i * 0.1)}s` }}
          >
            {char}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-0 m-0 relative overflow-hidden font-sans transition-colors duration-1000 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} ${isAr ? 'rtl font-cairo' : 'ltr'}`}>
      <style>{`
        @keyframes gearShuffle {
          0% { opacity: 0; transform: translateY(20px) rotateX(-120deg) scale(0.8); filter: blur(10px); }
          10%, 15% { opacity: 1; transform: translateY(0) rotateX(0deg) scale(1); filter: blur(0); }
          20% { transform: rotateY(15deg) translateX(2px); }
          25% { transform: rotateY(-15deg) translateX(-2px); }
          30% { transform: rotateX(10deg) translateY(-1px); }
          35% { transform: rotateX(0deg) translateY(0); }
          85% { opacity: 1; transform: scale(1); }
          95% { opacity: 0.5; transform: scale(0.95) rotateX(45deg); }
          100% { opacity: 0; transform: translateY(-20px) rotateX(90deg) scale(0.8); }
        }
        .letter-anim { opacity: 0; animation: gearShuffle 6s cubic-bezier(0.4, 0, 0.2, 1) infinite; backface-visibility: hidden; perspective: 1000px; display: inline-block; transform-origin: center center; }
      `}</style>

      <div className="w-full h-screen grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative z-10">
        
        {/* LEFT PANEL */}
        <div className="hidden lg:flex lg:col-span-7 bg-[#001F3F] relative flex-col justify-center p-20 overflow-hidden border-r border-white/5">
          <div className="absolute inset-0 z-0">
            <img src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=2000" className="w-full h-full object-cover opacity-20 grayscale scale-110" alt="Fleet" />
            <div className="absolute inset-0 bg-gradient-to-br from-[#001F3F] via-[#001F3F]/80 to-transparent"></div>
          </div>
          <div className="relative z-10">
            <div className="mb-16">
              <p className="text-[#C2A378] text-[10px] font-black uppercase tracking-[0.6em] mb-6 animate-pulse">{t.secureTerminal}</p>
              <h1 className="text-7xl font-black text-white tracking-tighter uppercase italic leading-none">NILE <span className="text-[#C2A378]">FLEET</span></h1>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#C2A378] italic mt-3">
                SHERIF HEGAZY
              </p>
            </div>
            <div className="space-y-6">
              <div>
                <h2 className="text-5xl font-black leading-tight uppercase tracking-tighter italic">
                  {isAr ? <span className="text-white">قوة المولدات.</span> : <><AnimatedText text="GENSET" baseDelay={0.2} /> <br/><AnimatedText text="POWER." colorClass="text-[#C2A378]" baseDelay={0.6} /></>}
                </h2>
              </div>
              <p className="text-slate-300 text-[10px] font-bold uppercase tracking-[0.4em] max-w-sm leading-relaxed border-l-2 border-[#C2A378]/30 pl-6">{t.coldChain}</p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className={`col-span-full lg:col-span-5 flex flex-col justify-center px-8 lg:px-16 relative z-10 transition-colors duration-1000 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
          {/* Top Bar for Language Switcher */}
          <div className="absolute top-6 right-6 lg:top-8 lg:right-8 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5 ${
                isDark 
                  ? 'border-[#C2A378]/40 bg-slate-800/80 text-[#C2A378] hover:bg-slate-700' 
                  : 'border-slate-300 bg-slate-50 text-[#001F3F] hover:bg-slate-100'
              }`}
            >
              <span>🌐</span>
              <span>{lang === 'en' ? 'العربية' : 'ENGLISH'}</span>
            </button>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[30rem] lg:text-[40rem] font-black text-slate-500/5 pointer-events-none select-none italic tracking-tighter">N</div>
          <div className="max-w-md w-full mx-auto space-y-10 relative z-10">
            <div className="space-y-3 text-center lg:text-start relative">
              <h3 className={`text-4xl lg:text-5xl font-black uppercase italic tracking-tighter leading-[0.9] ${isDark ? 'text-white' : 'text-[#001F3F]'}`}>
                <>{isAr ? 'مرحباً بكم في' : 'WELCOME TO'} <br/> <span className="text-[#C2A378]">{isAr ? 'أسطول النيل' : 'NILE FLEET'}</span></>
              </h3>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#C2A378] italic">
                SHERIF HEGAZY
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-start">
              <div className="group">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 px-1 group-focus-within:text-[#C2A378] transition-colors">{t.networkIdentity}</label>
                <input type="email" required className="w-full px-6 py-4 rounded-xl border-2 outline-none transition-all text-sm font-bold bg-[var(--input-bg)] border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent)]" placeholder="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="group">
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 px-1 group-focus-within:text-[#C2A378] transition-colors">{t.strategicPasskey}</label>
                <input type="password" required className="w-full px-6 py-4 rounded-xl border-2 outline-none transition-all text-sm font-bold bg-[var(--input-bg)] border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent)]" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              <button type="submit" className="w-full bg-[#001F3F] hover:bg-[#002b57] text-white font-black py-6 rounded-2xl transition-all uppercase tracking-[0.4em] text-[10px] shadow-2xl active:scale-[0.98] mt-4 relative overflow-hidden group/btn border border-white/5">
                <span className="relative z-10">{t.initializeCommand}</span>
                <div className="absolute inset-0 bg-[#C2A378] translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500 opacity-20"></div>
              </button>
            </form>

            <div className="flex flex-col gap-4 items-center">
               <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">{isAr ? 'لطلب حساب، تواصل مع مسؤول النظام.' : 'Contact your administrator to request an account.'}</p>
            </div>
            
            <div className="relative pt-6 border-t border-slate-100 dark:border-white/5">
               <div className="flex flex-col items-center gap-1 select-none transition-all mx-auto w-fit text-center font-sans">
                  <div className="bg-slate-50 dark:bg-slate-800/50 px-10 py-3 rounded-full border-2 border-slate-100 dark:border-white/10 shadow-sm">
                     <p className="text-[8px] font-black uppercase tracking-[0.6em] text-slate-400 py-1 leading-none">
                       POWERED BY BEBITO
                     </p>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
