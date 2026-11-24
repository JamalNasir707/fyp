import React from 'react'

/**
 * High-resolution modern SVG weather icons.
 * Maps OpenWeather icon codes (01d, 02n, etc.) or description terms
 * to crisp, beautifully styled vector graphics.
 */
export default function WeatherIcon({ icon, description = '', size = 20, className = '' }) {
  const code = (icon || '').toLowerCase().trim()
  const desc = (description || '').toLowerCase().trim()

  // Determine weather category
  let category = 'cloud'

  if (code.startsWith('01d')) {
    category = 'sun'
  } else if (code.startsWith('01n')) {
    category = 'moon'
  } else if (code.startsWith('02d') || code.startsWith('02n')) {
    category = 'partly-cloudy'
  } else if (code.startsWith('03') || code.startsWith('04')) {
    category = 'cloud'
  } else if (code.startsWith('09') || code.startsWith('10')) {
    category = 'rain'
  } else if (code.startsWith('11')) {
    category = 'thunderstorm'
  } else if (code.startsWith('13')) {
    category = 'snow'
  } else if (code.startsWith('50')) {
    category = 'mist'
  } else {
    // Fallback checks on description text
    if (desc.includes('clear') || desc.includes('sun')) category = 'sun'
    else if (desc.includes('rain') || desc.includes('drizzle')) category = 'rain'
    else if (desc.includes('thunder') || desc.includes('lightning')) category = 'thunderstorm'
    else if (desc.includes('snow') || desc.includes('ice')) category = 'snow'
    else if (desc.includes('cloud')) category = 'partly-cloudy'
  }

  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: `WeatherSvgIcon ${className}`,
    style: { width: size, height: size, flexShrink: 0, verticalAlign: 'middle' },
  }

  switch (category) {
    case 'sun':
      return (
        <svg {...svgProps} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#f59e0b" strokeWidth="2" />
        </svg>
      )

    case 'moon':
      return (
        <svg {...svgProps} viewBox="0 0 24 24">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#a78bfa" stroke="#7c3aed" strokeWidth="1.5" />
        </svg>
      )

    case 'partly-cloudy':
      return (
        <svg {...svgProps} viewBox="0 0 24 24">
          <circle cx="9" cy="9" r="3.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.2" />
          <path d="M6 6l-.8-.8M12 6l.8-.8M4.5 9.5H3.5M6 13l-.8.8" stroke="#f59e0b" strokeWidth="1.5" />
          <path d="M7 17a4 4 0 017.9-1A3.5 3.5 0 0118 19.5 3.5 3.5 0 0114.5 23H7a4 4 0 010-8z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
        </svg>
      )

    case 'rain':
      return (
        <svg {...svgProps} viewBox="0 0 24 24">
          <path d="M4 14.8A5 5 0 018.7 8 6 6 0 0119 11a4.5 4.5 0 01-.5 9H4.5A4.5 4.5 0 014 14.8z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
          <path d="M8 17v3M12 17v3M16 17v3" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )

    case 'thunderstorm':
      return (
        <svg {...svgProps} viewBox="0 0 24 24">
          <path d="M4 14.8A5 5 0 018.7 8 6 6 0 0119 11a4.5 4.5 0 01-.5 9H4.5A4.5 4.5 0 014 14.8z" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
          <path d="M13 15l-3 4h3l-1 4" fill="#facc15" stroke="#eab308" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )

    case 'snow':
      return (
        <svg {...svgProps} viewBox="0 0 24 24">
          <path d="M4 14.8A5 5 0 018.7 8 6 6 0 0119 11a4.5 4.5 0 01-.5 9H4.5A4.5 4.5 0 014 14.8z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
          <circle cx="8" cy="18" r="1" fill="#38bdf8" />
          <circle cx="12" cy="19" r="1" fill="#38bdf8" />
          <circle cx="16" cy="18" r="1" fill="#38bdf8" />
        </svg>
      )

    case 'mist':
      return (
        <svg {...svgProps} viewBox="0 0 24 24">
          <path d="M4 8h16M3 12h18M5 16h14" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )

    case 'cloud':
    default:
      return (
        <svg {...svgProps} viewBox="0 0 24 24">
          <path d="M4 14.8A5 5 0 018.7 8 6 6 0 0119 11a4.5 4.5 0 01-.5 9H4.5A4.5 4.5 0 014 14.8z" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
        </svg>
      )
  }
}
