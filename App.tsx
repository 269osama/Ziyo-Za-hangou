import React, { useState, useEffect, useRef } from 'react';
import { Novel, LibraryItem, ViewState, ChapterMetadata, ToastMessage } from './types';
import { searchNovels, downloadChapterContent, getChapterList, getFeaturedNovels } from './services/geminiService';
import { BookIcon, SearchIcon, HomeIcon, DownloadIcon, CheckIcon, RefreshIcon } from './components/Icons';
import Reader from './components/Reader';

// --- Toast Component ---
const ToastContainer = ({ toasts }: { toasts: ToastMessage[] }) => (
  <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
    {toasts.map(t => (
      <div key={t.id} className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border animate-fade-in
        ${t.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-100' : 
          t.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-100' : 
          'bg-blue-600/30 border-blue-400/50 text-blue-100'}
      `}>
        {t.type === 'loading' && <RefreshIcon className="w-4 h-4 animate-spin" />}
        <span className="text-xs font-bold font-tech tracking-wide">{t.message}</span>
      </div>
    ))}
  </div>
);

function App() {
  const [view, setView] = useState<ViewState>('library');
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Novel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Featured State
  const [featuredNovels, setFeaturedNovels] = useState<Novel[]>([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Download Queue (Novel ID -> Chapter ID set)
  const [activeDownloads, setActiveDownloads] = useState<Set<string>>(new Set());
  
  // Reading State
  const [activeNovelId, setActiveNovelId] = useState<string | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [activeChapterContent, setActiveChapterContent] = useState<string>('');
  const [isReaderLoading, setIsReaderLoading] = useState(false);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Helper for Toasts
  const addToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  useEffect(() => {
    const handleOnline = () => {
        setIsOnline(true);
        addToast("SYSTEM ONLINE. CONNECTION ESTABLISHED.", 'success');
    };
    const handleOffline = () => {
        setIsOnline(false);
        addToast("SYSTEM OFFLINE. LOCAL DATA ONLY.", 'error');
        if (view === 'search') setView('library');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, [view]);

  // Load library and cached featured
  useEffect(() => {
    try {
      const savedLib = localStorage.getItem('my_library');
      if (savedLib) setLibrary(JSON.parse(savedLib));

      const savedFeatured = localStorage.getItem('featured_cache');
      if (savedFeatured) setFeaturedNovels(JSON.parse(savedFeatured));
    } catch (e) { console.error(e); }
  }, []);

  // Save library changes
  useEffect(() => {
    localStorage.setItem('my_library', JSON.stringify(library));
  }, [library]);

  // Fetch Featured on Mount
  useEffect(() => {
      const fetchFeatured = async () => {
          // If we have cached items, we can rely on them, but since we switched to a 
          // fast static list, we can just update it to ensure latest URLs are used.
          setIsLoadingFeatured(true);
          try {
            const novels = await getFeaturedNovels();
            setFeaturedNovels(novels);
            localStorage.setItem('featured_cache', JSON.stringify(novels));
          } catch(e) {
            console.error(e);
          } finally {
            setIsLoadingFeatured(false);
          }
      };
      // Delay slightly to prioritize UI render
      const t = setTimeout(fetchFeatured, 500);
      return () => clearTimeout(t);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    if (!isOnline) {
        addToast("OFFLINE MODE. SEARCH UNAVAILABLE.", 'error');
        return;
    }
    
    setIsSearching(true);
    setSearchResults([]); 
    
    try {
      const results = await searchNovels(searchQuery);
      if (results.length > 0) setSearchResults(results);
      else addToast("NO MATCHING RECORDS FOUND.", 'info');
    } catch (err: any) {
      if (err.message === "API_KEY_MISSING") addToast("CONFIG ERROR: API KEY MISSING.", 'error');
      else addToast("SEARCH FAILED. RETRY?", 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToLibrary = async (novel: Novel) => {
    if (!isOnline) { addToast("NETWORK REQUIRED FOR SYNC.", 'error'); return; }
    
    setActiveDownloads(prev => new Set(prev).add(novel.id));
    addToast("SYNCING METADATA...", 'loading');
    
    try {
        const chapters = await getChapterList(novel.title);
        
        const newItem: LibraryItem = {
            ...novel,
            downloaded: true,
            chapters: chapters,
            lastReadChapterId: chapters[0]?.id,
            totalChapters: chapters.length,
            savedAt: Date.now()
        };
        
        setLibrary(prev => [newItem, ...prev.filter(n => n.id !== novel.id)]);
        addToast("NOVEL ADDED TO DATABASE.", 'success');
        
        // Auto-download first chapter
        if (chapters.length > 0) {
            await handleDownloadChapter(newItem, chapters[0], true);
        }
    } catch (e) {
        addToast("SYNC FAILED. CHECK CONNECTION.", 'error');
    } finally {
        setActiveDownloads(prev => {
            const next = new Set(prev);
            next.delete(novel.id);
            return next;
        });
    }
  };

  const handleDownloadChapter = async (novel: LibraryItem, chapter: ChapterMetadata, silent = false): Promise<boolean> => {
      const key = `novel_content_${novel.id}_ch${chapter.chapterNumber}`;
      if (localStorage.getItem(key)) return true;

      if (!silent) addToast(`DOWNLOADING CHAPTER ${chapter.chapterNumber}...`, 'loading');

      try {
          const content = await downloadChapterContent(novel.title, chapter.chapterNumber, chapter.title);
          try {
              localStorage.setItem(key, content);
              if (!silent) addToast("DOWNLOAD COMPLETE.", 'success');
              return true;
          } catch(e) {
              addToast("STORAGE FULL. CLEAR CACHE.", 'error');
              return false;
          }
      } catch (e) {
          console.error("Download failed", e);
          if (!silent) addToast("DOWNLOAD FAILED.", 'error');
          return false;
      }
  };

  // The Master Reader Opener
  const handleOpenReader = async (novelId: string, chapterId?: string) => {
    const novel = library.find(n => n.id === novelId);
    if (!novel || !novel.chapters || novel.chapters.length === 0) {
        addToast("DATA CORRUPTED OR EMPTY.", 'error');
        return;
    }

    const targetChapter = chapterId 
        ? novel.chapters.find(c => c.id === chapterId) 
        : novel.chapters[0];
    
    if (!targetChapter) return;

    // Provide haptic feedback
    if (navigator.vibrate) navigator.vibrate(10);

    const contentKey = `novel_content_${novel.id}_ch${targetChapter.chapterNumber}`;
    let content = localStorage.getItem(contentKey);

    if (!content) {
        // Content missing, try to download
        if (isOnline) {
             setIsReaderLoading(true);
             const success = await handleDownloadChapter(novel, targetChapter, false);
             setIsReaderLoading(false);
             
             if (success) {
                 content = localStorage.getItem(contentKey);
             } else {
                 return; // Stop if download failed
             }
        } else {
            addToast("OFFLINE. CHAPTER MISSING.", 'error');
            return;
        }
    }

    if (content) {
      // Update last read state
      const updatedNovel = { ...novel, lastReadChapterId: targetChapter.id };
      setLibrary(prev => [updatedNovel, ...prev.filter(n => n.id !== novel.id)]);
      
      setActiveNovelId(novel.id);
      setActiveChapterId(targetChapter.id);
      setActiveChapterContent(content);
      setView('reader');
    }
  };

  const handleNextChapter = () => {
      const currentNovel = library.find(n => n.id === activeNovelId);
      if (!currentNovel || !activeChapterId) return;

      const idx = currentNovel.chapters.findIndex(c => c.id === activeChapterId);
      
      if (idx !== -1 && idx < currentNovel.chapters.length - 1) {
          const nextChapter = currentNovel.chapters[idx + 1];
          handleOpenReader(currentNovel.id, nextChapter.id);
      } else {
          addToast("END OF RECORD REACHED.", 'info');
      }
  };

  const handlePrevChapter = () => {
      const currentNovel = library.find(n => n.id === activeNovelId);
      if (!currentNovel || !activeChapterId) return;

      const idx = currentNovel.chapters.findIndex(c => c.id === activeChapterId);
      
      if (idx > 0) {
          const prevChapter = currentNovel.chapters[idx - 1];
          handleOpenReader(currentNovel.id, prevChapter.id);
      } else {
          addToast("START OF RECORD.", 'info');
      }
  };

  const deleteFromLibrary = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm("PURGE DATA FOR THIS ENTRY?")) {
        const novel = library.find(n => n.id === id);
        if (novel) {
            novel.chapters.forEach(ch => {
                localStorage.removeItem(`novel_content_${id}_ch${ch.chapterNumber}`);
                localStorage.removeItem(`scroll_${id}_ch${ch.chapterNumber}`);
                localStorage.removeItem(`img_${id}_ch${ch.chapterNumber}`);
            });
        }
        setLibrary(prev => prev.filter(n => n.id !== id));
        addToast("ENTRY PURGED.", 'success');
    }
  };

  const activeNovel = library.find(n => n.id === activeNovelId);
  const activeChapter = activeNovel?.chapters.find(c => c.id === activeChapterId);

  // Reusable Novel Card Component with Error Handling
  const NovelCard = ({ novel, actionLabel }: { novel: Novel, actionLabel?: string }) => {
       const inLibrary = library.some(lib => lib.id === novel.id);
       const isDownloading = activeDownloads.has(novel.id);
       const [imgSrc, setImgSrc] = useState(novel.coverUrl);
       const [imgError, setImgError] = useState(false);
       
       return (
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5 hover:border-blue-500/30 flex gap-4 backdrop-blur-sm transition-all group animate-fade-in mb-3">
              <div className="w-20 h-28 shrink-0 relative rounded-lg overflow-hidden bg-black shadow-lg">
                  {imgError ? (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-gray-500">
                          <BookIcon className="w-8 h-8 opacity-50" />
                          <span className="text-[8px] mt-1 font-tech">NO COVER</span>
                      </div>
                  ) : (
                      <img 
                        src={imgSrc} 
                        alt={novel.title} 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                        onError={() => {
                            setImgError(true);
                            // Fallback to placeholder if not already tried
                            if (!imgSrc.includes('placeholder.com')) {
                                setImgSrc(`https://via.placeholder.com/200x300?text=${encodeURIComponent(novel.title.substring(0,20))}`);
                                setImgError(false);
                            }
                        }}
                      />
                  )}
              </div>
              <div className="flex-1 flex flex-col justify-between py-1">
                <div>
                    <h3 className="font-bold text-sm text-white line-clamp-1 mb-1 font-tech tracking-wide">{novel.title}</h3>
                    <p className="text-[10px] text-blue-400 mb-2 uppercase tracking-wider">{novel.author}</p>
                    <p className="text-[10px] text-gray-400 line-clamp-2 leading-relaxed">{novel.description}</p>
                </div>
                <button 
                    onClick={() => handleAddToLibrary(novel)}
                    disabled={inLibrary || isDownloading}
                    className={`self-start mt-2 px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 font-tech tracking-widest transition-all ${inLibrary ? 'text-green-400 bg-green-500/10 border border-green-500/30 cursor-default' : 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 hover:bg-blue-500 active:scale-95'}`}
                >
                    {isDownloading ? 'DOWNLOADING...' : inLibrary ? 'INSTALLED' : actionLabel || 'INSTALL'}
                </button>
              </div>
            </div>
       );
  };

  // --- RENDER ---

  if (view === 'reader' && activeNovel && activeChapter) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        <Reader 
            novel={activeNovel}
            chapter={activeChapter}
            content={activeChapterContent} 
            onClose={() => setView('library')}
            onNextChapter={handleNextChapter}
            onPrevChapter={handlePrevChapter}
            onSelectChapter={(ch) => handleOpenReader(activeNovel.id, ch.id)}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-gray-100 select-none overflow-hidden relative font-sans">
      <ToastContainer toasts={toasts} />
      
      {/* Global Loading Overlay */}
      {isReaderLoading && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
              <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
                  <p className="font-tech text-blue-400 text-sm tracking-[0.2em] animate-pulse">DOWNLOADING DATA...</p>
              </div>
          </div>
      )}
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navigation */}
      <header className="glass-panel px-4 py-4 sticky top-0 z-10 safe-top border-b border-white/5">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600/20 p-2 rounded-lg backdrop-blur-md border border-blue-500/30 shadow-[0_0_10px_rgba(37,99,235,0.3)]">
                <BookIcon className="w-5 h-5 text-blue-400" />
             </div>
             <div>
                <h1 className="font-tech font-bold text-lg leading-none tracking-wider text-white drop-shadow-md">RANOBE</h1>
                <p className="text-[9px] text-blue-400 font-bold tracking-[0.2em] uppercase mt-1 opacity-80">System Online</p>
             </div>
          </div>
          {!isOnline && (
            <span className="text-[9px] font-bold bg-red-900/50 border border-red-500/50 text-red-200 px-3 py-1 rounded animate-pulse tracking-widest">OFFLINE</span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 no-scrollbar touch-pan-y relative z-0">
        <div className="max-w-2xl mx-auto p-4">
          
          {/* LIBRARY & HOME */}
          {view === 'library' && (
            <div className="space-y-8 animate-fade-in">
              
              {/* My Library Section */}
              {library.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] font-tech border-b border-white/10 pb-2">My Library</h2>
                    <div className="grid grid-cols-3 gap-4">
                      {library.map(novel => (
                        <div key={novel.id} onClick={() => handleOpenReader(novel.id, novel.lastReadChapterId)} className="group relative flex flex-col cursor-pointer active:scale-95 transition-transform duration-300">
                          <div className="aspect-[2/3] w-full rounded-xl overflow-hidden shadow-lg shadow-black/50 relative bg-gray-800 border border-white/5 group-hover:border-blue-500/50 transition-colors">
                             <img 
                                src={novel.coverUrl} 
                                alt={novel.title} 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                                onError={(e) => {
                                    e.currentTarget.src = `https://via.placeholder.com/200x300?text=${encodeURIComponent(novel.title.substring(0,10))}`;
                                }}
                             />
                             <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
                             
                             <div className="absolute top-2 right-2">
                                 {novel.status === 'Ongoing' ? (
                                     <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
                                 ) : (
                                     <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                                 )}
                             </div>
    
                             <button onClick={(e) => deleteFromLibrary(novel.id, e)} className="absolute bottom-2 right-2 bg-red-500/20 backdrop-blur text-red-200 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border border-red-500/30">
                                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                          </div>
                          <h3 className="font-bold text-[10px] mt-2 leading-tight text-blue-100 uppercase tracking-wide truncate group-hover:text-white transition-colors">{novel.title}</h3>
                          <p className="text-[9px] text-gray-500 truncate font-mono">CH {novel.lastReadChapterId ? novel.chapters.find(c => c.id === novel.lastReadChapterId)?.chapterNumber : 0} / {novel.totalChapters}</p>
                        </div>
                      ))}
                    </div>
                </div>
              )}

              {/* Recommendations Section */}
              <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-white/10 pb-2">
                    <h2 className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] font-tech">Top Rated & Trending</h2>
                    {isLoadingFeatured && <RefreshIcon className="w-3 h-3 animate-spin text-blue-500" />}
                  </div>

                  {featuredNovels.length > 0 ? (
                      <div className="flex flex-col">
                          {featuredNovels.map(novel => (
                              <NovelCard key={novel.id} novel={novel} />
                          ))}
                      </div>
                  ) : (
                      <div className="text-center py-10 px-6 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                           <div className="flex flex-col items-center gap-2">
                               <RefreshIcon className="w-6 h-6 animate-spin text-blue-500" />
                               <span className="text-[9px] font-tech tracking-widest opacity-50">INITIALIZING DATABASE...</span>
                           </div>
                      </div>
                  )}
              </div>
            </div>
          )}

          {/* SEARCH */}
          {view === 'search' && (
            <div className="space-y-6 animate-fade-in">
                  <form onSubmit={handleSearch} className="relative sticky top-0 z-10">
                    <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full"></div>
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ENTER KEYWORDS..." 
                      className="relative w-full pl-12 pr-24 py-4 bg-[#0f172a]/90 backdrop-blur-xl border border-white/10 rounded-2xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm font-medium text-white font-tech placeholder-gray-600 shadow-2xl transition-all"
                    />
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 w-5 h-5" />
                    <button type="submit" disabled={!searchQuery.trim() || isSearching} className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-bold disabled:opacity-50 font-tech tracking-widest transition-all hover:shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                        {isSearching ? 'SCANNING' : 'SEARCH'}
                    </button>
                  </form>

                  <div className="space-y-3">
                    {searchResults.map(novel => (
                       <NovelCard key={novel.id} novel={novel} />
                    ))}
                  </div>
            </div>
          )}
        </div>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 glass-panel border-t border-white/5 pb-safe z-40 bg-[#0f172a]/80">
        <div className="flex justify-around items-center h-20 max-w-2xl mx-auto">
          <button onClick={() => setView('library')} className={`flex flex-col items-center gap-1.5 w-full h-full justify-center transition-all duration-300 ${view === 'library' ? 'text-blue-400 scale-105' : 'text-gray-500 hover:text-gray-300'}`}>
            <HomeIcon className={`w-5 h-5 ${view === 'library' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : ''}`} />
            <span className="text-[9px] font-bold font-tech tracking-widest">LIBRARY</span>
            {view === 'library' && <div className="w-1 h-1 rounded-full bg-blue-500 absolute bottom-4 animate-glow" />}
          </button>
          <button onClick={() => isOnline ? setView('search') : addToast("OFFLINE MODE.", 'error')} className={`flex flex-col items-center gap-1.5 w-full h-full justify-center transition-all duration-300 ${view === 'search' ? 'text-blue-400 scale-105' : 'text-gray-500 hover:text-gray-300'}`}>
            <SearchIcon className={`w-5 h-5 ${view === 'search' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]' : ''}`} />
            <span className="text-[9px] font-bold font-tech tracking-widest">DISCOVER</span>
            {view === 'search' && <div className="w-1 h-1 rounded-full bg-blue-500 absolute bottom-4 animate-glow" />}
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;