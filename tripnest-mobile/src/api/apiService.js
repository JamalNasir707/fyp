/**
 * Unified API Service Switcher
 * 
 * Provides a single API interface for the UI, state, and feature service layers.
 * Switches transparently between mockAdapter and real apiClient based on CURRENT_ENV.
 */

import { getCurrentEnvironment, ENVIRONMENTS } from '../config/env.js'
import { mockAdapter } from './mockAdapter.js'
import { apiClient } from './client.js'

function isMock(token) {
  if (token && typeof token === 'string' && token.startsWith('guest_local_token_')) {
    return true
  }
  return getCurrentEnvironment() === ENVIRONMENTS.MOCK
}

export const apiService = {
  // ==================== SYSTEM & HEALTH ====================
  async pingServer() {
    if (isMock()) return { ok: true, message: 'Mock Adapter Active' }
    return apiClient.pingServer()
  },

  // ==================== AUTH & ACCOUNT ====================
  async login(credentials) {
    if (credentials?.username === 'guest_explorer' || credentials?.isGuest) {
      return {
        success: true,
        token: 'guest_local_token_' + Date.now(),
        user: {
          id: 'usr_guest_local',
          username: 'guest_explorer',
          name: 'Guest Explorer',
          displayName: 'Guest Explorer',
          email: '',
          role: 'guest',
          bio: '',
        },
      }
    }
    if (isMock()) return mockAdapter.login(credentials)
    return apiClient.login(credentials)
  },

  async register(payload) {
    if (isMock()) return mockAdapter.register(payload)
    return apiClient.register(payload)
  },

  async googleLogin(tokenPayload) {
    if (isMock()) return mockAdapter.googleLogin(tokenPayload)
    return apiClient.googleLogin(tokenPayload)
  },

  async verifyToken(token) {
    if (isMock(token)) {
      return {
        success: true,
        user: {
          id: 'usr_guest_local',
          username: 'guest_explorer',
          name: 'Guest Explorer',
          displayName: 'Guest Explorer',
          email: '',
          role: 'guest',
          bio: '',
        },
      }
    }
    return apiClient.verifyToken(token)
  },

  async logout(token) {
    if (isMock(token)) return mockAdapter.logout()
    return apiClient.logout(token)
  },

  async updateProfile(token, payload) {
    if (isMock(token)) return mockAdapter.updateProfile(payload)
    return apiClient.updateProfile(token, payload)
  },

  async deleteAccount(token, payload) {
    if (isMock(token)) return mockAdapter.deleteAccount(payload)
    return apiClient.deleteAccount(token, payload)
  },

  // ==================== OWNED TRIPS ====================
  async getTrips(token) {
    if (isMock(token)) return mockAdapter.getTrips()
    return apiClient.getTrips(token)
  },

  async createTrip(token, trip) {
    if (isMock(token)) return mockAdapter.createTrip(trip)
    return apiClient.createTrip(token, trip)
  },

  async updateTrip(token, tripId, trip) {
    if (isMock(token)) return mockAdapter.updateTrip(tripId, trip)
    return apiClient.updateTrip(token, tripId, trip)
  },

  async deleteTrip(token, tripId) {
    if (isMock(token)) return mockAdapter.deleteTrip(tripId)
    return apiClient.deleteTrip(token, tripId)
  },

  // ==================== SHARING & CAN-EDIT COPY ====================
  async getTripShareToken(token, tripId, permission) {
    if (isMock(token)) return mockAdapter.getTripShareToken(tripId, permission)
    return apiClient.getTripShareToken(token, tripId, permission)
  },

  async getSharedTrip(shareToken) {
    if (isMock(shareToken)) return mockAdapter.getSharedTrip(shareToken)
    return apiClient.getSharedTrip(shareToken)
  },

  async getSharedEditTrip(editShareToken) {
    if (isMock(editShareToken)) return mockAdapter.getSharedEditTrip(editShareToken)
    return apiClient.getSharedEditTrip(editShareToken)
  },

  async copySharedEditTrip(token, editShareToken) {
    if (isMock(token)) return mockAdapter.copySharedEditTrip(editShareToken)
    return apiClient.copySharedEditTrip(token, editShareToken)
  },

  // ==================== TRIPMATES COLLABORATION ====================
  async getSharedTripmateTrips(token) {
    if (isMock(token)) return { trips: [] }
    return apiClient.getSharedTripmateTrips(token)
  },

  async getSharedTripmateTrip(token, tripId) {
    if (isMock(token)) return mockAdapter.getSharedTripmateTrip(tripId)
    return apiClient.getSharedTripmateTrip(token, tripId)
  },

  async updateTripmateItinerary(token, tripId, payload) {
    if (isMock(token)) return mockAdapter.updateTripmateItinerary(tripId, payload)
    return apiClient.updateTripmateItinerary(token, tripId, payload)
  },

  async getTripMembers(token, tripId) {
    if (isMock(token)) return mockAdapter.getTripMembers(tripId)
    return apiClient.getTripMembers(token, tripId)
  },

  async inviteTripMember(token, tripId, identifier) {
    if (isMock(token)) return mockAdapter.inviteTripMember(tripId, identifier)
    return apiClient.inviteTripMember(token, tripId, identifier)
  },

  async getUserInvitations(token) {
    if (isMock(token)) return { invitations: [] }
    return apiClient.getUserInvitations(token)
  },

  async respondToTripInvitation(token, inviteId, action) {
    if (isMock(token)) return mockAdapter.respondToTripInvitation(inviteId, action)
    return apiClient.respondToTripInvitation(token, inviteId, action)
  },

  async removeTripMember(token, tripId, userId) {
    if (isMock(token)) return mockAdapter.removeTripMember(tripId, userId)
    return apiClient.removeTripMember(token, tripId, userId)
  },

  // ==================== DEDICATED SHARED BUDGET & SETTLEMENTS ====================
  async listSharedBudgetExpenses(token, tripId) {
    if (isMock(token)) return mockAdapter.listSharedBudgetExpenses(tripId)
    return apiClient.listSharedBudgetExpenses(token, tripId)
  },
  async getSharedBudgetExpenses(token, tripId) {
    return this.listSharedBudgetExpenses(token, tripId)
  },

  async getSharedBudgetExpense(token, tripId, expenseId) {
    if (isMock(token)) return mockAdapter.getSharedBudgetExpense(tripId, expenseId)
    return apiClient.getSharedBudgetExpense(token, tripId, expenseId)
  },

  async createSharedBudgetExpense(token, tripId, payload) {
    if (isMock(token)) return mockAdapter.createSharedBudgetExpense(tripId, payload)
    return apiClient.createSharedBudgetExpense(token, tripId, payload)
  },
  async addSharedBudgetExpense(token, tripId, payload) {
    return this.createSharedBudgetExpense(token, tripId, payload)
  },

  async updateSharedBudgetExpense(token, tripId, expenseId, payload) {
    if (isMock(token)) return mockAdapter.updateSharedBudgetExpense(tripId, expenseId, payload)
    return apiClient.updateSharedBudgetExpense(token, tripId, expenseId, payload)
  },

  async deleteSharedBudgetExpense(token, tripId, expenseId) {
    if (isMock(token)) return mockAdapter.deleteSharedBudgetExpense(tripId, expenseId)
    return apiClient.deleteSharedBudgetExpense(token, tripId, expenseId)
  },

  async listSharedBudgetSettlements(token, tripId) {
    if (isMock(token)) return mockAdapter.listSharedBudgetSettlements(tripId)
    return apiClient.listSharedBudgetSettlements(token, tripId)
  },
  async getSharedBudgetSettlements(token, tripId) {
    return this.listSharedBudgetSettlements(token, tripId)
  },

  async createSharedBudgetSettlement(token, tripId, payload) {
    if (isMock(token)) return mockAdapter.createSharedBudgetSettlement(tripId, payload)
    return apiClient.createSharedBudgetSettlement(token, tripId, payload)
  },
  async addSharedBudgetSettlement(token, tripId, payload) {
    return this.createSharedBudgetSettlement(token, tripId, payload)
  },

  async deleteSharedBudgetSettlement(token, tripId, settlementId) {
    if (isMock(token)) return mockAdapter.deleteSharedBudgetSettlement(tripId, settlementId)
    return apiClient.deleteSharedBudgetSettlement(token, tripId, settlementId)
  },

  // ==================== SOCIAL & DISCOVERY ====================
  async searchUsers(queryOrToken, limitOrQuery, limit) {
    let q = queryOrToken
    let lim = limitOrQuery
    if (typeof queryOrToken === 'string' && typeof limitOrQuery === 'string') {
      q = limitOrQuery
      lim = limit
    }
    if (isMock()) return mockAdapter.searchUsers(q, lim)
    return apiClient.searchUsers(q, lim)
  },

  async getPublicUserByUsername(username) {
    if (isMock()) return mockAdapter.getPublicUserByUsername(username)
    return apiClient.getPublicUserByUsername(username)
  },

  async getPublicTripsByUsername(username) {
    if (isMock()) return mockAdapter.getPublicTripsByUsername(username)
    return apiClient.getPublicTripsByUsername(username)
  },

  async getPublicTripById(tripId) {
    if (isMock()) return mockAdapter.getPublicTripById(tripId)
    return apiClient.getPublicTripById(tripId)
  },

  async followUser(token, username) {
    if (isMock()) return mockAdapter.followUser(username)
    return apiClient.followUser(token, username)
  },

  async unfollowUser(token, username) {
    if (isMock()) return mockAdapter.unfollowUser(username)
    return apiClient.unfollowUser(token, username)
  },

  async getFollowStatus(username, token) {
    if (isMock()) return mockAdapter.getFollowStatus(username)
    return apiClient.getFollowStatus(username, token)
  },

  // ==================== NOTIFICATIONS ====================
  async getNotifications(token, limit) {
    if (isMock(token)) return mockAdapter.getNotifications()
    return apiClient.getNotifications(token, limit)
  },

  async markNotificationRead(token, notificationId) {
    if (isMock(token)) return mockAdapter.markNotificationRead(notificationId)
    return apiClient.markNotificationRead(token, notificationId)
  },

  async markAllNotificationsRead(token) {
    if (isMock(token)) return mockAdapter.markAllNotificationsRead()
    return apiClient.markAllNotificationsRead(token)
  },

  // ==================== AI ASSISTANT ====================
  async chatWithAi(prompt, tripContext) {
    if (isMock()) return mockAdapter.chatWithAi(prompt, tripContext)
    return apiClient.chatWithAi(prompt, tripContext)
  },

  // ==================== SEQUENCING (TSP & ROUTING) ====================
  async sequenceDay(dayIdOrPayload, maybeLocations, maybeOptions, maybeStart, maybeTripId) {
    if (isMock()) {
      return mockAdapter.sequenceDay(dayIdOrPayload, maybeLocations, maybeOptions, maybeStart, maybeTripId)
    }
    return apiClient.sequenceDay(dayIdOrPayload, maybeLocations, maybeOptions, maybeStart, maybeTripId)
  },

  // ==================== ACTIVITY HISTORY ====================
  async getHistory(token, limit) {
    if (isMock(token)) return mockAdapter.getHistory(limit)
    return apiClient.getHistory(token, limit)
  },

  // ==================== ADMIN PORTAL ====================
  async getAdminOverview(token) {
    if (isMock()) return mockAdapter.getAdminOverview()
    return apiClient.getAdminOverview(token)
  },

  async getAdminUsers(token, params) {
    if (isMock()) return mockAdapter.getAdminUsers(params)
    return apiClient.getAdminUsers(token, params)
  },

  async getAdminUserDetails(token, userId) {
    if (isMock()) return mockAdapter.getAdminUserDetails(userId)
    return apiClient.getAdminUserDetails(token, userId)
  },

  async updateAdminUserStatus(token, userId, status) {
    if (isMock()) return mockAdapter.updateAdminUserStatus(userId, status)
    return apiClient.updateAdminUserStatus(token, userId, status)
  },

  async updateAdminUserRole(token, userId, role) {
    if (isMock()) return mockAdapter.updateAdminUserRole(userId, role)
    return apiClient.updateAdminUserRole(token, userId, role)
  },

  async deleteAdminUser(token, userId) {
    if (isMock()) return mockAdapter.deleteAdminUser(userId)
    return apiClient.deleteAdminUser(token, userId)
  },

  async getAdminTrips(token, search) {
    if (isMock()) return mockAdapter.getAdminTrips(search)
    return apiClient.getAdminTrips(token, search)
  },

  async deleteAdminTrip(token, tripId) {
    if (isMock()) return mockAdapter.deleteAdminTrip(tripId)
    return apiClient.deleteAdminTrip(token, tripId)
  },

  // ==================== EXPLORE & WEATHER ====================
  async getWeather(lat, lon) {
    if (isMock()) return mockAdapter.getWeather(lat, lon)
    return apiClient.getWeather(lat, lon)
  },

  async getExplorePlaces(lat, lon, query) {
    if (isMock()) return mockAdapter.getExplorePlaces(lat, lon, query)
    return apiClient.getExplorePlaces(lat, lon, query)
  },

  async getPlaceDetails(placeId, dataId, fallbackPlace = null) {
    // If placeId is a non-Google synthetic or OSM ID, handle via local adapter immediately to avoid backend 502
    const isSynthetic = placeId && (
      String(placeId).startsWith('osm-') ||
      String(placeId).startsWith('nom-') ||
      String(placeId).startsWith('dyn-') ||
      String(placeId).startsWith('place-') ||
      String(placeId).startsWith('custom:')
    )

    if (isMock() || isSynthetic) {
      return mockAdapter.getPlaceDetails(placeId, dataId, fallbackPlace)
    }

    try {
      return await apiClient.getPlaceDetails(placeId, dataId)
    } catch (error) {
      // Graceful fallback for 502 Bad Gateway (SerpAPI rate-limit, missing backend key, or unknown data_id)
      return mockAdapter.getPlaceDetails(placeId, dataId, fallbackPlace)
    }
  },

  async getPlacePhotos(dataId) {
    if (isMock()) return mockAdapter.getPlacePhotos(dataId)
    return apiClient.getPlacePhotos(dataId)
  },
}

if (typeof global !== 'undefined') {
  global.__TRIPNEST_API_SERVICE__ = apiService
}

export default apiService

