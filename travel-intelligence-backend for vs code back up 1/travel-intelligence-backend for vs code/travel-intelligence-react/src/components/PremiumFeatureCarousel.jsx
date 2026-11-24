import { useCallback, useEffect, useMemo } from 'react'
import PremiumFeatureCard from './PremiumFeatureCard'

function ArrowIcon({ direction = 'next' }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={direction === 'next' ? 'm7.22 4.97 4.78 5.03-4.78 5.03' : 'm12.78 4.97-4.78 5.03 4.78 5.03'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PremiumFeatureCarousel({ slides, activeIndex, onChange }) {
  const clampedIndex = useMemo(() => {
    if (!slides.length) return 0
    return Math.min(Math.max(activeIndex, 0), slides.length - 1)
  }, [activeIndex, slides.length])

  const goNext = useCallback(() => {
    onChange((clampedIndex + 1) % slides.length)
  }, [clampedIndex, onChange, slides.length])

  const goPrev = useCallback(() => {
    onChange((clampedIndex - 1 + slides.length) % slides.length)
  }, [clampedIndex, onChange, slides.length])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'ArrowRight') {
        goNext()
      }
      if (event.key === 'ArrowLeft') {
        goPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev])

  return (
    <div className="TripHubPremiumCarousel">
      <button type="button" className="TripHubPremiumCarousel__nav TripHubPremiumCarousel__nav--prev" aria-label="Previous feature" onClick={goPrev}>
        <ArrowIcon direction="prev" />
      </button>

      <div className="TripHubPremiumCarousel__viewport">
        <div className="TripHubPremiumCarousel__track" style={{ transform: `translateX(-${clampedIndex * 100}%)` }}>
          {slides.map((slide) => (
            <div key={slide.title} className="TripHubPremiumCarousel__slide">
              <PremiumFeatureCard
                title={slide.title}
                description={slide.description}
                icon={slide.icon}
                variant="carousel"
              />
            </div>
          ))}
        </div>
      </div>

      <button type="button" className="TripHubPremiumCarousel__nav TripHubPremiumCarousel__nav--next" aria-label="Next feature" onClick={goNext}>
        <ArrowIcon direction="next" />
      </button>

      <div className="TripHubPremiumCarousel__indicators" role="tablist" aria-label="Premium feature slides">
        {slides.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            role="tab"
            aria-selected={clampedIndex === index ? 'true' : 'false'}
            className={`TripHubPremiumCarousel__indicator${clampedIndex === index ? ' is-active' : ''}`}
            onClick={() => onChange(index)}
          >
            <span className="sr-only">{slide.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
