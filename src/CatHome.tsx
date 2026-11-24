import { ReactNode, useState } from 'react'
import {
  ACHIEVEMENTS,
  FISH_PRICE,
  FRIENDSHIP,
  MAX_INTIMACY,
  petLevel,
  petLevelProgress,
  type AchievementContext,
  type PetState,
} from './pet'

type Props = {
  coins: number
  sessions: number
  focusMinutes: number
  returns: number
  pet: PetState
  onBuyFish: () => string
  onFeed: () => string
  onPat: () => string
  onHug: () => string
  onKiss: () => string
  onGoFocus: () => void
}

const LOCK = (
  <>
    <rect x="5" y="10.5" width="14" height="10.5" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </>
)
const COIN = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v9M9.8 10.4h4.4M9.8 13.6h4.4" />
  </>
)
const STAR = <path d="m12 3.2 2 5.9 6.2.1-5 3.7 1.9 5.9-5.1-3.6-5.1 3.6 1.9-5.9-5-3.7 6.2-.1Z" />
const HEART = <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21.2l7.7-7.7 1.1-1a5.5 5.5 0 0 0 0-7.9z" />

function Glyph({ shape, size = 20 }: { shape: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {shape}
    </svg>
  )
}

export default function CatHome({ coins, sessions, focusMinutes, returns, pet, onBuyFish, onFeed, onPat, onHug, onKiss, onGoFocus }: Props) {
  const [message, setMessage] = useState('Foco is reading by the window, waiting for you.')

  const mood =
    pet.intimacy >= 90
      ? 'Foco adores you. It follows you around the room.'
      : pet.intimacy >= 60
        ? 'Foco feels safe with you now.'
        : pet.intimacy >= 30
          ? 'Foco likes having you around.'
          : pet.intimacy > 0
            ? 'Foco is slowly getting used to you.'
            : 'Foco is still a little shy. A few quiet sessions will help.'

  const context: AchievementContext = { sessions, focusMinutes, returns, pet }
  const earned = ACHIEVEMENTS.filter((item) => item.count(context) >= item.target)
  const visible = ACHIEVEMENTS.filter((item) => !item.secret || earned.some((open) => open.id === item.id))
  const level = petLevel(pet.xp)
  const levelPercent = petLevelProgress(pet.xp)

  const runFriend = (id: string) => {
    if (id === 'pat') setMessage(onPat())
    else if (id === 'hug') setMessage(onHug())
    else setMessage(onKiss())
  }

  return (
    <section className="page garden-page">
      <div className="garden-hero">
        <p className="eyebrow">YOUR LITTLE HOME</p>
        <h1>Come home to<br /><em>your reading cat.</em></h1>
        <p className="lead">Every focused minute feeds this little world. Finish a session, earn coins, and bring something small home.</p>
      </div>

      <div className="cat-hall">
        <div className="cat-stage">
          <div className="stage-sky" />
          <div className="stage-hill stage-hill-back" />
          <div className="stage-hill stage-hill-front" />
          <p className="cat-speech" key={message}>{message}</p>
          <div className="cat-figure"><img src={import.meta.env.BASE_URL + "cat.png"} alt="Foco, your reading cat" /></div>
        </div>

        <div className="cat-panel">
          <div className="bond-block">
            <div className="bond-head"><span>BOND</span><strong>{pet.intimacy} / {MAX_INTIMACY}</strong></div>
            <div className="bond-track">
              <i style={{ width: `${Math.min(MAX_INTIMACY, pet.intimacy)}%` }} />
              {[30, 60, 90].map((mark) => (
                <span key={mark} className={pet.intimacy >= mark ? 'bond-mark reached' : 'bond-mark'} style={{ left: `${mark}%` }} />
              ))}
            </div>
            <p className="mood-line">{mood}</p>
          </div>

          <div className="friend-row">
            {FRIENDSHIP.map((step) => {
              const open = pet.intimacy >= step.need
              return (
                <button key={step.id} className={open ? 'friend-button' : 'friend-button locked'} disabled={!open} onClick={() => runFriend(step.id)}>
                  <strong>{step.label}</strong>
                  <small>{open ? step.copy : `${step.need} bond to unlock`}</small>
                </button>
              )
            })}
          </div>

          <button className="garden-focus-link" onClick={onGoFocus}>Start a focus session →</button>
        </div>
      </div>

      <div className="garden-stats">
        <div className="garden-stat">
          <span className="stat-glyph"><Glyph shape={COIN} size={18} /></span>
          <div><strong>{coins}</strong><small>coins earned</small></div>
        </div>
        <div className="garden-stat">
          <span className="stat-glyph"><Glyph shape={STAR} size={18} /></span>
          <div>
            <strong>Level {level}</strong>
            <small>{pet.xp} xp · {levelPercent}% to the next level</small>
            <div className="xp-track"><i style={{ width: `${levelPercent}%` }} /></div>
          </div>
        </div>
        <div className="garden-stat">
          <span className="stat-glyph"><Glyph shape={HEART} size={18} /></span>
          <div><strong>{sessions}</strong><small>sessions finished</small></div>
        </div>
      </div>

      <section className="feed-card">
        <div className="feed-head">
          <div>
            <p className="eyebrow">THE FISH BOWL</p>
            <h2>Keep the little bowl full</h2>
          </div>
          <div className="fish-count"><span>🐟</span><strong>{pet.fish}</strong><small>dried fish</small></div>
        </div>
        <div className="feed-actions">
          <button className="secondary-action" disabled={coins < FISH_PRICE} onClick={() => setMessage(onBuyFish())}>
            Buy a fish · {FISH_PRICE} coins
          </button>
          <button className="primary-action" disabled={pet.fish <= 0} onClick={() => setMessage(onFeed())}>
            Feed Foco
          </button>
          <p className="feed-hint">One focus session earns {focusMinutes} coins · one dried fish costs {FISH_PRICE} coins · feeding builds bond.</p>
        </div>
      </section>

      <section className="badges-section">
        <div className="section-title">
          <div><p className="eyebrow">MILESTONES</p><h2>Your achievements</h2></div>
          <span>{earned.length} of {visible.length} unlocked</span>
        </div>
        <div className="badges-grid">
          {visible.map((item) => {
            const open = earned.some((entry) => entry.id === item.id)
            const current = Math.min(item.count(context), item.target)
            return (
              <div className={open ? 'badge-card unlocked' : 'badge-card'} key={item.id}>
                <div className="medal"><span>{open ? item.symbol : <Glyph shape={LOCK} size={21} />}</span></div>
                <div>
                  <small>{open ? 'UNLOCKED' : `${current} / ${item.target}`}</small>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
                {open && <span className="badge-check">✓</span>}
              </div>
            )
          })}
        </div>
      </section>
    </section>
  )
}
