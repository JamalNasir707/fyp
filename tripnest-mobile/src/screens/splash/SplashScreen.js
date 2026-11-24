import React, { useEffect, useRef } from 'react'
import {
  View,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native'
import { BRANDING_ASSETS } from '../../../assets/branding'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

/**
 * TripNest Branded Splash Screen
 * 
 * Recreates the exact branding design from the reference:
 * - Warm cream background (#FBF9F5)
 * - Centered high-resolution TripNest travel logo
 * - Smooth animated progress loading bar
 * - Subtle mountain landscape footer blending into the background
 * - Elegant fade-in and graceful exit transition into the main application
 */
export function SplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0)).current
  const contentTranslate = useRef(new Animated.Value(10)).current

  useEffect(() => {
    // 1. Fade in the splash screen content
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslate, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start()

    // 2. Animate the progress bar from 0% to 100% over 1.8s
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1800,
      useNativeDriver: false,
    }).start(() => {
      // 3. Graceful fade out after loading is complete
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        if (onFinish) {
          onFinish()
        }
      })
    })

    // Safety fallback timer to guarantee splash screen unmounts even if animation frame stalls
    const fallbackTimer = setTimeout(() => {
      if (onFinish) {
        onFinish()
      }
    }, 2500)

    return () => clearTimeout(fallbackTimer)
  }, [fadeAnim, progressAnim, contentTranslate, onFinish])

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Centered Brand Content */}
      <Animated.View
        style={[
          styles.contentContainer,
          { transform: [{ translateY: contentTranslate }] },
        ]}
      >
        <Image
          source={BRANDING_ASSETS.logo}
          style={styles.logoImage}
          resizeMode="contain"
        />

        {/* Minimalist Progress Indicator */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressBar, { width: progressWidth }]}
          />
        </View>
      </Animated.View>

      {/* Mountain Landscape Footer with soft alpha-blended horizon */}
      <View style={styles.footerContainer} pointerEvents="none">
        <Image
          source={BRANDING_ASSETS.mountainFooter}
          style={styles.mountainFooterImage}
          resizeMode="cover"
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FBF9F5', // Signature warm cream background
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
    marginTop: -SCREEN_HEIGHT * 0.08, // Subtle elevation for vertical balance
  },
  logoImage: {
    width: Math.min(SCREEN_WIDTH * 0.65, 260),
    height: Math.min(SCREEN_WIDTH * 0.65, 260) * 1.05,
  },
  progressTrack: {
    width: 140,
    height: 4,
    backgroundColor: '#E5E0D8',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 22,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#134E32', // Deep forest green brand color
    borderRadius: 2,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: SCREEN_WIDTH,
    height: Math.min(SCREEN_HEIGHT * 0.36, 280),
    overflow: 'hidden',
  },
  mountainFooterImage: {
    width: '100%',
    height: '100%',
  },
})

export default SplashScreen
