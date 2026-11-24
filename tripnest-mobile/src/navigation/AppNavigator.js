import React from 'react'
import { ActivityIndicator, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useApp } from '../context/AppContext'
import { colors } from '../theme/colors'
import { BottomTabNavigator } from './BottomTabNavigator'
import { TripDetailScreen } from '../screens/trips/TripDetailScreen'
import { ItineraryScreen } from '../screens/itinerary/ItineraryScreen'
import { LoginScreen } from '../screens/auth/LoginScreen'
import { RegisterScreen } from '../screens/auth/RegisterScreen'
import { HistoryScreen } from '../screens/history/HistoryScreen'
import { SettingsScreen } from '../screens/settings/SettingsScreen'
import { PublicTripScreen } from '../screens/trips/PublicTripScreen'
import { PrintTripScreen } from '../screens/trips/PrintTripScreen'
import { AdminScreen } from '../screens/admin/AdminScreen'
import { UserProfileScreen } from '../screens/profile/UserProfileScreen'

const Stack = createNativeStackNavigator()

const linking = {
  prefixes: [
    'tripnest://',
    'https://tripnest.app',
    'https://tripnest.travel',
    'http://localhost:5173',
    'http://localhost:8081',
  ],
  config: {
    screens: {
      PublicTrip: {
        path: 'share/:token',
        parse: {
          token: (token) => token,
        },
      },
      PublicTripEdit: {
        path: 'share/edit/:token',
        parse: {
          token: (token) => token,
          editShareToken: (token) => token,
        },
      },
      PublicTripLegacy: {
        path: 'trips/shared/:token',
        parse: {
          token: (token) => token,
        },
      },
      PublicTripLegacyEdit: {
        path: 'trips/shared/edit/:token',
        parse: {
          token: (token) => token,
          editShareToken: (token) => token,
        },
      },
      PublicTripById: {
        path: 'trips/public/:tripId',
        parse: {
          tripId: (tripId) => tripId,
        },
      },
      TripDetail: 'trip/:tripId',
    },
  },
}

export function AppNavigator() {
  const { isAuthenticated, isHydrating } = useApp()

  if (isHydrating) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen
              name="TripDetail"
              component={TripDetailScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Itinerary"
              component={ItineraryScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Map"
              component={ItineraryScreen}
              initialParams={{ initialViewMode: 'split' }}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="History"
              component={HistoryScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PublicTrip"
              component={PublicTripScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PublicTripEdit"
              component={PublicTripScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PublicTripLegacy"
              component={PublicTripScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PublicTripLegacyEdit"
              component={PublicTripScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PublicTripById"
              component={PublicTripScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PrintTrip"
              component={PrintTripScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="Admin"
              component={AdminScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="UserProfile"
              component={UserProfileScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PublicTrip"
              component={PublicTripScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PublicTripEdit"
              component={PublicTripScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PublicTripLegacy"
              component={PublicTripScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PublicTripLegacyEdit"
              component={PublicTripScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="PublicTripById"
              component={PublicTripScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="UserProfile"
              component={UserProfileScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default AppNavigator
