import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, RefreshCw, Download, Book, PenTool, User, Trash2, X, Heart, ChevronRight } from 'lucide-react';
import { auth, db, signIn, signInAnon, signOut } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, setDoc, getDoc, getDocs, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Butterfly } from './components/Butterfly';
import { generateMoment, generateMBTIQuote } from './lib/gemini';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Module = 'home' | 'mbti' | 'write' | 'space';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [activeModule, setActiveModule] = useState<Module>('home');
  const [isTyping, setIsTyping] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number, y: number } | null>(null);
  const [writingBg, setWritingBg] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try {
          await signInAnon();
        } catch (e) {
          console.error("Anonymous sign-in failed:", e);
        }
      } else {
        setUser(u);
      }
    });
  }, []);

  const renderModule = () => {
    switch (activeModule) {
      case 'home': return <Home user={user} setIsTyping={setIsTyping} setFocusPoint={setFocusPoint} setWritingBg={setWritingBg} />;
      case 'mbti': return <MBTI user={user} onClose={() => setActiveModule('home')} />;
      case 'write': return <Write user={user} onClose={() => setActiveModule('home')} background={writingBg} setBackground={setWritingBg} />;
      case 'space': return <Space user={user} onClose={() => setActiveModule('home')} />;
      default: return <Home user={user} setIsTyping={setIsTyping} setFocusPoint={setFocusPoint} setWritingBg={setWritingBg} />;
    }
  };

  return (
    <div className="relative min-h-screen bg-ink text-paper selection:bg-cyan-light/20">
      <Butterfly isTyping={isTyping} focusPoint={focusPoint} />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={activeModule}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="min-h-screen"
        >
          {renderModule()}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Icons */}
      {activeModule === 'home' && (
        <>
          <button 
            onClick={async () => {
              try {
                if (user) setActiveModule('mbti');
                else await signIn();
              } catch (e) {
                console.error("Sign-in failed:", e);
                alert("登录失败，请检查 Firebase 配置及授权域名。");
              }
            }}
            className="fixed top-6 right-6 p-2 text-paper/40 hover:text-paper transition-colors"
          >
            <Book size={20} />
          </button>
          <button 
            onClick={async () => {
              try {
                if (user) setActiveModule('write');
                else await signIn();
              } catch (e) {
                console.error("Sign-in failed:", e);
                alert("登录失败，请检查 Firebase 配置及授权域名。");
              }
            }}
            className="fixed bottom-6 left-6 p-2 text-paper/40 hover:text-paper transition-colors"
          >
            <PenTool size={20} />
          </button>
          <button 
            onClick={async () => {
              try {
                if (user) setActiveModule('space');
                else await signIn();
              } catch (e) {
                console.error("Sign-in failed:", e);
                alert("登录失败，请检查 Firebase 配置及授权域名。");
              }
            }}
            className="fixed bottom-6 right-6 p-2 text-paper/40 hover:text-paper transition-colors"
          >
            <User size={20} />
          </button>
        </>
      )}
    </div>
  );
}

// --- Home Module ---
function Home({ user, setIsTyping, setFocusPoint, setWritingBg }: { user: FirebaseUser | null, setIsTyping: (b: boolean) => void, setFocusPoint: (p: any) => void, setWritingBg: (bg: string) => void }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!user || !result) {
      setIsSaved(false);
      return;
    }
    const q = query(collection(db, 'moments'), where('userId', '==', user.uid), where('text', '==', result.text));
    return onSnapshot(q, (snap) => {
      setIsSaved(!snap.empty);
    });
  }, [user, result]);

  const handleGenerate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setIsRefreshing(true);
    setFocusPoint({ x: 50, y: 50 });
    try {
      const data = await generateMoment(input);
      const layouts = ['classic', 'poetry', 'overlay', 'vertical', 'text-top'];
      const randomLayout = layouts[Math.floor(Math.random() * layouts.length)];
      setResult({ ...data, layout: randomLayout });
      if (data.image) setWritingBg(data.image);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setFocusPoint(null);
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const compressImage = (base64: string, quality: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        let width = img.width;
        let height = img.height;
        const max = 1024;
        if (width > max || height > max) {
          if (width > height) {
            height *= max / width;
            width = max;
          } else {
            width *= max / height;
            height = max;
          }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const toggleSaveMoment = async () => {
    if (!user || !result) return;
    try {
      const q = query(collection(db, 'moments'), where('userId', '==', user.uid), where('text', '==', result.text));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, 'moments', docSnap.id));
        }
      } else {
        let finalImage = result.image;
        if (finalImage && finalImage.length > 800000) {
          finalImage = await compressImage(finalImage, 0.6);
        }
        await addDoc(collection(db, 'moments'), {
          userId: user.uid,
          content: input,
          image: finalImage,
          text: result.text,
          weather: result.weather,
          mood: result.mood,
          layout: result.layout,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const downloadImage = async () => {
    const element = document.getElementById('moment-card');
    if (!element) return;
    
    try {
      // Ensure images are loaded
      const images = element.getElementsByTagName('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      }));

      const canvas = await html2canvas(element, { 
        backgroundColor: '#000000',
        scale: 2, // Higher quality
        useCORS: true,
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `moment-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-6 pt-24 pb-32 overflow-y-auto">
      {!result ? (
        <div className="text-center space-y-8 my-auto">
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-2xl font-serif tracking-widest text-paper/80"
          >
            写下此刻
          </motion.h1>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate();
            }}
            className="relative flex flex-col items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setIsTyping(true);
              }}
              onBlur={() => setIsTyping(false)}
              className="bg-transparent border-none outline-none text-center text-lg w-64 caret-cyan-light"
              placeholder="在这里输入..."
              autoFocus
            />
            <div className="w-64 h-px bg-paper/10 mt-2 relative overflow-hidden">
              {loading && (
                <motion.div 
                  key="loading-line"
                  initial={{ opacity: 0.2 }}
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 1.2, 
                    ease: "easeInOut" 
                  }}
                  className="absolute inset-0 bg-cyan-light"
                />
              )}
            </div>
            <button 
              type="submit"
              disabled={loading || !input.trim()}
              className="mt-8 text-xs tracking-[0.3em] text-paper/30 hover:text-cyan-light transition-colors disabled:opacity-10"
            >
              {loading ? "正在感知..." : "生成意象"}
            </button>
          </form>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-[500px] w-full space-y-8"
        >
          <motion.div 
            id="moment-card" 
            animate={isRefreshing ? { 
              borderColor: ["#0A0D16", "#E0F7FA", "#0A0D16"],
              boxShadow: ["0 0 0px rgba(0,0,0,0)", "0 0 20px rgba(224,247,250,0.1)", "0 0 0px rgba(0,0,0,0)"]
            } : {}}
            transition={{ duration: 1.5, repeat: isRefreshing ? Infinity : 0 }}
            style={{ backgroundColor: '#000000', color: '#F5F5F5' }}
            className="p-8 space-y-6 border border-paper/5 relative overflow-hidden"
          >
            <div className={cn(
              "flex flex-col gap-6",
              result.layout === 'text-top' && "flex-col-reverse"
            )}>
              <div className="relative group">
                {result.image && (
                  <img 
                    src={result.image} 
                    alt="Moment" 
                    className="w-full aspect-square object-cover opacity-80 grayscale-[0.3]" 
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                )}
                {result.layout === 'overlay' && (
                  <div className="absolute bottom-0 left-0 right-0 p-6" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                    <p className="text-lg leading-relaxed font-serif" style={{ color: '#F5F5F5' }}>
                      {result.text}
                    </p>
                  </div>
                )}
                {result.layout === 'vertical' && (
                  <div className="absolute top-6 right-6 bottom-6 flex items-center">
                    <p className="text-lg leading-relaxed font-serif [writing-mode:vertical-rl] tracking-[0.2em]" style={{ color: '#F5F5F5' }}>
                      {result.text}
                    </p>
                  </div>
                )}
              </div>

              {(result.layout === 'classic' || result.layout === 'poetry' || result.layout === 'text-top') && (
                <div className="space-y-4">
                  {result.layout === 'poetry' ? (
                    <div className="space-y-2">
                      {result.text.split(/[,.，。！？!?]/).filter(Boolean).map((line: string, i: number) => (
                        <p key={i} className="text-center text-lg leading-relaxed font-serif" style={{ color: '#F5F5F5' }}>
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-lg leading-relaxed font-serif" style={{ color: '#F5F5F5' }}>
                      {result.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
          
          <div className="flex justify-center gap-8">
            <button 
              onClick={toggleSaveMoment} 
              className={cn(
                "transition-all duration-300",
                isSaved ? "text-cyan-light scale-110" : "text-paper/40 hover:text-cyan-light"
              )}
            >
              <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
            </button>
            <button 
              onClick={handleGenerate} 
              disabled={loading}
              className={cn(
                "text-paper/40 hover:text-cyan-light transition-colors",
                loading && "animate-spin"
              )}
            >
              <RefreshCw size={18} />
            </button>
            <button onClick={downloadImage} className="text-paper/40 hover:text-cyan-light transition-colors">
              <Download size={18} />
            </button>
            <button onClick={() => setResult(null)} className="text-paper/40 hover:text-cyan-light transition-colors">
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// --- MBTI Module ---
function MBTI({ user, onClose }: { user: FirebaseUser | null, onClose: () => void }) {
  const [config, setConfig] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'userConfigs', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setConfig(data);
        
        // Check if daily refresh needed
        const last = data.lastQuoteRefresh?.toDate();
        const today = new Date();
        const isToday = last && last.getFullYear() === today.getFullYear() && 
                        last.getMonth() === today.getMonth() && 
                        last.getDate() === today.getDate();

        if (isToday && data.dailyQuote) {
          setQuote(data.dailyQuote);
        } else if (data.mbti) {
          fetchQuote(data.mbti);
        }
      }
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user || !quote) return;
    const q = query(collection(db, 'quotes'), where('userId', '==', user.uid), where('content', '==', quote.content));
    return onSnapshot(q, (snap) => {
      setIsSaved(!snap.empty);
    });
  }, [user, quote]);

  const fetchQuote = async (mbti: string) => {
    setLoading(true);
    try {
      const data = await generateMBTIQuote(mbti);
      setQuote(data);
      if (user) {
        await setDoc(doc(db, 'userConfigs', user.uid), {
          userId: user.uid,
          mbti,
          lastQuoteRefresh: serverTimestamp(),
          dailyQuote: {
            content: data.content,
            source: data.source,
            author: data.author
          }
        }, { merge: true });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const setMBTI = async (mbti: string) => {
    if (!user) return;
    await setDoc(doc(db, 'userConfigs', user.uid), {
      userId: user.uid,
      mbti,
      lastQuoteRefresh: serverTimestamp()
    }, { merge: true });
    fetchQuote(mbti);
  };

  // Correcting toggleSaveQuote to handle deletion properly
  const handleToggleSave = async () => {
    if (!user || !quote) return;
    
    const q = query(collection(db, 'quotes'), where('userId', '==', user.uid), where('content', '==', quote.content));
    const snap = await new Promise<any>((resolve) => {
      const unsub = onSnapshot(q, (s) => {
        unsub();
        resolve(s);
      });
    });

    if (!snap.empty) {
      await deleteDoc(doc(db, 'quotes', snap.docs[0].id));
    } else {
      await addDoc(collection(db, 'quotes'), {
        userId: user.uid,
        content: quote.content,
        source: quote.source,
        author: quote.author,
        mbti: config?.mbti,
        createdAt: serverTimestamp()
      });
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-ink/90 flex items-center justify-center p-6">
      <button onClick={onClose} className="absolute top-6 right-6 text-paper/40 hover:text-paper">
        <X size={24} />
      </button>

      {!config?.mbti ? (
        <div className="text-center space-y-8 max-w-lg">
          <h2 className="text-xl tracking-widest">选择你的 MBTI</h2>
          <div className="grid grid-cols-4 gap-4">
            {['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'].map(type => (
              <button 
                key={type}
                onClick={() => setMBTI(type)}
                className="p-3 text-sm border border-paper/10 hover:border-cyan-light/50 transition-colors"
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-xl w-full space-y-12">
          {quote ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="space-y-6">
                <p className="text-lg leading-relaxed font-serif text-cyan-light/90 drop-shadow-[0_0_8px_rgba(224,247,250,0.3)]">
                  {quote.content}
                </p>
                <div className="text-right text-sm text-paper/40">
                  ——《{quote.source}》（{quote.author}）
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-8 border-t border-paper/5">
                <button 
                  onClick={handleToggleSave} 
                  className={cn(
                    "transition-all duration-300",
                    isSaved ? "text-cyan-light scale-110" : "text-paper/40 hover:text-cyan-light"
                  )}
                >
                  <Heart size={18} fill={isSaved ? "currentColor" : "none"} />
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="text-center">
              <button 
                onClick={() => fetchQuote(config.mbti)}
                className="text-paper/40 hover:text-paper tracking-widest"
              >
                {loading ? '正在寻觅...' : '开启今日摘抄'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Write Module ---
function Write({ user, onClose, background, setBackground }: { user: FirebaseUser | null, onClose: () => void, background: string | null, setBackground: (bg: string | null) => void }) {
  const [content, setContent] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'writings'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (content.trim() && user) {
        localStorage.setItem(`writing_${user.uid}`, content);
        if (currentId) {
          await updateDoc(doc(db, 'writings', currentId), {
            content,
            updatedAt: serverTimestamp()
          });
        } else {
          const docRef = await addDoc(collection(db, 'writings'), {
            userId: user.uid,
            content,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          setCurrentId(docRef.id);
        }
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [content, user, currentId]);

  return (
    <div className="fixed inset-0 z-40 bg-ink flex flex-col p-12">
      {background && (
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none grayscale"
          style={{ backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
      )}
      
      <div className="relative z-10 flex justify-between items-center mb-12">
        <div className="flex gap-6 items-center">
          <button onClick={() => setShowHistory(!showHistory)} className="text-paper/40 hover:text-paper text-xs tracking-widest">
            {showHistory ? '返回编辑' : '历史'}
          </button>
          <button onClick={() => setBackground(null)} className="text-paper/40 hover:text-paper text-xs tracking-widest">
            纯净模式
          </button>
          <label className="text-paper/40 hover:text-paper text-xs tracking-widest cursor-pointer">
            自定义背景
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setBackground(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }
              }} 
            />
          </label>
        </div>
        <button onClick={onClose} className="text-paper/40 hover:text-paper">
          <X size={20} />
        </button>
      </div>

      {showHistory ? (
        <div className="relative z-10 flex-1 overflow-y-auto space-y-8 max-w-2xl mx-auto w-full">
          {history.map(item => (
            <div key={item.id} className="p-6 border border-paper/5 space-y-4 bg-ink/50 backdrop-blur-sm">
              <div className="text-[10px] text-paper/20 tracking-widest">
                {item.createdAt?.toDate().toLocaleString()}
              </div>
              <p className="text-sm text-paper/60 line-clamp-3">{item.content}</p>
              <button 
                onClick={() => { setContent(item.content); setShowHistory(false); }}
                className="text-[10px] text-cyan-light/40 hover:text-cyan-light"
              >
                恢复此内容
              </button>
            </div>
          ))}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="此刻，你想写下什么..."
          className="relative z-10 flex-1 bg-transparent border-none outline-none resize-none text-lg leading-relaxed font-serif placeholder:text-paper/10"
          autoFocus
        />
      )}
    </div>
  );
}

// --- Space Module ---
function Space({ user, onClose }: { user: FirebaseUser | null, onClose: () => void }) {
  const [moments, setMoments] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [writings, setWritings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'quote' | 'writing' | 'moment'>('quote');

  useEffect(() => {
    if (!user) return;
    const unsubMoments = onSnapshot(query(collection(db, 'moments'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')), (snap) => {
      setMoments(snap.docs.map(d => ({ id: d.id, type: 'moment', ...d.data() })));
    });
    const unsubQuotes = onSnapshot(query(collection(db, 'quotes'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')), (snap) => {
      setQuotes(snap.docs.map(d => ({ id: d.id, type: 'quote', ...d.data() })));
    });
    const unsubWritings = onSnapshot(query(collection(db, 'writings'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')), (snap) => {
      setWritings(snap.docs.map(d => ({ id: d.id, type: 'writing', ...d.data() })));
    });
    return () => { unsubMoments(); unsubQuotes(); unsubWritings(); };
  }, [user]);

  const deleteItem = async (type: string, id: string) => {
    await deleteDoc(doc(db, type === 'moment' ? 'moments' : type === 'quote' ? 'quotes' : 'writings', id));
  };

  const tabs = [
    { id: 'quote', label: '摘抄' },
    { id: 'writing', label: '随笔' },
    { id: 'moment', label: '写下此刻' }
  ];

  const currentItems = (activeTab === 'quote' ? quotes : activeTab === 'writing' ? writings : moments).reduce((acc: any[], current: any) => {
    const key = current.content || current.text;
    const existing = acc.find(item => (item.content || item.text) === key);
    if (!existing) {
      acc.push(current);
    } else if ((current.createdAt?.toMillis() || 0) > (existing.createdAt?.toMillis() || 0)) {
      // Replace with newer version
      const index = acc.indexOf(existing);
      acc[index] = current;
    }
    return acc;
  }, []);

  return (
    <div className="fixed inset-0 z-40 bg-ink overflow-y-auto p-12">
      <div className="max-w-4xl mx-auto w-full">
        <div className="flex justify-between items-center mb-16">
          <h2 className="text-xl tracking-[0.5em] font-serif">我的空间</h2>
          <button onClick={onClose} className="text-paper/40 hover:text-paper">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-12 mb-12 border-b border-paper/5 pb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "text-sm tracking-widest transition-all relative pb-4",
                activeTab === tab.id ? "text-cyan-light" : "text-paper/30 hover:text-paper/60"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-px bg-cyan-light"
                />
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {currentItems.map(item => (
            <div key={item.id} className="relative group bg-deep/50 border border-paper/5 p-6 space-y-4">
              <button 
                onClick={() => deleteItem(item.type, item.id)}
                className="absolute top-4 right-4 text-paper/0 group-hover:text-paper/20 hover:text-paper/60 transition-colors"
              >
                <Trash2 size={14} />
              </button>
              
              <div className="text-[10px] text-paper/20 tracking-widest">
                {item.createdAt?.toDate().toLocaleDateString()}
              </div>

              {item.type === 'moment' && (
                <div className="space-y-4">
                  <div className={cn(
                    "flex flex-col gap-4",
                    item.layout === 'text-top' && "flex-col-reverse"
                  )}>
                    <div className="relative">
                      {item.image && <img src={item.image} className="w-full aspect-video object-cover opacity-60" referrerPolicy="no-referrer" />}
                      {item.layout === 'overlay' && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-ink/80 to-transparent">
                          <p className="text-xs text-paper/80 line-clamp-2">{item.text}</p>
                        </div>
                      )}
                      {item.layout === 'vertical' && (
                        <div className="absolute top-2 right-2 bottom-2 flex items-center">
                          <p className="text-xs text-paper/80 [writing-mode:vertical-rl] line-clamp-2">{item.text}</p>
                        </div>
                      )}
                    </div>
                    {(item.layout === 'classic' || item.layout === 'poetry' || item.layout === 'text-top') && (
                      <p className="text-sm text-paper/80 leading-relaxed line-clamp-3">{item.text}</p>
                    )}
                  </div>
                </div>
              )}

              {item.type === 'quote' && (
                <div className="space-y-2">
                  <p className="text-sm text-cyan-light/70">{item.content}</p>
                  <p className="text-right text-[10px] text-paper/30">——《{item.source}》</p>
                </div>
              )}

              {item.type === 'writing' && (
                <p className="text-sm text-paper/60 line-clamp-4">{item.content}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
