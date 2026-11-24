import React from 'react'

/**
 * Universal Card Header / Badge Component
 */
function CardHeaderBadges({ category, priceLevel, rating, reviewCount, distance, badges = [] }) {
  return (
    <div className="AiCardBadges">
      {category && <span className="AiCardBadge AiCardBadge--category">{category}</span>}
      {priceLevel && <span className="AiCardBadge AiCardBadge--price">{priceLevel}</span>}
      {rating && (
        <span className="AiCardBadge AiCardBadge--rating">
          ⭐ {rating} {reviewCount ? `(${reviewCount.toLocaleString()})` : ''}
        </span>
      )}
      {distance && <span className="AiCardBadge AiCardBadge--distance">📍 {distance}</span>}
      {badges.map((b, idx) => (
        <span key={idx} className="AiCardBadge AiCardBadge--tag">
          {b}
        </span>
      ))}
    </div>
  )
}

/**
 * Universal Action Buttons Component
 */
function CardActionButtons({ actions = [] }) {
  if (!actions || actions.length === 0) return null

  return (
    <div className="AiCardActions">
      {actions.map((act, idx) => (
        <button
          key={idx}
          type="button"
          className={`AiCardActionBtn${act.variant === 'primary' ? ' AiCardActionBtn--primary' : ''}`}
          onClick={() => {
            if (act.url) {
              window.open(act.url, '_blank', 'noopener,noreferrer')
            } else if (act.onClick) {
              act.onClick()
            }
          }}
        >
          {act.label}
        </button>
      ))}
    </div>
  )
}

/**
 * 1. Restaurant Card Renderer
 */
export function RestaurantCard({ cardData }) {
  if (!cardData) return null
  const { title, subtitle, description, category, priceLevel, rating, reviewCount, distance, badges, thumbnail, actions } = cardData

  return (
    <div className="AiTravelCardContainer AiTravelCardContainer--restaurant">
      {thumbnail && (
        <div className="AiTravelCard__thumb">
          <img src={thumbnail} alt={title} />
        </div>
      )}
      <div className="AiTravelCard__content">
        <CardHeaderBadges
          category={category || 'Restaurant'}
          priceLevel={priceLevel}
          rating={rating}
          reviewCount={reviewCount}
          distance={distance}
          badges={badges}
        />
        <h4 className="AiTravelCard__title">{title}</h4>
        {subtitle && <p className="AiTravelCard__subtitle">{subtitle}</p>}
        {description && <p className="AiTravelCard__desc">{description}</p>}
        <CardActionButtons actions={actions || [
          { label: 'View Details', variant: 'primary' },
          { label: 'Open Maps', variant: 'secondary' }
        ]} />
      </div>
    </div>
  )
}

/**
 * 2. Place / Attraction Card Renderer
 */
export function PlaceCard({ cardData }) {
  if (!cardData) return null
  const { title, subtitle, description, category, rating, reviewCount, distance, badges, thumbnail, actions } = cardData

  return (
    <div className="AiTravelCardContainer AiTravelCardContainer--place">
      {thumbnail && (
        <div className="AiTravelCard__thumb">
          <img src={thumbnail} alt={title} />
        </div>
      )}
      <div className="AiTravelCard__content">
        <CardHeaderBadges
          category={category || 'Attraction'}
          rating={rating}
          reviewCount={reviewCount}
          distance={distance}
          badges={badges}
        />
        <h4 className="AiTravelCard__title">{title}</h4>
        {subtitle && <p className="AiTravelCard__subtitle">{subtitle}</p>}
        {description && <p className="AiTravelCard__desc">{description}</p>}
        <CardActionButtons actions={actions || [
          { label: 'Explore Place', variant: 'primary' },
          { label: 'View on Map', variant: 'secondary' }
        ]} />
      </div>
    </div>
  )
}

/**
 * 3. Hotel / Stay Card Renderer
 */
export function HotelCard({ cardData }) {
  if (!cardData) return null
  const { title, subtitle, description, category, priceLevel, rating, reviewCount, distance, badges, thumbnail, actions } = cardData

  return (
    <div className="AiTravelCardContainer AiTravelCardContainer--hotel">
      {thumbnail && (
        <div className="AiTravelCard__thumb">
          <img src={thumbnail} alt={title} />
        </div>
      )}
      <div className="AiTravelCard__content">
        <CardHeaderBadges
          category={category || 'Hotel & Stay'}
          priceLevel={priceLevel}
          rating={rating}
          reviewCount={reviewCount}
          distance={distance}
          badges={badges}
        />
        <h4 className="AiTravelCard__title">{title}</h4>
        {subtitle && <p className="AiTravelCard__subtitle">{subtitle}</p>}
        {description && <p className="AiTravelCard__desc">{description}</p>}
        <CardActionButtons actions={actions || [
          { label: 'View Rooms', variant: 'primary' },
          { label: 'Directions', variant: 'secondary' }
        ]} />
      </div>
    </div>
  )
}

/**
 * 4. Budget Breakdown Card Renderer
 */
export function BudgetCard({ cardData }) {
  if (!cardData) return null
  const { title, subtitle, totalBudget, currency = '$', items = [], actions } = cardData

  return (
    <div className="AiTravelCardContainer AiTravelCardContainer--budget">
      <div className="AiTravelCard__content">
        <div className="AiCardBadges">
          <span className="AiCardBadge AiCardBadge--category">💰 Travel Budget</span>
        </div>
        <h4 className="AiTravelCard__title">{title || 'Budget Estimate'}</h4>
        {subtitle && <p className="AiTravelCard__subtitle">{subtitle}</p>}

        {totalBudget && (
          <div className="AiBudgetTotal">
            <span className="AiBudgetTotal__label">Estimated Total:</span>
            <span className="AiBudgetTotal__value">{currency}{totalBudget}</span>
          </div>
        )}

        {Array.isArray(items) && items.length > 0 && (
          <div className="AiBudgetList">
            {items.map((item, idx) => (
              <div key={idx} className="AiBudgetItem">
                <span className="AiBudgetItem__name">{item.name || item.label}</span>
                <span className="AiBudgetItem__cost">{currency}{item.cost || item.amount}</span>
              </div>
            ))}
          </div>
        )}

        <CardActionButtons actions={actions} />
      </div>
    </div>
  )
}

/**
 * 5. Packing / Travel Checklist Card Renderer
 */
export function ChecklistCard({ cardData }) {
  if (!cardData) return null
  const { title, subtitle, items = [], actions } = cardData

  return (
    <div className="AiTravelCardContainer AiTravelCardContainer--checklist">
      <div className="AiTravelCard__content">
        <div className="AiCardBadges">
          <span className="AiCardBadge AiCardBadge--category">📦 Checklist</span>
        </div>
        <h4 className="AiTravelCard__title">{title || 'Travel Checklist'}</h4>
        {subtitle && <p className="AiTravelCard__subtitle">{subtitle}</p>}

        {Array.isArray(items) && items.length > 0 && (
          <div className="AiChecklistItems">
            {items.map((item, idx) => {
              const label = typeof item === 'string' ? item : item.label
              const isChecked = typeof item === 'object' && item.checked
              return (
                <div key={idx} className={`AiChecklistItem${isChecked ? ' AiChecklistItem--checked' : ''}`}>
                  <span className="AiChecklistItem__icon">{isChecked ? '✓' : '•'}</span>
                  <span className="AiChecklistItem__text">{label}</span>
                </div>
              )
            })}
          </div>
        )}

        <CardActionButtons actions={actions} />
      </div>
    </div>
  )
}

/**
 * 6. Information / Alert Card Renderer
 */
export function InfoCard({ cardData }) {
  if (!cardData) return null
  const { title, subtitle, description, category, badges, actions } = cardData

  return (
    <div className="AiTravelCardContainer AiTravelCardContainer--info">
      <div className="AiTravelCard__content">
        <CardHeaderBadges category={category || 'Travel Tip'} badges={badges} />
        <h4 className="AiTravelCard__title">{title}</h4>
        {subtitle && <p className="AiTravelCard__subtitle">{subtitle}</p>}
        {description && <p className="AiTravelCard__desc">{description}</p>}
        <CardActionButtons actions={actions} />
      </div>
    </div>
  )
}

/**
 * Dispatcher Component for Rich Travel Cards
 */
export default function TravelCardSwitch({ type, cardData }) {
  if (!cardData) return null

  switch (type) {
    case 'RESTAURANT_CARD':
      return <RestaurantCard cardData={cardData} />
    case 'HOTEL_CARD':
      return <HotelCard cardData={cardData} />
    case 'PLACE_CARD':
      return <PlaceCard cardData={cardData} />
    case 'BUDGET_CARD':
      return <BudgetCard cardData={cardData} />
    case 'CHECKLIST_CARD':
      return <ChecklistCard cardData={cardData} />
    case 'INFO_CARD':
      return <InfoCard cardData={cardData} />
    default:
      return <PlaceCard cardData={cardData} />
  }
}
