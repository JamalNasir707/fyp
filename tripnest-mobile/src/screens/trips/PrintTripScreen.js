import React, { useState, useMemo } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { colors } from '../../theme/colors'
import { useApp } from '../../context/AppContext'
import { formatTripDateRange, formatTime12h, getDayColor } from '../../utils/tripUtils'
import Card from '../../components/common/Card'

export function PrintTripScreen({ navigation, route }) {
  const { activeTrip, savedTrips } = useApp()
  const paramTripId = route?.params?.trip?.id || route?.params?.trip?.tripId || route?.params?.tripId
  const currentSavedTrip = Array.isArray(savedTrips) && paramTripId
    ? savedTrips.find((t) => String(t.id || t.tripId) === String(paramTripId))
    : null
  const trip = currentSavedTrip || route?.params?.trip || activeTrip

  // View Mode: 'preview' (native UI cards) | 'html_doc' (WebView printable document)
  const [viewMode, setViewMode] = useState('preview')
  const [isPrinting, setIsPrinting] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [exportModalVisible, setExportModalVisible] = useState(false)

  function getDayItems(day) {
    if (!day) return []
    if (Array.isArray(day.items) && day.items.length > 0) return day.items
    if (Array.isArray(day.places) && day.places.length > 0) return day.places
    if (Array.isArray(day.stops) && day.stops.length > 0) return day.stops
    return Array.isArray(day.items) ? day.items : []
  }

  function getItemTiming(item, idx) {
    if (item?.startTime) {
      const start = formatTime12h(item.startTime)
      if (item?.endTime) {
        return `${start} – ${formatTime12h(item.endTime)}`
      }
      return start
    }
    const defaultSlots = ['09:30 AM', '11:30 AM', '02:00 PM', '04:30 PM', '07:00 PM', '08:30 PM']
    return defaultSlots[idx % defaultSlots.length]
  }

  function getItemLocation(item, tripDestination) {
    return item?.address || item?.subtitle || item?.location || (tripDestination ? `Central ${tripDestination}, Pakistan` : 'Pakistan')
  }

  function getItemCategory(item) {
    return item?.category || item?.tag || 'Attraction'
  }

  function handleGoBack() {
    if (navigation.canGoBack()) {
      navigation.goBack()
    } else {
      navigation.navigate('MainTabs', { screen: 'TripsTab' })
    }
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Print / Export</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>No trip selected for printing.</Text>
        </View>
      </SafeAreaView>
    )
  }

  const days = Array.isArray(trip.days) ? trip.days : []
  const title = trip.title || trip.name || trip.destination || 'My Trip'
  const dates = trip.dates || formatTripDateRange(trip.startDate, trip.endDate)
  const destination = trip.destination || title
  const totalStops = days.reduce((sum, d) => sum + getDayItems(d).length, 0)
  const totalDays = days.length || (trip.days ? trip.days.length : 1)
  const printDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Plain-text itinerary for messaging export
  const textSummary = useMemo(() => {
    let out = `🗺️ ${title.toUpperCase()} — OFFICIAL ITINERARY\n`
    if (destination) out += `📍 Destination: ${destination}, Pakistan\n`
    if (dates) out += `📅 Travel Dates: ${dates} (${totalDays} Days)\n`
    out += `📊 Planned Stops: ${totalStops} Attractions\n`
    out += `────────────────────────────────────────\n\n`

    days.forEach((day, dIdx) => {
      out += `📌 ${(day.label || `Day ${dIdx + 1}`).toUpperCase()}\n`
      const items = getDayItems(day).filter((item) => item.type !== 'note' && item.type !== 'checklist')
      if (items.length === 0) {
        out += `   (No stops scheduled)\n`
      } else {
        items.forEach((item, sIdx) => {
          const timing = getItemTiming(item, sIdx)
          const loc = getItemLocation(item, destination)
          out += `   ${sIdx + 1}. ${item.title || item.name} [⏰ ${timing}]\n`
          out += `      📍 Location: ${loc}\n`
          if (item.category) out += `      🏷️ Category: ${item.category}\n`
          if (item.note || item.description) out += `      📝 Note: ${item.note || item.description}\n`
        })
      }
      out += `\n`
    })

    out += `────────────────────────────────────────\n`
    out += `🚨 Emergency Services in Pakistan:\n`
    out += `• Police Emergency: 15 | Rescue: 1122 | Tourist Police: 1421\n`
    out += `\nGenerated via TripNest Mobile Travel Intelligence.`
    return out
  }, [trip, title, dates, days, destination, totalStops, totalDays])

  // Ultra-Professional Printable HTML Document
  const printableHtml = useMemo(() => {
    const daysHtml = days
      .map((day, dIdx) => {
        const items = getDayItems(day)
        const dayColor = day.color || getDayColor(dIdx)

        const stopsHtml = items.length
          ? items
              .map((item, sIdx) => {
                const isNote = item.type === 'note'
                const isChecklist = item.type === 'checklist'
                const stopTitle = isNote ? item.title || 'Note' : isChecklist ? item.title || 'Checklist' : item.title || item.name || 'Stop'
                const desc = item.note || item.description || item.subtitle || item.content || (item.items ? item.items.map((r) => r.text).join(' • ') : '')
                const timing = getItemTiming(item, sIdx)
                const loc = getItemLocation(item, destination)
                const cat = getItemCategory(item)

                return `
              <div class="stop-card">
                <div class="stop-marker-col">
                  <div class="stop-marker" style="background-color: ${dayColor};">${sIdx + 1}</div>
                  ${sIdx < items.length - 1 ? '<div class="timeline-line"></div>' : ''}
                </div>
                <div class="stop-body">
                  <div class="stop-header-row">
                    <h4 class="stop-title">${stopTitle}</h4>
                    <div class="time-badge">⏰ ${timing}</div>
                  </div>
                  <div class="stop-meta-row">
                    <span class="cat-pill">${cat}</span>
                    <span class="loc-tag">📍 ${loc}</span>
                  </div>
                  ${desc ? `<p class="stop-desc">${desc}</p>` : ''}
                </div>
              </div>`
              })
              .join('')
          : `<div class="empty-day-box"><p>No stops scheduled for this day.</p></div>`

        return `
        <section class="day-section">
          <div class="day-header-bar" style="border-left-color: ${dayColor};">
            <div class="day-header-left">
              <span class="day-badge" style="background-color: ${dayColor};">DAY ${dIdx + 1}</span>
              <h3 class="day-label">${day.label || `Day ${dIdx + 1}`}</h3>
            </div>
            <div class="day-header-right">
              <span class="stops-count-pill">${items.length} ${items.length === 1 ? 'Stop' : 'Stops'} Planned</span>
            </div>
          </div>
          <div class="day-timeline">${stopsHtml}</div>
        </section>`
      })
      .join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — TripNest Travel Itinerary</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 32px;
      color: #0F172A;
      background: #FFFFFF;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    
    /* BRAND HEADER */
    .brand-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 2px solid #E2E8F0;
      margin-bottom: 20px;
    }
    .brand-logo-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-logo-text {
      font-size: 16px;
      font-weight: 800;
      color: #0E442B;
      letter-spacing: 0.5px;
    }
    .brand-doc-type {
      font-size: 11px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 1px;
      background: #F1F5F9;
      padding: 4px 10px;
      border-radius: 6px;
    }

    /* HERO TRIP HEADER */
    .hero-banner {
      background: linear-gradient(135deg, #0E442B 0%, #166534 100%);
      color: #FFFFFF;
      padding: 24px;
      border-radius: 14px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(14, 68, 43, 0.15);
    }
    .hero-dest-pill {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      color: #ECFDF5;
      font-size: 12px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .hero-title {
      font-size: 26px;
      font-weight: 800;
      margin: 0 0 6px 0;
      line-height: 1.2;
    }
    .hero-dates {
      font-size: 14px;
      color: #D1FAE5;
      font-weight: 500;
      margin-bottom: 16px;
    }
    .hero-stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      padding-top: 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }
    .stat-box {
      font-size: 11px;
      color: #A7F3D0;
    }
    .stat-box strong {
      display: block;
      font-size: 14px;
      color: #FFFFFF;
      font-weight: 700;
      margin-top: 2px;
    }

    /* DAY SECTIONS */
    .day-section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }
    .day-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #F8FAFC;
      border-left: 5px solid #0E442B;
      padding: 10px 16px;
      border-radius: 0 10px 10px 0;
      margin-bottom: 16px;
      border-top: 1px solid #F1F5F9;
      border-right: 1px solid #F1F5F9;
      border-bottom: 1px solid #F1F5F9;
    }
    .day-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .day-badge {
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .day-label {
      font-size: 16px;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
    }
    .stops-count-pill {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      background: #E2E8F0;
      padding: 3px 10px;
      border-radius: 12px;
    }

    /* TIMELINE & STOPS */
    .day-timeline {
      padding-left: 8px;
    }
    .stop-card {
      display: flex;
      align-items: flex-start;
      margin-bottom: 16px;
      position: relative;
    }
    .stop-marker-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-right: 14px;
      flex-shrink: 0;
      width: 26px;
    }
    .stop-marker {
      width: 26px;
      height: 26px;
      border-radius: 13px;
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .timeline-line {
      width: 2px;
      flex: 1;
      min-height: 40px;
      background: #E2E8F0;
      margin-top: 4px;
      margin-bottom: -10px;
    }
    .stop-body {
      flex: 1;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 12px 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .stop-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 4px;
    }
    .stop-title {
      font-size: 15px;
      font-weight: 700;
      color: #0F172A;
      margin: 0;
      line-height: 1.3;
    }
    .time-badge {
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
      font-size: 12px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .stop-meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .cat-pill {
      font-size: 11px;
      font-weight: 700;
      color: #0E442B;
      background: #F0FDF4;
      padding: 1px 7px;
      border-radius: 4px;
    }
    .loc-tag {
      font-size: 12px;
      color: #475569;
      font-weight: 500;
    }
    .stop-desc {
      font-size: 12px;
      color: #334155;
      margin: 4px 0 0 0;
      line-height: 1.45;
    }
    .empty-day-box {
      padding: 16px;
      background: #F8FAFC;
      border: 1px dashed #CBD5E1;
      border-radius: 8px;
      text-align: center;
      color: #94A3B8;
      font-style: italic;
      font-size: 13px;
    }

    /* EMERGENCY BOX */
    .emergency-box {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 12px;
      padding: 16px;
      margin-top: 32px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .emergency-title {
      font-size: 13px;
      font-weight: 800;
      color: #92400E;
      margin: 0 0 8px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .emergency-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      font-size: 12px;
      color: #78350F;
    }
    .emergency-item strong {
      display: block;
      font-size: 13px;
      color: #B45309;
    }

    /* FOOTER */
    .doc-footer {
      border-top: 1.5px solid #E2E8F0;
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #94A3B8;
      margin-top: 24px;
    }

    /* PRINT SPECIFIC ADJUSTMENTS */
    @media print {
      body {
        padding: 0;
        font-size: 12pt;
      }
      .hero-banner {
        box-shadow: none;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .day-section {
        page-break-inside: avoid;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- BRAND HEADER -->
  <div class="brand-top">
    <div class="brand-logo-row">
      <span style="font-size: 20px;">🧭</span>
      <span class="brand-logo-text">TripNest</span>
      <span style="color: #94A3B8; font-size: 12px;">| Travel Intelligence</span>
    </div>
    <div class="brand-doc-type">Official Travel Itinerary</div>
  </div>

  <!-- HERO SECTION -->
  <div class="hero-banner">
    <div class="hero-dest-pill">📍 ${destination}, Pakistan</div>
    <h1 class="hero-title">${title}</h1>
    <div class="hero-dates">📅 ${dates || 'Scheduled Itinerary'}</div>

    <div class="hero-stats-grid">
      <div class="stat-box">
        DURATION
        <strong>${totalDays} ${totalDays === 1 ? 'Day' : 'Days'}</strong>
      </div>
      <div class="stat-box">
        TOTAL STOPS
        <strong>${totalStops} Planned Spots</strong>
      </div>
      <div class="stat-box">
        TRAVEL STYLE
        <strong>${trip.budgetLevel || 'Moderate'} • ${trip.travelCompanion || 'Personal'}</strong>
      </div>
      <div class="stat-box">
        ISSUED ON
        <strong>${printDateStr.split(',')[1] || printDateStr}</strong>
      </div>
    </div>
  </div>

  <!-- DAYS TIMELINE -->
  ${daysHtml}

  <!-- EMERGENCY HELP & TRAVEL TIPS -->
  <div class="emergency-box">
    <div class="emergency-title">⚠️ Essential Pakistan Travel Assistance & Helplines</div>
    <div class="emergency-grid">
      <div class="emergency-item">
        POLICE EMERGENCY
        <strong>15 (Toll Free)</strong>
      </div>
      <div class="emergency-item">
        MEDICAL RESCUE
        <strong>1122</strong>
      </div>
      <div class="emergency-item">
        TOURISM HELPLINE
        <strong>1421 (PTDC)</strong>
      </div>
      <div class="emergency-item">
        EDHI AMBULANCE
        <strong>115</strong>
      </div>
    </div>
  </div>

  <!-- DOCUMENT FOOTER -->
  <div class="doc-footer">
    <div>Generated & verified via <strong>TripNest Mobile</strong> • Pakistan Tourism Hub</div>
    <div>Document Date: ${printDateStr}</div>
  </div>
</body>
</html>`
  }, [trip, title, dates, days, destination, totalStops, totalDays, printDateStr])

  // 1. AirPrint / System Print Dialog (Official iOS AirPrint)
  async function handleDirectPrint() {
    try {
      setIsPrinting(true)
      await Print.printAsync({
        html: printableHtml,
      })
    } catch (err) {
      if (err?.message && !err.message.includes('dismissed') && !err.message.includes('cancel')) {
        Alert.alert('Printing Note', 'Could not open printer dialog: ' + err.message)
      }
    } finally {
      setIsPrinting(false)
    }
  }

  // 2. Export as PDF File & Share via Native Sheet
  async function handleExportPdf() {
    try {
      setIsExportingPdf(true)
      const { uri } = await Print.printToFileAsync({
        html: printableHtml,
      })
      if (uri) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `Export ${title} PDF`,
          })
        } else {
          Alert.alert('PDF Created', `Saved itinerary PDF to device cache.`)
        }
      }
    } catch (err) {
      Alert.alert('Export Error', 'Could not generate PDF: ' + (err?.message || 'Unknown error'))
    } finally {
      setIsExportingPdf(false)
    }
  }

  // 3. Share text summary
  async function handleShareText() {
    try {
      const shareContent = Platform.OS === 'ios'
        ? { message: textSummary }
        : { title: `${title} Itinerary`, message: textSummary }
      await Share.share(shareContent)
    } catch {
      // dismissed
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.titleCol}>
          <Text style={styles.navTitle}>Print & Export Itinerary</Text>
          <Text style={styles.navSub} numberOfLines={1}>{destination} • {dates}</Text>
        </View>

        <View style={styles.headerRightBtns}>
          <TouchableOpacity
            style={styles.printHeaderBtn}
            onPress={handleDirectPrint}
            activeOpacity={0.8}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="print" size={16} color="#FFFFFF" />
                <Text style={styles.printHeaderBtnText}>Print</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareIconBtn}
            onPress={() => setExportModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="share-social-outline" size={19} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Mode Switcher */}
      <View style={styles.switcherBar}>
        <TouchableOpacity
          style={[styles.switcherTab, viewMode === 'preview' && styles.switcherTabActive]}
          onPress={() => setViewMode('preview')}
        >
          <Ionicons name="document-text-outline" size={16} color={viewMode === 'preview' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.switcherText, viewMode === 'preview' && styles.switcherTextActive]}>
            Mobile View
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.switcherTab, viewMode === 'html_doc' && styles.switcherTabActive]}
          onPress={() => setViewMode('html_doc')}
        >
          <Ionicons name="newspaper-outline" size={16} color={viewMode === 'html_doc' ? colors.primary : colors.textSecondary} />
          <Text style={[styles.switcherText, viewMode === 'html_doc' && styles.switcherTextActive]}>
            Printable Document (PDF)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {viewMode === 'preview' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Banner */}
          <View style={styles.docHeaderCard}>
            <View style={styles.docHeaderTagRow}>
              <View style={styles.destBadge}>
                <Ionicons name="location" size={12} color="#FFFFFF" />
                <Text style={styles.destBadgeText}>{destination}</Text>
              </View>
              <Text style={styles.docIssuedText}>{printDateStr}</Text>
            </View>

            <Text style={styles.docMainTitle}>{title}</Text>
            {dates ? <Text style={styles.docDates}>📅 {dates} ({totalDays} Days)</Text> : null}

            {/* Quick Stats Grid */}
            <View style={styles.mobileStatsGrid}>
              <View style={styles.mobileStatCol}>
                <Text style={styles.mobileStatLabel}>STOPS</Text>
                <Text style={styles.mobileStatVal}>{totalStops} Spots</Text>
              </View>
              <View style={styles.mobileStatCol}>
                <Text style={styles.mobileStatLabel}>DURATION</Text>
                <Text style={styles.mobileStatVal}>{totalDays} Days</Text>
              </View>
              <View style={styles.mobileStatCol}>
                <Text style={styles.mobileStatLabel}>BUDGET</Text>
                <Text style={styles.mobileStatVal}>{trip.budgetLevel || 'Moderate'}</Text>
              </View>
            </View>
          </View>

          {/* Days */}
          {days.map((day, dayIdx) => {
            const items = getDayItems(day)
            const dayColor = day.color || getDayColor(dayIdx)

            return (
              <Card key={day.id || dayIdx} style={styles.dayCard} padding="md">
                <View style={[styles.dayHeader, { borderLeftColor: dayColor }]}>
                  <View style={[styles.dayDot, { backgroundColor: dayColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dayTitle}>{day.label || `Day ${dayIdx + 1}`}</Text>
                    <Text style={styles.daySubLabel}>📍 {destination} • {items.length} {items.length === 1 ? 'stop' : 'stops'} scheduled</Text>
                  </View>
                </View>

                {items.length === 0 ? (
                  <Text style={styles.emptyDayText}>No places scheduled for this day.</Text>
                ) : (
                  items.map((item, itemIdx) => {
                    const isNote = item.type === 'note'
                    const isChecklist = item.type === 'checklist'
                    const stopTitle = isNote ? item.title || 'Note' : isChecklist ? item.title || 'Checklist' : item.title || item.name || 'Stop'
                    const desc = item.note || item.description || item.subtitle || item.content || (item.items ? item.items.map((r) => r.text).join(' • ') : '')
                    const timing = getItemTiming(item, itemIdx)
                    const loc = getItemLocation(item, destination)
                    const cat = getItemCategory(item)

                    return (
                      <View key={item.id ? `${day.id}-${item.id}` : `print-day-${dayIdx}-item-${itemIdx}`} style={styles.stopRow}>
                        <View style={[styles.stopBadge, { backgroundColor: dayColor }]}>
                          <Text style={styles.stopBadgeText}>{itemIdx + 1}</Text>
                        </View>
                        <View style={styles.stopInfoCol}>
                          <View style={styles.stopTitleRow}>
                            <Text style={styles.stopTitle}>{stopTitle}</Text>
                            <View style={styles.stopTimeBox}>
                              <Ionicons name="time-outline" size={11} color="#065F46" />
                              <Text style={styles.stopTimeText}>{timing}</Text>
                            </View>
                          </View>

                          <View style={styles.stopMetaRow}>
                            <View style={styles.stopCatPill}>
                              <Text style={styles.stopCatPillText}>{cat}</Text>
                            </View>
                            <Text style={styles.stopLocText} numberOfLines={1}>
                              📍 {loc}
                            </Text>
                          </View>

                          {desc ? <Text style={styles.stopDesc}>{desc}</Text> : null}
                        </View>
                      </View>
                    )
                  })
                )}
              </Card>
            )
          })}

          {/* Bottom Dual Action Buttons */}
          <View style={styles.actionsBox}>
            <TouchableOpacity
              style={styles.mainPrintBtn}
              onPress={handleDirectPrint}
              activeOpacity={0.85}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="print" size={20} color="#FFFFFF" />
                  <Text style={styles.mainPrintBtnText}>Print Itinerary (AirPrint)</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.secondaryBtnRow}>
              <TouchableOpacity
                style={styles.pdfExportBtn}
                onPress={handleExportPdf}
                activeOpacity={0.8}
                disabled={isExportingPdf}
              >
                {isExportingPdf ? (
                  <ActivityIndicator size="small" color="#0E442B" />
                ) : (
                  <>
                    <Ionicons name="document-attach-outline" size={18} color="#0E442B" />
                    <Text style={styles.pdfExportBtnText}>Save / Export PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareTextBtn}
                onPress={handleShareText}
                activeOpacity={0.8}
              >
                <Ionicons name="share-outline" size={18} color="#0E442B" />
                <Text style={styles.shareTextBtnText}>Share Text</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <View style={styles.webviewWrapper}>
          {/* Printable Toolbar */}
          <View style={styles.webviewToolbar}>
            <View>
              <Text style={styles.webviewToolbarText}>Print-Ready Document Preview</Text>
              <Text style={styles.webviewToolbarSub}>A4 Page layout with exact times & locations</Text>
            </View>
            <TouchableOpacity
              style={styles.webviewPrintBtn}
              onPress={handleDirectPrint}
              activeOpacity={0.8}
            >
              <Ionicons name="print" size={15} color="#FFFFFF" />
              <Text style={styles.webviewPrintBtnText}>Print Now</Text>
            </TouchableOpacity>
          </View>
          <WebView
            originWhitelist={['*']}
            source={{ html: printableHtml }}
            style={styles.webview}
          />
        </View>
      )}

      {/* Export Options Modal Sheet */}
      <Modal
        visible={exportModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setExportModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Print & Export Itinerary</Text>
            <Text style={styles.modalSubtitle}>{destination} • {dates}</Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setExportModalVisible(false)
                setTimeout(handleDirectPrint, 300)
              }}
            >
              <View style={[styles.modalIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="print" size={22} color="#059669" />
              </View>
              <View style={styles.modalOptionTextCol}>
                <Text style={styles.modalOptionTitle}>Print with AirPrint</Text>
                <Text style={styles.modalOptionDesc}>Direct wireless printing to local AirPrint printers</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setExportModalVisible(false)
                setTimeout(handleExportPdf, 300)
              }}
            >
              <View style={[styles.modalIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="document-text" size={22} color="#2563EB" />
              </View>
              <View style={styles.modalOptionTextCol}>
                <Text style={styles.modalOptionTitle}>Export Official PDF File</Text>
                <Text style={styles.modalOptionDesc}>Generate standalone high-res PDF to save in Files or send</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setExportModalVisible(false)
                setTimeout(handleShareText, 300)
              }}
            >
              <View style={[styles.modalIconBox, { backgroundColor: '#F0FDF4' }]}>
                <Ionicons name="chatbubbles" size={22} color="#16A34A" />
              </View>
              <View style={styles.modalOptionTextCol}>
                <Text style={styles.modalOptionTitle}>Share Text Summary</Text>
                <Text style={styles.modalOptionDesc}>Send itinerary outline with dates and times via WhatsApp</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setExportModalVisible(false)}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  titleCol: {
    flex: 1,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  navSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '600',
  },
  headerRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  printHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E442B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 5,
  },
  printHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  shareIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  switcherTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  switcherTabActive: {
    borderBottomColor: '#0E442B',
  },
  switcherText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  switcherTextActive: {
    color: '#0E442B',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  docHeaderCard: {
    backgroundColor: '#0E442B',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#0E442B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  docHeaderTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  destBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  destBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  docIssuedText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '600',
  },
  docMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  docDates: {
    fontSize: 13,
    color: '#ECFDF5',
    fontWeight: '600',
    marginBottom: 14,
  },
  mobileStatsGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    paddingTop: 12,
    gap: 8,
  },
  mobileStatCol: {
    flex: 1,
  },
  mobileStatLabel: {
    fontSize: 10,
    color: '#A7F3D0',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mobileStatVal: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 2,
  },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 8,
    borderLeftWidth: 4,
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  daySubLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  emptyDayText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  stopBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stopBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stopInfoCol: {
    flex: 1,
  },
  stopTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  stopTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  stopTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stopTimeText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '800',
  },
  stopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  stopCatPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stopCatPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0E442B',
  },
  stopLocText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  stopDesc: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
    lineHeight: 17,
  },
  actionsBox: {
    marginTop: 10,
    gap: 10,
  },
  mainPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0E442B',
    paddingVertical: 15,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#0E442B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  mainPrintBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pdfExportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0E442B',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
  },
  pdfExportBtnText: {
    color: '#0E442B',
    fontSize: 13,
    fontWeight: '700',
  },
  shareTextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingVertical: 13,
    borderRadius: 14,
    gap: 6,
  },
  shareTextBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '700',
  },
  webviewWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webviewToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  webviewToolbarText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  webviewToolbarSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  webviewPrintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E442B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  webviewPrintBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  webview: {
    flex: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  /* MODAL SHEET STYLES */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: -8,
    marginBottom: 4,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  modalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionTextCol: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalOptionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    marginTop: 6,
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
})
