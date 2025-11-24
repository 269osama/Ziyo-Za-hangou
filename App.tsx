import React, { useState, useEffect, useCallback } from 'react';
import { Novel, LibraryItem, ViewState } from './types';
import { searchNovels, downloadChapterContent } from './services/geminiService';
import { BookIcon, SearchIcon, HomeIcon, DownloadIcon, CheckIcon, RefreshIcon } from './components/Icons';
import Reader from './components/Reader';

function App() {
  const [view, setView] = useState<ViewState>('library');
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Novel[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Download/Active Reading State
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [activeNovel, setActiveNovel] = useState<LibraryItem | null>(null);
  const [activeChapterContent, setActiveChapterContent] = useState<string>('');
  
  // Network State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor Online/Offline Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
        setIsOnline(false);
        // Automatically switch to library if user goes offline while in search
        if (view === 'search') {
            setView('library');
        }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, [view]);

  // Load library from local storage on mount
  useEffect(() => {
    try {
      const savedLib = localStorage.getItem('my_library');
      if (savedLib) {
        setLibrary(JSON.parse(savedLib));
      }
    } catch (e) {
      console.error("Failed to load library", e);
    }
  }, []);

  // Save library whenever it changes
  useEffect(() => {
    localStorage.setItem('my_library', JSON.stringify(library));
  }, [library]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    if (!isOnline) {
        setError("You are offline. Connect to the internet to search.");
        return;
    }
    
    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    setSearchResults([]); 
    
    try {
      const results = await searchNovels(searchQuery);
      if (results && results.length > 0) {
        setSearchResults(results);
      } else {
        // If results is empty array but no error thrown
        setError("No novels found for this query. Try a more general term.");
      }
    } catch (err: any) {
      console.error("Search failed", err);
      if (err.message === "API_KEY_MISSING") {
         setError("API Key is missing from configuration.");
      } else {
         setError(err.message || "Failed to search novels. The AI service might be busy.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownload = async (novel: Novel) => {
    if (!isOnline) {
        alert("You need an internet connection to download new books.");
        return;
    }

    if (downloadingIds.has(novel.id)) return;

    // Check if already in library
    if (library.find(n => n.id === novel.id)) {
      setView('library');
      return;
    }

    setDownloadingIds(prev => new Set(prev).add(novel.id));

    // 1. Generate content via Gemini (simulating download)
    try {
      const content = await downloadChapterContent(novel.title, 1);
      
      // 2. Save content to LocalStorage
      try {
          localStorage.setItem(`novel_content_${novel.id}_ch1`, content);
          
          const newItem: LibraryItem = {
              ...novel,
              downloaded: true,
              lastReadChapter: 0,
              totalChapters: 100, // Mock
              savedAt: Date.now()
          };

          setLibrary(prev => [newItem, ...prev]);
          // Optional: Vibrate on success
          if (navigator.vibrate) navigator.vibrate(50);
      } catch (e) {
          alert("Storage full! Please delete some books.");
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
        setDownloadingIds(prev => {
            const next = new Set(prev);
            next.delete(novel.id);
            return next;
        });
    }
  };

  const handleOpenReader = (novel: LibraryItem) => {
    const content = localStorage.getItem(`novel_content_${novel.id}_ch1`);
    if (content) {
      setActiveNovel(novel);
      setActiveChapterContent(content);
      setView('reader');
    } else {
      // Fallback or error if data missing (e.g. cleared cache)
      if (isOnline) {
          if(confirm("Content missing from device. Re-download now?")) {
              handleDownload(novel);
          }
      } else {
          alert("This chapter is not downloaded and you are offline.");
      }
    }
  };

  const deleteFromLibrary = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm("Remove this book from library?")) {
        setLibrary(prev => prev.filter(n => n.id !== id));
        localStorage.removeItem(`novel_content_${id}_ch1`);
    }
  };

  if (view === 'reader' && activeNovel) {
    return (
      <Reader 
        novel={activeNovel} 
        content={activeChapterContent} 
        onClose={() => setView('library')}
        onUpdateProgress={(id, ch) => {
            // Update last read status
            setLibrary(prev => prev.map(n => n.id === id ? {...n, lastReadChapter: ch} : n));
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 select-none overflow-hidden">
      
      {/* Top Navigation - Updated to match Blue style */}
      <header className="bg-blue-600 px-4 py-3 sticky top-0 z-10 shadow-md safe-top">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3 text-white">
             <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                <BookIcon className="w-6 h-6 text-white" />
             </div>
             <div>
                <h1 className="font-bold text-lg leading-none tracking-tight">Ranobe Reader</h1>
                <p className="text-[10px] text-blue-100 opacity-80 font-medium">Offline Light Novels</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
                <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-1 rounded-full animate-pulse">
                    OFFLINE
                </span>
            )}
            {view === 'library' && (
                <span className="text-xs font-medium text-blue-100 bg-blue-700/50 px-2 py-1 rounded-md border border-blue-500/50">
                    {library.length} books
                </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 no-scrollbar touch-pan-y">
        <div className="max-w-2xl mx-auto p-4">
          
          {/* LIBRARY VIEW */}
          {view === 'library' && (
            <div className="space-y-6">
              {library.length === 0 ? (
                <div className="text-center py-20 px-6">
                   <div className="bg-blue-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                       <BookIcon className="w-10 h-10 text-blue-500" />
                   </div>
                   <h2 className="text-xl font-bold text-gray-800 mb-2">Your library is empty</h2>
                   <p className="text-gray-500 mb-8 max-w-xs mx-auto">
                       {isOnline 
                        ? "Search and download light novels to read them offline later."
                        : "You are offline. Connect to the internet to add books."}
                   </p>
                   {isOnline && (
                       <button 
                        onClick={() => setView('search')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-blue-500/30 transition-all active:scale-95 transform hover:-translate-y-1"
                       >
                         Start Browsing
                       </button>
                   )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {library.map(novel => (
                    <div 
                        key={novel.id} 
                        onClick={() => handleOpenReader(novel)}
                        className="group relative flex flex-col cursor-pointer transition-transform active:scale-95"
                    >
                      <div className="aspect-[2/3] w-full rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300 relative bg-gray-200">
                         {/* Offline Check Badge */}
                         <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5 z-10 shadow-sm border border-white">
                            <CheckIcon className="w-3 h-3 text-white" />
                         </div>
                         
                         <img src={novel.coverUrl} alt={novel.title} className="w-full h-full object-cover" loading="lazy" />
                         <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                         
                         {/* Delete button */}
                         <button 
                            onClick={(e) => deleteFromLibrary(novel.id, e)}
                            className="absolute bottom-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                         >
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                      </div>
                      <div className="mt-2">
                          <h3 className="font-bold text-xs leading-tight text-gray-900 line-clamp-2 mb-1">{novel.title}</h3>
                          <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                               <div className={`h-full ${novel.lastReadChapter > 0 ? 'bg-blue-500' : 'bg-transparent'}`} style={{width: `${Math.max(5, (novel.lastReadChapter / novel.totalChapters) * 100)}%`}} />
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SEARCH VIEW */}
          {view === 'search' && (
            <div className="space-y-6">
              {!isOnline ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="bg-gray-200 p-4 rounded-full mb-4">
                          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                      </div>
                      <h3 className="font-bold text-gray-800">You're Offline</h3>
                      <p className="text-sm text-gray-500 mt-2">Connect to the internet to discover new novels.</p>
                      <button onClick={() => setView('library')} className="mt-6 text-blue-600 font-medium text-sm">Return to Library</button>
                  </div>
              ) : (
                <>
                  <form onSubmit={handleSearch} className="relative sticky top-0 bg-gray-50 pb-2 z-10">
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search light novels..." 
                      className="w-full pl-12 pr-4 py-3.5 bg-white rounded-xl shadow-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                    />
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-[calc(50%+4px)] text-gray-400 w-5 h-5" />
                    <button 
                      type="submit" 
                      disabled={!searchQuery.trim() || isSearching}
                      className="absolute right-2 top-1/2 -translate-y-[calc(50%+4px)] bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide disabled:opacity-50 disabled:bg-gray-300"
                    >
                        {isSearching ? '...' : 'Search'}
                    </button>
                  </form>

                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <p className="text-red-800 text-sm font-medium">{error}</p>
                        {error.includes("API Key") && (
                            <div className="mt-2 text-xs text-red-600 text-left bg-white/50 p-2 rounded">
                                <p className="font-bold">Troubleshooting:</p>
                                <ol className="list-decimal ml-4 mt-1 space-y-1">
                                    <li>Check your Vercel Project Settings</li>
                                    <li>Ensure your variable is named <code>API_KEY</code> or <code>VITE_API_KEY</code></li>
                                    <li>Redeploy the project after changing settings</li>
                                </ol>
                            </div>
                        )}
                    </div>
                  )}

                  {/* Suggestions / Initial State */}
                  {!isSearching && !hasSearched && searchResults.length === 0 && (
                      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                          <div className="flex items-start gap-4">
                              <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                                 <RefreshIcon className="w-6 h-6" />
                              </div>
                              <div>
                                  <h3 className="font-bold text-gray-900 mb-1">Discover Novels</h3>
                                  <p className="text-sm text-gray-500 mb-4">
                                      Ask AI to find trending novels. Try searching for generic terms or specific genres.
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                      {['Top Rated', 'Isekai', 'Romance', 'Fantasy', 'Action'].map(genre => (
                                          <button 
                                            key={genre}
                                            onClick={() => {
                                                setSearchQuery(`${genre} light novels`);
                                                // Trigger search manually since state update is async in a handler
                                                // Ideally we'd use a useEffect or specific handler, 
                                                // but for this simple app, we'll let the user click search or just set query
                                            }}
                                            className="text-xs bg-gray-50 text-gray-700 px-3 py-1.5 rounded-full border border-gray-200 font-medium hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                          >
                                              {genre}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* No Results State */}
                  {!isSearching && hasSearched && searchResults.length === 0 && !error && (
                      <div className="text-center py-10">
                          <p className="text-gray-500 text-sm">No novels found matching "{searchQuery}".</p>
                          <p className="text-xs text-gray-400 mt-1">Try a different keyword.</p>
                      </div>
                  )}

                  {/* Results List */}
                  <div className="space-y-3">
                    {isSearching && (
                        // Skeleton Loading
                        [1,2,3].map(i => (
                            <div key={i} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex gap-3 animate-pulse">
                                <div className="w-20 h-28 bg-gray-200 rounded-md shrink-0" />
                                <div className="flex-1 space-y-2 py-2">
                                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                                    <div className="h-12 bg-gray-200 rounded w-full mt-2" />
                                </div>
                            </div>
                        ))
                    )}

                    {searchResults.map(novel => {
                       const isDownloaded = library.some(lib => lib.id === novel.id);
                       const isDownloading = downloadingIds.has(novel.id);

                       return (
                        <div key={novel.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex gap-3 hover:shadow-md transition-shadow">
                          <div className="w-20 h-28 shrink-0 relative rounded-md overflow-hidden bg-gray-200 shadow-inner">
                              <img src={novel.coverUrl} alt={novel.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 flex flex-col justify-between py-0.5">
                            <div>
                                <div className="flex justify-between items-start">
                                    <h3 className="font-bold text-sm text-gray-900 leading-snug mb-0.5 line-clamp-1">{novel.title}</h3>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${novel.status === 'Ongoing' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {novel.status}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mb-2 font-medium">{novel.author}</p>
                                <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed opacity-80">{novel.description}</p>
                            </div>
                            
                            <div className="mt-2 flex items-center justify-between">
                                <div className="flex gap-1 overflow-hidden">
                                    {novel.tags.slice(0, 2).map(tag => (
                                        <span key={tag} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">{tag}</span>
                                    ))}
                                </div>
                                
                                <button 
                                    onClick={() => handleDownload(novel)}
                                    disabled={isDownloaded || isDownloading}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                        ${isDownloaded 
                                            ? 'bg-transparent text-green-600 cursor-default' 
                                            : 'bg-blue-600 text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-95'
                                        }
                                        ${isDownloading ? 'opacity-75 cursor-wait' : ''}
                                    `}
                                >
                                    {isDownloading ? (
                                        <>
                                           <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                           <span>Loading...</span>
                                        </>
                                    ) : isDownloaded ? (
                                        <>
                                            <CheckIcon className="w-4 h-4" />
                                            <span>Saved</span>
                                        </>
                                    ) : (
                                        <>
                                            <DownloadIcon className="w-3 h-3" />
                                            <span>Download</span>
                                        </>
                                    )}
                                </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Tabs */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16 max-w-2xl mx-auto">
          <button 
            onClick={() => setView('library')}
            className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${view === 'library' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <HomeIcon className={`w-6 h-6 ${view === 'library' ? 'fill-current/10 stroke-[2.5px]' : ''}`} />
            <span className="text-[10px] font-bold">My Library</span>
          </button>
          
          <button 
             onClick={() => {
                 if (isOnline) setView('search');
                 else alert("Search is unavailable offline.");
             }}
             className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${view === 'search' ? 'text-blue-600' : isOnline ? 'text-gray-400 hover:text-gray-600' : 'text-gray-300 cursor-not-allowed'}`}
          >
            <SearchIcon className={`w-6 h-6 ${view === 'search' ? 'stroke-[2.5px]' : ''}`} />
            <span className="text-[10px] font-bold">Discover</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;