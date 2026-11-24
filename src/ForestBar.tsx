type Layer = 0 | 1 | 2

const LAYER_BOTTOM: Record<Layer, number> = { 0: 10, 1: 5, 2: 0 }

const trees: { x: number; height: number; layer: Layer }[] = (() => {
  let seed = 20261118
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const specs = [
    { count: 21, base: 24, spread: 12 },
    { count: 15, base: 34, spread: 14 },
    { count: 11, base: 46, spread: 16 },
  ]
  return specs.flatMap((spec, layer) =>
    Array.from({ length: spec.count }, (_, index) => ({
      x: ((index + 0.5) / spec.count) * 100 + (random() - 0.5) * 3.4,
      height: Math.round(spec.base + random() * spec.spread),
      layer: layer as Layer,
    })),
  )
})()

export default function ForestBar({ progress }: { progress: number }) {
  const value = Math.max(0, Math.min(100, Math.round(progress)))
  return (
    <div className="forest-bar">
      <div className="forest-bar-head">
        <span className="forest-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3 6 13h4l-5 8h14l-5-8h4L12 3Z" />
            <path d="M12 21v-3" />
          </svg>
          BLUE FOREST
        </span>
        <span className="forest-value">{value}%</span>
      </div>
      <div className="forest-track">
        <div className="forest-scene" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}>
          {trees.map((tree, index) => (
            <svg
              key={index}
              className={`tree tree-${tree.layer}`}
              style={{ left: `${tree.x}%`, width: Math.round(tree.height * 0.6), height: tree.height, bottom: LAYER_BOTTOM[tree.layer] }}
              viewBox="0 0 40 60"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path className="tree-crown" d="M20 1 31 25H24L35 47H5L16 25H9Z" />
              <path className="tree-trunk" d="M17 46h6v12h-6z" />
            </svg>
          ))}
        </div>
        <div className="forest-cat" style={{ left: `${Math.max(4, Math.min(96, value))}%` }}>
          <img src={import.meta.env.BASE_URL + "cat.png"} alt="" />
        </div>
      </div>
    </div>
  )
}
