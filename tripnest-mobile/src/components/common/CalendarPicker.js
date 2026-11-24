import React, { useState, useMemo, useEffect } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import {
  toNormalizedIsoDate,
  addDaysToIso,
  countDaysBetweenIso,
} from '../../utils/tripUtils'

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

/**
 * Pure local ISO date formatter (YYYY-MM-DD) avoiding UTC shifts
 */
function toLocalIso(year, monthIndex, day) {
  const y = String(year)
  const m = String(monthIndex + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIsoParts(isoString) {
  if (!isoString || typeof isoString !== 'string') return null
  const parts = isoString.split('-')
  if (parts.length !== 3) return null
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10) - 1
  const d = parseInt(parts[2], 10)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null
  return { year: y, month: m, day: d }
}

export function CalendarPicker({
  startDate,
  endDate,
  onDateRangeChange,
  minDate = null, // YYYY-MM-DD string or null
  maxDays = 60,
  style,
}) {
  const initialParts = useMemo(() => {
    return parseIsoParts(startDate) || parseIsoParts(minDate) || {
      year: new Date().getFullYear(),
      month: new Date().getMonth(),
      day: new Date().getDate(),
    }
  }, [startDate, minDate])

  const [viewYear, setViewYear] = useState(initialParts.year)
  const [viewMonth, setViewMonth] = useState(initialParts.month)

  useEffect(() => {
    const parts = parseIsoParts(startDate)
    if (parts && (parts.year !== viewYear || parts.month !== viewMonth)) {
      setViewYear(parts.year)
      setViewMonth(parts.month)
    }
  }, [startDate])

  const canGoPrevMonth = useMemo(() => {
    if (!minDate) return true
    const minParts = parseIsoParts(minDate)
    if (!minParts) return true
    if (viewYear < minParts.year) return false
    if (viewYear === minParts.year && viewMonth <= minParts.month) return false
    return true
  }, [minDate, viewYear, viewMonth])

  function handlePrevMonth() {
    if (!canGoPrevMonth) return
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  // Calculate days in month
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay()
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const cells = []
    // Leading blank slots from previous month
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ type: 'empty', key: `empty-${i}` })
    }

    // Days in current month
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const iso = toLocalIso(viewYear, viewMonth, day)
      cells.push({
        type: 'day',
        day,
        iso,
        key: `day-${iso}`,
      })
    }

    return cells
  }, [viewYear, viewMonth])

  function handleDayPress(iso) {
    if (minDate && iso < minDate) {
      return // Disabled past date
    }

    if (!startDate || (startDate && endDate)) {
      // Start a new range selection
      onDateRangeChange({ startDate: iso, endDate: null })
    } else if (startDate && !endDate) {
      if (iso < startDate) {
        // Tapped an earlier date: make it the new start date
        onDateRangeChange({ startDate: iso, endDate: null })
      } else {
        // Tapped on or after start date: complete the range
        onDateRangeChange({ startDate, endDate: iso })
      }
    }
  }

  const normalizedStart = toNormalizedIsoDate(startDate)
  const normalizedEnd = toNormalizedIsoDate(endDate)

  return (
    <View style={[styles.container, style]}>
      {/* Month & Year Navigation Header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={[styles.navBtn, !canGoPrevMonth && { opacity: 0.3 }]}
          onPress={canGoPrevMonth ? handlePrevMonth : undefined}
          disabled={!canGoPrevMonth}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={20} color={canGoPrevMonth ? colors.textPrimary : '#CBD5E1'} />
        </TouchableOpacity>

        <Text style={styles.navTitle}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>

        <TouchableOpacity
          style={styles.navBtn}
          onPress={handleNextMonth}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Weekday Header Row */}
      <View style={styles.weekDaysRow}>
        {DAYS_OF_WEEK.map((d, idx) => (
          <Text key={idx} style={styles.weekDayText}>
            {d}
          </Text>
        ))}
      </View>

      {/* Days Grid */}
      <View style={styles.grid}>
        {calendarGrid.map((cell) => {
          if (cell.type === 'empty') {
            return <View key={cell.key} style={styles.dayCellEmpty} />
          }

          const iso = cell.iso
          const isPast = minDate ? iso < minDate : false
          const isStart = iso === normalizedStart
          const isEnd = iso === normalizedEnd
          const isInRange =
            normalizedStart &&
            normalizedEnd &&
            iso > normalizedStart &&
            iso < normalizedEnd
          const isSingleDayRange = isStart && isEnd

          let cellStyle = styles.dayCell
          let textStyle = styles.dayText

          if (isPast) {
            textStyle = styles.dayTextDisabled
          } else if (isStart || isEnd) {
            cellStyle = styles.dayCellSelected
            textStyle = styles.dayTextSelected
          } else if (isInRange) {
            cellStyle = styles.dayCellInRange
            textStyle = styles.dayTextInRange
          }

          return (
            <TouchableOpacity
              key={cell.key}
              style={[styles.dayCellWrapper]}
              onPress={() => !isPast && handleDayPress(iso)}
              disabled={isPast}
              activeOpacity={0.7}
            >
              {/* Range background stripe for middle days */}
              {isInRange && <View style={styles.rangeStripe} />}
              {isStart && normalizedEnd && !isSingleDayRange && (
                <View style={styles.rangeStripeRight} />
              )}
              {isEnd && normalizedStart && !isSingleDayRange && (
                <View style={styles.rangeStripeLeft} />
              )}

              <View style={cellStyle}>
                <Text style={textStyle}>{cell.day}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Bottom Range Legend / Hint */}
      <View style={styles.footerRow}>
        {normalizedStart && normalizedEnd ? (
          <View style={styles.summaryBadge}>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={styles.summaryText}>
              {countDaysBetweenIso(normalizedStart, normalizedEnd)} Days Selected: {normalizedStart} to {normalizedEnd}
            </Text>
          </View>
        ) : normalizedStart ? (
          <Text style={styles.hintText}>
            Tap your trip's end date to finish selecting dates.
          </Text>
        ) : (
          <Text style={styles.hintText}>
            Tap a date to choose when your journey begins.
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: 6,
  },
  weekDayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellWrapper: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 2,
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    height: 42,
  },
  rangeStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 4,
    bottom: 4,
    backgroundColor: 'rgba(15, 118, 110, 0.12)', // brand primary subtle fill
  },
  rangeStripeRight: {
    position: 'absolute',
    left: '50%',
    right: 0,
    top: 4,
    bottom: 4,
    backgroundColor: 'rgba(15, 118, 110, 0.12)',
  },
  rangeStripeLeft: {
    position: 'absolute',
    left: 0,
    right: '50%',
    top: 4,
    bottom: 4,
    backgroundColor: 'rgba(15, 118, 110, 0.12)',
  },
  dayCell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dayCellInRange: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dayTextSelected: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textWhite,
  },
  dayTextInRange: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  dayTextDisabled: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textTertiary,
    opacity: 0.4,
  },
  footerRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    alignItems: 'center',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  hintText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
})

