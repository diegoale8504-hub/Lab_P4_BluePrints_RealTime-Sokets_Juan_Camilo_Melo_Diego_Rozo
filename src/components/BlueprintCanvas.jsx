import { useEffect, useRef } from 'react'

export default function BlueprintCanvas({
  points = [],
  width = 650,
  height = 420,
  onAddPoint,
  disabled = false,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear background
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#0a1120'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw blueprint grid lines
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)'
    ctx.lineWidth = 1
    const gridSize = 40

    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Connect blueprint points with blue lines
    if (points && points.length > 1) {
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.stroke()

      // Subtle line glow effect
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)'
      ctx.lineWidth = 8
      ctx.stroke()
    }

    // Draw points as golden node circles
    if (points && points.length > 0) {
      points.forEach((p, index) => {
        // Glowing outer circle
        ctx.fillStyle = index === points.length - 1 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(234, 179, 8, 0.25)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, index === points.length - 1 ? 8 : 6, 0, Math.PI * 2)
        ctx.fill()

        // Inner solid dot
        ctx.fillStyle = index === points.length - 1 ? '#f59e0b' : '#fbbf24'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fill()

        // Point label / sequence index
        ctx.fillStyle = '#94a3b8'
        ctx.font = '10px Inter, sans-serif'
        ctx.fillText(`(${p.x}, ${p.y})`, p.x + 8, p.y - 6)
      })
    }
  }, [points])

  const handleClick = (e) => {
    if (disabled || !onAddPoint || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const scaleX = ref.current.width / rect.width
    const scaleY = ref.current.height / rect.height
    const x = Math.round((e.clientX - rect.left) * scaleX)
    const y = Math.round((e.clientY - rect.top) * scaleY)
    onAddPoint({ x, y })
  }

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 12 }}>
      <canvas
        ref={ref}
        width={width}
        height={height}
        onClick={handleClick}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          background: '#0a1120',
          border: '1px solid #2a3756',
          borderRadius: 12,
          cursor: disabled ? 'not-allowed' : 'crosshair',
        }}
      />
      {disabled && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(11, 15, 23, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '0.95rem',
            fontWeight: 500,
          }}
        >
          Selecciona o carga un plano para interactuar en el Canvas
        </div>
      )}
    </div>
  )
}
