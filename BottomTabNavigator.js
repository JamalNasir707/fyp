import React from 'react'
import { Platform } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme/colors'
import { HomeScreen } from '../screens/home/HomeScreen'
import { ExploreScreen } from '../screens/explore/ExploreScreen'
import { TripsListScreen } from '../screens/trips/TripsListScreen'
import { SavedPlacesScreen } from '../screens/saved/SavedPlacesScreen'
import { ProfileScreen } from '../screens/profile/ProfileScreen'

const Tab = createBottomTabNavigator()

export function BottomTabNavigator() {
  const insets = useSafeAreaInsets()
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4)

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: 60 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName
          if (route.name === 'HomeTab') {
            iconName = focused ? 'home' : 'home-outline'
          } else if (route.name === 'ExploreTab') {
            iconName = focused ? 'compass' : 'compass-outline'
          } else if (route.name === 'TripsTab') {
            iconName = focused ? 'airplane' : 'airplane-outline'
          } else if (route.name === 'SavedTab') {
            iconName = focused ? 'bookmark' : 'bookmark-outline'
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline'
          }
          return <Ionicons name={iconName} size={22} color={color} />
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreScreen}
        options={{ title: 'Explore' }}
      />
      <Tab.Screen
        name="TripsTab"
        component={TripsListScreen}
        options={{ title: 'Trips' }}
      />
      <Tab.Screen
        name="SavedTab"
        component={SavedPlacesScreen}
        options={{ title: 'Saved' }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  )
}

export default BottomTabNavigator
