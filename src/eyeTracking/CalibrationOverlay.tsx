import { useState, type CSSProperties, type MouseEvent } from 'react'

// 9 个校准点，位置用屏幕宽、高的百分比表示（横向 10% / 50% / 90%，纵向 10% / 50% / 90%）。
const POINTS = [10, 50, 90].flatMap(y => [10, 50, 90].map(x => ({ x, y })))
// 每个点需要点击的次数。
const CLICKS_PER_POINT = 5

type Step = 'intro' | 'points' | 'check' | 'result'

type Props = {
  faceFound: boolean
  onRecord: (x: number, y: number) => boolean
  onMeasure: (target: { x: number; y: number }) => Promise<number | null>
  onFinish: () => void
  onCancel: () => void
  onRestart: () => void
}

export default function CalibrationOverlay({ faceFound, onRecord, onMeasure, onFinish, onCancel, onRestart }: Props) {
  const [step, setStep] = useState<Step>('intro')
  const [clicks, setClicks] = useState<number[]>(() => POINTS.map(() => 0))
  const [offset, setOffset] = useState<number | null>(null)

  const donePoints = clicks.filter(count => count >= CLICKS_PER_POINT).length

  const clickPoint = (index: number, event: MouseEvent<HTMLButtonElement>) => {
    if (clicks[index] >= CLICKS_PER_POINT) return
    const rect = event.currentTarget.getBoundingClientRect()
    if (!onRecord(rect.left + rect.width / 2, rect.top + rect.height / 2)) return
    const next = clicks.map((count, i) => (i === index ? count + 1 : count))
    setClicks(next)
    if (next.every(count => count >= CLICKS_PER_POINT)) runCheck()
  }

  const runCheck = async () => {
    setStep('check')
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const result = await onMeasure(target)
    setOffset(result === null ? null : Math.round(result))
    setStep('result')
  }

  const restart = () => {
    setClicks(POINTS.map(() => 0))
    setOffset(null)
    onRestart()
    setStep('points')
  }

  // 精度分级：平均偏差 ≤ 150 像素为良好，≤ 250 像素为可用，更大建议重新校准。
  const quality = offset === null ? 'none' : offset <= 150 ? 'good' : offset <= 250 ? 'fair' : 'poor'

  return (
    <div className="eye-calibration" role="dialog" aria-modal="true" aria-labelledby="eye-calibration-title">
      {step === 'intro' && (
        <div className="eye-calibration-card">
          <span className="soft-icon"><EyeIcon /></span>
          <h2 id="eye-calibration-title">Calibrate eye tracking</h2>
          <p>Foco needs about 30 seconds to learn where you look. Sit about an arm’s length from the screen, face the light, and keep your head fairly still.</p>
          <p className={faceFound ? 'eye-face-state found' : 'eye-face-state'} aria-live="polite">
            <i />{faceFound ? 'Face found. You’re ready.' : 'Looking for your face in the camera box…'}
          </p>
          <button className="primary-action" disabled={!faceFound} onClick={() => setStep('points')}>Start calibration</button>
          <button className="eye-text-button" onClick={onCancel}>Cancel</button>
        </div>
      )}

      {step === 'points' && (
        <>
          <div className="eye-calibration-guide" aria-live="polite">
            <strong>Look at a dot, then click it {CLICKS_PER_POINT} times</strong>
            <span>Keep your eyes on the dot while you click · {donePoints} of {POINTS.length} done</span>
            {!faceFound && <em>Your face is out of view. Move back into the camera box.</em>}
          </div>
          {POINTS.map((point, index) => {
            const count = clicks[index]
            const done = count >= CLICKS_PER_POINT
            return (
              <button
                key={index}
                className={done ? 'eye-point done' : 'eye-point'}
                style={{ left: `${point.x}%`, top: `${point.y}%`, '--eye-fill': `${(count / CLICKS_PER_POINT) * 360}deg` } as CSSProperties}
                onClick={event => clickPoint(index, event)}
                disabled={done || !faceFound}
                aria-label={`Calibration dot ${index + 1}, ${count} of ${CLICKS_PER_POINT} clicks`}
              />
            )
          })}
          <button className="eye-text-button eye-calibration-cancel" onClick={onCancel}>Cancel</button>
        </>
      )}

      {step === 'check' && (
        <>
          <div className="eye-calibration-guide"><strong>Keep looking at the dot</strong><span>Checking accuracy for 3 seconds</span></div>
          <span className="eye-point eye-point-check" style={{ left: '50%', top: '50%' }} aria-hidden="true" />
          <button className="eye-text-button eye-calibration-cancel" onClick={onCancel}>Cancel</button>
        </>
      )}

      {step === 'result' && (
        <div className="eye-calibration-card">
          <span className="soft-icon"><EyeIcon /></span>
          <h2 id="eye-calibration-title">{quality === 'good' ? 'Calibration looks good' : quality === 'fair' ? 'Calibration is usable' : quality === 'poor' ? 'Calibration is rough' : 'Your face wasn’t visible'}</h2>
          <p>
            {offset === null
              ? 'Foco couldn’t see your face during the check. Move into the camera box and calibrate again.'
              : `On average, the estimate landed about ${offset} px from the dot. ${quality === 'good' ? 'That’s enough to tell when you leave the page.' : quality === 'fair' ? 'It works, but recalibrating in better light will reduce false nudges.' : 'Expect false nudges. Try again with more light on your face.'}`}
          </p>
          {offset !== null && <button className="primary-action" onClick={onFinish}>Start tracking</button>}
          <button className={offset === null ? 'primary-action' : 'eye-text-button'} onClick={restart}>Calibrate again</button>
          <button className="eye-text-button" onClick={onCancel}>Cancel</button>
        </div>
      )}
    </div>
  )
}

export function EyeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
