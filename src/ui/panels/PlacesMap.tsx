/** The map of "Places that shaped me": countries I've lived in, the route between them, and favourite haunts. */
import { chapters, haunts } from '../../content/profile.ts'
import { MAP, projectLonLat } from '../../content/europeMap.ts'

export default function PlacesMap({ active, onPick }: { active: string | null; onPick: (id: string) => void }) {
  const points = chapters.map((c) => ({ ...c, xy: projectLonLat(c.lon, c.lat) }))
  const route = points.map((p) => p.xy.map((v) => v.toFixed(1)).join(',')).join(' ')
  return (
    <svg className="places-map" viewBox={`0 0 ${MAP.width} ${MAP.height}`} role="img" aria-label="A map of Europe showing where I've lived: Hungary, northern Italy, Denmark, the Netherlands and the UK.">
      <path d={MAP.land} className="places-map__land" />
      {Object.entries(MAP.countries).map(([code, d]) => (
        <path key={code} d={d} className="places-map__lived" />
      ))}
      <polyline points={route} className="places-map__route" />
      {haunts.map((h) => {
        const [x, y] = projectLonLat(h.lon, h.lat)
        return (
          <g key={h.id} className="places-map__haunt" transform={`translate(${x} ${y})`}>
            <path d="M0 -9 L2.6 -2.8 L9 -2.8 L3.8 1.2 L5.7 7.6 L0 3.8 L-5.7 7.6 L-3.8 1.2 L-9 -2.8 L-2.6 -2.8 Z" />
            <title>{`${h.label}: ${h.note}`}</title>
          </g>
        )
      })}
      {points.map((p, i) => (
        <g
          key={p.id}
          className={`places-map__stop${active === p.id ? ' is-active' : ''}`}
          transform={`translate(${p.xy[0]} ${p.xy[1]})`}
          onClick={() => onPick(p.id)}
        >
          <circle r="11" />
          <text y="4.5" textAnchor="middle">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  )
}
