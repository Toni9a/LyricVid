
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Heart, 
  Music, 
  Type as TypeIcon, 
  Camera, 
  Search, 
  RefreshCw, 
  Download, 
  Video, 
  Sparkles,
  ChevronRight,
  User,
  Settings2,
  Send,
  Loader2,
  ImageIcon,
  Timer,
  Layers,
  Sun,
  Contrast,
  FlipHorizontal,
  UserCircle,
  AlertCircle
} from 'lucide-react';
import { AppMode, Theme, LyricResult } from './types';
import { GeminiService } from './services/geminiService';
import { DitherService } from './services/ditherService';
import { MusicService } from './services/musicService';

const INITIAL_QUERY = "Frank Ocean Blonde";

export default function App() {
  // Main State
  const [mode, setMode] = useState<AppMode>(AppMode.DEFAULT);
  const [theme, setTheme] = useState<Theme>(Theme.WHITE);
  const [threshold, setThreshold] = useState(52);
  const [ditherSteps, setDitherSteps] = useState(4);
  const [bgBrightness, setBgBrightness] = useState(0.65);
  const [textContrast, setTextContrast] = useState(0.4); 
  const [isFlipped, setIsFlipped] = useState(false);
  const [faceFocus, setFaceFocus] = useState(true);
  const [header, setHeader] = useState('to my dearest');
  const [customText, setCustomText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lyricsData, setLyricsData] = useState<LyricResult | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [ditheredBgCanvas, setDitheredBgCanvas] = useState<HTMLCanvasElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Facial detection state
  const [faceBox, setFaceBox] = useState<{x: number, y: number, w: number, h: number} | null>(null);

  // UI & Export State
  const [isSearching, setIsSearching] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [snapshotTimer, setSnapshotTimer] = useState(0); 
  const [countdown, setCountdown] = useState<number | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  if (!tempCanvasRef.current && typeof document !== 'undefined') {
    (tempCanvasRef as any).current = document.createElement('canvas');
    tempCanvasRef.current!.width = 160;
    tempCanvasRef.current!.height = 90;
  }

  const activeLyricsClean = useMemo(() => {
    let raw = 'I love you more than words can say. Every moment with you is a dream. ';
    if (mode === AppMode.HEARTS) {
      raw = '❤️ 💕 💖 💗 💘 💝 '.repeat(10);
    }
    else if (mode === AppMode.CUSTOM) raw = customText || 'Type your message... ';
    else if (mode === AppMode.LYRICS && lyricsData) raw = lyricsData.lyrics;
    
    if (mode !== AppMode.HEARTS) {
      return raw.replace(/\[.*?\]/g, '').replace(/\n+/g, ' ').trim();
    }
    return raw;
  }, [mode, customText, lyricsData]);

  useEffect(() => {
    handleFind(INITIAL_QUERY);
  }, []);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 }, 
          audio: true 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.error("Autoplay blocked:", e));
          };
        }
      } catch (err) {
        console.error("Camera access denied", err);
      }
    }
    setupCamera();
  }, []);

  // Native Face Detection
  useEffect(() => {
    if (!faceFocus) {
      setFaceBox(null);
      return;
    }

    let detectId: number;
    const detectorAvailable = 'FaceDetector' in window;
    let detector: any = null;
    
    if (detectorAvailable) {
      // @ts-ignore
      detector = new window.FaceDetector({ fastMode: true, maxFaces: 1 });
    }

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        detectId = requestAnimationFrame(detect);
        return;
      }

      try {
        if (detector) {
          const faces = await detector.detect(videoRef.current);
          if (faces.length > 0) {
            const { x, y, width, height } = faces[0].boundingBox;
            setFaceBox({
              x: x / videoRef.current.videoWidth,
              y: y / videoRef.current.videoHeight,
              w: width / videoRef.current.videoWidth,
              h: height / videoRef.current.videoHeight
            });
          }
        } else {
          // Soft-center focus heuristic if native API is missing
          setFaceBox({ x: 0.3, y: 0.2, w: 0.4, h: 0.5 });
        }
      } catch (e) {
        console.warn("Detection cycle failed", e);
      }
      
      setTimeout(() => {
        detectId = requestAnimationFrame(detect);
      }, 100);
    };

    detect();
    return () => cancelAnimationFrame(detectId);
  }, [faceFocus]);

  // Pre-process Dithered Background
  useEffect(() => {
    const processBg = async () => {
      if (!bgImage && !lyricsData?.palette) return;

      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 914;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (bgImage) {
        const scale = Math.max(canvas.width / bgImage.width, canvas.height / bgImage.height);
        const x = (canvas.width - bgImage.width * scale) / 2;
        const y = (canvas.height - bgImage.height * scale) / 2;
        ctx.filter = `brightness(${bgBrightness})`;
        ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
        ctx.filter = 'none';
      } else if (lyricsData?.palette) {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, lyricsData.palette[0] || '#000000');
        grad.addColorStop(0.5, lyricsData.palette[1] || '#333333');
        grad.addColorStop(1, lyricsData.palette[2] || '#666666');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = `rgba(0,0,0,${1 - bgBrightness})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      DitherService.applyDitherToCanvas(canvas, ditherSteps);
      setDitheredBgCanvas(canvas);
    };

    processBg();
  }, [bgImage, lyricsData, ditherSteps, bgBrightness]);

  // Main Render Loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (!canvas || !video || !tempCanvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !tempCtx) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const tw = tempCanvas.width;
    const th = tempCanvas.height;

    const render = () => {
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        // 1. Draw Background
        if (ditheredBgCanvas) {
          ctx.drawImage(ditheredBgCanvas, 0, 0);
        } else {
          ctx.fillStyle = theme === Theme.WHITE ? '#121212' : '#f5f5f5';
          ctx.fillRect(0, 0, cw, ch);
        }

        ctx.fillStyle = theme === Theme.WHITE ? `rgba(0,0,0,${textContrast})` : `rgba(255,255,255,${textContrast})`;
        ctx.fillRect(0, 0, cw, ch);

        // 2. Mirroring logic for camera input
        tempCtx.save();
        if (isFlipped) {
          tempCtx.translate(tw, 0);
          tempCtx.scale(-1, 1);
        }
        tempCtx.drawImage(video, 0, 0, tw, th);
        tempCtx.restore();

        const imgData = tempCtx.getImageData(0, 0, tw, th);
        const data = imgData.data;

        const charWidth = 10;
        const charHeight = 15;
        const cols = Math.floor(cw / charWidth);
        const rows = Math.floor(ch / charHeight);
        
        ctx.fillStyle = theme === Theme.WHITE ? '#ffffff' : '#000000';
        ctx.font = `bold ${charHeight - 2}px "JetBrains Mono", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.textAlign = 'left';
        
        const baseThreshold = (threshold / 100) * 255;
        const lyrics = Array.from(activeLyricsClean);

        if (lyrics.length > 0) {
          for (let r = 0; r < rows; r++) {
            const sampleYNorm = r / rows;
            const sampleY = Math.floor(sampleYNorm * th);
            
            for (let c = 0; c < cols; c++) {
              const sampleXNorm = c / cols;
              const lookupX = isFlipped ? (1 - sampleXNorm) : sampleXNorm;
              const sampleX = Math.floor(lookupX * tw);
              
              const i = (sampleY * tw + sampleX) * 4;
              const brightness = (data[i] + data[i+1] + data[i+2]) / 3;

              let activeThreshold = baseThreshold;
              if (faceBox) {
                const inFace = (
                  sampleXNorm >= faceBox.x && 
                  sampleXNorm <= faceBox.x + faceBox.w && 
                  sampleYNorm >= faceBox.y && 
                  sampleYNorm <= faceBox.y + faceBox.h
                );
                if (inFace) {
                   activeThreshold = baseThreshold * 1.25;
                }
              }

              if (brightness < activeThreshold) {
                const char = lyrics[(r * cols + c) % lyrics.length];
                ctx.fillText(char, c * charWidth, r * charHeight + (charHeight - 2));
              }
            }
          }
        }
        
        const topGrad = ctx.createLinearGradient(0, 0, 0, 180);
        topGrad.addColorStop(0, theme === Theme.WHITE ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)');
        topGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, cw, 180);

        ctx.fillStyle = theme === Theme.WHITE ? '#ffffff' : '#000000';
        ctx.font = '38px "Dancing Script", cursive';
        ctx.textAlign = 'left';
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.fillText(header, 50, 75);

        if (lyricsData) {
          ctx.shadowBlur = 4;
          ctx.font = 'bold 16px "JetBrains Mono", monospace';
          ctx.fillText(`${lyricsData.songTitle.toUpperCase()} — ${lyricsData.artist} (${lyricsData.releaseYear})`, 55, 115);
        }
        ctx.shadowBlur = 0;
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [theme, threshold, activeLyricsClean, header, lyricsData, ditheredBgCanvas, textContrast, isFlipped, faceBox]);

  const handleFind = async (queryInput: string | any) => {
    const q = typeof queryInput === 'string' ? queryInput : searchQuery;
    if (!q) return;
    
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const lyricsInfo = await GeminiService.fetchLyricsAndVibe(q);
      setLyricsData(lyricsInfo);
      setMode(AppMode.LYRICS);

      const artwork = await MusicService.findAlbumArt(lyricsInfo.songTitle, lyricsInfo.artist, lyricsInfo.releaseYear).catch(() => null);

      if (artwork) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = artwork.imageUrl;
        img.onload = () => setBgImage(img);
        img.onerror = () => {
          setBgImage(null);
          setErrorMsg("Failed to load album artwork image.");
        };
      } else {
        setBgImage(null);
        setErrorMsg("Couldn't find artwork for this track.");
      }
    } catch (e: any) {
      console.error("Search Pipeline Failed:", e);
      setErrorMsg(e.message || "An unexpected error occurred during search.");
    } finally {
      setIsSearching(false);
    }
  };

  const takeSnapshot = () => {
    if (snapshotTimer > 0) {
      setCountdown(snapshotTimer);
      const timerInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === 1) {
            clearInterval(timerInterval);
            triggerDownload();
            return null;
          }
          return prev ? prev - 1 : null;
        });
      }, 1000);
    } else {
      triggerDownload();
    }
  };

  const triggerDownload = () => {
    const link = document.createElement('a');
    link.download = `lyricNote-${Date.now()}.png`;
    link.href = canvasRef.current?.toDataURL('image/png') || '';
    link.click();
  };

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      const stream = canvasRef.current?.captureStream(30);
      const recorder = new MediaRecorder(stream!, { mimeType: 'video/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${Date.now()}.webm`;
        a.click();
      };
      recorder.start();
    }
    setIsRecording(!isRecording);
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-full bg-[#fafafa] overflow-hidden">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      <aside className="w-full lg:w-[420px] h-full bg-white border-r border-zinc-100 p-8 flex flex-col gap-8 overflow-y-auto z-10 shadow-xl">
        <section className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
            <User size={12} /> Personalization
          </label>
          <input 
            type="text"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            className="w-full px-5 py-4 bg-zinc-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-black/5 transition-all shadow-inner"
            placeholder="e.g. to my dearest"
          />
          <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl">
            <button 
              onClick={() => setTheme(Theme.BLACK)}
              className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${theme === Theme.BLACK ? 'bg-black text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-200'}`}
            >
              Dark Theme
            </button>
            <button 
              onClick={() => setTheme(Theme.WHITE)}
              className={`flex-1 py-3 text-[11px] font-black uppercase rounded-xl transition-all ${theme === Theme.WHITE ? 'bg-white text-zinc-900 shadow-md border border-zinc-200' : 'text-zinc-500 hover:bg-zinc-200'}`}
            >
              Light Theme
            </button>
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-5 p-5 bg-zinc-50 rounded-[32px] border border-zinc-100 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                <FlipHorizontal size={12} /> Mirror Vision
              </label>
              <button 
                onClick={() => setIsFlipped(!isFlipped)}
                className={`w-12 h-6 rounded-full transition-all flex items-center p-1 ${isFlipped ? 'bg-black' : 'bg-zinc-200'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${isFlipped ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                <UserCircle size={12} /> Face Focus Detail
              </label>
              <button 
                onClick={() => setFaceFocus(!faceFocus)}
                className={`w-12 h-6 rounded-full transition-all flex items-center p-1 ${faceFocus ? 'bg-black' : 'bg-zinc-200'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${faceFocus ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                <Contrast size={12} /> Legibility (Contrast)
              </label>
              <span className="text-[10px] font-bold text-zinc-900">{Math.round(textContrast * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="0.9" step="0.05"
              value={textContrast}
              onChange={(e) => setTextContrast(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-black"
            />

            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                <Sun size={12} /> Art Brightness
              </label>
              <span className="text-[10px] font-bold text-zinc-900">{Math.round(bgBrightness * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05"
              value={bgBrightness}
              onChange={(e) => setBgBrightness(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
            
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                <Layers size={12} /> Dither Matrix
              </label>
              <span className="text-[10px] font-bold text-zinc-900">{ditherSteps} steps</span>
            </div>
            <input 
              type="range" min="2" max="16" step="1"
              value={ditherSteps}
              onChange={(e) => setDitherSteps(parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-black"
            />

            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Silhouette Sensitivity</label>
              <span className="text-[10px] font-bold text-zinc-900">{threshold}%</span>
            </div>
            <input 
              type="range" min="0" max="100" 
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-black"
            />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          {[
            { id: AppMode.DEFAULT, icon: Camera, label: 'Default' },
            { id: AppMode.HEARTS, icon: Heart, label: 'Hearts' },
            { id: AppMode.CUSTOM, icon: TypeIcon, label: 'Custom' },
            { id: AppMode.LYRICS, icon: Music, label: 'Lyrics' },
          ].map(m => (
            <button 
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all ${mode === m.id ? 'border-black bg-black text-white shadow-xl scale-95' : 'border-zinc-50 text-zinc-400 hover:border-zinc-200 hover:bg-zinc-50'}`}
            >
              <m.icon size={20} className="mb-2" />
              <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
            </button>
          ))}
        </section>

        <section className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
            <Music size={12} /> Music Search Engine
          </label>
          <div className="relative">
            <input 
              type="text"
              placeholder="e.g. Frank Ocean Blonde"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-6 pr-20 py-5 bg-zinc-50 border-none rounded-full text-sm font-bold shadow-inner"
              onKeyDown={(e) => e.key === 'Enter' && handleFind(searchQuery)}
            />
            <button 
              onClick={() => handleFind(searchQuery)}
              disabled={isSearching}
              className="absolute right-2 top-2 bottom-2 px-6 bg-black text-white rounded-full flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50"
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={14} />
              <span className="text-[10px] font-bold">{errorMsg}</span>
            </div>
          )}

          {mode === AppMode.CUSTOM && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
              <textarea 
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Write your note here..."
                className="w-full h-32 p-4 bg-zinc-50 rounded-2xl text-sm border-none focus:ring-0 shadow-inner resize-none"
              />
              <button 
                onClick={async () => {
                   setIsEnhancing(true);
                   try {
                     const better = await GeminiService.enhancePoem(customText);
                     setCustomText(better);
                   } catch (err) {
                     console.error(err);
                   } finally {
                     setIsEnhancing(false);
                   }
                }}
                disabled={isEnhancing}
                className="w-full py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors"
              >
                {isEnhancing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Poetic Rewrite
              </button>
            </div>
          )}
        </section>

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl">
            {[0, 3, 5, 10].map(t => (
              <button 
                key={t}
                onClick={() => setSnapshotTimer(t)}
                className={`flex-1 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${snapshotTimer === t ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:bg-zinc-200'}`}
              >
                {t === 0 ? 'No Timer' : `${t}s`}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={takeSnapshot}
              className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors"
            >
              <Download size={18} />
              <span className="text-[10px] font-black uppercase">Snapshot</span>
            </button>
            <button 
              onClick={toggleRecording}
              className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-900 text-white hover:bg-black'}`}
            >
              <Video size={18} />
              <span className="text-[10px] font-black uppercase">{isRecording ? 'Stop' : 'Record'}</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-[#f4f4f4] relative">
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-[320px] font-black text-black/10 tabular-nums animate-pulse">
              {countdown}
            </div>
          </div>
        )}

        <div className="relative w-full max-w-5xl aspect-[1.4/1] bg-white rounded-[60px] p-2 card-shadow overflow-hidden group shadow-2xl">
          <canvas 
            ref={canvasRef}
            width={1280}
            height={914}
            className="w-full h-full rounded-[52px] object-cover border-[12px] border-white/5"
          />
          
          <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
          
          <div className="absolute bottom-12 left-12 opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-3 bg-black/30 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/10">
              <Settings2 size={12} className="text-white" />
              <span className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Matrix Engine v2 // {ditherSteps}-Step</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
