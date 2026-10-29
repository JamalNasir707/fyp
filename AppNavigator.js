import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useApp } from '../context/AppContext'
import { BottomTabNavigator } from './BottomTabNavigator'
import { TripDetailScreen } from '../screens/trips/TripDetailScreen'
import { ItineraryScreen } from '../screens/itinerary/ItineraryScreen'
import { MapScreen } from '../screens/map/MapScreen'
import { LoginScreen } from '../screens/auth/LoginScreen'
import { RegisterScreen } from '../screens/auth/RegisterScreen'
import { HistoryScreen } from '../screens/history/HistoryScreen'
import { SettingsScreen } from '../screens/settings/SettingsScreen'
import { PublicTripScreen } from '../screens/trips/PublicTripScreen'
import { PrintTripScreen } from '../screens/trips/PrintTripScreen'
import { AdminScreen } from '../screens/admin/AdminScreen'
import { UserProfileScreen } from '../screens/profile/UserProfileScreen'

const Stack = createNativeStackNavigator()

export function AppNavigator() {
  const { isAuthenticated } = useApp()

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
              component={MapScreen}
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

