import React, { useState, useEffect, useRef } from 'react';
import { LibraryItem, ReaderSettings, ChapterMetadata } from '../types';
import { ChevronLeftIcon, SettingsIcon, RefreshIcon, CheckIcon } from './Icons';
import { generateChapterImage } from '../services/geminiService';

interface ReaderProps {
  novel: LibraryItem;
  chapter: ChapterMetadata;
  content: string;
  onClose: () => void;
  onNextChapter: () => void;
  onPrevChapter: () => void;
  onSelectChapter: (ch: ChapterMetadata) => void;
}

const Reader: React.FC<ReaderProps> = ({ 
    novel, chapter, content, onClose, onNextChapter, onPrevChapter, onSelectChapter 
}) => {
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 18,
    fontFamily: 'serif',
    theme: 'future',
    lineHeight: 1.8,
    autoGenerateImage: false,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  // Image Generation State
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Swipe State
  const touchStart = useRef<number | null>(null);
  const [swipeHint, setSwipeHint] = useState<'next' | 'prev' | null>(null);

  useEffect(() => {
    // Unique key for every chapter
    const key = `scroll_${novel.id}_ch${chapter.chapterNumber}`;
    const savedScroll = localStorage.getItem(key);
    if (savedScroll) {
      window.scrollTo(0, parseInt(savedScroll));
    } else {
      window.scrollTo(0, 0);
    }
    
    // Check local storage for image
    const savedImg = localStorage.getItem(`img_${novel.id}_ch${chapter.chapterNumber}`);
    setGeneratedImage(savedImg);

    // Auto-generate check (if at end of chapter, roughly)
    if (!savedImg && settings.autoGenerateImage) {
        // Logic handled in handleGenerateImage if needed, but usually user scrolls to bottom
    }

    const handleScroll = () => {
      const position = window.scrollY;
      const total = document.body.scrollHeight - window.innerHeight;
      const progress = total > 0 ? (position / total) * 100 : 0;
      setScrollProgress(progress);
      localStorage.setItem(key, position.toString());
      
      // Auto-hide controls on scroll
      if (controlsVisible && position > 50) setControlsVisible(false);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [novel.id, chapter.chapterNumber]);
  
  // Trigger auto-generate if settings enabled and user reaches bottom (simplified: doing it on load if configured, or maybe just manual is better for cost)
  // For now we keep it manual or explicitly via button, but settings toggle exists.

  // Handle Swipe Gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const current = e.targetTouches[0].clientX;
      const diff = touchStart.current - current;
      if (Math.abs(diff) > 50) {
          setSwipeHint(diff > 0 ? 'next' : 'prev');
      } else {
          setSwipeHint(null);
      }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart.current - touchEnd;
    setSwipeHint(null);

    if (Math.abs(diff) > 100) { // Threshold
        if (diff > 0) onNextChapter();
        else onPrevChapter();
    }
    touchStart.current = null;
  };

  const toggleControls = () => {
      setControlsVisible(prev => !prev);
  };

  const handleGenerateImage = async (e?: React.MouseEvent) => {
      e?.stopPropagation(); // Prevent toggling controls
      setIsGeneratingImage(true);
      try {
          const base64 = await generateChapterImage(content);
          setGeneratedImage(base64);
          localStorage.setItem(`img_${novel.id}_ch${chapter.chapterNumber}`, base64);
      } catch (e) {
          // Toast will be handled by App logic if we hoisted it, but here we just alert safely or ignore
          console.error(e);
      } finally {
          setIsGeneratingImage(false);
      }
  };

  const getThemeClass = () => {
    switch (settings.theme) {
      case 'sepia': return 'bg-[#f4ecd8] text-[#5b4636] selection:bg-[#d4c5a3]';
      case 'dark': return 'bg-[#1a1a1a] text-[#d1d5db] selection:bg-gray-700';
      case 'light': return 'bg-white text-gray-900 selection:bg-blue-100';
      case 'future': default: return 'bg-[#0f172a] text-[#94a3b8] selection:bg-blue-500/30';
    }
  };
  
  const getTextColor = () => settings.theme === 'future' ? 'text-slate-300' : '';

  return (
    <div 
        className={`min-h-screen ${getThemeClass()} transition-colors duration-500 relative overflow-hidden`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      {/* Swipe Hint Overlay */}
      <div className={`fixed inset-y-0 right-0 w-16 bg-gradient-to-l from-blue-500/20 to-transparent pointer-events-none transition-opacity duration-300 z-40 ${swipeHint === 'next' ? 'opacity-100' : 'opacity-0'}`} />
      <div className={`fixed inset-y-0 left-0 w-16 bg-gradient-to-r from-blue-500/20 to-transparent pointer-events-none transition-opacity duration-300 z-40 ${swipeHint === 'prev' ? 'opacity-100' : 'opacity-0'}`} />

      {/* Background Ambience for Future Theme */}
      {settings.theme === 'future' && (
          <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900 via-[#0f172a] to-[#0f172a]" />
      )}

      {/* Tap Zone to Toggle Controls */}
      <div className="fixed inset-0 z-0" onClick={toggleControls} />

      {/* HUD Header */}
      <div className={`fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50 transition-all duration-500 transform ${controlsVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'} ${settings.theme === 'future' ? 'bg-[#0f172a]/80 backdrop-blur-md border-b border-white/5' : 'bg-white/90 backdrop-blur border-b border-gray-200'}`}>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-3 -ml-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all">
          <ChevronLeftIcon className={`w-6 h-6 ${settings.theme === 'future' ? 'text-blue-400' : 'text-gray-700'}`} />
        </button>
        <div 
            className="flex-1 text-center mx-4 cursor-pointer active:scale-95 transition-transform"
            onClick={(e) => { e.stopPropagation(); setShowChapters(true); }}
        >
            <h1 className={`text-[9px] font-bold uppercase tracking-[0.2em] mb-1 ${settings.theme === 'future' ? 'text-blue-500' : 'text-gray-500'}`}>Chapter {chapter.chapterNumber}</h1>
            <h2 className={`text-xs font-bold truncate font-tech ${settings.theme === 'future' ? 'text-white' : 'text-gray-900'}`}>{chapter.title}</h2>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} 
          className="p-3 -mr-2 rounded-xl hover:bg-white/10 active:scale-95 transition-all"
        >
          <SettingsIcon className={`w-5 h-5 ${settings.theme === 'future' ? 'text-blue-400' : 'text-gray-700'}`} />
        </button>
      </div>

      {/* Chapter Menu Modal */}
      {showChapters && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="flex-1" onClick={() => setShowChapters(false)} />
            <div className={`h-[70vh] rounded-t-3xl shadow-2xl overflow-hidden flex flex-col ${settings.theme === 'future' ? 'bg-[#0f172a] text-white border-t border-blue-500/20' : 'bg-white text-gray-900'}`}>
                <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="font-bold font-tech tracking-wide text-sm">CHAPTER INDEX</h3>
                    <button onClick={() => setShowChapters(false)} className="p-2 opacity-50 hover:opacity-100">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
                    {novel.chapters && novel.chapters.length > 0 ? (
                        novel.chapters.map(ch => (
                            <button
                                key={ch.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectChapter(ch);
                                    setShowChapters(false);
                                }}
                                className={`w-full text-left p-4 rounded-xl mb-2 flex justify-between items-center transition-all ${
                                    ch.chapterNumber === chapter.chapterNumber 
                                    ? 'bg-blue-600 shadow-lg shadow-blue-900/50 text-white' 
                                    : settings.theme === 'future' ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-700'
                                }`}
                            >
                                <span className="text-xs font-bold font-tech tracking-wide">CH {ch.chapterNumber} <span className="opacity-50 mx-2">|</span> {ch.title}</span>
                                {localStorage.getItem(`novel_content_${novel.id}_ch${ch.chapterNumber}`) && (
                                    <CheckIcon className="w-4 h-4 opacity-70" />
                                )}
                            </button>
                        ))
                    ) : (
                        <div className="p-4 text-center opacity-50 font-mono text-xs">NO DATA AVAILABLE</div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className={`fixed top-16 right-4 w-72 p-5 rounded-2xl shadow-2xl z-50 border backdrop-blur-xl animate-fade-in ${settings.theme === 'future' ? 'bg-[#0f172a]/95 border-blue-500/30' : 'bg-white border-gray-200'}`}>
           <div className="mb-6">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-3 block font-tech">Appearance</label>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => setSettings(s => ({...s, theme: 'light'}))} className={`h-10 rounded-lg border-2 bg-white ${settings.theme === 'light' ? 'border-blue-500' : 'border-gray-200'}`} />
              <button onClick={() => setSettings(s => ({...s, theme: 'sepia'}))} className={`h-10 rounded-lg border-2 bg-[#f4ecd8] ${settings.theme === 'sepia' ? 'border-blue-500' : 'border-[#e3dccb]'}`} />
              <button onClick={() => setSettings(s => ({...s, theme: 'dark'}))} className={`h-10 rounded-lg border-2 bg-[#1a1a1a] ${settings.theme === 'dark' ? 'border-blue-500' : 'border-gray-700'}`} />
              <button onClick={() => setSettings(s => ({...s, theme: 'future'}))} className={`h-10 rounded-lg border-2 bg-[#0f172a] relative overflow-hidden ${settings.theme === 'future' ? 'border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-blue-900'}`}>
                  <div className="absolute inset-0 bg-blue-500/20"></div>
              </button>
            </div>
          </div>
          <div className="mb-6">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-3 block font-tech">Font Size</label>
            <div className="flex items-center gap-4 bg-white/5 p-2 rounded-xl border border-white/10">
              <button onClick={() => setSettings(s => ({...s, fontSize: Math.max(12, s.fontSize - 1)}))} className="w-8 h-8 flex items-center justify-center font-bold bg-white/10 rounded-lg">-</button>
              <span className="flex-1 text-center text-xs font-mono">{settings.fontSize}px</span>
              <button onClick={() => setSettings(s => ({...s, fontSize: Math.min(24, s.fontSize + 1)}))} className="w-8 h-8 flex items-center justify-center font-bold bg-white/10 rounded-lg">+</button>
            </div>
          </div>
          <div className="mb-6">
             <label className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-3 block font-tech">Typography</label>
             <div className="flex bg-black/20 rounded-xl p-1 gap-1">
               <button onClick={() => setSettings(s => ({...s, fontFamily: 'sans'}))} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${settings.fontFamily === 'sans' ? 'bg-blue-600 text-white shadow' : 'hover:bg-white/5'}`}>SANS</button>
               <button onClick={() => setSettings(s => ({...s, fontFamily: 'serif'}))} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${settings.fontFamily === 'serif' ? 'bg-blue-600 text-white shadow' : 'hover:bg-white/5'}`}>SERIF</button>
             </div>
          </div>
          <div>
              <label className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer group">
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-50 font-tech">Auto-Visualize</span>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${settings.autoGenerateImage ? 'bg-blue-600' : 'bg-gray-700'}`} onClick={() => setSettings(s => ({...s, autoGenerateImage: !s.autoGenerateImage}))}>
                      <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.autoGenerateImage ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
              </label>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div 
        className={`pt-24 pb-40 px-6 md:px-0 max-w-2xl mx-auto leading-relaxed relative z-10 ${settings.fontFamily === 'serif' ? 'font-serif' : 'font-sans'} ${getTextColor()}`}
        style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
      >
        <h1 className="text-3xl font-bold mb-12 text-center tracking-tight leading-tight">{chapter.title}</h1>
        
        {content.split('\n').map((para, i) => (
          <p key={i} className={`mb-6 ${para.trim().startsWith('#') ? 'text-xl font-bold mt-8 opacity-90' : 'opacity-80'}`}>
             {para.replace(/^#\s/, '')}
          </p>
        ))}
        
        {/* Memory Shard (Visualization) */}
        <div className="mt-20 pt-10 border-t border-white/10 flex flex-col items-center gap-8">
            <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.3em] opacity-50 font-tech mb-2">CHAPTER {chapter.chapterNumber} COMPLETE</p>
                <div className="h-1 w-20 bg-blue-500 mx-auto rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
            </div>
            
            {generatedImage ? (
                <div className="w-full relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10">
                        <img src={generatedImage} alt="Visual" className="w-full h-auto opacity-90 hover:opacity-100 transition-opacity duration-700" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                            <p className="text-[10px] text-blue-200 font-tech uppercase tracking-widest text-center drop-shadow-md">Memory Shard Acquired</p>
                        </div>
                    </div>
                </div>
            ) : (
                <button 
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage}
                    className="w-full py-6 rounded-2xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] border border-blue-500/20 hover:border-blue-500/50 group relative overflow-hidden transition-all shadow-xl"
                >
                     <div className="absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors"></div>
                     <div className="relative flex flex-col items-center gap-3">
                         {isGeneratingImage ? (
                             <RefreshIcon className="animate-spin w-8 h-8 text-blue-500"/>
                         ) : (
                             <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                                 <span className="text-2xl">✨</span>
                             </div>
                         )}
                         <span className="text-sm font-bold font-tech tracking-wider text-blue-200 group-hover:text-white transition-colors">
                             {isGeneratingImage ? "SYNCHRONIZING VISUAL DATA..." : "MATERIALIZE VISUAL"}
                         </span>
                     </div>
                </button>
            )}

            <div className="flex gap-4 w-full mt-8">
                <button 
                    onClick={(e) => { e.stopPropagation(); onPrevChapter(); }} 
                    className="flex-1 py-4 bg-white/5 border border-white/10 rounded-xl font-bold text-xs font-tech tracking-widest hover:bg-white/10 transition-colors active:scale-95"
                >
                    PREVIOUS
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onNextChapter(); }}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold text-xs font-tech tracking-widest shadow-lg shadow-blue-900/50 hover:bg-blue-500 active:scale-95 transition-all relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                    NEXT CHAPTER
                </button>
            </div>
        </div>
      </div>

      {/* Futuristic Progress Bar */}
      <div className={`fixed bottom-0 left-0 right-0 h-1 bg-white/5 z-50 transition-all duration-500 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]" style={{ width: `${scrollProgress}%` }} />
      </div>
    </div>
  );
};

export default Reader;