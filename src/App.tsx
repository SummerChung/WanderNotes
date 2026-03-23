import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Search, 
  Plus, 
  MapPin, 
  Trash2, 
  Sparkles, 
  ChevronRight, 
  Globe, 
  BookOpen, 
  X,
  Loader2,
  Calendar,
  Utensils,
  Camera,
  Info,
  Link as LinkIcon,
  Image as ImageIcon,
  Eye,
  Edit3,
  LogOut,
  LogIn,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import type { TravelMemo } from './types';
import { getCountryTips, setGeminiApiKey } from './services/geminiService';
import { cn } from './utils/cn';
import { COMMON_COUNTRIES } from './constants';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  handleFirestoreError, 
  OperationType,
  FirebaseUser
} from './firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "發生了預期外的錯誤。";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "權限不足，請確認您已登入。";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#fdfcf8]">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md text-center border border-[#e5e5df]">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info size={32} />
            </div>
            <h2 className="text-2xl font-bold text-[#5A5A40] mb-2">糟糕！出錯了</h2>
            <p className="text-[#5A5A40]/70 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="olive-btn w-full justify-center"
            >
              重新整理頁面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <WanderNotes />
    </ErrorBoundary>
  );
}

function WanderNotes() {
  const [memos, setMemos] = useState<TravelMemo[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [memoContent, setMemoContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [aiTips, setAiTips] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'edit' | 'preview'>('edit');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(!!localStorage.getItem('GEMINI_API_KEY'));

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Real-time Sync
  useEffect(() => {
    if (!isAuthReady || !user) {
      setMemos([]);
      return;
    }

    const q = query(
      collection(db, 'memos'),
      where('uid', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMemos = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as TravelMemo[];
      setMemos(fetchedMemos);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'memos');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const groupedMemos = useMemo(() => {
    const filtered = memos.filter(m => 
      m.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groups: Record<string, TravelMemo[]> = {};
    filtered.forEach(memo => {
      if (!groups[memo.country]) {
        groups[memo.country] = [];
      }
      groups[memo.country].push(memo);
    });

    // Sort countries alphabetically and memos within each country by date
    return Object.keys(groups).sort().map(country => ({
      country,
      memos: groups[country].sort((a, b) => b.updatedAt - a.updatedAt)
    }));
  }, [memos, searchQuery]);

  const handleSaveMemo = async () => {
    if (!selectedCountry || !memoContent || !user) return;

    const memoId = activeMemoId || (Date.now().toString(36) + Math.random().toString(36).substring(2));
    const memoPath = `memos/${memoId}`;
    
    try {
      const newMemo = {
        uid: user.uid,
        country: selectedCountry,
        content: memoContent,
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'memos', memoId), newMemo);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, memoPath);
    }
  };

  const resetForm = () => {
    setSelectedCountry('');
    setMemoContent('');
    setIsAdding(false);
    setAiTips(null);
    setActiveMemoId(null);
    setEditMode('edit');
  };

  const handleDeleteMemo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('確定要刪除這則筆記嗎？')) return;
    
    const memoPath = `memos/${id}`;
    try {
      await deleteDoc(doc(db, 'memos', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, memoPath);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login Error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout Error:', error);
    }
  };

  const handleEditMemo = (memo: TravelMemo) => {
    setSelectedCountry(memo.country);
    setMemoContent(memo.content);
    setActiveMemoId(memo.id);
    setIsAdding(true);
    setEditMode('preview'); // Default to preview when viewing existing
  };

  const fetchAiTips = async () => {
    if (!selectedCountry) return;
    setIsAiLoading(true);
    try {
      const tips = await getCountryTips(selectedCountry);
      setAiTips(tips ?? '目前無法取得建議。');
    } catch (error) {
      console.error('AI Tips Error:', error);
      if (error instanceof Error && error.message === 'API_KEY_MISSING') {
        setShowApiKeyModal(true);
        setAiTips(null);
      } else {
        setAiTips('無法取得 AI 建議，請稍後再試。');
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveApiKey = () => {
    if (tempApiKey.trim()) {
      setGeminiApiKey(tempApiKey.trim());
      setHasApiKey(true);
      setShowApiKeyModal(false);
      // Retry fetching tips if we were in the middle of it
      if (selectedCountry) {
        fetchAiTips();
      }
    }
  };

  const insertMarkdown = (type: 'link' | 'image') => {
    const textarea = document.getElementById('memo-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);

    let insertion = '';
    if (type === 'link') {
      const url = prompt('請輸入連結網址 (URL):', 'https://');
      if (!url) return;
      insertion = `[${selectedText || '連結文字'}](${url})`;
    } else if (type === 'image') {
      const url = prompt('請輸入圖片網址 (URL):', 'https://');
      if (!url) return;
      insertion = `\n![${selectedText || '圖片描述'}](${url})\n`;
    }

    const newContent = text.substring(0, start) + insertion + text.substring(end);
    setMemoContent(newContent);
    setEditMode('edit');
    
    // Focus back and set cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <header className="mb-12 flex flex-col items-center">
        <div className="w-full flex justify-end mb-4">
          {isAuthReady && (
            user ? (
              <div className="flex items-center gap-4 bg-white p-2 pl-4 rounded-full border border-[#e5e5df] shadow-sm">
                <div className="flex items-center gap-2">
                  <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                  <span className="text-sm font-medium text-[#5A5A40] hidden sm:inline">{user.displayName}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-red-50 text-[#5A5A40]/40 hover:text-red-500 rounded-full transition-colors"
                  title="登出"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="olive-btn"
              >
                <LogIn size={18} />
                登入同步
              </button>
            )
          )}
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center mb-4"
        >
          <div className="w-16 h-16 rounded-full bg-[#5A5A40] flex items-center justify-center text-white shadow-lg">
            <Globe size={32} />
          </div>
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-5xl font-bold mb-2 tracking-tight"
        >
          漫遊筆記
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-[#5A5A40]/70 italic text-lg"
        >
          WanderNotes — 記錄每一段未來的旅程
        </motion.p>
      </header>

      {/* Main Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5A5A40]/40" size={18} />
          <input 
            type="text"
            placeholder="搜尋國家或備忘錄..."
            className="w-full pl-12 pr-4 py-3 rounded-full border border-[#e5e5df] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 bg-white shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          onClick={() => {
            if (!user) {
              handleLogin();
              return;
            }
            setIsAdding(true);
            setEditMode('edit');
          }}
          className="olive-btn w-full md:w-auto justify-center"
        >
          <Plus size={20} />
          新增備忘錄
        </button>
      </div>

      {!user && isAuthReady && (
        <div className="bg-[#5A5A40]/5 rounded-3xl p-12 text-center mb-12 border border-dashed border-[#5A5A40]/20">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm text-[#5A5A40]">
            <UserIcon size={32} />
          </div>
          <h2 className="text-2xl font-bold text-[#5A5A40] mb-4">開啟雲端同步</h2>
          <p className="text-[#5A5A40]/70 mb-8 max-w-md mx-auto leading-relaxed">
            登入後，您的旅遊筆記將會自動同步到雲端，讓您在任何裝置上都能隨時存取。
          </p>
          <button 
            onClick={handleLogin}
            className="olive-btn mx-auto px-8 py-4 text-lg"
          >
            <LogIn size={24} />
            使用 Google 帳號登入
          </button>
        </div>
      )}

      {/* Content Grid - Grouped by Country */}
      <div className="space-y-12">
        <AnimatePresence mode="popLayout">
          {groupedMemos.map((group) => (
            <motion.section
              layout
              key={group.country}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 border-b border-[#5A5A40]/10 pb-2">
                <div className="w-8 h-8 rounded-full bg-[#5A5A40]/10 flex items-center justify-center text-[#5A5A40]">
                  <MapPin size={18} />
                </div>
                <h2 className="text-2xl font-bold text-[#5A5A40]">{group.country}</h2>
                <span className="text-xs font-medium px-2 py-1 bg-[#5A5A40]/5 text-[#5A5A40]/60 rounded-full">
                  {group.memos.length} 則筆記
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.memos.map((memo) => (
                  <motion.div
                    layout
                    key={memo.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => handleEditMemo(memo)}
                    className="journal-card cursor-pointer group relative overflow-hidden flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-[10px] uppercase tracking-widest text-[#5A5A40]/40">
                        {new Date(memo.updatedAt).toLocaleDateString()}
                      </div>
                      <button 
                        onClick={(e) => handleDeleteMemo(memo.id, e)}
                        className="text-[#5A5A40]/20 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="text-[#3a3a30]/80 line-clamp-6 text-sm leading-relaxed mb-4 prose prose-sm prose-stone">
                      <div className="markdown-body">
                        <ReactMarkdown>{memo.content}</ReactMarkdown>
                      </div>
                    </div>

                    <div className="text-[10px] uppercase tracking-widest text-[#5A5A40]/40 flex items-center justify-end mt-auto pt-4 border-t border-[#5A5A40]/5">
                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          ))}
        </AnimatePresence>

        {groupedMemos.length === 0 && !isAdding && (
          <div className="py-20 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#5A5A40]/5 text-[#5A5A40]/20 mb-4">
              <BookOpen size={40} />
            </div>
            <p className="text-[#5A5A40]/40 italic">還沒有任何筆記，點擊「新增備忘錄」開始記錄吧！</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3a3a30]/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-[#e5e5df] flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  {activeMemoId ? '編輯備忘錄' : '新增旅遊靈感'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-[#5A5A40]/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1 space-y-6">
                {/* Country Selection */}
                <div>
                  <label className="block text-xs uppercase tracking-widest text-[#5A5A40]/60 font-bold mb-3">選擇國家</label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_COUNTRIES.map(c => (
                      <button
                        key={c}
                        onClick={() => setSelectedCountry(c)}
                        className={cn(
                          "px-4 py-2 rounded-full text-sm transition-all border",
                          selectedCountry === c 
                            ? "bg-[#5A5A40] text-white border-[#5A5A40]" 
                            : "bg-white text-[#5A5A40] border-[#e5e5df] hover:border-[#5A5A40]/40"
                        )}
                      >
                        {c}
                      </button>
                    ))}
                    <div className="relative inline-block">
                      <input 
                        type="text"
                        placeholder="其他國家..."
                        className="px-4 py-2 rounded-full text-sm border border-[#e5e5df] focus:outline-none focus:border-[#5A5A40] w-32"
                        value={!COMMON_COUNTRIES.includes(selectedCountry) ? selectedCountry : ''}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Memo Content with Toolbar */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-xs uppercase tracking-widest text-[#5A5A40]/60 font-bold">筆記內容 (支援 Markdown)</label>
                    <div className="flex items-center gap-1 bg-[#fdfcf8] p-1 rounded-lg border border-[#e5e5df]">
                      <button 
                        onClick={() => setEditMode('edit')}
                        className={cn("p-1.5 rounded-md transition-colors", editMode === 'edit' ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#5A5A40]/10")}
                        title="編輯模式"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => setEditMode('preview')}
                        className={cn("p-1.5 rounded-md transition-colors", editMode === 'preview' ? "bg-[#5A5A40] text-white" : "text-[#5A5A40] hover:bg-[#5A5A40]/10")}
                        title="預覽模式"
                      >
                        <Eye size={16} />
                      </button>
                      <div className="w-px h-4 bg-[#e5e5df] mx-1" />
                      <button 
                        onClick={() => insertMarkdown('link')}
                        className="p-1.5 text-[#5A5A40] hover:bg-[#5A5A40]/10 rounded-md transition-colors"
                        title="插入連結"
                      >
                        <LinkIcon size={16} />
                      </button>
                      <button 
                        onClick={() => insertMarkdown('image')}
                        className="p-1.5 text-[#5A5A40] hover:bg-[#5A5A40]/10 rounded-md transition-colors"
                        title="插入圖片"
                      >
                        <ImageIcon size={16} />
                      </button>
                    </div>
                  </div>

                  {editMode === 'edit' ? (
                    <textarea 
                      id="memo-editor"
                      rows={8}
                      placeholder="記錄一些想去的景點、美食或是注意事項... (可以使用 Markdown 語法)"
                      className="w-full p-4 rounded-2xl border border-[#e5e5df] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 bg-[#fdfcf8] resize-none font-sans"
                      value={memoContent}
                      onChange={(e) => setMemoContent(e.target.value)}
                    />
                  ) : (
                    <div className="w-full min-h-[12rem] p-6 rounded-2xl border border-[#e5e5df] bg-[#fdfcf8] prose prose-stone prose-sm max-w-none overflow-y-auto">
                      {memoContent ? (
                        <ReactMarkdown>{memoContent}</ReactMarkdown>
                      ) : (
                        <p className="text-[#5A5A40]/30 italic">預覽內容為空...</p>
                      )}
                    </div>
                  )}
                </div>

                {/* AI Assistant Section */}
                <div className="bg-[#fdfcf8] rounded-2xl p-6 border border-[#e5e5df] relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-[#5A5A40]">
                      <Sparkles size={18} />
                      <span className="font-bold">AI 旅遊小助手</span>
                    </div>
                    {selectedCountry && (
                      <button 
                        onClick={fetchAiTips}
                        disabled={isAiLoading}
                        className="text-xs text-[#5A5A40] underline underline-offset-4 hover:text-[#4a4a35] disabled:opacity-50"
                      >
                        {aiTips ? '重新生成' : '獲取旅遊建議'}
                      </button>
                    )}
                  </div>

                  {isAiLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-[#5A5A40]/40">
                      <Loader2 className="animate-spin mb-2" size={24} />
                      <p className="text-sm italic">正在為您規劃中...</p>
                    </div>
                  ) : aiTips ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="prose prose-sm max-w-none text-[#3a3a30]/80 prose-stone"
                    >
                      <div className="markdown-body">
                        <ReactMarkdown>{aiTips}</ReactMarkdown>
                      </div>
                    </motion.div>
                  ) : (
                    <p className="text-sm text-[#5A5A40]/40 italic">
                      {selectedCountry ? `想知道更多關於「${selectedCountry}」的資訊嗎？點擊上方獲取 AI 建議。` : '請先選擇一個國家以獲取建議。'}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-[#e5e5df] bg-[#fdfcf8] flex gap-3">
                <button 
                  onClick={resetForm}
                  className="secondary-btn flex-1 justify-center"
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveMemo}
                  disabled={!selectedCountry || !memoContent}
                  className="olive-btn flex-1 justify-center disabled:opacity-50"
                >
                  儲存筆記
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Key Modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#3a3a30]/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8"
            >
              <div className="flex items-center gap-3 text-[#5A5A40] mb-6">
                <Sparkles size={24} />
                <h2 className="text-xl font-bold">設定 Gemini API 金鑰</h2>
              </div>
              
              <p className="text-sm text-[#5A5A40]/70 mb-6 leading-relaxed">
                為了使用 AI 旅遊建議功能，您需要提供自己的 Google Gemini API 金鑰。
                金鑰將安全地儲存在您的瀏覽器中，不會上傳到任何伺服器。
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block mt-2 text-[#5A5A40] underline font-bold"
                >
                  👉 點此獲取免費金鑰
                </a>
              </p>

              <input 
                type="password"
                placeholder="在此貼上您的 API Key..."
                className="w-full px-4 py-3 rounded-xl border border-[#e5e5df] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 mb-6"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
              />

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowApiKeyModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-[#e5e5df] text-[#5A5A40] font-bold hover:bg-[#fdfcf8] transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveApiKey}
                  disabled={!tempApiKey.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-[#5A5A40] text-white font-bold hover:bg-[#4a4a35] transition-colors disabled:opacity-50"
                >
                  儲存並繼續
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Decoration */}
      <footer className="mt-24 pt-12 border-t border-[#e5e5df] text-center">
        <div className="flex justify-center gap-8 text-[#5A5A40]/20 mb-6">
          <Calendar size={24} />
          <Utensils size={24} />
          <Camera size={24} />
          <Info size={24} />
        </div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#5A5A40]/30">
          © 2026 WanderNotes — Your Personal Travel Archive
        </p>
      </footer>
    </div>
  );
}
// WanderNotes App Component
