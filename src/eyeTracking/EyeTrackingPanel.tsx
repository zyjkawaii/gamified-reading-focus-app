import { DRIFT_MAX, DRIFT_MIN, type DriftStage, type EyeSettings, type EyeStatus } from './useEyeTracking'
import { EyeIcon } from './CalibrationOverlay'

type Props = {
  status: EyeStatus
  error: string
  faceFound: boolean
  stage: DriftStage
  drifts: number
  snoozed: boolean
  // 番茄钟是否处于专注计时中（不在计时时不判定偏离）。
  counting: boolean
  settings: EyeSettings
  onSettings: (settings: EyeSettings) => void
  onStart: () => void
  onStop: () => void
  onRecalibrate: () => void
}

export default function EyeTrackingPanel({ status, error, faceFound, stage, drifts, snoozed, counting, settings, onSettings, onStart, onStop, onRecalibrate }: Props) {
  const tracking = status === 'tracking'

  let tone: 'idle' | 'ok' | 'warn' | 'busy' = 'idle'
  let label = 'Off'
  if (status === 'loading') { tone = 'busy'; label = 'Starting camera…' }
  else if (status === 'calibrating') { tone = 'busy'; label = 'Calibrating' }
  else if (status === 'error') { tone = 'warn'; label = 'Not running' }
  else if (tracking && !faceFound) { tone = 'warn'; label = 'Can’t see your face' }
  else if (tracking && snoozed) { tone = 'idle'; label = 'Thinking time' }
  else if (tracking && !counting) { tone = 'idle'; label = 'Waits for the focus timer' }
  else if (tracking && stage > 0) { tone = 'warn'; label = 'Looking away' }
  else if (tracking) { tone = 'ok'; label = 'On the page' }

  const setDrift = (value: number) => onSettings({ ...settings, driftSeconds: Math.max(DRIFT_MIN, Math.min(DRIFT_MAX, value)) })

  return (
    <section className="eye-mini" aria-label="Eye tracking">
      <span className="eye-mini-title"><EyeIcon size={16} /> EYE TRACKING</span>
      <p className={`eye-status ${tone}`} aria-live="polite"><i />{label}</p>

      {status === 'off' && <>
        <p className="eye-note">Uses your laptop camera to notice when your eyes leave the page. Foco checks in only when you drift.</p>
        <button className="eye-action" onClick={onStart}>Turn on</button>
      </>}

      {status === 'loading' && <>
        <p className="eye-note">Allow camera access when the browser asks. The first start loads a face model and can take a moment.</p>
        <button className="eye-action" onClick={onStop}>Cancel</button>
      </>}

      {status === 'error' && <>
        <p className="eye-note eye-error" role="alert">{error}</p>
        <button className="eye-action" onClick={onStart}>Try again</button>
      </>}

      {tracking && <>
        {snoozed && <p className="eye-note">Tracking resumes in a minute.</p>}
        <div className="eye-setting">
          <span>Nudge after</span>
          <span className="eye-stepper">
            <button onClick={() => setDrift(settings.driftSeconds - 1)} aria-label="Nudge sooner" disabled={settings.driftSeconds <= DRIFT_MIN}>−</button>
            <b>{settings.driftSeconds}s</b>
            <button onClick={() => setDrift(settings.driftSeconds + 1)} aria-label="Nudge later" disabled={settings.driftSeconds >= DRIFT_MAX}>+</button>
          </span>
        </div>
        <button type="button" className="eye-action" onClick={() => onSettings({ ...settings, showDot: !settings.showDot })}>
          {settings.showDot ? 'Hide gaze trail' : 'Show gaze trail'}
        </button>
        <label className="eye-toggle"><input type="checkbox" checked={settings.showVideo} onChange={event => onSettings({ ...settings, showVideo: event.target.checked })} /><span />Show camera</label>
        <p className="eye-count">{drifts === 0 ? 'No drifts yet' : `Drifted away ${drifts} ${drifts === 1 ? 'time' : 'times'}`}</p>
        <div className="eye-actions">
          <button onClick={onRecalibrate}>Recalibrate</button>
          <button onClick={onStop}>Turn off</button>
        </div>
      </>}

      {(tracking || status === 'calibrating' || status === 'loading') && <p className="eye-privacy">Video stays on this device.</p>}
    </section>
  )
}
