import { useCallback, useEffect, useRef, useState } from 'react'
import { startWebgazer, type GazePrediction, type GazeSession } from './loadWebgazer'

// 状态：off 未开启；loading 正在打开摄像头、加载模型；calibrating 校准中；tracking 追踪中；error 出错。
export type EyeStatus = 'off' | 'loading' | 'calibrating' | 'tracking' | 'error'
// 偏离阶段：0 正常；1 已轻提示（纸张边框发亮 + Foco 说话）；2 已弹出 check-in。
export type DriftStage = 0 | 1 | 2
// 事件：drift 进入轻提示；nudge 需要弹 check-in；return 视线回到阅读区。
export type EyeEvent = 'drift' | 'nudge' | 'return'
export type EyeSettings = { driftSeconds: number; showDot: boolean; showVideo: boolean }
type Point = { x: number; y: number }

// 平滑：取最近 SMOOTH_WINDOW 个视线点的横、纵坐标平均值作为当前视线位置。
export const SMOOTH_WINDOW = 10
// 容差：阅读区域矩形的上下左右四条边各向外放宽 REGION_MARGIN 像素。
export const REGION_MARGIN = 60
// 回到阅读区后，需要连续停留 RETURN_MS 毫秒才算真正回来。
export const RETURN_MS = 1000
// 超过 FACE_LOST_MS 毫秒没有收到有效数据时，清除过期的视线。
export const FACE_LOST_MS = 1500
// 轻提示之后再过 NUDGE_EXTRA_SECONDS 秒仍未回来，弹出 check-in。
export const NUDGE_EXTRA_SECONDS = 10
// 判定频率：每 TICK_MS 毫秒检查一次。
const TICK_MS = 200
const TRAIL_MS = 750
const START_TIMEOUT_MS = 60000
export const DRIFT_MIN = 5
export const DRIFT_MAX = 30

const SETTINGS_KEY = 'bloo-eye-settings'
const defaultSettings: EyeSettings = { driftSeconds: 8, showDot: false, showVideo: false }

export function loadEyeSettings(): EyeSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    const merged = { ...defaultSettings, ...saved }
    return { ...merged, driftSeconds: Math.max(DRIFT_MIN, Math.min(DRIFT_MAX, Number(merged.driftSeconds) || defaultSettings.driftSeconds)) }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveEyeSettings(settings: EyeSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* ignore */ }
}

// 判断点是否落在任一区域（放宽 margin 像素后）之内。坐标都是相对浏览器可视窗口的像素值。
export function isInsideRegions(point: Point, regions: DOMRect[], margin = REGION_MARGIN) {
  return regions.some(rect =>
    point.x >= rect.left - margin && point.x <= rect.right + margin &&
    point.y >= rect.top - margin && point.y <= rect.bottom + margin)
}

function describeStartError(error: unknown) {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (message === 'insecure') return 'Camera access only works at http://localhost or https. Open the app at http://localhost:5173.'
  if (message === 'timeout') return 'Eye tracking took too long to start. Check the camera prompt, then try again.'
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission is blocked. Allow the camera in the address bar, then try again.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.'
  if (name === 'NotReadableError' || name === 'AbortError') return 'The camera is busy in another app. Close that app and try again.'
  if (message === 'camera-ended') return 'The camera disconnected. Reconnect it, then try again.'
  if (message === 'webgazer-script') return 'The eye-tracking script could not load. Try again.'
  if (message === 'webgazer-model') return 'The face model could not initialize. Try again in a browser with WebGL enabled.'
  if (message === 'webgazer-frame') return 'Eye tracking could not process the camera feed. Try again.'
  return 'Eye tracking could not start. Check the camera, then try again.'
}

type Options = {
  // 是否正在计时判定（番茄钟专注中、在阅读区、没有弹窗）。
  active: boolean
  // 是否停留在阅读区页面；离开时暂停 WebGazer 的计算。
  visible: boolean
  // 返回当前“算作在读”的屏幕区域。
  getRegions: () => DOMRect[]
  settings: EyeSettings
  onEvent: (event: EyeEvent) => void
}

export function useEyeTracking({ active, visible, getRegions, settings, onEvent }: Options) {
  const [status, setStatus] = useState<EyeStatus>('off')
  const [error, setError] = useState('')
  const [faceFound, setFaceFound] = useState(false)
  const [stage, setStage] = useState<DriftStage>(0)
  const [drifts, setDrifts] = useState(0)
  const [snoozed, setSnoozed] = useState(false)

  const session = useRef<GazeSession | null>(null)
  const startup = useRef<AbortController | null>(null)
  const audio = useRef<AudioContext | null>(null)
  const samples = useRef<Point[]>([])
  const smoothed = useRef<Point | null>(null)
  const lastValidAt = useRef(-Infinity)
  const lastFaceAt = useRef(-Infinity)
  const faceRef = useRef(false)
  const offSince = useRef<number | null>(null)
  const backSince = useRef<number | null>(null)
  const stageRef = useRef<DriftStage>(0)
  const snoozeUntil = useRef(0)
  const snoozeTimer = useRef<number | null>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const trailRef = useRef<SVGPolylineElement>(null)
  const trail = useRef<(Point & { at: number })[]>([])

  const activeRef = useRef(active)
  const getRegionsRef = useRef(getRegions)
  const settingsRef = useRef(settings)
  const onEventRef = useRef(onEvent)
  activeRef.current = active
  getRegionsRef.current = getRegions
  settingsRef.current = settings
  onEventRef.current = onEvent

  const setStageBoth = useCallback((next: DriftStage) => { stageRef.current = next; setStage(next) }, [])

  const resetDrift = useCallback(() => {
    offSince.current = null
    backSince.current = null
    if (stageRef.current !== 0) setStageBoth(0)
  }, [setStageBoth])

  const clearGaze = useCallback(() => {
    samples.current = []
    smoothed.current = null
    lastValidAt.current = -Infinity
    trail.current = []
    trailRef.current?.removeAttribute('points')
    dotRef.current?.removeAttribute('style')
  }, [])

  const clearSignal = useCallback(() => {
    clearGaze()
    lastFaceAt.current = -Infinity
    faceRef.current = false
    setFaceFound(false)
  }, [clearGaze])

  const handleGaze = useCallback((data: GazePrediction | null, hasFace: boolean) => {
    const now = performance.now()
    if (hasFace) lastFaceAt.current = now
    if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return
    if (now - lastValidAt.current >= FACE_LOST_MS) clearGaze()

    const list = samples.current
    list.push(data)
    if (list.length > SMOOTH_WINDOW) list.shift()
    let sumX = 0
    let sumY = 0
    for (const point of list) { sumX += point.x; sumY += point.y }
    const point = { x: sumX / list.length, y: sumY / list.length }
    smoothed.current = point
    lastValidAt.current = now

    // Display only. AOI always receives the same smoothed coordinates.
    const dot = dotRef.current
    const line = trailRef.current
    if (!dot || !line) return
    trail.current = trail.current.filter(sample => now - sample.at <= TRAIL_MS).slice(-29)
    trail.current.push({ ...point, at: now })
    dot.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`
    line.setAttribute('points', trail.current.map(sample => `${sample.x},${sample.y}`).join(' '))
  }, [clearGaze])

  const release = useCallback(() => {
    startup.current?.abort()
    startup.current = null
    session.current = null
    if (snoozeTimer.current !== null) window.clearTimeout(snoozeTimer.current)
    snoozeTimer.current = null
    snoozeUntil.current = 0
    if (audio.current) void audio.current.close().catch(() => {})
    audio.current = null
  }, [])

  const stop = useCallback(() => {
    release()
    clearSignal()
    resetDrift()
    setSnoozed(false)
    setError('')
    setStatus('off')
  }, [release, clearSignal, resetDrift])

  const start = useCallback(async () => {
    if (startup.current) return
    const controller = new AbortController()
    startup.current = controller
    setError('')
    setStatus('loading')

    const fail = (cause: unknown) => {
      if (startup.current !== controller) return
      console.error('[eye tracking] session failed', cause)
      release()
      clearSignal()
      resetDrift()
      setSnoozed(false)
      setError(describeStartError(cause))
      setStatus('error')
    }
    const timeout = window.setTimeout(() => fail(new Error('timeout')), START_TIMEOUT_MS)
    controller.signal.addEventListener('abort', () => window.clearTimeout(timeout), { once: true })
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('insecure')
      // Unlock the optional reminder sound during the user's click.
      try {
        audio.current = new AudioContext()
        void audio.current.resume().catch(() => {})
      } catch { /* Visual reminders still work. */ }

      const nextSession = await startWebgazer(controller.signal, handleGaze, fail)
      if (startup.current !== controller) return
      session.current = nextSession
      setDrifts(0)
      setStatus('calibrating')
    } catch (cause) {
      fail(cause)
    } finally {
      window.clearTimeout(timeout)
    }
  }, [clearSignal, handleGaze, release, resetDrift])

  const recordPoint = useCallback((x: number, y: number) =>
    session.current?.recordPoint(x, y) ?? false, [])

  const playReminder = () => {
    const context = audio.current
    if (context?.state !== 'running') return
    const tone = context.createOscillator()
    const volume = context.createGain()
    const now = context.currentTime
    tone.type = 'sine'
    tone.frequency.setValueAtTime(660, now)
    volume.gain.setValueAtTime(0, now)
    volume.gain.linearRampToValueAtTime(0.09, now + 0.035)
    volume.gain.linearRampToValueAtTime(0, now + 0.25)
    tone.connect(volume)
    volume.connect(context.destination)
    tone.start(now)
    tone.stop(now + 0.25)
  }

  // 精度检查：在 durationMs 内每 100 毫秒取一次平滑后的视线位置，
  // 计算它与目标点的直线距离 sqrt((x - 目标x)² + (y - 目标y)²)，返回这些距离的平均值（像素）。
  const measureAccuracy = useCallback((target: Point, durationMs = 3000) => new Promise<number | null>(resolve => {
    const signal = startup.current?.signal
    if (!signal) { resolve(null); return }
    const distances: number[] = []
    const cancel = () => { window.clearInterval(id); resolve(null) }
    const startedAt = performance.now()
    const id = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      const point = smoothed.current
      const fresh = performance.now() - lastValidAt.current < FACE_LOST_MS
      // 前 600 毫秒视线还在移向目标点，不计入。
      if (elapsed > 600 && point && fresh) distances.push(Math.hypot(point.x - target.x, point.y - target.y))
      if (elapsed >= durationMs) {
        window.clearInterval(id)
        signal.removeEventListener('abort', cancel)
        resolve(distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : null)
      }
    }, 100)
    signal.addEventListener('abort', cancel, { once: true })
  }), [])

  const finishCalibration = useCallback(() => {
    clearGaze()
    resetDrift()
    setStatus('tracking')
  }, [clearGaze, resetDrift])

  const recalibrate = useCallback(() => {
    if (!session.current) return
    session.current.resetCalibration()
    clearGaze()
    resetDrift()
    setStatus('calibrating')
  }, [clearGaze, resetDrift])

  // 用户在 check-in 里选“我在思考”后，暂停判定 ms 毫秒。
  const snooze = useCallback((ms: number) => {
    snoozeUntil.current = performance.now() + ms
    setSnoozed(true)
    if (snoozeTimer.current) window.clearTimeout(snoozeTimer.current)
    snoozeTimer.current = window.setTimeout(() => setSnoozed(false), ms)
    resetDrift()
  }, [resetDrift])

  // 主判定循环。
  useEffect(() => {
    if (status !== 'calibrating' && status !== 'tracking') return
    const id = window.setInterval(() => {
      const now = performance.now()
      const face = now - lastFaceAt.current < FACE_LOST_MS
      if (smoothed.current && now - lastValidAt.current >= FACE_LOST_MS) clearGaze()
      if (face !== faceRef.current) { faceRef.current = face; setFaceFound(face) }
      if (status !== 'tracking') return
      const point = smoothed.current
      if (!activeRef.current || document.hidden || now < snoozeUntil.current || !face || !point) {
        resetDrift()
        return
      }
      const regions = getRegionsRef.current()
      if (!regions.length) { resetDrift(); return }
      const inside = isInsideRegions(point, regions)
      if (inside) {
        offSince.current = null
        if (stageRef.current > 0) {
          backSince.current ??= now
          if (now - backSince.current >= RETURN_MS) {
            const previous = stageRef.current
            backSince.current = null
            setStageBoth(0)
            if (previous === 1) onEventRef.current('return')
          }
        }
        return
      }

      backSince.current = null
      offSince.current ??= now
      const offMs = lastValidAt.current - offSince.current
      const driftMs = settingsRef.current.driftSeconds * 1000
      if (stageRef.current < 2 && offMs >= driftMs + NUDGE_EXTRA_SECONDS * 1000) {
        setStageBoth(2)
        onEventRef.current('nudge')
      } else if (stageRef.current < 1 && offMs >= driftMs) {
        setStageBoth(1)
        setDrifts(count => count + 1)
        playReminder()
        onEventRef.current('drift')
      }
    }, TICK_MS)
    document.addEventListener('visibilitychange', resetDrift)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', resetDrift)
    }
  }, [status, clearGaze, resetDrift, setStageBoth])

  useEffect(() => {
    if (status !== 'tracking') return
    const onClick = (event: MouseEvent) => {
      if (!visible || event.target instanceof Element && event.target.closest('.eye-mini')) return
      recordPoint(event.clientX, event.clientY)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [status, visible, recordPoint])

  useEffect(() => {
    session.current?.setPaused(!visible)
    if (!visible) {
      clearSignal()
      resetDrift()
    }
  }, [visible, status, clearSignal, resetDrift])

  useEffect(() => {
    session.current?.showVideo(visible && (status === 'calibrating' || status === 'tracking' && settings.showVideo))
  }, [visible, status, settings.showVideo])

  useEffect(() => {
    if (!settings.showDot || status !== 'tracking') trail.current = []
  }, [settings.showDot, status])

  // 给 body 加状态类，用 CSS 摆放摄像头小窗。
  useEffect(() => {
    const body = document.body
    body.classList.toggle('eye-calibrating', status === 'calibrating')
    body.classList.toggle('eye-tracking', status === 'tracking')
    return () => body.classList.remove('eye-calibrating', 'eye-tracking')
  }, [status])

  useEffect(() => release, [release])

  return {
    status, error, faceFound, stage, drifts, snoozed, dotRef, trailRef,
    start, stop, recordPoint, measureAccuracy, finishCalibration, recalibrate, snooze,
  }
}

export type EyeTracking = ReturnType<typeof useEyeTracking>
