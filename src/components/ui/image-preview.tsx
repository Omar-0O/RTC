import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * ImagePreview — A premium smart popup lightbox.
 * Wraps any clickable element and opens a full-screen preview overlay on click.
 */
export function ImagePreview({ src, alt = 'Image preview', children, className }: ImagePreviewProps) {
  const { isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFitted, setIsFitted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const open = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setIsFitted(true);
    setIsLoaded(false);
    setShowControls(true);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === 'r' || e.key === 'R') rotate();
      if (e.key === '0') resetView();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, close]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    if (isOpen) resetControlsTimer();
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
  }, [isOpen, resetControlsTimer]);

  const zoomIn = () => { setScale(s => Math.min(s + 0.5, 5)); setIsFitted(false); };
  const zoomOut = () => {
    setScale(s => {
      const next = Math.max(s - 0.5, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };
  const rotate = () => setRotation(r => (r + 90) % 360);
  const resetView = () => { setScale(1); setRotation(0); setPosition({ x: 0, y: 0 }); setIsFitted(true); };
  const toggleFit = () => {
    if (isFitted) {
      setScale(2);
      setIsFitted(false);
    } else {
      resetView();
    }
  };

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    resetControlsTimer();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale(s => {
      const next = Math.max(0.3, Math.min(s + delta, 5));
      if (next <= 1) setPosition({ x: 0, y: 0 });
      setIsFitted(false);
      return next;
    });
  }, [resetControlsTimer]);

  // Double click to toggle zoom
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    resetControlsTimer();
    toggleFit();
  }, [isFitted]);

  // Drag to pan when zoomed
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    resetControlsTimer();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPosition({
      x: posStart.current.x + dx,
      y: posStart.current.y + dy,
    });
  }, [isDragging, resetControlsTimer]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch drag support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    posStart.current = { ...position };
  }, [scale, position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.current.x;
    const dy = touch.clientY - dragStart.current.y;
    setPosition({
      x: posStart.current.x + dx,
      y: posStart.current.y + dy,
    });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={open}
        className={cn('cursor-pointer focus:outline-none', className)}
      >
        {children}
      </button>
    );
  }

  const overlay = (
    <div
      className="fixed inset-0 z-[9999] select-none"
      onMouseMove={(e) => { handleMouseMove(e); resetControlsTimer(); }}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
      ref={containerRef}
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-xl"
        style={{ animation: 'ipFadeIn 200ms ease-out' }}
        onClick={close}
      />

      {/* Top bar — fades with controls */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent transition-all duration-300",
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        )}
      >
        {/* Left — info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 text-white/80 text-xs font-medium">
            <span>{Math.round(scale * 100)}%</span>
            {rotation > 0 && <span className="text-white/50">• {rotation}°</span>}
          </div>
        </div>

        {/* Right — close */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); close(); }}
          className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/25 active:bg-white/30 text-white flex items-center justify-center transition-all backdrop-blur-md hover:scale-105"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Bottom controls bar */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center pb-6 pt-12 bg-gradient-to-t from-black/60 to-transparent transition-all duration-300",
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        <div className="flex items-center gap-1 bg-white/10 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 shadow-2xl">
          {[
            { icon: ZoomOut, action: zoomOut, label: isRTL ? 'تصغير' : 'Zoom out', disabled: scale <= 0.5 },
            { icon: ZoomIn, action: zoomIn, label: isRTL ? 'تكبير' : 'Zoom in', disabled: scale >= 5 },
            { icon: RotateCw, action: rotate, label: isRTL ? 'تدوير' : 'Rotate' },
            { icon: isFitted ? Maximize2 : Minimize2, action: toggleFit, label: isRTL ? 'ملء الشاشة' : 'Fit/Fill' },
          ].map((btn, i) => (
            <button
              key={i}
              type="button"
              disabled={btn.disabled}
              onClick={(e) => { e.stopPropagation(); btn.action(); resetControlsTimer(); }}
              className={cn(
                "h-11 w-11 rounded-xl flex items-center justify-center text-white transition-all",
                btn.disabled
                  ? "opacity-30 cursor-not-allowed"
                  : "hover:bg-white/15 active:bg-white/25 hover:scale-105 active:scale-95"
              )}
              title={btn.label}
            >
              <btn.icon className="h-5 w-5" />
            </button>
          ))}

          {/* Separator */}
          <div className="w-px h-7 bg-white/20 mx-0.5" />

          {/* Download */}
          <a
            href={src}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.stopPropagation(); resetControlsTimer(); }}
            className="h-11 w-11 rounded-xl flex items-center justify-center text-white hover:bg-white/15 active:bg-white/25 hover:scale-105 active:scale-95 transition-all"
            title={isRTL ? 'تحميل' : 'Download'}
          >
            <Download className="h-5 w-5" />
          </a>
        </div>
      </div>

      {/* Loading spinner */}
      {!isLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* Image container */}
      <div
        className="absolute inset-0 z-[1] flex items-center justify-center overflow-hidden"
        onClick={close}
        onWheel={handleWheel}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => setIsLoaded(true)}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "max-w-[92vw] max-h-[88vh] object-contain select-none transition-[opacity] duration-300",
            isLoaded ? 'opacity-100' : 'opacity-0',
            scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in',
          )}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </div>

      {/* Inline styles for the animation */}
      <style>{`
        @keyframes ipFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={cn('cursor-pointer focus:outline-none', className)}
      >
        {children}
      </button>
      {createPortal(overlay, document.body)}
    </>
  );
}
