import React from 'react'
import { Platform, StyleSheet, View } from 'react-native'
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
        tabBarActiveTintColor: '#0E442B',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: 64 + bottomPadding,
          paddingBottom: bottomPadding + 2,
          paddingTop: 6,
          shadowColor: '#0E442B',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: -2,
          marginBottom: 2,
          letterSpacing: 0.1,
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

          return (
            <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
              <Ionicons
                name={iconName}
                size={20}
                color={focused ? '#0E442B' : '#64748B'}
              />
            </View>
          )
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

const styles = StyleSheet.create({
  tabIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    backgroundColor: '#ECFDF5',
  },
})

export default BottomTabNavigator
