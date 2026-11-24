import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'

/**
 * Robust image wrapper with loading spinner, automatic CDN fallback retry,
 * error recovery, and verified styling.
 * Prevents broken images from crashing or rendering blank white cards.
 */
export function SafeImage({
  source,
  fallbackUri,
  fallbackUrls = [],
  fallbackIcon = 'image-outline',
  fallbackColor = colors.textTertiary,
  style,
  resizeMode = 'cover',
  children,
}) {
  const isLocalAsset = typeof source === 'number'
  const primaryUri = typeof source === 'object' && source?.uri ? source.uri : null

  // Collect all potential fallback URLs
  const fallbacks = [
    ...(fallbackUri ? [fallbackUri] : []),
    ...(Array.isArray(fallbackUrls) ? fallbackUrls : []),
  ].filter((u) => u && typeof u === 'string' && u !== primaryUri)

  const [currentUri, setCurrentUri] = useState(primaryUri)
  const [fallbackIndex, setFallbackIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Reset state when source URI changes
  useEffect(() => {
    if (!isLocalAsset) {
      setCurrentUri(primaryUri)
      setFallbackIndex(-1)
      setError(false)
      setLoading(false)
    }
  }, [primaryUri, isLocalAsset])

  // If source is missing or empty
  if (!source || (!currentUri && !isLocalAsset)) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        <Ionicons name={fallbackIcon} size={28} color={fallbackColor} />
        {children}
      </View>
    )
  }

  // If all attempts failed
  if (error && !isLocalAsset) {
    return (
      <View style={[styles.fallbackContainer, style]}>
        <Ionicons name="images-outline" size={26} color={colors.textTertiary} />
        {children}
      </View>
    )
  }

  const effectiveSource = isLocalAsset
    ? source
    : { uri: currentUri }

  return (
    <View style={[styles.wrapper, style]}>
      <Image
        source={effectiveSource}
        style={[StyleSheet.absoluteFill, style]}
        resizeMode={resizeMode}
        onLoadStart={() => {
          if (!isLocalAsset) setLoading(true)
        }}
        onLoadEnd={() => {
          setLoading(false)
        }}
        onError={() => {
          setLoading(false)
          // Try fallback URLs if available
          const nextIndex = fallbackIndex + 1
          if (nextIndex < fallbacks.length) {
            setFallbackIndex(nextIndex)
            setCurrentUri(fallbacks[nextIndex])
          } else {
            setError(true)
          }
        }}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surfaceSubtle,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(241, 245, 249, 0.6)',
  },
  fallbackContainer: {
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
})

