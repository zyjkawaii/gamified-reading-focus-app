import { ChangeEvent, DragEvent, ReactNode, useEffect, useRef, useState } from 'react'

import mammoth from 'mammoth'

import * as pdfjs from 'pdfjs-dist'

import type { PDFDocumentProxy } from 'pdfjs-dist'

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import JSZip from 'jszip'

import { PDFDocument } from 'pdf-lib'

import ForestBar from './ForestBar'

import CatHome from './CatHome'

import { FISH_PRICE, MAX_INTIMACY, loadPet, savePet, type PetState } from './pet'

import { loadEyeSettings, saveEyeSettings, useEyeTracking, type EyeSettings } from './eyeTracking/useEyeTracking'

import EyeTrackingPanel from './eyeTracking/EyeTrackingPanel'

import CalibrationOverlay from './eyeTracking/CalibrationOverlay'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

type Page = 'home' | 'upload' | 'reading' | 'profile'

type ReadingNote = { id: number; quote: string; text: string; page: number; paragraph?: number; start?: number; end?: number; kind?: 'highlight' | 'annotation' }

type IconName =
  | 'home'
  | 'upload'
  | 'book'
  | 'user'
  | 'play'
  | 'pause'
  | 'reset'
  | 'clock'
  | 'spark'
  | 'arrow'
  | 'file'
  | 'check'
  | 'lock'
  | 'close'

const starterArticle = [
  "Small Steps, Deep Focus",
  "Attention is not a switch that we turn on. It is more like a path through a garden: the more gently and consistently we walk it, the easier it becomes to follow.",
  "For many readers, beginning is the hardest part. A long chapter can feel like a wall before the first sentence has even been read. The secret is to make the doorway smaller. Instead of promising to finish the whole chapter, promise to read for one focused interval.",
  "The Pomodoro method works because it gives attention a clear edge. During a focus session, there is only one job. When the timer ends, the break is not a distraction or a reward that must be earned. It is part of the process.",
  "Designing a Gentle Reading Ritual",
  "Choose a comfortable place and remove only the distractions you can control. Keep water nearby. Put your phone out of reach, but do not spend ten minutes making the environment perfect. A useful ritual should make starting easier, not become another task.",
  "As you read, let your eyes move at their natural pace. If a sentence does not make sense, read it once more. If it still feels unclear, mark it and continue. Momentum often creates understanding that effort alone cannot force.",
  "When your mind wanders, notice it without judgment. Returning to the page is the exercise. Every return is a repetition that strengthens your ability to direct attention.",
  "Progress Over Perfection",
  "Some focus sessions will feel effortless. Others will be messy. Both count. The goal is not to create twenty-five perfect minutes; it is to practice coming back to the words in front of you.",
  "At the end of a session, pause before deciding what comes next. Stretch, breathe, and notice what you finished. A visible record of small sessions turns an abstract ambition into evidence: you are becoming a reader who returns.",
  "One page is progress. One focused minute is practice. Begin where you are, and let consistency do the rest."
].join('\n\n')

const navItems: { id: Page; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'upload', label: 'Upload', icon: 'upload' },
  { id: 'reading', label: 'Reading zone', icon: 'book' },
  { id: 'profile', label: 'Garden', icon: 'user' },
]

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-7h6v7" /></>,
    upload: <><path d="M12 16V3m0 0L7 8m5-5 5 5" /><path d="M5 13H3v8h18v-8h-2" /></>,
    book: <><path d="M4 4.5A3.5 3.5 0 0 1 7.5 8H11v12H7.5A3.5 3.5 0 0 0 4 23.5v-19Z" transform="translate(0 -2)" /><path d="M20 4.5A3.5 3.5 0 0 0 16.5 8H13v12h3.5a3.5 3.5 0 0 1 3.5 3.5v-19Z" transform="translate(0 -2)" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    play: <path d="m9 6 9 6-9 6V6Z" />,
    pause: <><path d="M9 6v12M15 6v12" /></>,
    reset: <><path d="M4 10a8 8 0 1 1 1 7" /><path d="M4 4v6h6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    spark: <><path d="m12 2 1.5 5.3L19 9l-5.5 1.7L12 16l-1.5-5.3L5 9l5.5-1.7L12 2Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    file: <><path d="M6 2h8l4 4v16H6V2Z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Mascot({ large = false }: { large?: boolean }) {
  return <img className={large ? 'mascot mascot-large' : 'mascot'} src={import.meta.env.BASE_URL + "cat.png"} alt="Foco, your reading companion" />
}

function PdfPage({ document, pageNumber, zoom }: { document: PDFDocumentProxy; pageNumber: number; zoom: number }) {
  const container = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null
    const render = async () => {
      if (!container.current || !canvas.current) return
      try {
        const page = await document.getPage(pageNumber)
        if (cancelled || !container.current || !canvas.current) return
        const base = page.getViewport({ scale: 1 })
        const availableWidth = container.current.closest('.reading-paper')?.clientWidth || container.current.clientWidth
        const scale = Math.min(3, ((availableWidth - 28) / base.width) * zoom)
        const viewport = page.getViewport({ scale })
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const target = canvas.current
        target.width = Math.ceil(viewport.width * ratio)
        target.height = Math.ceil(viewport.height * ratio)
        target.style.width = viewport.width + 'px'
        target.style.height = viewport.height + 'px'
        const context = target.getContext('2d')!
        renderTask = page.render({ canvas: target, canvasContext: context, viewport, transform: [ratio, 0, 0, ratio, 0, 0] })
        await renderTask.promise
        setError('')
      } catch (cause) {
        if (!cancelled && !(cause instanceof Error && cause.name === 'RenderingCancelledException')) setError('This PDF page could not be displayed.')
      }
    }
    render()
    return () => { cancelled = true; renderTask?.cancel() }
  }, [document, pageNumber, zoom])

  return <div className="pdf-page-surface" data-pdf-page={pageNumber} ref={container}>{error ? <p role="alert">{error}</p> : <canvas ref={canvas} aria-label={'PDF page ' + pageNumber} />}</div>
}

function PdfDocumentView({ url, zoom, onReady }: { url: string; zoom: number; onReady: () => void }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const task = pdfjs.getDocument({ url })
    task.promise.then(pdf => { if (!cancelled) { setDocument(pdf); setError('') } }).catch(() => { if (!cancelled) setError('This PDF could not be displayed.') })
    return () => { cancelled = true; task.destroy() }
  }, [url])

  useEffect(() => { if (document) onReady() }, [document])

  if (error) return <p role="alert">{error}</p>
  if (!document) return <p>Loading document…</p>
  return <div className="pdf-document">{Array.from({ length: document.numPages }, (_, index) => <PdfPage key={index} document={document} pageNumber={index + 1} zoom={zoom} />)}</div>
}

function MagicProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full max-w-3xl mx-auto my-4 px-4 relative">
      <div className="flex justify-between text-[#5a7a9e] text-xs font-semibold mb-2">
        <span className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          蓝萤森林
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-3 bg-[#1e293b] rounded-full relative shadow-inner overflow-visible border border-[#334155]">
        <div
          className="h-full bg-gradient-to-r from-[#38bdf8] to-[#818cf8] rounded-full absolute top-0 left-0 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(56,189,248,0.6)]"
          style={{ width: progress + '%' }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_12px_#fff,0_0_20px_#38bdf8]"></div>
        </div>
        <div
          className="absolute -top-5 transition-all duration-300 ease-out z-10"
          style={{ left: 'calc(' + progress + '% - 20px)' }}
        >
          <div className="relative w-10 h-10 animate-bounce" style={{ animationDuration: '2s' }}>
            <div className="absolute -right-2 bottom-1 w-4 h-2 bg-white rounded-full origin-left -rotate-45 shadow-sm"></div>
            <div className="absolute bottom-0 left-1 w-6 h-4 bg-white rounded-t-[12px] rounded-bl-[4px] shadow-sm"></div>
            <div className="absolute -top-1 left-1 w-6 h-6 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]">
              <div className="absolute -top-1 left-1 w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-white -rotate-12"></div>
              <div className="absolute -top-1 right-1 w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-white rotate-12"></div>
              <div className="absolute top-2.5 left-1 w-1.5 h-0.5 bg-slate-400 rounded-full rotate-6"></div>
              <div className="absolute top-2.5 right-1 w-1.5 h-0.5 bg-slate-400 rounded-full -rotate-6"></div>
              <div className="absolute top-3.5 left-0.5 w-1.5 h-1 bg-pink-200 rounded-full opacity-60"></div>
              <div className="absolute top-3.5 right-0.5 w-1.5 h-1 bg-pink-200 rounded-full opacity-60"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FocoHome({ points, sessions, setPoints }: { points: number, sessions: number, setPoints: (val: number) => void }) {
  const [intimacy, setIntimacy] = React.useState(0);
  const [interaction, setInteraction] = React.useState("Foco 在安静地看书。");

  const feedFish = () => {
    if (points >= 10) {
      setPoints(points - 10);
      setIntimacy((prev) => Math.min(prev + 5, 100));
      setInteraction("Foco 开心地吃掉了小鱼干！🐟");
      setTimeout(() => setInteraction("Foco 心满意足地打滚~"), 2000);
    } else {
      setInteraction("金币不够啦，再去专注一会儿吧！");
      setTimeout(() => setInteraction("Foco 在安静地看书。"), 2000);
    }
  };

  const handlePat = () => {
    setInteraction("Foco 蹭了蹭你的手，呼噜呼噜~ 🐾");
    setTimeout(() => setInteraction("Foco 在安静地看书。"), 2000);
  };

  const handleHug = () => {
    setInteraction("Foco 紧紧抱住了你，感到十分安心。❤️");
    setTimeout(() => setInteraction("Foco 在安静地看书。"), 2000);
  };

  const handleKiss = () => {
    setInteraction("Foco 亲了你一下！好感度爆表 💖");
    setTimeout(() => setInteraction("Foco 在安静地看书。"), 2000);
  };

  const level = Math.floor(sessions / 3) + 1;
  const nextLevelProgress = (sessions % 3) * 33.33;

  return (
    <section className="page profile-page" style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', color: '#2c3e50', marginBottom: '10px' }}>Foco 的家园 🏡</h1>
        <p style={{ color: '#5a7a9e', fontSize: '1.1rem' }}>每一次专注，都让 Foco 和你更亲近。</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
        <div style={{ background: '#fff', borderRadius: '20px', padding: '30px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', textAlign: 'center', border: '2px solid #e1ebf5' }}>
          <div style={{ fontSize: '100px', margin: '20px 0', animation: 'bounce 2s infinite' }}>
            😺
          </div>
          <div style={{ background: '#f0f7ff', padding: '15px', borderRadius: '15px', color: '#4a6b8c', fontWeight: 'bold', marginBottom: '20px' }}>
            {interaction}
          </div>
          <button onClick={feedFish} style={{ background: '#f8b4b4', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '25px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(248,180,180,0.4)', marginBottom: '20px', width: '100%' }}>
            投喂小鱼干 (-10 🪙)
          </button>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button onClick={handlePat} disabled={intimacy < 20} style={{ flex: 1, padding: '10px', borderRadius: '15px', border: '1px solid #e1ebf5', background: intimacy >= 20 ? 'white' : '#f5f5f5', cursor: intimacy >= 20 ? 'pointer' : 'not-allowed' }}>摸摸 (20亲密)</button>
            <button onClick={handleHug} disabled={intimacy < 50} style={{ flex: 1, padding: '10px', borderRadius: '15px', border: '1px solid #e1ebf5', background: intimacy >= 50 ? 'white' : '#f5f5f5', cursor: intimacy >= 50 ? 'pointer' : 'not-allowed' }}>抱抱 (50亲密)</button>
            <button onClick={handleKiss} disabled={intimacy < 80} style={{ flex: 1, padding: '10px', borderRadius: '15px', border: '1px solid #e1ebf5', background: intimacy >= 80 ? 'white' : '#f5f5f5', cursor: intimacy >= 80 ? 'pointer' : 'not-allowed' }}>亲亲 (80亲密)</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '2px solid #e1ebf5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ color: '#8a9ba8', fontWeight: 'bold' }}>我的金币</span>
              <span style={{ fontSize: '1.5rem', color: '#e6a23c', fontWeight: 'bold' }}>🪙 {points}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <span style={{ color: '#8a9ba8', fontWeight: 'bold' }}>亲密值</span>
              <span style={{ color: '#f56c6c', fontWeight: 'bold' }}>{intimacy} / 100</span>
            </div>
            <div style={{ height: '10px', background: '#f0f2f5', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: intimacy + '%', background: '#f56c6c', transition: 'width 0.3s' }}></div>
            </div>
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ color: '#8a9ba8', fontWeight: 'bold' }}>当前等级: Lv.{level}</span>
                <span style={{ color: '#5a7a9e', fontSize: '0.9rem' }}>完成 {sessions % 3} / 3 次专注升级</span>
              </div>
              <div style={{ height: '10px', background: '#f0f2f5', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: nextLevelProgress + '%', background: '#5a7a9e', transition: 'width 0.3s' }}></div>
              </div>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '2px solid #e1ebf5' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#2c3e50' }}>🏆 成就</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: sessions >= 1 ? '#f0f9eb' : '#fafafa', borderRadius: '10px', opacity: sessions >= 1 ? 1 : 0.5 }}>
                <span style={{ fontSize: '24px' }}>{sessions >= 1 ? '🥇' : '🔒'}</span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#2c3e50' }}>初次相遇</div>
                  <div style={{ fontSize: '0.8rem', color: '#8a9ba8' }}>完成 1 次专注</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: sessions >= 5 ? '#f0f9eb' : '#fafafa', borderRadius: '10px', opacity: sessions >= 5 ? 1 : 0.5 }}>
                <span style={{ fontSize: '24px' }}>{sessions >= 5 ? '🎖️' : '🔒'}</span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#2c3e50' }}>渐入佳境</div>
                  <div style={{ fontSize: '0.8rem', color: '#8a9ba8' }}>完成 5 次专注</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: intimacy >= 80 ? '#f0f9eb' : '#fafafa', borderRadius: '10px', opacity: intimacy >= 80 ? 1 : 0.5 }}>
                <span style={{ fontSize: '24px' }}>{intimacy >= 80 ? '💖' : '🔒'}</span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#2c3e50' }}>灵魂伴侣</div>
                  <div style={{ fontSize: '0.8rem', color: '#8a9ba8' }}>亲密值达到 80</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function App() {
  // ========== 阅读历史记录 类型与常量（新增功能，不影响原有阅读逻辑）==========
  type ReadingHistoryItem = {
    id: string
    fileName: string
    uploadTime: number
    readingText: string
    savedPdfData: string | null
    fileSize: string
  }

  const HISTORY_KEY = 'focureader-reading-history'

  const getReadingHistory = (): ReadingHistoryItem[] => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      return raw ? (JSON.parse(raw) as ReadingHistoryItem[]) : []
    } catch {
      return []
    }
  }

  const addReadingHistory = (item: ReadingHistoryItem) => {
    try {
      const list = getReadingHistory()
      const filtered = list.filter(prev => prev.fileName !== item.fileName)
      const newList = [item, ...filtered].slice(0, 8)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newList))
    } catch {
    }
  }

  const deleteReadingHistory = (id: string) => {
    const list = getReadingHistory().filter(item => item.id !== id)
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)) } catch { /* ignore */ }
    return list
  }
  // ======================================

  type SavedReading = { fileName: string; secondsLeft: number; focusMinutes: number; breakMinutes: number; scrollTop: number; progress: number; pdfPage: number }

  const loadSavedReading = (): SavedReading | null => {
    try { return JSON.parse(localStorage.getItem('bloo-active-reading') || 'null') } catch { return null }
  }

  // ===== 历史记录面板状态（新增）=====
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyList, setHistoryList] = useState<ReadingHistoryItem[]>([])

  const [page, setPage] = useState<Page>('home')
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [sessions, setSessions] = useState(() => Number(localStorage.getItem('bloo-sessions') || 0))
  const [points, setPoints] = useState(() => Number(localStorage.getItem('bloo-points') ?? (Number(localStorage.getItem('bloo-sessions') || 0) * 120)))
  const [returns, setReturns] = useState(() => Number(localStorage.getItem('bloo-returns') || 0))
  const [pet, setPet] = useState<PetState>(loadPet)
  const [checkIn, setCheckIn] = useState(false)
  const [thoughtClouds, setThoughtClouds] = useState(0)
  const [rewardVisible, setRewardVisible] = useState(false)
  const checkInElapsed = useRef(0)
  const checkInRewards = useRef(0)
  const rewardTimeout = useRef<number | null>(null)
  const [readingText, setReadingText] = useState(() => localStorage.getItem('bloo-reading') || starterArticle)
  const [fileName, setFileName] = useState(() => localStorage.getItem('bloo-file') || 'Small Steps, Deep Focus.txt')
  const [fileSize, setFileSize] = useState('4.2 KB')
  const [uploadError, setUploadError] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [fontSize, setFontSize] = useState(18)
  const [pdfZoom, setPdfZoom] = useState(1)
  const [thinkMinutes, setThinkMinutes] = useState(5)
  const readingRewardGiven = useRef(false)
  const [notes, setNotes] = useState<ReadingNote[]>([])
  const [notesOpen, setNotesOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [selectedQuote, setSelectedQuote] = useState('')
  const [selectedAnchor, setSelectedAnchor] = useState<{ paragraph: number; start: number; end: number } | null>(null)
  const [showReadingSetup, setShowReadingSetup] = useState(false)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [savedReading, setSavedReading] = useState<SavedReading | null>(loadSavedReading)
  const [pdfPage, setPdfPage] = useState(1)
  const [pdfPageCount, setPdfPageCount] = useState(0)
  const [savedPdfData, setSavedPdfData] = useState<string | null>(() => localStorage.getItem('bloo-pdf-data'))
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [showSessionComplete, setShowSessionComplete] = useState(false)
  const [showReadingComplete, setShowReadingComplete] = useState(false)
  const [readingStartedAt, setReadingStartedAt] = useState<number | null>(null)
  const [readingDuration, setReadingDuration] = useState(0)
  const readingRef = useRef<HTMLElement>(null)
  const readingScrollTop = useRef(0)
  const originalFile = useRef<File | null>(null)
  const selectionAnchor = useRef<{ paragraph: number; start: number; end: number; quote: string } | null>(null)
  const [exportError, setExportError] = useState('')

  const [eyeSettings, setEyeSettings] = useState<EyeSettings>(loadEyeSettings)
  const [mascotMessage, setMascotMessage] = useState('')
  const [checkInReason, setCheckInReason] = useState<'timer' | 'gaze'>('timer')
  const mascotTimeout = useRef<number | null>(null)
  const resumeAfterCalibration = useRef(false)
  const notesPanelRef = useRef<HTMLElement>(null)

  const sayMascot = (message: string, ms: number) => {
    if (mascotTimeout.current) window.clearTimeout(mascotTimeout.current)
    setMascotMessage(message)
    mascotTimeout.current = window.setTimeout(() => setMascotMessage(''), ms)
  }

  const eyeCounting = page === 'reading' && running && mode === 'focus'
  const eyeActive = eyeCounting && !checkIn && !showReadingSetup && !showResumePrompt && !showSessionComplete && !showReadingComplete

  const eye = useEyeTracking({
    active: eyeActive,
    visible: page === 'reading',
    settings: eyeSettings,
    getRegions: () => {
      const regions: DOMRect[] = []
      if (readingRef.current) regions.push(readingRef.current.getBoundingClientRect())
      if (notesPanelRef.current) regions.push(notesPanelRef.current.getBoundingClientRect())
      return regions
    },
    onEvent: event => {
      if (event === 'return') sayMascot('There you are. Let’s keep going.', 2600)
      if (event === 'nudge') { setCheckInReason('gaze'); setCheckIn(true) }
    },
  })

  const eyeOn = eye.status === 'loading' || eye.status === 'calibrating' || eye.status === 'tracking'

  const updateEyeSettings = (next: EyeSettings) => { setEyeSettings(next); saveEyeSettings(next) }

  const startEyeTracking = () => { resumeAfterCalibration.current = running; setRunning(false); eye.start() }
  const recalibrateEyeTracking = () => { resumeAfterCalibration.current = running; setRunning(false); eye.recalibrate() }
  const resumeTimerAfterCalibration = () => { if (resumeAfterCalibration.current) setRunning(true); resumeAfterCalibration.current = false }
  const finishEyeCalibration = () => { eye.finishCalibration(); resumeTimerAfterCalibration() }
  const cancelEyeCalibration = () => { eye.stop(); resumeTimerAfterCalibration() }

  useEffect(() => { if (eye.status === 'error') resumeTimerAfterCalibration() }, [eye.status])
  useEffect(() => { if (eyeOn) { checkInElapsed.current = 0; setThoughtClouds(0) } }, [eyeOn])
  useEffect(() => () => { if (mascotTimeout.current) window.clearTimeout(mascotTimeout.current) }, [])

  useEffect(() => {
    try {
      const notesKey = 'bloo-notes:' + fileName
      setNotes(JSON.parse(localStorage.getItem(notesKey) || '[]'))
    } catch {
      setNotes([])
    }
  }, [fileName])

  useEffect(() => {
    if (historyOpen) setHistoryList(getReadingHistory())
  }, [historyOpen])

  const saveNotes = (updated: ReadingNote[]) => {
    setNotes(updated)
    localStorage.setItem('bloo-notes:' + fileName, JSON.stringify(updated))
  }

  const rememberSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    const parent = range.startContainer.parentElement?.closest('[data-paragraph]')
    if (!parent || !readingRef.current?.contains(parent) || !parent.contains(range.endContainer)) return
    const before = range.cloneRange()
    before.selectNodeContents(parent)
    before.setEnd(range.startContainer, range.startOffset)
    const start = before.toString().length
    const quote = range.toString()
    selectionAnchor.current = { paragraph: Number(parent.getAttribute('data-paragraph')), start, end: start + quote.length, quote }
  }

  const useSelection = (kind: 'highlight' | 'annotation') => {
    rememberSelection()
    const anchor = selectionAnchor.current
    if (!anchor) { setExportError(pdfUrl ? 'PDF text selection is not available in this viewer. Use page notes for PDFs.' : 'Select a phrase in the reading text first.'); setNotesOpen(true); return }
    setExportError('')
    if (kind === 'highlight') {
      saveNotes([...notes, { id: Date.now(), quote: anchor.quote, text: '', page: pdfPage, paragraph: anchor.paragraph, start: anchor.start, end: anchor.end, kind }])
    } else {
      setSelectedQuote(anchor.quote)
      setSelectedAnchor(anchor)
      setNotesOpen(true)
    }
    selectionAnchor.current = null
    window.getSelection()?.removeAllRanges()
  }

  const renderMarkedText = (paragraph: string, index: number) => {
    const marks = notes.filter(note => note.paragraph === index && note.start !== undefined && note.end !== undefined).sort((a, b) => a.start! - b.start!)
    const pieces: ReactNode[] = []
    let position = 0
    for (const mark of marks) {
      if (mark.start! < position || mark.end! > paragraph.length) continue
      pieces.push(paragraph.slice(position, mark.start))
      const relatedAnnotation = notes.find(note => note.kind === 'annotation' && note.paragraph === index && note.start! < mark.end! && note.end! > mark.start!)
      const annotation = mark.kind === 'annotation' ? mark.text : relatedAnnotation?.text
      pieces.push(<mark key={mark.id} className={mark.kind === 'highlight' ? 'reader-highlight' : 'reader-annotation'} data-note={annotation || ''} onClick={() => {
        if (mark.kind === 'annotation') { setNotesOpen(true); return }
        setSelectedQuote(mark.quote)
        setSelectedAnchor({ paragraph: index, start: mark.start!, end: mark.end! })
        setNotesOpen(true)
      }}>{paragraph.slice(mark.start, mark.end)}</mark>)
      position = mark.end!
    }
    pieces.push(paragraph.slice(position))
    return pieces
  }

  const exportAnnotatedCopy = async () => {
    setExportError('')
    const extension = fileName.split('.').pop()?.toLowerCase()
    const source = originalFile.current
    if ((extension === 'pdf' || extension === 'docx') && (!source || source.name !== fileName)) {
      setNotesOpen(true)
      setExportError('Please upload the original file again before exporting this format.')
      return
    }
    try {
      let blob: Blob
      if (extension === 'pdf' && source) {
        const pdfDocument = await PDFDocument.load(await source.arrayBuffer())
        if (notes.length) {
          const canvas = document.createElement('canvas')
          canvas.width = 1200; canvas.height = 1680
          const context = canvas.getContext('2d')!
          const lines: string[] = []
          for (const [index, note] of notes.entries()) {
            lines.push((index + 1) + '. ' + (note.quote ? '“' + note.quote + '”' : 'Page ' + note.page))
            lines.push(note.text, '')
          }
          const pages: string[][] = [[]]
          context.font = '28px sans-serif'
          for (const line of lines) {
            let row = ''
            for (const char of line) {
              if (context.measureText(row + char).width > 1030) { pages[pages.length - 1].push(row); row = char }
              else row += char
            }
            pages[pages.length - 1].push(row)
            if (pages[pages.length - 1].length >= 44) pages.push([])
          }
          for (const pageLines of pages.filter(page => page.length)) {
            context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1200, 1680)
            context.fillStyle = '#254456'; context.font = 'bold 40px sans-serif'; context.fillText('Reading notes and annotations', 80, 95)
            context.font = '28px sans-serif'
            pageLines.forEach((line, index) => context.fillText(line, 80, 160 + index * 33))
            const image = await pdfDocument.embedPng(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer())
            const page = pdfDocument.addPage([600, 840]); page.drawImage(image, { x: 0, y: 0, width: 600, height: 840 })
          }
        }
        blob = new Blob([new Uint8Array(await pdfDocument.save())], { type: 'application/pdf' })
      } else if (extension === 'docx' && source) {
        const zip = await JSZip.loadAsync(await source.arrayBuffer())
        const xml = new DOMParser().parseFromString(await zip.file('word/document.xml')!.async('text'), 'application/xml')
        const namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
        const body = xml.getElementsByTagNameNS(namespace, 'body')[0]
        const section = body.getElementsByTagNameNS(namespace, 'sectPr')[0]
        const addParagraph = (value: string, pageBreak = false) => {
          const paragraph = xml.createElementNS(namespace, 'w:p')
          const run = xml.createElementNS(namespace, 'w:r')
          if (pageBreak) { const br = xml.createElementNS(namespace, 'w:br'); br.setAttributeNS(namespace, 'w:type', 'page'); run.appendChild(br) }
          const text = xml.createElementNS(namespace, 'w:t'); text.textContent = value; run.appendChild(text); paragraph.appendChild(run)
          body.insertBefore(paragraph, section || null)
        }
        if (notes.length) {
          addParagraph('Reading notes and annotations', true)
          notes.forEach((note, index) => { addParagraph((index + 1) + '. ' + (note.quote ? '“' + note.quote + '”' : 'Page ' + note.page)); addParagraph(note.text) })
        }
        zip.file('word/document.xml', new XMLSerializer().serializeToString(xml))
        blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      } else {
        const appendix = notes.map((note, index) => (index + 1) + '. ' + (note.quote || 'Page ' + note.page) + '\n' + note.text).join('\n\n')
        blob = new Blob([readingText, appendix ? '\n\n--- Reading notes and annotations ---\n\n' + appendix : ''], { type: 'text/plain;charset=utf-8' })
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = fileName.replace(/\.[^/.]+$/, '') + '-annotated.' + (extension || 'txt'); link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setNotesOpen(true); setExportError('The file could not be exported. Please try uploading it again.') }
  }

  const totalSeconds = (mode === 'focus' ? focusMinutes : breakMinutes) * 60
  const timerProgress = Math.max(0, Math.min(1, 1 - secondsLeft / totalSeconds))
  const minutesDisplay = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const secondsDisplay = String(secondsLeft % 60).padStart(2, '0')

  useEffect(() => {
    if (!savedReading || page !== 'reading' || showReadingSetup || showResumePrompt) return
    const snapshot = { ...savedReading, secondsLeft, focusMinutes, breakMinutes, scrollTop: readingScrollTop.current, progress, pdfPage }
    localStorage.setItem('bloo-active-reading', JSON.stringify(snapshot))
    setSavedReading(snapshot)
  }, [secondsLeft, focusMinutes, breakMinutes, progress, pdfPage, page, showReadingSetup, showResumePrompt])

  useEffect(() => {
    const pauseOnHide = () => { if (document.hidden) setRunning(false) }
    document.addEventListener('visibilitychange', pauseOnHide)
    return () => document.removeEventListener('visibilitychange', pauseOnHide)
  }, [])

  useEffect(() => {
    if (eyeOn || !running || page !== 'reading' || mode !== 'focus' || checkIn || showReadingSetup || showResumePrompt) return
    const interval = window.setInterval(() => {
      checkInElapsed.current += 1
      if (checkInElapsed.current === 60 || checkInElapsed.current === 120) setThoughtClouds(checkInElapsed.current / 60)
      if (checkInElapsed.current >= 180) {
        checkInElapsed.current = 0
        setThoughtClouds(0)
        setCheckIn(true)
      }
    }, 1000)
    return () => window.clearInterval(interval)
  }, [running, page, mode, checkIn, showReadingSetup, showResumePrompt, eyeOn])

  const respondToCheckIn = (response: 'return' | 'thinking' | 'break') => {
    setCheckIn(false)
    setCheckInReason('timer')
    if (response === 'thinking' && eye.status === 'tracking') eye.snooze(60 * 1000)
    checkInElapsed.current = 0
    setThoughtClouds(0)
    if (response === 'break') { setRunning(false); return }
    setRunning(true)
    if (response === 'return' && checkInRewards.current < 2) {
      checkInRewards.current += 1
      if (rewardTimeout.current) window.clearTimeout(rewardTimeout.current)
      setRewardVisible(true)
      rewardTimeout.current = window.setTimeout(() => setRewardVisible(false), 1500)
      setReturns(current => {
        const next = current + 1
        localStorage.setItem('bloo-returns', String(next))
        return next
      })
      setPoints(current => {
        const next = current + 5
        localStorage.setItem('bloo-points', String(next))
        return next
      })
    }
  }

  const updatePet = (change: (current: PetState) => PetState) => {
    setPet(current => {
      const next = change(current)
      savePet(next)
      return next
    })
  }

  const addCoins = (amount: number) => setPoints(current => {
    const next = Math.max(0, current + amount)
    try { localStorage.setItem('bloo-points', String(next)) } catch { /* ignore */ }
    return next
  })

  const buyFish = () => {
    if (points < FISH_PRICE) return 'Not enough coins yet — finish one more focus session.'
    addCoins(-FISH_PRICE)
    updatePet(current => ({ ...current, fish: current.fish + 1 }))
    return 'One dried fish dropped into the bowl.'
  }

  const feedCat = () => {
    if (pet.fish <= 0) return 'The bowl is empty. Buy a dried fish first.'
    if (pet.intimacy >= MAX_INTIMACY) return 'Foco is already completely at home with you.'
    updatePet(current => ({
      ...current,
      fish: Math.max(0, current.fish - 1),
      fed: current.fed + 1,
      intimacy: Math.min(MAX_INTIMACY, current.intimacy + 3),
      xp: current.xp + 5,
    }))
    return 'Foco purrs and eats the fish in tiny bites.'
  }

  const patCat = () => {
    if (pet.intimacy < 30) return 'Foco is not ready for that yet. A few more fish will help.'
    updatePet(current => ({ ...current, pats: current.pats + 1, xp: current.xp + 2, intimacy: Math.min(MAX_INTIMACY, current.intimacy + 1) }))
    return 'Foco leans into your hand. Purr, purr.'
  }

  const hugCat = () => {
    if (pet.intimacy < 60) return 'Not yet — Foco needs a little more quiet company.'
    updatePet(current => ({ ...current, hugs: current.hugs + 1, xp: current.xp + 3, intimacy: Math.min(MAX_INTIMACY, current.intimacy + 1) }))
    return 'Foco melts into your arms and stays there.'
  }

  const kissCat = () => {
    if (pet.intimacy < 90) return 'Something is still hidden. Keep feeding and reading together.'
    updatePet(current => ({ ...current, kisses: current.kisses + 1, xp: current.xp + 5, intimacy: MAX_INTIMACY }))
    return 'Foco touches its nose to yours, then hides its face.'
  }

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1
        setRunning(false)
        if (mode === 'focus') {
          const next = sessions + 1
          setSessions(next)
          localStorage.setItem('bloo-sessions', String(next))
          setPoints(current => {
            const updated = current + focusMinutes
            localStorage.setItem('bloo-points', String(updated))
            return updated
          })
          updatePet(current => ({
            ...current,
            xp: current.xp + focusMinutes * 2,
            minutes: current.minutes + focusMinutes,
            longest: Math.max(current.longest, focusMinutes),
            intimacy: Math.min(MAX_INTIMACY, current.intimacy + 2),
          }))
          setCheckIn(false)
          setShowSessionComplete(true)
        }
        return 0
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running, mode, sessions])

  const updateFocus = (value: number) => {
    const safeValue = Math.max(1, Math.min(90, value || 1))
    setFocusMinutes(safeValue)
    if (!running && mode === 'focus') setSecondsLeft(safeValue * 60)
  }

  const updateBreak = (value: number) => {
    const safeValue = Math.max(1, Math.min(30, value || 1))
    setBreakMinutes(safeValue)
    if (!running && mode === 'break') setSecondsLeft(safeValue * 60)
  }

  const resetTimer = () => {
    setRunning(false)
    setSecondsLeft(totalSeconds)
  }

  const switchMode = (nextMode: 'focus' | 'break') => {
    setMode(nextMode)
    setRunning(false)
    setSecondsLeft((nextMode === 'focus' ? focusMinutes : breakMinutes) * 60)
  }

  const handleFile = async (file?: File) => {
    if (!file) return
    setUploadError('')
    if (file.size > 20 * 1024 * 1024) { setUploadError('Please choose a file under 20 MB.'); return }
    try {
      let text = ''
      if (/\.(txt|md)$/i.test(file.name)) text = await file.text()
      else if (/\.docx$/i.test(file.name)) text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
      else if (/\.pdf$/i.test(file.name)) {
        const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
        const pages: string[] = []
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
          const page = await document.getPage(pageNumber)
          const content = await page.getTextContent()
          pages.push(content.items.map((item) => 'str' in item ? item.str : '').join(' '))
        }
        text = pages.join('\n\n')
      } else { setUploadError('Please choose a TXT, MD, PDF, or DOCX file.'); return }
      if (!text.trim() && !/\.pdf$/i.test(file.name)) { setUploadError('No readable text was found in this file.'); return }

      originalFile.current = file
      setReadingText(text)
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      setPdfUrl(/\.pdf$/i.test(file.name) ? URL.createObjectURL(file) : null)
      setPdfPage(1)
      setPdfPageCount(/\.pdf$/i.test(file.name) ? (await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise).numPages : 0)
      if (/\.pdf$/i.test(file.name) && file.size < 3 * 1024 * 1024) {
        const reader = new FileReader()
        reader.onload = () => { const data = String(reader.result); setSavedPdfData(data); try { localStorage.setItem('bloo-pdf-data', data) } catch {} }
        reader.readAsDataURL(file)
      } else { setSavedPdfData(null); localStorage.removeItem('bloo-pdf-data') }

      localStorage.removeItem('bloo-active-reading')
      setSavedReading(null)
      setFileName(file.name)
      setFileSize(file.size > 1024 * 1024 ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(file.size / 1024)) + ' KB')
      setProgress(0)
      setShowReadingComplete(false)
      readingRewardGiven.current = false
      localStorage.removeItem('bloo-reading-reward:' + file.name)
      localStorage.setItem('bloo-file', file.name)
      try { localStorage.setItem('bloo-reading', text) } catch { /* Large files remain available until refresh. */ }

      // ===== 追加：写入历史记录（原有后续逻辑不变）=====
      let historyPdfData: string | null = null
      if (/\.pdf$/i.test(file.name) && file.size < 3 * 1024 * 1024) {
        historyPdfData = await new Promise<string | null>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(file)
        })
      }
      addReadingHistory({
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        fileName: file.name,
        uploadTime: Date.now(),
        readingText: text,
        savedPdfData: historyPdfData,
        fileSize: file.size > 1024 * 1024
          ? (file.size / 1024 / 1024).toFixed(1) + ' MB'
          : Math.max(1, Math.round(file.size / 1024)) + ' KB',
      })
    } catch {
      setUploadError('This file could not be read. Try another PDF or DOCX file.')
    }
  }

  const handleScroll = () => {
    const el = readingRef.current
    if (!el) return
    readingScrollTop.current = el.scrollTop
    const max = el.scrollHeight - el.clientHeight
    const next = max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100))
    if (pdfUrl) {
      setProgress(next)
      const pages = Array.from(el.querySelectorAll<HTMLElement>('[data-pdf-page]'))
      const current = pages.reverse().find(page => page.offsetTop <= el.scrollTop + el.clientHeight * .4)
      if (current) setPdfPage(Number(current.dataset.pdfPage))
    } else setProgress(next)
    if (next === 100 && !readingRewardGiven.current) {
      readingRewardGiven.current = true
      localStorage.setItem('bloo-reading-reward:' + fileName, '1')
      setPoints(current => {
        const updated = current + 5
        localStorage.setItem('bloo-points', String(updated))
        return updated
      })
      setRunning(false)
      const elapsed = readingStartedAt ? Math.max(1, Math.round((Date.now() - readingStartedAt) / 60000)) : 1
      setReadingDuration(elapsed)
      setShowReadingComplete(true)
    }
  }

  const goTo = (nextPage: Page) => {
    if (nextPage === 'reading' && page !== 'reading') {
      setRunning(false)
      readingRewardGiven.current = localStorage.getItem('bloo-reading-reward:' + fileName) === '1'
      const previous = savedReading || loadSavedReading()
      setShowResumePrompt(Boolean(previous && previous.fileName === fileName && previous.secondsLeft > 0))
      setShowReadingSetup(!previous || previous.fileName !== fileName || previous.secondsLeft <= 0)
    }
    if (page === 'reading' && nextPage !== 'reading') {
      if (eye.status === 'loading' || eye.status === 'calibrating') {
        eye.stop()
        resumeAfterCalibration.current = false
      }
      setRunning(false)
      if (savedReading) {
        const snapshot = { ...savedReading, secondsLeft, focusMinutes, breakMinutes, scrollTop: readingScrollTop.current, progress, pdfPage }
        localStorage.setItem('bloo-active-reading', JSON.stringify(snapshot))
        setSavedReading(snapshot)
      }
    }
    setPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ===== 从历史记录恢复一篇文献（新增，复用原有 state 与阅读页）=====
  const restoreHistoryItem = (item: ReadingHistoryItem) => {
    setReadingText(item.readingText)
    setFileName(item.fileName)
    setFileSize(item.fileSize)
    setSavedPdfData(item.savedPdfData)
    setPdfUrl(item.savedPdfData)
    setPdfPage(1)
    setPdfPageCount(0)
    setProgress(0)
    setSavedReading(null)
    setShowResumePrompt(false)
    setShowReadingSetup(false)
    localStorage.removeItem('bloo-active-reading')
    localStorage.setItem('bloo-file', item.fileName)
    try { localStorage.setItem('bloo-reading', item.readingText) } catch { /* ignore */ }
    originalFile.current = null
    setHistoryOpen(false)
    goTo('reading')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => goTo('home')} aria-label="Bloo Reader home">
          <span className="brand-mark"> <img src={import.meta.env.BASE_URL + "brand-focu.png"} alt="" /> </span>
          <span>Focu<span>Reader</span></span>
        </button>
        <nav className="desktop-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.id} className={page === item.id ? 'nav-item active' : 'nav-item'} onClick={() => goTo(item.id)}>
              <Icon name={item.icon} size={18} />
              {item.label}
            </button>
          ))}
          <button className="nav-item" onClick={() => setHistoryOpen(true)}>
            <Icon name="file" size={18} />
            History
          </button>
        </nav>
        <div className="streak-pill"><Icon name="spark" size={16} /><span>{points}</span> coins</div>
      </header>

      <main>
        {page === 'home' && (
          <section className="page home-page">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">YOUR FOCUS SPACE</p>
                <h1>Ready to read,<br /><em>one page at a time?</em></h1>
                <p className="lead">Settle in, start a focus session, and let Bloo help you stay on track.</p>
              </div>
              <div className="welcome-stats">
                <div><strong>{sessions}</strong><span>sessions completed</span></div>
                <div><strong>{Math.round((sessions * focusMinutes) / 60 * 10) / 10}h</strong><span>focused so far</span></div>
              </div>
            </div>
            <div className="home-grid">
              <section className="timer-card">
                <div className="mode-tabs">
                  <button className={mode === 'focus' ? 'active' : ''} onClick={() => switchMode('focus')}>Focus</button>
                  <button className={mode === 'break' ? 'active' : ''} onClick={() => switchMode('break')}>Break</button>
                </div>
                <div className="timer-ring" style={{ '--timer-progress': timerProgress * 360 + 'deg' } as React.CSSProperties}>
                  <div className="timer-inner">
                    <span className="timer-label">{mode === 'focus' ? 'FOCUS TIME' : 'BREAK TIME'}</span>
                    <strong>{minutesDisplay}<i>:</i>{secondsDisplay}</strong>
                    <span>{running ? 'Stay with it' : secondsLeft === 0 ? 'Session complete' : 'Ready when you are'}</span>
                  </div>
                </div>
                <div className="timer-actions">
                  <button className="secondary-icon" onClick={resetTimer} aria-label="Reset timer"><Icon name="reset" /></button>
                  <button className="primary-action" onClick={() => {
                    if (secondsLeft === 0) setSecondsLeft(totalSeconds)
                    setRunning(!running)
                  }}>
                    <Icon name={running ? 'pause' : 'play'} size={22} />
                    {running ? 'Pause session' : 'Start focusing'}
                  </button>
                  <button className="secondary-icon" onClick={() => goTo('reading')} aria-label="Open reading zone"><Icon name="book" /></button>
                </div>
              </section>
              <aside className="side-stack">
                <section className="settings-card">
                  <div className="section-heading">
                    <div><span className="soft-icon"><Icon name="clock" /></span><div><h2>Shape your session</h2><p>Choose a rhythm that works for you.</p></div></div>
                  </div>
                  <label className="time-setting">
                    <span><strong>Focus length</strong><small>A distraction-free reading block</small></span>
                    <span className="stepper">
                      <button onClick={() => updateFocus(focusMinutes - 5)} aria-label="Decrease focus time">−</button>
                      <input type="number" value={focusMinutes} min="1" max="90" onChange={(e) => updateFocus(Number(e.target.value))} />
                      <i>min</i>
                      <button onClick={() => updateFocus(focusMinutes + 5)} aria-label="Increase focus time">+</button>
                    </span>
                  </label>
                  <label className="time-setting">
                    <span><strong>Break length</strong><small>Time to reset and recharge</small></span>
                    <span className="stepper">
                      <button onClick={() => updateBreak(breakMinutes - 1)} aria-label="Decrease break time">−</button>
                      <input type="number" value={breakMinutes} min="1" max="30" onChange={(e) => updateBreak(Number(e.target.value))} />
                      <i>min</i>
                      <button onClick={() => updateBreak(breakMinutes + 1)} aria-label="Increase break time">+</button>
                    </span>
                  </label>
                  <div className="tip"><Icon name="spark" size={18} /><p><strong>Bloo's tip</strong>Shorter sessions are still real progress. Start with 15 minutes if 25 feels like too much.</p></div>
                </section>
                <button className="continue-card" onClick={() => goTo('reading')}>
                  <span className="continue-art"><Mascot /></span>
                  <span><small>CONTINUE READING</small><strong>{fileName.replace(/\.[^/.]+$/, '')}</strong><i>{progress}% complete</i></span>
                  <span className="round-arrow"><Icon name="arrow" size={19} /></span>
                </button>
              </aside>
            </div>
          </section>
        )}

        {page === 'upload' && (
          <section className="page narrow-page">
            <div className="page-intro">
              <span className="page-icon"><Icon name="upload" size={26} /></span>
              <p className="eyebrow">YOUR READING SHELF</p>
              <h1>Bring something<br /><em>worth focusing on.</em></h1>
              <p className="lead">Upload your material and we’ll turn it into a calm, distraction-free reading experience.</p>
            </div>
            <div
              className={dragging ? 'drop-zone dragging' : 'drop-zone'}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
            >
              <input id="file-upload" type="file" accept=".txt,.md,.pdf,.docx" onChange={(e: ChangeEvent<HTMLInputElement>) => handleFile(e.target.files?.[0])} />
              <div className="upload-illustration"><Icon name="file" size={42} /><span><Icon name="upload" size={19} /></span></div>
              <h2>Drop your reading here</h2>
              <p>or choose a file from your device</p>
              <label htmlFor="file-upload" className="primary-action">Browse files</label>
              <small>TXT, MD, PDF or DOCX · up to 20 MB</small>
            </div>
            {uploadError && <p role="alert" style={{ color: '#a73d3d', marginTop: 12, textAlign: 'center' }}>{uploadError}</p>}
            <section className="current-file">
              <div className="file-badge"><Icon name="file" size={24} /></div>
              <div><small>READY TO READ</small><strong>{fileName}</strong><span>{fileSize} · Saved in this browser</span></div>
              <span className="ready-check"><Icon name="check" size={17} /></span>
              <button onClick={() => goTo('reading')}>Open in reading zone <Icon name="arrow" size={17} /></button>
            </section>
            <div className="privacy-note"><Icon name="lock" size={16} /> Your document stays private in this browser.</div>
          </section>
        )}

        {page === 'reading' && (
          <section className="reading-page">
            <ForestBar progress={progress} />
            <div className="reader-layout">
              <aside className="reader-meta">
                <button className="back-link" onClick={() => goTo('home')}>← Back to home</button>
                <p className="eyebrow">NOW READING</p>
                <h2>{fileName.replace(/\.[^/.]+$/, '')}</h2>
                <div className="focus-mini">
                  <span><Icon name="clock" size={17} /> FOCUS SESSION</span>
                  <strong>{minutesDisplay}:{secondsDisplay}</strong>
                  <button onClick={() => setRunning(!running)}><Icon name={running ? 'pause' : 'play'} size={16} />{running ? 'Pause' : 'Resume'}</button>
                </div>
                <EyeTrackingPanel
                  status={eye.status}
                  error={eye.error}
                  faceFound={eye.faceFound}
                  stage={eye.stage}
                  drifts={eye.drifts}
                  snoozed={eye.snoozed}
                  counting={eyeCounting}
                  settings={eyeSettings}
                  onSettings={updateEyeSettings}
                  onStart={startEyeTracking}
                  onStop={cancelEyeCalibration}
                  onRecalibrate={recalibrateEyeTracking}
                />
                <p className="reader-hint">Scroll inside the page to track your reading progress.</p>
                {!pdfUrl && <div className="reader-font-controls" aria-label="Text size"><button onClick={() => setFontSize(Math.max(14, fontSize - 2))} aria-label="Smaller text">A−</button><span>{fontSize}px</span><button onClick={() => setFontSize(Math.min(28, fontSize + 2))} aria-label="Larger text">A+</button></div>}
                {pdfUrl && <div className="reader-font-controls" aria-label="PDF page size"><button onClick={() => setPdfZoom(Math.max(.7, Math.round((pdfZoom - .15) * 100) / 100))} aria-label="Smaller PDF page">−</button><span>{Math.round(pdfZoom * 100)}%</span><button onClick={() => setPdfZoom(Math.min(2, Math.round((pdfZoom + .15) * 100) / 100))} aria-label="Larger PDF page">+</button></div>}
              </aside>
              <article className={(pdfUrl ? 'reading-paper pdf-paper' : 'reading-paper') + (eye.stage === 1 ? ' gaze-drift' : '')} ref={readingRef} onScroll={handleScroll} onMouseUp={rememberSelection}>
                {pdfUrl ? <PdfDocumentView url={pdfUrl} zoom={pdfZoom} onReady={() => { const previous = savedReading || loadSavedReading(); if (previous?.fileName === fileName) requestAnimationFrame(() => { const el = readingRef.current; if (el) el.scrollTop = previous.scrollTop }) }} /> : readingText.split(/\n+/).filter(Boolean).map((paragraph, index) =>
                  index === 0 && paragraph.length < 100 ? <h1 key={index} data-paragraph={index}>{renderMarkedText(paragraph, index)}</h1> :
                  paragraph.length < 42 && !paragraph.endsWith('.') ? <h2 key={index} data-paragraph={index}>{renderMarkedText(paragraph, index)}</h2> :
                  <p key={index} data-paragraph={index} style={{ fontSize }}>{renderMarkedText(paragraph, index)}</p>
                )}
                {!pdfUrl &&
                <div className="end-mark"><span><Icon name="check" size={18} /></span> End of reading</div>
                }
              </article>
            </div>
            <div className="reading-tools" aria-label="Reading tools">
              <button onClick={() => useSelection('highlight')} title="Highlight selected text" aria-label="Highlight selected text">✎</button>
              <button onClick={() => useSelection('annotation')} title="Annotate selected text" aria-label="Annotate selected text">▤</button>
              <button onClick={() => setNotesOpen(!notesOpen)} title="My notes" aria-label="My notes">☷</button>
              <button onClick={exportAnnotatedCopy} title="Export annotated copy" aria-label="Export annotated copy">↓</button>
              {notes.some(note => note.kind === 'annotation') && <div className="annotation-peek" tabIndex={0} aria-label="Annotation preview">
                <strong>Annotations</strong>
                {notes.filter(note => note.kind === 'annotation').map(note => <p key={note.id}><b>“{note.quote}”</b><br />{note.text}</p>)}
              </div>}
            </div>
            {notesOpen && <aside className="notes-panel" aria-label="Notes and annotations" ref={notesPanelRef}>
              <div className="notes-panel-heading"><h2>My notes</h2><button onClick={() => setNotesOpen(false)} aria-label="Close notes"><Icon name="close" size={18} /></button></div>
              {exportError && <p role="alert">{exportError}</p>}
              {selectedQuote && <blockquote>{selectedQuote}</blockquote>}
              <textarea aria-label="Write a note" placeholder="What would you like to remember?" value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />
              <button className="save-note" disabled={!noteDraft.trim()} onClick={() => { saveNotes([...notes, { id: Date.now(), quote: selectedQuote, text: noteDraft.trim(), page: pdfPage, ...selectedAnchor || {}, kind: selectedAnchor ? 'annotation' : undefined }]); setNoteDraft(''); setSelectedQuote(''); setSelectedAnchor(null) }}>Save note</button>
              <div className="note-list">{notes.map(note => <div className="note-card" key={note.id}>
                <small>{note.quote ? '“' + note.quote + '”' : pdfUrl ? 'Page ' + note.page : 'Reading note'}</small>
                <textarea aria-label="Edit note" value={note.text} onChange={e => saveNotes(notes.map(item => item.id === note.id ? { ...item, text: e.target.value } : item))} />
                <button onClick={() => saveNotes(notes.filter(item => item.id !== note.id))}>Delete</button>
              </div>)}</div>
            </aside>}
            <div className={eye.stage === 1 || mascotMessage ? 'floating-mascot speaking' : 'floating-mascot'}>
              {thoughtClouds > 0 && !checkIn && <div className="thought-clouds" aria-hidden="true">
                <span className="thought-cloud thought-cloud-one" />
                {thoughtClouds > 1 && <span className="thought-cloud thought-cloud-two" />}
              </div>}
              {rewardVisible && <strong className="floating-reward" aria-live="polite">+5</strong>}
              <span aria-live="polite">{eye.stage === 1 ? 'Psst, your page is right here. I’ll wait for you.' : mascotMessage || "I'm reading with you."}</span>
              <Mascot />
            </div>
            {checkIn && <div className="reading-check-in" role="status" aria-live="polite">
              <div className="check-in-content">{checkInReason === 'gaze' ? <><strong>Still with me?</strong><p>Your eyes have been off the page for a bit. What would help right now?</p></> : <><strong>How's it going?</strong><p>Take your time. What would help right now?</p></>}
                <div><button onClick={() => respondToCheckIn('return')}>I'm coming back {checkInRewards.current < 2 ? '· +5 points' : ''}</button><button onClick={() => respondToCheckIn('thinking')}>I'm thinking</button><button onClick={() => respondToCheckIn('break')}>Pause for a break</button></div>
              </div>
            </div>}
          </section>
        )}
      </main>

      {page === 'profile' && (
        <CatHome
          coins={points}
          sessions={sessions}
          focusMinutes={focusMinutes}
          returns={returns}
          pet={pet}
          onBuyFish={buyFish}
          onFeed={feedCat}
          onPat={patCat}
          onHug={hugCat}
          onKiss={kissCat}
          onGoFocus={() => goTo('home')}
        />
      )}

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => goTo(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}
      </nav>

      {eye.status === 'calibrating' && (
        <CalibrationOverlay
          faceFound={eye.faceFound}
          onRecord={eye.recordPoint}
          onMeasure={eye.measureAccuracy}
          onFinish={finishEyeCalibration}
          onCancel={cancelEyeCalibration}
          onRestart={eye.recalibrate}
        />
      )}

      {eye.status === 'tracking' && eyeSettings.showDot && eye.faceFound && page === 'reading' && (
        <div aria-hidden="true">
          <svg className="gaze-trail"><polyline ref={eye.trailRef} /></svg>
          <div ref={eye.dotRef} className="gaze-dot" />
        </div>
      )}

      {showResumePrompt && (
        <div className="modal-backdrop"><div className="reading-setup-modal resume-modal" role="dialog" aria-modal="true" aria-labelledby="resume-title">
          <div className="resume-mascot"><Mascot /></div>
          <h2 id="resume-title">Welcome back!</h2>
          <p>Would you like to continue your last reading?</p>
          <button className="primary-action" onClick={() => {
            const previous = savedReading || loadSavedReading()
            if (!previous) return
            setFocusMinutes(previous.focusMinutes); setBreakMinutes(previous.breakMinutes)
            setSecondsLeft(previous.secondsLeft); setProgress(previous.progress); setPdfPage(previous.pdfPage)
            if (!pdfUrl && savedPdfData && fileName.toLowerCase().endsWith('.pdf')) setPdfUrl(savedPdfData)
            setShowResumePrompt(false); setReadingStartedAt(Date.now()); setRunning(true)
            requestAnimationFrame(() => { if (readingRef.current) readingRef.current.scrollTop = previous.scrollTop })
          }}><Icon name="play" />Continue last reading</button>
          <button className="new-journey" onClick={() => {
            localStorage.removeItem('bloo-active-reading'); setSavedReading(null); setShowResumePrompt(false)
            readingRewardGiven.current = false
            localStorage.removeItem('bloo-reading-reward:' + fileName)
            setMode('focus'); setSecondsLeft(focusMinutes * 60); setProgress(0); setPdfPage(1)
            readingScrollTop.current = 0; if (readingRef.current) readingRef.current.scrollTop = 0
            setShowReadingSetup(true)
          }}>Start a new time journey — I can do it!</button>
        </div></div>
      )}

      {showReadingSetup && (
        <div className="modal-backdrop">
          <div className="reading-setup-modal" role="dialog" aria-modal="true" aria-labelledby="reading-setup-title">
            <button className="modal-close" onClick={() => { setShowReadingSetup(false); goTo('upload') }} aria-label="Close"><Icon name="close" /></button>
            <span className="soft-icon"><Icon name="clock" /></span>
            <h2 id="reading-setup-title">Shape your session</h2>
            <p>Choose your reading and break times before you begin.</p>
            <div className="setup-time"><span>Focus length</span><div className="stepper"><button onClick={() => updateFocus(focusMinutes - 5)} aria-label="Decrease focus time">−</button><input aria-label="Focus minutes" type="number" min="1" max="90" value={focusMinutes} onChange={e => updateFocus(Number(e.target.value))} /><i>min</i><button onClick={() => updateFocus(focusMinutes + 5)} aria-label="Increase break time">+</button></div></div>
            <div className="setup-time"><span>Break length</span><div className="stepper"><button onClick={() => updateBreak(breakMinutes - 1)} aria-label="Decrease break time">−</button><input aria-label="Break minutes" type="number" min="1" max="30" value={breakMinutes} onChange={e => updateBreak(Number(e.target.value))} /><i>min</i><button onClick={() => updateBreak(breakMinutes + 1)} aria-label="Increase break time">+</button></div></div>
            <button className="primary-action" onClick={() => { readingRewardGiven.current = false; localStorage.removeItem('bloo-reading-reward:' + fileName); checkInElapsed.current = 0; checkInRewards.current = 0; setThoughtClouds(0); setCheckIn(false); setMode('focus'); setSecondsLeft(focusMinutes * 60); setReadingStartedAt(Date.now()); setShowReadingSetup(false); setSavedReading({fileName, secondsLeft: focusMinutes * 60, focusMinutes, breakMinutes, scrollTop: 0, progress: 0, pdfPage: 1}); setRunning(true) }}><Icon name="play" />Start reading</button>
          </div>
        </div>
      )}

      {showSessionComplete && (
        <div className="modal-backdrop">
          <div className="encouragement-modal session-nudge">
            <button className="modal-close" onClick={() => setShowSessionComplete(false)} aria-label="Close"><Icon name="close" /></button>
            <span className="session-cat-wrap">
              <img
                className="session-cat"
                src={import.meta.env.BASE_URL + "cat-happy.png"}
                alt="Foco is cheering for you"
                onError={(event) => { event.currentTarget.src = import.meta.env.BASE_URL + "cat.png" }}
              />
            </span>
            <p className="eyebrow">SESSION COMPLETE</p>
            <h2>Time's up.<br />Want to keep going?</h2>
            <p>You stayed with it for {focusMinutes} minutes. Foco is very proud of you.</p>
            <p className="nudge-reward">+{focusMinutes} coins · +2 bond</p>
            <div className="nudge-actions">
              <button
                className="primary-action"
                onClick={() => {
                  setShowSessionComplete(false)
                  setMode('focus')
                  setSecondsLeft(focusMinutes * 60)
                  setReadingStartedAt(Date.now())
                  setCheckIn(false)
                  setThoughtClouds(0)
                  checkInElapsed.current = 0
                  checkInRewards.current = 0
                  setRunning(true)
                }}
              >Keep going · {focusMinutes} min<Icon name="arrow" size={18} /></button>
              <button
                className="nudge-break"
                onClick={() => { setShowSessionComplete(false); switchMode('break'); setRunning(true) }}
              >Take a break · {breakMinutes} min</button>
              <button
                className="nudge-link"
                onClick={() => { setShowSessionComplete(false); goTo('profile') }}
              >Visit Foco's home →</button>
            </div>
          </div>
        </div>
      )}

      {showReadingComplete && (
        <div className="modal-backdrop">
          <div className="reading-complete-modal">
            <button className="modal-close" onClick={() => setShowReadingComplete(false)} aria-label="Close"><Icon name="close" /></button>
            <span className="completion-check"><Icon name="check" size={28} /></span>
            <p className="eyebrow">READING COMPLETE</p>
            <h2>You reached the end.</h2>
            <p>You finished this reading. Take a moment to enjoy your progress.</p>
            <strong className="completion-reward">+5 points ✦</strong>
            <div className="completion-stats">
              <div><strong>{readingDuration}</strong><span>minutes reading</span></div>
              <div><strong>100%</strong><span>material covered</span></div>
            </div>
            <div className="completion-next-actions">
              <button className="primary-action" onClick={() => { setShowReadingComplete(false); goTo('upload') }}>Read another article <Icon name="arrow" size={18} /></button>
              <label>Think a little longer <span><input type="number" min="1" max="90" value={thinkMinutes} onChange={event => setThinkMinutes(Math.max(1, Math.min(90, Number(event.target.value) || 1)))} /> min</span></label>
              <button className="completion-think" onClick={() => { setShowReadingComplete(false); setFocusMinutes(thinkMinutes); setMode('focus'); setSecondsLeft(thinkMinutes * 60); setReadingStartedAt(Date.now()); setRunning(true); checkInElapsed.current = 0 }}>Start thinking time</button>
            </div>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="modal-backdrop" onClick={() => setHistoryOpen(false)}>
          <div
            className="reading-setup-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 560, width: '92vw', maxHeight: '80vh', overflowY: 'auto', display: 'block' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Reading history</h2>
              <button className="modal-close" onClick={() => setHistoryOpen(false)} aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>
            {historyList.length === 0 ? (
              <p style={{ color: '#8a9ba8' }}>No saved articles yet. Upload something and it will appear here.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
                {historyList.map((item) => (
                  <li
                    key={item.id}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#f7fafc', borderRadius: 12, padding: 12 }}
                  >
                    <button
                      onClick={() => restoreHistoryItem(item)}
                      style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#2c3e50', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.fileName}
                      </div>
                      <div style={{ fontSize: 12, color: '#8a9ba8', marginTop: 2 }}>
                        {item.fileSize} · {new Date(item.uploadTime).toLocaleString()}
                      </div>
                    </button>
                    <button
                      onClick={() => setHistoryList(deleteReadingHistory(item.id))}
                      style={{ border: 'none', background: '#fff', color: '#c0392b', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
