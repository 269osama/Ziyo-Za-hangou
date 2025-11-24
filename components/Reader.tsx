import React, { useState, useEffect } from 'react';
import { LibraryItem, ReaderSettings } from '../types';
import { ChevronLeftIcon, SettingsIcon } from './Icons';

interface ReaderProps {
  novel: LibraryItem;
  content: string; // The full text
  onClose: () => void;
  onUpdateProgress: (novelId: string, chapter: number) => void;
}

const Reader: React.FC<ReaderProps> = ({ novel, content, onClose, onUpdateProgress }) => {
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 18,
    fontFamily: 'serif',
    theme: 'light',
  });
  const [showSettings, setShowSettings] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Restore scroll position
  useEffect(() => {
    const savedScroll = localStorage.getItem(`scroll_${novel.id}`);
    if (savedScroll) {
      window.scrollTo(0, parseInt(savedScroll));
    } else {
      window.scrollTo(0, 0);
    }

    const handleScroll = () => {
      const position = window.scrollY;
      const total = document.body.scrollHeight - window.innerHeight;
      const progress = (position / total) * 100;
      setScrollProgress(progress);
      localStorage.setItem(`scroll_${novel.id}`, position.toString());
      
      // Assume chapter finished if scrolled to 90%
      if (progress > 90) {
        onUpdateProgress(novel.id, 1); // Simulating chapter 1 for now
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [novel.id, onUpdateProgress]);

  // Theme Styles
  const getThemeClass = () => {
    switch (settings.theme) {
      case 'sepia': return 'bg-[#f4ecd8] text-[#5b4636]';
      case 'dark': return 'bg-[#1a1a1a] text-[#d1d5db]';
      default: return 'bg-white text-gray-900';
    }
  };

  return (
    <div className={`min-h-screen ${getThemeClass()} transition-colors duration-300 relative`}>
      {/* Sticky Header */}
      <div className={`fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-50 border-b ${settings.theme === 'dark' ? 'border-gray-800 bg-[#1a1a1a]/90' : 'border-gray-200 bg-white/90'} backdrop-blur-sm transition-transform duration-300`}>
        <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="text-sm font-semibold truncate max-w-[200px]">{novel.title}</h1>
        <button 
          onClick={() => setShowSettings(!showSettings)} 
          className="p-2 -mr-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className={`fixed top-14 right-4 w-64 p-4 rounded-xl shadow-xl z-50 border ${settings.theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-wide opacity-50 mb-2 block">Theme</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setSettings(s => ({...s, theme: 'light'}))}
                className={`w-8 h-8 rounded-full border border-gray-300 bg-white ${settings.theme === 'light' ? 'ring-2 ring-blue-500' : ''}`}
              />
              <button 
                onClick={() => setSettings(s => ({...s, theme: 'sepia'}))}
                className={`w-8 h-8 rounded-full border border-[#e3dccb] bg-[#f4ecd8] ${settings.theme === 'sepia' ? 'ring-2 ring-blue-500' : ''}`}
              />
              <button 
                onClick={() => setSettings(s => ({...s, theme: 'dark'}))}
                className={`w-8 h-8 rounded-full border border-gray-700 bg-[#1a1a1a] ${settings.theme === 'dark' ? 'ring-2 ring-blue-500' : ''}`}
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-wide opacity-50 mb-2 block">Font Size</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setSettings(s => ({...s, fontSize: Math.max(12, s.fontSize - 1)}))} className="p-1 font-bold">A-</button>
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: `${((settings.fontSize - 12) / 12) * 100}%` }}></div>
              </div>
              <button onClick={() => setSettings(s => ({...s, fontSize: Math.min(24, s.fontSize + 1)}))} className="p-1 font-bold">A+</button>
            </div>
          </div>

          <div>
             <label className="text-xs font-bold uppercase tracking-wide opacity-50 mb-2 block">Typeface</label>
             <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
               <button 
                onClick={() => setSettings(s => ({...s, fontFamily: 'sans'}))}
                className={`flex-1 py-1 text-xs rounded-md ${settings.fontFamily === 'sans' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
               >Sans</button>
               <button 
                onClick={() => setSettings(s => ({...s, fontFamily: 'serif'}))}
                className={`flex-1 py-1 text-xs rounded-md ${settings.fontFamily === 'serif' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
               >Serif</button>
             </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div 
        className={`pt-20 pb-20 px-4 md:px-0 max-w-2xl mx-auto leading-relaxed ${settings.fontFamily === 'serif' ? 'font-serif' : 'font-sans'}`}
        style={{ fontSize: `${settings.fontSize}px` }}
      >
        {content.split('\n').map((para, i) => (
          <p key={i} className={`mb-4 ${para.startsWith('#') ? 'text-2xl font-bold mt-8 mb-6' : ''}`}>
             {para.replace(/^#\s/, '')}
          </p>
        ))}
        
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-center opacity-60 text-sm">
          <p>End of Chapter 1</p>
        </div>
      </div>

      {/* Progress Bar (Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-800 z-50">
        <div className="h-full bg-blue-500 transition-all duration-150" style={{ width: `${scrollProgress}%` }} />
      </div>
    </div>
  );
};

export default Reader;