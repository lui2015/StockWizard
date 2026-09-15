export function Sparkline({
  series,
  width = 280,
  height = 90,
}: {
  series: number[]
  width?: number
  height?: number
}) {
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  const step = width / (series.length - 1)
  const points = series
    .map((v, i) => `${i * step},${height - 8 - ((v - min) / span) * (height - 16)}`)
    .join(' ')
  const up = series[series.length - 1] >= series[0]

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
      {Array.from({ length: 5 }, (_, i) => (
        <line
          key={i}
          x1="0"
          x2={width}
          y1={(i * height) / 4}
          y2={(i * height) / 4}
          stroke="#1A1A1A"
          strokeOpacity="0.12"
          strokeWidth="1"
        />
      ))}
      <polyline
        fill="none"
        stroke={up ? '#C41E3A' : '#2D5A27'}
        strokeWidth="3"
        strokeLinejoin="miter"
        points={points}
      />
    </svg>
  )
}
