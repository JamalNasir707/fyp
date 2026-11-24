import React, { useState, useEffect } from 'react'
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme/colors'
import { typography } from '../../theme/typography'
import { useApp } from '../../context/AppContext'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'

export function SettingsScreen({ navigation }) {
  const { user, token, updateUserProfile, deleteAccount, logout, preferences, updatePreference, updatePreferences } = useApp()

  // Tab: 'account' | 'preferences' | 'notifications' | 'membership'
  const [activeTab, setActiveTab] = useState('account')

  // Profile Draft
  const [name, setName] = useState(user?.name || user?.displayName || '')
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [profileImage, setProfileImage] = useState(user?.profileImage || '')
  const [savingProfile, setSavingProfile] = useState(false)

  // Preferences
  const [dateFormat, setDateFormat] = useState('month-day') // 'month-day' | 'day-month'
  const [distanceFormat, setDistanceFormat] = useState('kilometers') // 'kilometers' | 'miles'
  const [timeFormat, setTimeFormat] = useState('12-hour') // '12-hour' | '24-hour'
  const [expertTips, setExpertTips] = useState(true)
  const [photoUploadWifiOnly, setPhotoUploadWifiOnly] = useState(false)
  const [language, setLanguage] = useState('English')

  // Notifications
  const [emailTripInvites, setEmailTripInvites] = useState(true)
  const [emailTripUpdates, setEmailTripUpdates] = useState(true)
  const [emailSecurity, setEmailSecurity] = useState(true)
  const [pushTripInvites, setPushTripInvites] = useState(true)
  const [pushTripReminders, setPushTripReminders] = useState(true)
  const [pushAnnouncements, setPushAnnouncements] = useState(false)

  // Delete Account Modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || user.displayName || '')
      setUsername(user.username || '')
      setEmail(user.email || '')
      setBio(user.bio || '')
      setProfileImage(user.profileImage || '')
    }
  }, [user])

  async function handleSaveProfile() {
    if (!name.trim()) {
      Alert.alert('Required', 'Name cannot be empty')
      return
    }
    setSavingProfile(true)
    try {
      await updateUserProfile({
        name: name.trim(),
        displayName: name.trim(),
        username: username.trim().replace(/^@/, ''),
        email: email.trim(),
        bio: bio.trim(),
        profileImage: profileImage.trim() || null,
      })
      Alert.alert('Saved', 'Profile settings updated successfully.')
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleDeleteAccountSubmit() {
    if (!deleteReason.trim()) {
      Alert.alert('Reason required', 'Please provide a short reason for account deletion.')
      return
    }
    if (!deleteConfirmed) {
      Alert.alert('Confirmation required', 'Please check the box confirming you understand this action is permanent.')
      return
    }

    setDeleting(true)
    try {
      await deleteAccount(deleteReason.trim())
      setDeleteModalVisible(false)
      Alert.alert('Account Deleted', 'Your account has been deleted permanently.')
    } catch (err) {
      Alert.alert('Deletion Failed', err.message || 'Could not delete account.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack()
            } else {
              navigation.navigate('MainTabs', { screen: 'ProfileTab' })
            }
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Settings & Preferences</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[
          { key: 'account', label: 'Account', icon: 'person-outline' },
          { key: 'preferences', label: 'Preferences', icon: 'options-outline' },
          { key: 'notifications', label: 'Alerts', icon: 'notifications-outline' },
          { key: 'membership', label: 'Pro', icon: 'star-outline' },
        ].map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? colors.primary : colors.textTertiary}
              />
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ========================================================= */}
        {/* TAB 1: ACCOUNT */}
        {/* ========================================================= */}
        {activeTab === 'account' && (
          <View style={styles.sectionCol}>
            <Card style={styles.card} padding="lg">
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Personal Profile</Text>
                <Badge
                  label={user?.role === 'admin' ? 'Admin' : 'Traveler'}
                  variant={user?.role === 'admin' ? 'accent' : 'primary'}
                  size="sm"
                />
              </View>

              <Text style={styles.fieldLabel}>Display Name</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Username</Text>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                autoCapitalize="none"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Profile Image URL (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={profileImage}
                onChangeText={setProfileImage}
                placeholder="https://example.com/avatar.jpg"
                autoCapitalize="none"
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Bio</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell other travelers about your travel style..."
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.textTertiary}
              />

              <Button
                title={savingProfile ? 'Saving...' : 'Save Profile Changes'}
                onPress={handleSaveProfile}
                disabled={savingProfile}
                style={{ marginTop: 16 }}
              />
            </Card>

            {/* Account Actions */}
            <Card style={styles.card} padding="lg">
              <Text style={styles.cardTitle}>Account Security & Actions</Text>
              <Text style={styles.cardSub}>Manage authentication session and data</Text>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'destructive', onPress: logout },
                  ])
                }}
                activeOpacity={0.7}
              >
                <View style={styles.actionRowLeft}>
                  <Ionicons name="log-out-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.actionRowText}>Sign Out of TripNest</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={[styles.actionRow, { paddingBottom: 0 }]}
                onPress={() => {
                  setDeleteReason('')
                  setDeleteConfirmed(false)
                  setDeleteModalVisible(true)
                }}
                activeOpacity={0.7}
              >
                <View style={styles.actionRowLeft}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                  <Text style={[styles.actionRowText, { color: colors.error }]}>Delete Account</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.error} />
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 2: PREFERENCES */}
        {/* ========================================================= */}
        {activeTab === 'preferences' && (
          <View style={styles.sectionCol}>
            <Card style={styles.card} padding="lg">
              <Text style={styles.cardTitle}>Unit & Display Preferences</Text>

              {/* Date Format */}
              <Text style={styles.fieldLabel}>Date Format</Text>
              <View style={styles.pillGroup}>
                {[
                  { key: 'month-day', label: 'Month / Day' },
                  { key: 'day-month', label: 'Day / Month' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.choicePill, (preferences?.dateFormat || 'month-day') === item.key && styles.choicePillActive]}
                    onPress={() => updatePreference('dateFormat', item.key)}
                  >
                    <Text style={[styles.choicePillText, (preferences?.dateFormat || 'month-day') === item.key && styles.choicePillTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Distance Unit */}
              <Text style={styles.fieldLabel}>Distance Unit</Text>
              <View style={styles.pillGroup}>
                {[
                  { key: 'kilometers', label: 'Kilometers (km)' },
                  { key: 'miles', label: 'Miles (mi)' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.choicePill, (preferences?.distanceFormat || 'kilometers') === item.key && styles.choicePillActive]}
                    onPress={() => updatePreference('distanceFormat', item.key)}
                  >
                    <Text style={[styles.choicePillText, (preferences?.distanceFormat || 'kilometers') === item.key && styles.choicePillTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Time Format */}
              <Text style={styles.fieldLabel}>Time Format</Text>
              <View style={styles.pillGroup}>
                {[
                  { key: '12-hour', label: '12-Hour (10:00 AM)' },
                  { key: '24-hour', label: '24-Hour (10:00)' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.choicePill, (preferences?.timeFormat || '12-hour') === item.key && styles.choicePillActive]}
                    onPress={() => updatePreference('timeFormat', item.key)}
                  >
                    <Text style={[styles.choicePillText, (preferences?.timeFormat || '12-hour') === item.key && styles.choicePillTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            <Card style={styles.card} padding="lg">
              <Text style={styles.cardTitle}>Trip Planner Intelligence</Text>

              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Expert Travel Tips</Text>
                  <Text style={styles.switchSub}>Surface localized advice & warnings while planning itineraries</Text>
                </View>
                <Switch
                  value={preferences?.expertTravelTips === 'enabled'}
                  onValueChange={(val) => updatePreference('expertTravelTips', val ? 'enabled' : 'disabled')}
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Upload Media on Wi-Fi Only</Text>
                  <Text style={styles.switchSub}>Conserve mobile data when uploading journal photos</Text>
                </View>
                <Switch
                  value={preferences?.photoUpload === 'wifi-only'}
                  onValueChange={(val) => updatePreference('photoUpload', val ? 'wifi-only' : 'cellular-and-wifi')}
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                />
              </View>
            </Card>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 3: NOTIFICATIONS */}
        {/* ========================================================= */}
        {activeTab === 'notifications' && (
          <View style={styles.sectionCol}>
            <Card style={styles.card} padding="lg">
              <Text style={styles.cardTitle}>Email Notifications</Text>

              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Trip Invitations</Text>
                  <Text style={styles.switchSub}>When a collaborator invites you to join an expedition</Text>
                </View>
                <Switch
                  value={preferences?.emailNotifications?.tripInvitations ?? true}
                  onValueChange={(val) =>
                    updatePreferences((prev) => ({
                      ...prev,
                      emailNotifications: { ...prev.emailNotifications, tripInvitations: val },
                    }))
                  }
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Trip Updates & Changes</Text>
                  <Text style={styles.switchSub}>When itinerary stops or shared expenses are updated</Text>
                </View>
                <Switch
                  value={preferences?.emailNotifications?.tripUpdates ?? true}
                  onValueChange={(val) =>
                    updatePreferences((prev) => ({
                      ...prev,
                      emailNotifications: { ...prev.emailNotifications, tripUpdates: val },
                    }))
                  }
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Account Security</Text>
                  <Text style={styles.switchSub}>Important login and session notifications</Text>
                </View>
                <Switch
                  value={preferences?.emailNotifications?.accountSecurity ?? true}
                  onValueChange={(val) =>
                    updatePreferences((prev) => ({
                      ...prev,
                      emailNotifications: { ...prev.emailNotifications, accountSecurity: val },
                    }))
                  }
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                />
              </View>
            </Card>

            <Card style={styles.card} padding="lg">
              <Text style={styles.cardTitle}>Push Notifications</Text>

              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Collaboration Invites</Text>
                  <Text style={styles.switchSub}>Immediate alert when invited to co-plan a trip</Text>
                </View>
                <Switch
                  value={preferences?.pushNotifications?.tripInvitations ?? true}
                  onValueChange={(val) =>
                    updatePreferences((prev) => ({
                      ...prev,
                      pushNotifications: { ...prev.pushNotifications, tripInvitations: val },
                    }))
                  }
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>Upcoming Trip Reminders</Text>
                  <Text style={styles.switchSub}>Timely notifications before your scheduled departure</Text>
                </View>
                <Switch
                  value={preferences?.pushNotifications?.tripReminders ?? true}
                  onValueChange={(val) =>
                    updatePreferences((prev) => ({
                      ...prev,
                      pushNotifications: { ...prev.pushNotifications, tripReminders: val },
                    }))
                  }
                  trackColor={{ false: colors.borderLight, true: colors.primary }}
                />
              </View>
            </Card>
          </View>
        )}

        {/* ========================================================= */}
        {/* TAB 4: MEMBERSHIP */}
        {/* ========================================================= */}
        {activeTab === 'membership' && (
          <View style={styles.sectionCol}>
            <Card style={styles.card} padding="lg">
              <View style={styles.proHero}>
                <Ionicons name="sparkles" size={32} color={colors.accent} />
                <Text style={styles.proTitle}>TripNest Pro</Text>
                <Text style={styles.proSubtitle}>AI Trip Intelligence & Multi-Stop TSP Optimization</Text>
              </View>

              <View style={styles.proFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.proFeatureText}>Unlimited TSP multi-stop day route optimization</Text>
              </View>
              <View style={styles.proFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.proFeatureText}>Real-time OSRM driving routes & road distances</Text>
              </View>
              <View style={styles.proFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.proFeatureText}>Real-time live weather feeds across Pakistan</Text>
              </View>
              <View style={styles.proFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.proFeatureText}>Offline trip synchronization & PDF/Print exports</Text>
              </View>
              <View style={styles.proFeatureRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.proFeatureText}>Collaborative Tripmates workspace with bill splitting</Text>
              </View>

              <View style={styles.tierBadgeBox}>
                <Text style={styles.tierLabel}>Current Tier:</Text>
                <Badge label="Active Explorer Membership" variant="success" size="sm" />
              </View>
            </Card>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.deleteWarningIcon}>
              <Ionicons name="warning" size={32} color={colors.error} />
            </View>
            <Text style={styles.deleteModalTitle}>Delete Account Permanently</Text>
            <Text style={styles.deleteModalSub}>
              This will permanently delete your account, saved trips, and collaborative data. This action cannot be undone.
            </Text>

            <Text style={styles.fieldLabel}>Why are you leaving?</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={deleteReason}
              onChangeText={setDeleteReason}
              placeholder="Please let us know your reason..."
              multiline
              numberOfLines={2}
              placeholderTextColor={colors.textTertiary}
            />

            <TouchableOpacity
              style={styles.confirmCheckRow}
              onPress={() => setDeleteConfirmed(!deleteConfirmed)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={deleteConfirmed ? 'checkbox' : 'square-outline'}
                size={22}
                color={deleteConfirmed ? colors.error : colors.textTertiary}
              />
              <Text style={styles.confirmCheckText}>
                I understand that this action is irreversible and permanent.
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActionsRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setDeleteModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={deleting ? 'Deleting...' : 'Delete Permanently'}
                onPress={handleDeleteAccountSubmit}
                disabled={!deleteReason.trim() || !deleteConfirmed || deleting}
                style={{ flex: 1.2, backgroundColor: colors.error }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  scrollContent: {
    padding: 16,
  },
  sectionCol: {
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  pillGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  choicePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  choicePillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  choicePillText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  choicePillTextActive: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  switchCol: {
    flex: 1,
    paddingRight: 16,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  switchSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  proHero: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  proTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 8,
  },
  proSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  proFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  proFeatureText: {
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
  },
  tierBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceHover,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  tierLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  deleteWarningIcon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  deleteModalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  confirmCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 20,
  },
  confirmCheckText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
})

export default SettingsScreen
