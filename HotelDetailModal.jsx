import { useState, useEffect } from 'react'

const FALLBACK_HOTEL_IMG = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80'

export default function HotelDetailModal({ hotel, searchContext, onClose }) {
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)
  const [imageErrors, setImageErrors] = useState({})

  // Assemble unique photo list from hotel data
  const photos = Array.isArray(hotel?.photos) && hotel.photos.length > 0
    ? hotel.photos
    : hotel?.thumbnail_url
    ? [hotel.thumbnail_url]
    : [FALLBACK_HOTEL_IMG]

  // Close on Escape key press and prevent background scroll
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [onClose])

  if (!hotel) return null

  function handleImageError(idx) {
    setImageErrors((prev) => ({ ...prev, [idx]: true }))
  }

  function handlePrevPhoto() {
    setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1))
  }

  function handleNextPhoto() {
    setActivePhotoIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0))
  }

  const currentPhotoSrc = imageErrors[activePhotoIdx] ? FALLBACK_HOTEL_IMG : photos[activePhotoIdx]
  const hasMultiplePhotos = photos.length > 1
  const mapUrl = hotel.lat && hotel.lon
    ? `https://www.google.com/maps/search/?api=1&query=${hotel.lat},${hotel.lon}`
    : null

  const offers = Array.isArray(hotel.provider_offers) ? hotel.provider_offers : []

  return (
    <div
      className="TripNest-HotelsModalBackdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hotel-modal-title"
    >
      <div
        className="TripNest-HotelsModalDialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Close Button */}
        <button
          type="button"
          className="TripNest-HotelsModalCloseBtn"
          onClick={onClose}
          aria-label="Close hotel details"
        >
          ✕
        </button>

        {/* Modal Scrollable Container */}
        <div className="TripNest-HotelsModalBody">
          {/* Header Section */}
          <div className="TripNest-HotelsModalHeader">
            <div className="TripNest-HotelsModalHeaderMeta">
              {hotel.is_mock_data ? (
                <span className="TripNest-HotelsMockTag" style={{ position: 'static' }}>
                  Test Data
                </span>
              ) : hotel.star_rating > 0 ? (
                <span className="TripNest-HotelsLiveTag" style={{ position: 'static' }}>
                  {Math.round(hotel.star_rating)}★ Hotel
                </span>
              ) : null}

              {hotel.user_rating > 0 && (
                <div className="TripNest-HotelsRatingRow" style={{ margin: 0 }}>
                  <span className="TripNest-HotelsScoreBadge">★ {hotel.user_rating.toFixed(1)}</span>
                  <span className="TripNest-HotelsReviewCount">
                    ({hotel.reviews_count?.toLocaleString() || 0} Google reviews)
                  </span>
                </div>
              )}
            </div>

            <h2 id="hotel-modal-title" className="TripNest-HotelsModalTitle">
              {hotel.name}
            </h2>

            <p className="TripNest-HotelsModalAddress">
              📍 {hotel.location_address || `${hotel.destination}, Pakistan`}
            </p>
          </div>

          {/* Photo Gallery Section */}
          <div className="TripNest-HotelsGallery">
            <div className="TripNest-HotelsMainPhotoWrap">
              <img
                src={currentPhotoSrc}
                alt={`${hotel.name} photo ${activePhotoIdx + 1}`}
                className="TripNest-HotelsMainPhoto"
                onError={() => handleImageError(activePhotoIdx)}
              />

              {hasMultiplePhotos && (
                <>
                  <button
                    type="button"
                    className="TripNest-HotelsGalleryNavBtn TripNest-HotelsGalleryNavBtn--prev"
                    onClick={handlePrevPhoto}
                    aria-label="Previous photo"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="TripNest-HotelsGalleryNavBtn TripNest-HotelsGalleryNavBtn--next"
                    onClick={handleNextPhoto}
                    aria-label="Next photo"
                  >
                    ›
                  </button>
                  <span className="TripNest-HotelsPhotoBadge">
                    {activePhotoIdx + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            {hasMultiplePhotos && (
              <div className="TripNest-HotelsThumbStrip" role="tablist" aria-label="Photo thumbnails">
                {photos.map((photoUrl, idx) => {
                  const thumbSrc = imageErrors[idx] ? FALLBACK_HOTEL_IMG : photoUrl
                  const isActive = idx === activePhotoIdx
                  return (
                    <button
                      key={photoUrl + idx}
                      type="button"
                      className={`TripNest-HotelsThumbBtn ${isActive ? 'TripNest-HotelsThumbBtn--active' : ''}`}
                      onClick={() => setActivePhotoIdx(idx)}
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`View photo ${idx + 1}`}
                    >
                      <img
                        src={thumbSrc}
                        alt=""
                        className="TripNest-HotelsThumbImg"
                        onError={() => handleImageError(idx)}
                        loading="lazy"
                      />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Details Grid (Property Info & Booking Panel) */}
          <div className="TripNest-HotelsModalGrid">
            {/* Left Column: Property Info & Amenities */}
            <div className="TripNest-HotelsModalLeftCol">
              {/* Overview */}
              <div className="TripNest-HotelsDetailSection">
                <h3 className="TripNest-HotelsSectionTitle">About this property</h3>
                <p className="TripNest-HotelsDescription">
                  {hotel.location_address || `Accommodation property located in ${hotel.destination}, Pakistan.`}
                </p>

                {/* Location & Map Action */}
                {mapUrl && (
                  <div className="TripNest-HotelsLocationBox">
                    <span style={{ fontSize: '18px' }}>🗺️</span>
                    <div>
                      <strong>Coordinates:</strong> {hotel.lat?.toFixed(4)}° N, {hotel.lon?.toFixed(4)}° E
                    </div>
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="TripNest-HotelsMapLink"
                    >
                      View on Google Maps ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Amenities */}
              <div className="TripNest-HotelsDetailSection">
                <h3 className="TripNest-HotelsSectionTitle">Amenities & Features</h3>
                {Array.isArray(hotel.amenities) && hotel.amenities.length > 0 ? (
                  <div className="TripNest-HotelsModalAmenitiesGrid">
                    {hotel.amenities.map((amenity) => (
                      <div key={amenity} className="TripNest-HotelsModalAmenityItem">
                        <span className="TripNest-HotelsAmenityCheck">✓</span>
                        <span>{amenity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                    Standard guest amenities available upon request.
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Pricing & Booking Providers */}
            <div className="TripNest-HotelsModalRightCol">
              <div className="TripNest-HotelsBookingCard">
                {/* Stay Parameters Header */}
                <div className="TripNest-HotelsStayParamsBox">
                  <div className="TripNest-HotelsStayDates">
                    <span className="TripNest-HotelsStayDatesLabel">STAY DATES:</span>
                    <span className="TripNest-HotelsStayDatesValue">
                      {searchContext?.check_in_date || 'Selected date'} → {searchContext?.check_out_date || 'Check out'}
                    </span>
                  </div>
                  <div className="TripNest-HotelsStayGuests">
                    <span>
                      {searchContext?.nights || 1} night{searchContext?.nights > 1 ? 's' : ''} •{' '}
                      {searchContext?.adults || 2} guest{searchContext?.adults > 1 ? 's' : ''} •{' '}
                      {searchContext?.rooms || 1} room{searchContext?.rooms > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Price Summary */}
                <div className="TripNest-HotelsModalPricingRow">
                  <div>
                    <span className="TripNest-HotelsPriceLabel">Best Rate Available</span>
                    {hotel.price_per_night > 0 ? (
                      <div className="TripNest-HotelsModalPriceValue">
                        {hotel.currency || 'PKR'} {hotel.price_per_night.toLocaleString()}
                        <span className="TripNest-HotelsModalPricePerNight"> / night</span>
                      </div>
                    ) : (
                      <div className="TripNest-HotelsModalPriceValue" style={{ fontSize: '20px' }}>
                        Check Rates
                      </div>
                    )}
                  </div>

                  {hotel.total_price > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <span className="TripNest-HotelsPriceLabel">Total Stay</span>
                      <div className="TripNest-HotelsModalTotalValue">
                        {hotel.currency || 'PKR'} {hotel.total_price.toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Provider Offers List */}
                <div className="TripNest-HotelsOffersSection">
                  <h4 className="TripNest-HotelsOffersTitle">Booking Provider Offers</h4>
                  {offers.length > 0 ? (
                    <div className="TripNest-HotelsOffersTable">
                      {offers.map((offer, idx) => (
                        <div key={offer.provider_name + idx} className="TripNest-HotelsOfferRow">
                          <div className="TripNest-HotelsOfferProviderInfo">
                            <span className="TripNest-HotelsOfferProviderName">{offer.provider_name}</span>
                            {offer.is_best_deal && (
                              <span className="TripNest-HotelsBestDealBadge">Best Deal</span>
                            )}
                          </div>

                          <div className="TripNest-HotelsOfferAction">
                            {offer.price_per_night > 0 && (
                              <span className="TripNest-HotelsOfferPrice">
                                {offer.currency || 'PKR'} {offer.price_per_night.toLocaleString()}
                                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}> / night</span>
                              </span>
                            )}
                            <a
                              href={offer.booking_url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="TripNest-HotelsOfferButton"
                            >
                              {hotel.is_mock_data ? 'View Mock Deal ↗' : 'View Deal ↗'}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#64748b' }}>
                      Direct partner booking rates unavailable for these dates. Contact property directly.
                    </div>
                  )}
                </div>

                {/* External Booking Notice */}
                <div className="TripNest-HotelsBookingDisclaimer">
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>ℹ️</span>
                  <span>
                    Reservations are completed directly on the external partner's website. TripNest does not collect booking fees or store payment details.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

