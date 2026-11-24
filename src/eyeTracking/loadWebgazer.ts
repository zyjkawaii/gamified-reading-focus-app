// WebGazer's classic browser bundle keeps MediaPipe's global WASM loader intact.
export type GazePrediction = { x: number; y: number }
type EyePatches = { left: { patch: ImageData }; right: { patch: ImageData } }
type FaceDetector = { dispose: () => void }

type Webgazer = {
  params: { faceMeshSolutionPath: string; camConstraints: MediaStreamConstraints }
  tracker: {
    TFFaceMesh: new () => {
      init: () => Promise<FaceDetector>
      getEyePatches: (video: HTMLVideoElement, canvas: HTMLCanvasElement, width: number, height: number) => Promise<EyePatches | false | null>
    }
  }
  reg: {
    RidgeReg: new () => {
      init: () => void
      addData: (eyes: EyePatches, target: [number, number], type: 'click') => void
      predict: (eyes: EyePatches) => GazePrediction | null
    }
  }
}

const assetBase = new URL(`${import.meta.env.BASE_URL}eye-tracking/`, document.baseURI)
let pending: Promise<Webgazer> | undefined

export function loadWebgazer(): Promise<Webgazer> {
  pending ??= new Promise<Webgazer>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = new URL('webgazer.js', assetBase).href
    script.async = true
    const timeout = window.setTimeout(fail, 15000)

    function fail() {
      window.clearTimeout(timeout)
      script.remove()
      reject(new Error('webgazer-script'))
    }

    script.onload = () => {
      const wg = (window as Window & { webgazer?: Webgazer }).webgazer
      if (typeof wg?.tracker?.TFFaceMesh !== 'function' || typeof wg.reg?.RidgeReg !== 'function') {
        fail()
        return
      }
      window.clearTimeout(timeout)
      wg.params.faceMeshSolutionPath = new URL('face_mesh', assetBase).href
      resolve(wg)
    }
    script.onerror = fail
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    pending = undefined
    throw error
  })
  return pending
}

// Own the stream and frame loop. WebGazer 3.5.3's end() only removes its UI,
// and its startup promise does not cover errors on later inference frames.
export async function startWebgazer(
  signal: AbortSignal,
  onFrame: (point: GazePrediction | null, faceFound: boolean) => void,
  onError: (error: unknown) => void,
) {
  const wg = await loadWebgazer()
  signal.throwIfAborted()
  const stream = await navigator.mediaDevices.getUserMedia(wg.params.camConstraints)
  const video = document.createElement('video')
  const preview = document.createElement('div')
  const canvas = document.createElement('canvas')
  let detector: FaceDetector | undefined
  let frame = 0
  let busy = false
  let paused = false
  let eyes: EyePatches | false | null = null

  function disposeDetector() {
    detector?.dispose()
    detector = undefined
  }

  function cameraEnded() { onError(new Error('camera-ended')) }

  function release() {
    cancelAnimationFrame(frame)
    for (const track of stream.getTracks()) {
      track.removeEventListener('ended', cameraEnded)
      track.stop()
    }
    video.srcObject = null
    preview.remove()
    if (!busy) disposeDetector()
  }

  signal.addEventListener('abort', release, { once: true })
  try {
    signal.throwIfAborted()
    const tracker = new wg.tracker.TFFaceMesh()
    const regression = new wg.reg.RidgeReg()
    for (const track of stream.getVideoTracks()) track.addEventListener('ended', cameraEnded)

    preview.id = 'webgazerVideoContainer'
    preview.hidden = true
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    preview.append(video)
    document.body.append(preview)
    await video.play()
    signal.throwIfAborted()

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('webgazer-canvas')
    try {
      detector = await tracker.init()
    } catch (cause) {
      throw Object.assign(new Error('webgazer-model'), { cause })
    }
    signal.throwIfAborted()

    const tick = async () => {
      frame = 0
      if (paused || signal.aborted) return
      busy = true
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const patches = await tracker.getEyePatches(video, canvas, canvas.width, canvas.height)
        if (!signal.aborted && !paused) {
          eyes = patches
          onFrame(eyes ? regression.predict(eyes) : null, Boolean(eyes))
        }
      } catch (error) {
        if (!signal.aborted) onError(Object.assign(new Error('webgazer-frame'), { cause: error }))
      } finally {
        busy = false
        if (signal.aborted) disposeDetector()
        else if (!paused) frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return {
      showVideo(show: boolean) { preview.hidden = !show },
      setPaused(next: boolean) {
        paused = next
        if (paused) {
          eyes = null
          cancelAnimationFrame(frame)
          frame = 0
        } else if (!frame && !busy) frame = requestAnimationFrame(tick)
      },
      recordPoint(x: number, y: number) {
        if (!eyes || paused || signal.aborted) return false
        regression.addData(eyes, [x, y], 'click')
        return true
      },
      resetCalibration() { regression.init() },
    }
  } catch (error) {
    signal.removeEventListener('abort', release)
    release()
    throw error
  }
}

export type GazeSession = Awaited<ReturnType<typeof startWebgazer>>
