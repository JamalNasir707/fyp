import React, { useMemo, useRef, useEffect, useState } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { getPlaceLatLon, getDayColor, DAY_FALLBACK_COLORS, haversineKm } from '../../utils/tripUtils'
import { getDestinationCoordinates } from '../../utils/locationService'
import { CARTO_API_KEY } from '../../config/env'
import { fetchSegmentRoadRoute } from '../../services/routeOptimizationService'
import { SafeImage } from '../common/SafeImage'

/**
 * InteractiveMap
 * 
 * Real mobile interactive map featuring:
 * - Real geographic map tiles (CartoDB Positron & OpenStreetMap)
 * - True latitude/longitude marker plotting
 * - Day-colored numbered pins matching the web itinerary
 * - OSRM road-following route polylines
 * - Smooth fit-bounds & marker selection synchronization
 * - Resilient handling of missing coordinates without crashing
 * - Honest empty state when no mappable places exist
 */
export function InteractiveMap({
  trip,
  selectedDayId = 'all', // 'all' | day.id | 'pool'
  selectedPlaceId = null,
  onSelectPlace,
  showRoutes = true,
  style,
  onBoundsChange = null,
}) {
  const webViewRef = useRef(null)

  // Extract all plotted places with valid coordinates
  const { mappablePlaces, unmappableCount, dayColorMap } = useMemo(() => {
    if (!trip) {
      return { mappablePlaces: [], unmappableCount: 0, dayColorMap: new Map() }
    }

    const colorMap = new Map()
    const days = Array.isArray(trip.days) ? trip.days : []
    days.forEach((day, index) => {
      const dayColor = day.color || getDayColor(index)
      colorMap.set(day.id, dayColor)
      colorMap.set(String(day.id), dayColor)
    })

    const places = []
    let unmapped = 0
    const dayCounters = new Map()

    const processItem = (item, dayId, dayIndex, itemIndex, isPool = false) => {
      if (!item || item.type === 'note' || item.type === 'checklist') return

      const coords = getPlaceLatLon(item, trip?.destination)
      if (!coords) {
        unmapped += 1
        return
      }

      const color = isPool
        ? '#6366f1' // indigo for places pool
        : '#7c3aed' // consistent purple style matching screenshot

      const seqNumber = isPool ? '★' : String((dayCounters.get(dayId) || 0) + 1)
      if (!isPool) {
        dayCounters.set(dayId, (dayCounters.get(dayId) || 0) + 1)
      }

      places.push({
        id: String(item.id || item.place_id || `stop-${itemIndex}`),
        title: item.title || item.name || 'Place',
        subtitle: item.subtitle || item.address || '',
        category: item.category || 'attraction',
        lat: coords.lat,
        lon: coords.lon,
        isEstimated: Boolean(coords.isEstimated || item.isEstimated),
        dayId,
        dayIndex,
        itemIndex,
        isPool,
        color,
        label: seqNumber,
        photo: item.photo || item.image || '',
        rating: item.rating || null,
        reviews: item.reviews || null,
        openStatus: item.openStatus || '',
      })
    }

    if (selectedDayId === 'pool') {
      ;(trip.placesPool || []).forEach((item, idx) => {
        processItem(item, 'pool', -1, idx, true)
      })
    } else if (selectedDayId === 'all') {
      days.forEach((day, dayIdx) => {
        ;(day.items || []).forEach((item, itemIdx) => {
          processItem(item, day.id, dayIdx, itemIdx, false)
        })
      })
      ;(trip.placesPool || []).forEach((item, idx) => {
        processItem(item, 'pool', -1, idx, true)
      })
    } else {
      const targetDayIdx = days.findIndex((d) => String(d.id) === String(selectedDayId))
      const targetDay = targetDayIdx >= 0 ? days[targetDayIdx] : null
      if (targetDay) {
        ;(targetDay.items || []).forEach((item, itemIdx) => {
          processItem(item, targetDay.id, targetDayIdx, itemIdx, false)
        })
      }
    }

    return { mappablePlaces: places, unmappableCount: unmapped, dayColorMap: colorMap }
  }, [trip, selectedDayId])

  // Group places to draw sequential routes (per-day or across entire trip)
  const routeGroups = useMemo(() => {
    if (!showRoutes || mappablePlaces.length < 2) return []

    // Helper to format stop point
    const formatPoint = (p) => ({
      stopId: p.id,
      stopName: p.title,
      title: p.title,
      latitude: p.lat,
      longitude: p.lon,
      lat: p.lat,
      lon: p.lon,
      color: p.color || '#7c3aed',
      label: p.label,
      hasValidCoords: true,
    })

    // Case 1: Specific day selected
    if (selectedDayId !== 'all' && selectedDayId !== 'pool') {
      const dayPlaces = mappablePlaces.filter((p) => !p.isPool && String(p.dayId) === String(selectedDayId))
      if (dayPlaces.length >= 2) {
        return [{
          dayId: selectedDayId,
          color: '#7c3aed',
          points: dayPlaces.map(formatPoint),
        }]
      }
      return []
    }

    // Case 2: Pool selected
    if (selectedDayId === 'pool') {
      const poolPlaces = mappablePlaces.filter((p) => p.isPool)
      if (poolPlaces.length >= 2) {
        return [{
          dayId: 'pool',
          color: '#6366f1',
          points: poolPlaces.map(formatPoint),
        }]
      }
      return []
    }

    // Case 3: All Days (selectedDayId === 'all')
    // 3A: First check if individual days each have 2+ stops
    const groups = new Map()
    const scheduledPlaces = mappablePlaces.filter((p) => !p.isPool)

    scheduledPlaces.forEach((p) => {
      const groupKey = String(p.dayId)
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          dayId: p.dayId,
          color: '#7c3aed',
          points: [],
        })
      }
      groups.get(groupKey).points.push(formatPoint(p))
    })

    const dayGroupsWithPairs = Array.from(groups.values()).filter((g) => g.points.length >= 2)
    if (dayGroupsWithPairs.length > 0) {
      return dayGroupsWithPairs
    }

    // 3B: If no single day has 2+ stops, connect all scheduled stops across days in order
    if (scheduledPlaces.length >= 2) {
      return [{
        dayId: 'itinerary-all',
        color: '#7c3aed',
        points: scheduledPlaces.map(formatPoint),
      }]
    }

    // 3C: If total mappable places (including pool) >= 2, connect all places in order
    if (mappablePlaces.length >= 2) {
      return [{
        dayId: 'trip-all',
        color: '#7c3aed',
        points: mappablePlaces.map(formatPoint),
      }]
    }

    return []
  }, [mappablePlaces, showRoutes, selectedDayId])

  // React Native level OSRM road geometry pre-fetch with individual pair resolution
  const [routeDataByDay, setRouteDataByDay] = useState({})

  useEffect(() => {
    if (!showRoutes || routeGroups.length === 0) {
      setRouteDataByDay({})
      return
    }

    let isMounted = true

    async function prefetchDayRoutes() {
      const nextData = {}

      await Promise.all(
        routeGroups.map(async (group) => {
          const pts = group.points
          const segments = []
          let fullLine = []

          for (let i = 1; i < pts.length; i++) {
            const fromStop = pts[i - 1]
            const toStop = pts[i]
            const seg = await fetchSegmentRoadRoute(fromStop, toStop)

            if (seg) {
              segments.push({
                ...seg,
                fromLat: fromStop.lat,
                fromLon: fromStop.lon,
                toLat: toStop.lat,
                toLon: toStop.lon,
                color: '#7c3aed',
                dayId: group.dayId,
              })
              if (seg.geometry && seg.geometry.length > 0) {
                if (fullLine.length === 0) {
                  fullLine = [...seg.geometry]
                } else {
                  fullLine.push(...seg.geometry.slice(1))
                }
              }
            } else {
              const directCoords = [[fromStop.lat, fromStop.lon], [toStop.lat, toStop.lon]]
              const dKm = haversineKm(fromStop, toStop)
              const dMin = Math.max(1, Math.round((dKm / 35.0) * 60))
              segments.push({
                fromStopId: fromStop.stopId,
                fromName: fromStop.title,
                fromLat: fromStop.lat,
                fromLon: fromStop.lon,
                toStopId: toStop.stopId,
                toName: toStop.title,
                toLat: toStop.lat,
                toLon: toStop.lon,
                distanceKm: Number(dKm.toFixed(2)),
                distanceLabel: `${dKm.toFixed(1)} km`,
                durationMin: dMin,
                durationLabel: `${dMin} min`,
                geometry: directCoords,
                color: '#7c3aed',
                dayId: group.dayId,
                isRoadRoute: false,
              })
              if (fullLine.length === 0) {
                fullLine = [...directCoords]
              } else {
                fullLine.push(directCoords[1])
              }
            }
          }

          nextData[String(group.dayId)] = {
            geometry: fullLine.length >= 2 ? fullLine : pts.map((p) => [p.lat, p.lon]),
            segments,
          }
        })
      )

      if (isMounted) {
        setRouteDataByDay(nextData)
      }
    }

    prefetchDayRoutes()

    return () => {
      isMounted = false
    }
  }, [routeGroups, showRoutes, selectedDayId])

  // Enrich route groups with resolved geometry
  const enrichedRouteGroups = useMemo(() => {
    return routeGroups.map((g) => ({
      ...g,
      geometry: routeDataByDay[String(g.dayId)]?.geometry || g.points.map((p) => [p.lat, p.lon]),
      segments: routeDataByDay[String(g.dayId)]?.segments || [],
    }))
  }, [routeGroups, routeDataByDay])

  // Consecutive stop legs for travel metrics strip
  const activeStopLegs = useMemo(() => {
    if (!showRoutes || selectedDayId === 'pool') return []
    const legs = []

    if (selectedDayId === 'all') {
      const days = Array.isArray(trip?.days) ? trip.days : []
      days.forEach((day, dIdx) => {
        const dayData = routeDataByDay[String(day.id)]
        if (dayData && Array.isArray(dayData.segments) && dayData.segments.length > 0) {
          dayData.segments.forEach((seg) => {
            legs.push({
              dayLabel: day.shortLabel || `Day ${dIdx + 1}`,
              color: seg.color || getDayColor(dIdx),
              from: seg.fromName,
              to: seg.toName,
              distanceLabel: seg.distanceLabel,
              durationLabel: seg.durationLabel,
              isRoadRoute: seg.isRoadRoute,
            })
          })
        } else {
          const places = mappablePlaces.filter((p) => String(p.dayId) === String(day.id))
          for (let i = 1; i < places.length; i++) {
            const prev = places[i - 1]
            const curr = places[i]
            const distKm = haversineKm(prev, curr)
            const driveMin = Math.max(1, Math.round((distKm / 35.0) * 60))
            legs.push({
              dayLabel: day.shortLabel || `Day ${dIdx + 1}`,
              color: prev.color,
              from: prev.title,
              to: curr.title,
              distanceLabel: `${distKm.toFixed(1)} km`,
              durationLabel: driveMin >= 60 ? `${Math.floor(driveMin / 60)} hr ${driveMin % 60} min` : `${driveMin} min`,
              isRoadRoute: false,
            })
          }
        }
      })
    } else {
      const targetDayIdx = (trip?.days || []).findIndex((d) => String(d.id) === String(selectedDayId))
      const dayData = routeDataByDay[String(selectedDayId)]
      if (dayData && Array.isArray(dayData.segments) && dayData.segments.length > 0) {
        dayData.segments.forEach((seg) => {
          legs.push({
            dayLabel: '',
            color: seg.color || (targetDayIdx >= 0 ? getDayColor(targetDayIdx) : colors.primary),
            from: seg.fromName,
            to: seg.toName,
            distanceLabel: seg.distanceLabel,
            durationLabel: seg.durationLabel,
            isRoadRoute: seg.isRoadRoute,
          })
        })
      } else {
        const places = mappablePlaces.filter((p) => String(p.dayId) === String(selectedDayId))
        for (let i = 1; i < places.length; i++) {
          const prev = places[i - 1]
          const curr = places[i]
          const distKm = haversineKm(prev, curr)
          const driveMin = Math.max(1, Math.round((distKm / 35.0) * 60))
          legs.push({
            dayLabel: '',
            color: prev.color,
            from: prev.title,
            to: curr.title,
            distanceLabel: `${distKm.toFixed(1)} km`,
            durationLabel: driveMin >= 60 ? `${Math.floor(driveMin / 60)} hr ${driveMin % 60} min` : `${driveMin} min`,
            isRoadRoute: false,
          })
        }
      }
    }
    // Fallback: If no day-specific legs found but multiple places are mapped, compute legs across consecutive mapped places
    if (legs.length === 0 && mappablePlaces.length >= 2) {
      for (let i = 1; i < mappablePlaces.length; i++) {
        const prev = mappablePlaces[i - 1]
        const curr = mappablePlaces[i]
        const distKm = haversineKm(prev, curr)
        const driveMin = Math.max(1, Math.round((distKm / 35.0) * 60))
        legs.push({
          dayLabel: '',
          color: prev.color || '#7c3aed',
          from: prev.title,
          to: curr.title,
          distanceLabel: `${distKm.toFixed(1)} km`,
          durationLabel: driveMin >= 60 ? `${Math.floor(driveMin / 60)} hr ${driveMin % 60} min` : `${driveMin} min`,
          isRoadRoute: false,
        })
      }
    }

    return legs
  }, [showRoutes, selectedDayId, mappablePlaces, trip?.days, routeDataByDay])

  // Compute total route distance across active route groups
  const totalRouteDistKm = useMemo(() => {
    let total = 0
    if (Object.keys(routeDataByDay).length > 0) {
      Object.values(routeDataByDay).forEach((dayData) => {
        ;(dayData.segments || []).forEach((seg) => {
          total += Number(seg.distanceKm || 0)
        })
      })
    } else {
      routeGroups.forEach((g) => {
        for (let i = 1; i < g.points.length; i++) {
          total += haversineKm(g.points[i - 1], g.points[i])
        }
      })
    }
    return total
  }, [routeDataByDay, routeGroups])

  const estimatedDriveMinutes = useMemo(() => {
    return Math.max(1, Math.round((totalRouteDistKm / 35.0) * 60))
  }, [totalRouteDistKm])

  // Signature of resolved route lines so web iframe re-renders with full curve geometry
  const routeSig = useMemo(() => {
    return Object.keys(routeDataByDay)
      .map((k) => `${k}_${routeDataByDay[k]?.geometry?.length || 0}`)
      .join('-')
  }, [routeDataByDay])

  // Key to force WebView re-render with complete embedded route geometry
  const mapKey = useMemo(() => {
    const placeSignatures = mappablePlaces.map((p) => `${p.id}_${p.lat.toFixed(4)}_${p.lon.toFixed(4)}_${p.label}`).join('|')
    const daysOpt = (trip?.days || []).map((d) => `${d.id}_${(d.items || []).map((i) => i.id).join('-')}`).join('|')
    return `map_${selectedDayId}_${placeSignatures}_${daysOpt}_${routeSig}`
  }, [mappablePlaces, selectedDayId, trip?.days, routeSig])

  // Active selected place for the floating Map Information Panel (Web parity)
  const selectedPlace = useMemo(() => {
    if (!selectedPlaceId) return null
    return mappablePlaces.find((p) => String(p.id) === String(selectedPlaceId)) || null
  }, [selectedPlaceId, mappablePlaces])

  // Consecutive leg details for the selected place
  const selectedPlaceLeg = useMemo(() => {
    if (!selectedPlace) return null
    const placeIdx = mappablePlaces.findIndex((p) => String(p.id) === String(selectedPlace.id))
    if (placeIdx <= 0) return null
    const prev = mappablePlaces[placeIdx - 1]
    if (String(prev.dayId) !== String(selectedPlace.dayId)) return null
    const dayData = routeDataByDay[String(selectedPlace.dayId)]
    if (dayData?.segments) {
      const seg = dayData.segments.find(
        (s) => String(s.toStopId) === String(selectedPlace.id) || s.segmentIndex === placeIdx
      )
      if (seg) return seg
    }
    const distKm = haversineKm(prev, selectedPlace)
    const durMin = Math.max(1, Math.round((distKm / 35.0) * 60))
    return {
      fromName: prev.title,
      toName: selectedPlace.title,
      distanceLabel: `${distKm.toFixed(1)} km`,
      durationLabel: `${durMin} min`,
    }
  }, [selectedPlace, mappablePlaces, routeDataByDay])

  const [isMapReady, setIsMapReady] = useState(false)

  useEffect(() => {
    setIsMapReady(false)
  }, [mapKey])

  // Support web iframe message listening for place selection
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleWebMsg = (e) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
          if (data?.type === 'SELECT_PLACE' && onSelectPlace) {
            onSelectPlace(data.placeId)
          }
        } catch {}
      }
      window.addEventListener('message', handleWebMsg)
      return () => window.removeEventListener('message', handleWebMsg)
    }
  }, [onSelectPlace])

  // Dynamically stream OSRM route geometry updates into the Leaflet WebView without remounting
  useEffect(() => {
    if (isMapReady && webViewRef.current?.injectJavaScript && enrichedRouteGroups.length > 0) {
      webViewRef.current.injectJavaScript(`
        if (typeof window.updateRoutes === 'function') {
          window.updateRoutes(${JSON.stringify(enrichedRouteGroups)});
        }
        true;
      `)
    }
  }, [enrichedRouteGroups, isMapReady])

  // Build the complete Leaflet HTML bundle
  const htmlContent = useMemo(() => {
    const placesJson = JSON.stringify(mappablePlaces)
    const routesJson = JSON.stringify(enrichedRouteGroups)
    const selectedIdJson = JSON.stringify(selectedPlaceId)
    const destCoords = trip
      ? getDestinationCoordinates(trip.destination || trip.name)
      : { lat: 33.6844, lon: 73.0479 }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .custom-marker {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: #ffffff;
      font-weight: 800;
      font-size: 12px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.32);
      border: 2px solid #ffffff;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .custom-marker.is-selected {
      transform: scale(1.35);
      border-color: #0f172a;
      box-shadow: 0 6px 16px rgba(0,0,0,0.45);
      z-index: 1000 !important;
    }
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      padding: 4px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.18);
    }
    .popup-title {
      font-weight: 700;
      font-size: 14px;
      color: #0f172a;
      margin-bottom: 2px;
    }
    .popup-sub {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .popup-btn {
      display: inline-block;
      background: #2563eb;
      color: #fff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var places = ${placesJson};
    var routeGroups = ${routesJson};
    var selectedPlaceId = ${selectedIdJson};

    var destCenter = [${destCoords.lat}, ${destCoords.lon}];
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView(destCenter, 12);

    // Dedicated Panes for strict SVG stacking order (Parity with Web PlannerMapPanel.jsx: routes at 350, markers at 450)
    map.createPane('routes');
    map.getPane('routes').style.zIndex = 350;
    map.getPane('routes').style.pointerEvents = 'none';
    map.createPane('markers');
    map.getPane('markers').style.zIndex = 450;

    // Tile Layer Configuration (Carto Voyager when key is supplied, automatic OpenStreetMap fallback)
    var cartoKey = ${JSON.stringify(CARTO_API_KEY ? CARTO_API_KEY.trim() : '')};
    var activeTileUrl = cartoKey
      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=' + encodeURIComponent(cartoKey)
      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    var activeSubdomains = cartoKey ? 'abcd' : 'abc';

    var tileLayer = L.tileLayer(activeTileUrl, {
      maxZoom: 19,
      subdomains: activeSubdomains,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Resilient fallback: If Carto tiles fail (e.g., auth required, rate limited), smoothly fall back to OSM
    if (cartoKey) {
      var didFallback = false;
      tileLayer.on('tileerror', function() {
        if (!didFallback) {
          didFallback = true;
          try {
            map.removeLayer(tileLayer);
          } catch(e) {}
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            subdomains: 'abc',
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'TILE_PROVIDER_FALLBACK',
              message: 'Switched to OpenStreetMap tile provider.'
            }));
          }
        }
      });
    }

    var markerMap = {};
    var boundsPoints = [];
    var routeLayerGroup = L.layerGroup().addTo(map);

    function renderMarkers() {
      places.forEach(function(p) {
        var isSelected = String(p.id) === String(selectedPlaceId);
        var size = isSelected ? 32 : 28;

        var iconHtml = '<div class="custom-marker ' + (isSelected ? 'is-selected' : '') + '" style="background:' + p.color + '; width:' + size + 'px; height:' + size + 'px;">' + p.label + '</div>';

        var icon = L.divIcon({
          html: iconHtml,
          className: 'marker-wrapper',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        });

        var marker = L.marker([p.lat, p.lon], { icon: icon, pane: 'markers' }).addTo(map);

        var subText = p.subtitle ? p.subtitle : '';
        if (p.isEstimated) {
          subText = (subText ? subText + ' • ' : '') + '(Estimated GPS)';
        }
        var popupContent = '<div class="popup-title">' + p.title + '</div>' +
          (subText ? '<div class="popup-sub">' + subText + '</div>' : '') +
          '<a class="popup-btn" onclick="notifySelect(\\'' + p.id + '\\')">Select in Itinerary</a>';

        marker.bindPopup(popupContent);

        marker.on('click', function() {
          notifySelect(p.id);
        });

        markerMap[String(p.id)] = marker;
        boundsPoints.push([p.lat, p.lon]);
      });
    }

    function renderRoutes(routesToRender) {
      routeLayerGroup.clearLayers();
      (routesToRender || []).forEach(function(g) {
        if (!g.points || g.points.length < 2) return;

        // Render each consecutive segment individually for 100% complete route coverage
        if (g.segments && g.segments.length > 0) {
          g.segments.forEach(function(seg, idx) {
            var coords = (seg.geometry && seg.geometry.length >= 2)
              ? seg.geometry
              : [[seg.fromLat || (g.points[idx] && g.points[idx].lat), seg.fromLon || (g.points[idx] && g.points[idx].lon)],
                 [seg.toLat || (g.points[idx + 1] && g.points[idx + 1].lat), seg.toLon || (g.points[idx + 1] && g.points[idx + 1].lon)]];

            if (!coords || coords.length < 2) return;

            // 1. High-contrast crisp white casing
            L.polyline(coords, {
              color: '#ffffff',
              weight: 8.5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
              pane: 'routes'
            }).addTo(routeLayerGroup);

            // 2. Consistent vivid royal purple road-following polyline (Web parity / screenshot)
            var poly = L.polyline(coords, {
              color: '#7c3aed',
              weight: 5,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
              pane: 'routes'
            }).addTo(routeLayerGroup);

            if (seg.distanceLabel) {
              poly.bindTooltip(
                '<strong>' + (seg.fromName || 'Stop') + ' ➔ ' + (seg.toName || 'Stop') + '</strong><br/>' +
                seg.distanceLabel + (seg.durationLabel ? ' • ~' + seg.durationLabel : ''),
                { sticky: true, opacity: 0.9 }
              );
            }
          });
          return;
        }

        // Fallback for fullLine geometry
        var initialCoords = (g.geometry && g.geometry.length >= 2)
          ? g.geometry
          : g.points.map(function(pt) { return [pt.lat, pt.lon]; });

        L.polyline(initialCoords, {
          color: '#ffffff',
          weight: 8.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          pane: 'routes'
        }).addTo(routeLayerGroup);

        L.polyline(initialCoords, {
          color: '#7c3aed',
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          pane: 'routes'
        }).addTo(routeLayerGroup);
      });
    }

    // In-Leaflet OSRM asynchronous fallback for road curved geometry per consecutive pair
    function enrichRoutesAsync() {
      (routeGroups || []).forEach(function(g) {
        if (!g.points || g.points.length < 2) return;
        if (g.segments && g.segments.length === g.points.length - 1 && g.segments.every(function(s) { return s.isRoadRoute; })) {
          return;
        }

        var totalSegs = g.points.length - 1;
        var completed = 0;
        var updatedSegments = g.segments ? [].concat(g.segments) : [];

        function checkDone() {
          completed++;
          if (completed === totalSegs) {
            g.segments = updatedSegments;
            renderRoutes(routeGroups);
          }
        }

        for (var i = 1; i < g.points.length; i++) {
          (function(segIdx, p1, p2) {
            if (updatedSegments[segIdx] && updatedSegments[segIdx].isRoadRoute && updatedSegments[segIdx].geometry && updatedSegments[segIdx].geometry.length > 2) {
              checkDone();
              return;
            }

            var url = 'https://router.project-osrm.org/route/v1/driving/' + p1.lon + ',' + p1.lat + ';' + p2.lon + ',' + p2.lat + '?overview=full&geometries=geojson&steps=false';
            fetch(url)
              .then(function(res) { return res.json(); })
              .then(function(data) {
                var coords = data && data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates;
                var dist = data && data.routes && data.routes[0] && data.routes[0].distance;
                var dur = data && data.routes && data.routes[0] && data.routes[0].duration;
                var distKm = dist ? (dist / 1000).toFixed(1) + ' km' : '';
                var durMin = dur ? Math.round(dur / 60) + ' min' : '';

                if (coords && coords.length >= 2) {
                  updatedSegments[segIdx] = {
                    fromName: p1.title,
                    toName: p2.title,
                    fromLat: p1.lat,
                    fromLon: p1.lon,
                    toLat: p2.lat,
                    toLon: p2.lon,
                    geometry: coords.map(function(c) { return [c[1], c[0]]; }),
                    distanceLabel: distKm,
                    durationLabel: durMin,
                    isRoadRoute: true
                  };
                } else {
                  updatedSegments[segIdx] = {
                    fromName: p1.title,
                    toName: p2.title,
                    fromLat: p1.lat,
                    fromLon: p1.lon,
                    toLat: p2.lat,
                    toLon: p2.lon,
                    geometry: [[p1.lat, p1.lon], [p2.lat, p2.lon]],
                    distanceLabel: distKm,
                    durationLabel: durMin,
                    isRoadRoute: false
                  };
                }
                checkDone();
              })
              .catch(function() {
                if (!updatedSegments[segIdx]) {
                  updatedSegments[segIdx] = {
                    fromName: p1.title,
                    toName: p2.title,
                    fromLat: p1.lat,
                    fromLon: p1.lon,
                    toLat: p2.lat,
                    toLon: p2.lon,
                    geometry: [[p1.lat, p1.lon], [p2.lat, p2.lon]],
                    isRoadRoute: false
                  };
                }
                checkDone();
              });
          })(i - 1, g.points[i - 1], g.points[i]);
        }
      });
    }

    function notifySelect(id) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SELECT_PLACE', placeId: id }));
      }
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(JSON.stringify({ type: 'SELECT_PLACE', placeId: id }), '*');
        }
      } catch (e) {}
    }

    // Initial render
    renderRoutes(routeGroups);
    enrichRoutesAsync();
    renderMarkers();

    if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 14);
    } else if (boundsPoints.length > 1) {
      map.fitBounds(boundsPoints, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView(destCenter, 12);
    }

    // Inform React Native host that map is fully initialized and ready for route updates
    map.whenReady(function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
      }
    });

    // Dynamic map move/zoom boundary change listener for nationwide location discovery
    map.on('moveend', function() {
      try {
        var b = map.getBounds();
        var c = map.getCenter();
        var msg = JSON.stringify({
          type: 'MAP_BOUNDS_CHANGED',
          bounds: {
            minLat: b.getSouth(),
            maxLat: b.getNorth(),
            minLon: b.getWest(),
            maxLon: b.getEast(),
            zoom: map.getZoom(),
            center: { lat: c.lat, lon: c.lng }
          }
        });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(msg);
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, '*');
        }
      } catch (e) {}
    });

    // Dynamic Leaflet route updater called directly from React Native
    window.updateRoutes = function(newRoutes) {
      renderRoutes(newRoutes);
    };

    // Window helper for RN updates
    window.focusPlace = function(id) {
      var m = markerMap[String(id)];
      if (m) {
        map.setView(m.getLatLng(), Math.max(map.getZoom(), 14), { animate: true });
        m.openPopup();
      }
    };

    window.fitAllBounds = function() {
      if (boundsPoints.length > 1) {
        map.fitBounds(boundsPoints, { padding: [40, 40] });
      }
    };
  </script>
</body>
</html>
    `
  }, [mappablePlaces, enrichedRouteGroups, selectedPlaceId])

  // Center on selected place when selection changes
  useEffect(() => {
    if (selectedPlaceId && webViewRef.current?.injectJavaScript) {
      webViewRef.current.injectJavaScript(`
        if (window.focusPlace) {
          window.focusPlace(${JSON.stringify(selectedPlaceId)});
        }
        true;
      `)
    }
  }, [selectedPlaceId])

  function handleMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'MAP_READY') {
        setIsMapReady(true)
      } else if (data.type === 'SELECT_PLACE' && onSelectPlace) {
        onSelectPlace(data.placeId)
      } else if (data.type === 'MAP_BOUNDS_CHANGED' && onBoundsChange) {
        onBoundsChange(data.bounds)
      }
    } catch {
      // ignore
    }
  }

  function handleFitBounds() {
    if (webViewRef.current?.injectJavaScript) {
      webViewRef.current.injectJavaScript(`
        if (window.fitAllBounds) {
          window.fitAllBounds();
        }
        true;
      `)
    }
  }

  if (mappablePlaces.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Ionicons name="map-outline" size={44} color={colors.textTertiary} />
        <Text style={styles.emptyTitle}>No Plotted Places</Text>
        <Text style={styles.emptySub}>
          {unmappableCount > 0
            ? `${unmappableCount} place(s) have missing coordinates and cannot be mapped.`
            : 'Add stops or places with geographic locations to view them on the map.'}
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      {Platform.OS === 'web' ? (
        <iframe
          key={mapKey}
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="TripNest Interactive Map"
        />
      ) : (
        <WebView
          key={mapKey}
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent, baseUrl: 'https://tripnest.dev' }}
          style={styles.webView}
          onMessage={handleMessage}
          onLoadEnd={() => setIsMapReady(true)}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          mixedContentMode="always"
          allowsInlineMediaPlayback={true}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent
            console.warn('Map WebView error:', nativeEvent?.description || nativeEvent)
          }}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading interactive map tiles...</Text>
            </View>
          )}
        />
      )}

      {/* Route Distance & Drive Time Summary Banner */}
      {totalRouteDistKm > 0 && (
        <View style={styles.metricsBanner}>
          <Ionicons name="flash" size={13} color="#D97706" />
          <Text style={styles.metricsBannerText}>
            ⚡ Route: {totalRouteDistKm.toFixed(1)} km • ~{estimatedDriveMinutes >= 60 ? `${Math.floor(estimatedDriveMinutes / 60)} hr ${estimatedDriveMinutes % 60} min` : `${estimatedDriveMinutes} min`} drive
          </Text>
        </View>
      )}

      {/* Floating Map Controls */}
      <View style={styles.floatingControls}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handleFitBounds}
          activeOpacity={0.8}
        >
          <Ionicons name="scan-outline" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Selected Place Information Panel (Web Parity / Screenshot) */}
      {selectedPlace && (
        <View style={styles.infoPanel}>
          <View style={styles.infoPanelHeader}>
            <View style={styles.infoPanelThumbWrap}>
              <SafeImage
                source={selectedPlace.photo}
                placeName={selectedPlace.title}
                category={selectedPlace.category}
                style={styles.infoPanelThumb}
              />
              <View style={styles.infoPanelBadge}>
                <Text style={styles.infoPanelBadgeText}>#{selectedPlace.label}</Text>
              </View>
            </View>

            <View style={styles.infoPanelContent}>
              <View style={styles.infoPanelRow}>
                <Text style={styles.infoPanelTitle} numberOfLines={1}>
                  {selectedPlace.title}
                </Text>
                <TouchableOpacity
                  onPress={() => onSelectPlace && onSelectPlace(null)}
                  style={styles.infoPanelCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.infoPanelTags}>
                {selectedPlace.rating ? (
                  <View style={styles.infoPanelTagRating}>
                    <Ionicons name="star" size={10} color="#D97706" />
                    <Text style={styles.infoPanelTagRatingText}>{selectedPlace.rating}</Text>
                  </View>
                ) : null}
                <View style={styles.infoPanelTag}>
                  <Text style={styles.infoPanelTagText}>{selectedPlace.category}</Text>
                </View>
                <Text style={styles.infoPanelCoordsText}>
                  📍 {selectedPlace.lat.toFixed(4)}, {selectedPlace.lon.toFixed(4)}
                </Text>
              </View>

              {selectedPlace.subtitle ? (
                <Text style={styles.infoPanelSubtitle} numberOfLines={1}>
                  {selectedPlace.subtitle}
                </Text>
              ) : null}

              {selectedPlaceLeg ? (
                <View style={styles.infoPanelLegRow}>
                  <Ionicons name="car" size={11} color="#7c3aed" />
                  <Text style={styles.infoPanelLegText}>
                    {selectedPlaceLeg.distanceLabel} (~{selectedPlaceLeg.durationLabel}) from Stop #{Number(selectedPlace.label) - 1}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {/* Consecutive Stop Legs Scroll Row */}
      {!selectedPlace && activeStopLegs.length > 0 && (
        <View style={styles.legsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.legsScrollContent}
          >
            {activeStopLegs.map((leg, idx) => (
              <View key={idx} style={styles.legBadge}>
                <Ionicons name="car-outline" size={11} color={leg.color || colors.primary} />
                <Text style={styles.legBadgeText}>
                  {leg.dayLabel ? `${leg.dayLabel}: ` : ''}{leg.from} ━━━━> {leg.to}: {leg.distanceLabel}, ~{leg.durationLabel}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Badge showing plotted places vs unmapped count and tile provider */}
      <View style={styles.plottedBadge}>
        <View style={styles.plottedDot} />
        <Text style={styles.plottedText}>
          {mappablePlaces.length} mapped{unmappableCount > 0 ? ` • ${unmappableCount} no coords` : ''}
          {totalRouteDistKm > 0 ? ` • ${totalRouteDistKm.toFixed(1)} km route` : ''}
          {' • ' + (CARTO_API_KEY ? 'Carto Voyager' : 'OpenStreetMap')}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    position: 'relative',
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 250, 252, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    gap: 8,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  metricsBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 20,
  },
  metricsBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  legsContainer: {
    position: 'absolute',
    bottom: 46,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  legsScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  legBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  legBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  floatingControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    gap: 8,
    zIndex: 20,
  },
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  plottedBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  plottedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  plottedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoPanel: {
    position: 'absolute',
    bottom: 46,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.1)',
    zIndex: 25,
  },
  infoPanelHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  infoPanelThumbWrap: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    flexShrink: 0,
  },
  infoPanelThumb: {
    width: '100%',
    height: '100%',
  },
  infoPanelBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    zIndex: 2,
  },
  infoPanelBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  infoPanelContent: {
    flex: 1,
    justifyContent: 'center',
  },
  infoPanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoPanelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 6,
  },
  infoPanelCloseBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  infoPanelTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  infoPanelTagRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  infoPanelTagRatingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  infoPanelTag: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  infoPanelTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B21A8',
    textTransform: 'capitalize',
  },
  infoPanelCoordsText: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  infoPanelSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoPanelLegRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  infoPanelLegText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7c3aed',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emptyTitle: {
    ...typography.subtitle1,
    color: colors.textPrimary,
    marginTop: 10,
    fontWeight: '700',
  },
  emptySub: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    maxWidth: 260,
  },
})

export default InteractiveMap
