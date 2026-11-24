import React, { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AppProvider } from './src/context/AppContext'
import { AppNavigator } from './src/navigation/AppNavigator'
import { SplashScreen } from './src/screens/splash/SplashScreen'

export default function App() {
  const [isSplashFinished, setIsSplashFinished] = useState(false)

  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <AppNavigator />
        {!isSplashFinished && (
          <SplashScreen onFinish={() => setIsSplashFinished(true)} />
        )}
      </AppProvider>
    </SafeAreaProvider>
  )
}
