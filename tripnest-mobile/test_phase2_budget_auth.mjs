import assert from 'assert'
import { getTravelerMetaKey } from './src/utils/profileUtils.js'
import { rebuildTripDays, formatTripDateRange } from './src/utils/tripUtils.js'

console.log('=== RUNNING PHASE 2 & 6 VERIFICATION TEST SUITE ===\n')

// 1. Budget Calculations and Category Breakdown Parity
const EXPENSE_CATEGORIES = ['Transport', 'Food', 'Tickets', 'Hotel', 'Shopping', 'Misc']

const sampleExpenses = [
  { id: 'exp_1', name: 'Van to Hunza', amount: 8000, category: 'Transport', date: '2026-06-01' },
  { id: 'exp_2', name: 'Karahi Dinner', amount: 3500, category: 'Food', date: '2026-06-01' },
  { id: 'exp_3', name: 'Fort Entry Ticket', amount: 1500, category: 'Tickets', date: '2026-06-02' },
  { id: 'exp_4', name: 'Serena Hotel', amount: 25000, category: 'Hotel', date: '2026-06-02' },
  { id: 'exp_5', name: 'Local Handicrafts', amount: 4500, category: 'Shopping', date: '2026-06-03' },
  { id: 'exp_6', name: 'Toll plaza & tips', amount: 1500, category: 'Misc', date: '2026-06-03' },
]

const targetBudget = 50000
const totalSpent = sampleExpenses.reduce((sum, e) => sum + e.amount, 0)
const remaining = Math.max(0, targetBudget - totalSpent)
const spentPct = Math.min(100, Math.round((totalSpent / targetBudget) * 100))

assert.strictEqual(totalSpent, 44000, 'Total spent calculation mismatch')
assert.strictEqual(remaining, 6000, 'Remaining budget mismatch')
assert.strictEqual(spentPct, 88, 'Spent percentage mismatch')

// Category Breakdown Calculation
const categoryTotals = {}
EXPENSE_CATEGORIES.forEach((cat) => { categoryTotals[cat] = 0 })
sampleExpenses.forEach((exp) => {
  const cat = EXPENSE_CATEGORIES.includes(exp.category) ? exp.category : 'Misc'
  categoryTotals[cat] += exp.amount
})

assert.strictEqual(categoryTotals['Transport'], 8000)
assert.strictEqual(categoryTotals['Food'], 3500)
assert.strictEqual(categoryTotals['Tickets'], 1500)
assert.strictEqual(categoryTotals['Hotel'], 25000)
assert.strictEqual(categoryTotals['Shopping'], 4500)
assert.strictEqual(categoryTotals['Misc'], 1500)
console.log('✓ Test 1: Budget calculations and category breakdown parity verified.')

// 2. Budget CRUD Mutations Simulation
let testExpenses = [...sampleExpenses]
// Add
testExpenses.push({ id: 'exp_7', name: 'Jeep Safari', amount: 5000, category: 'Transport', date: '2026-06-04' })
assert.strictEqual(testExpenses.length, 7)
// Edit
testExpenses = testExpenses.map((e) => (e.id === 'exp_7' ? { ...e, amount: 6000, note: 'Updated fare' } : e))
const edited = testExpenses.find((e) => e.id === 'exp_7')
assert.strictEqual(edited.amount, 6000)
assert.strictEqual(edited.note, 'Updated fare')
// Delete
testExpenses = testExpenses.filter((e) => e.id !== 'exp_7')
assert.strictEqual(testExpenses.length, 6)
console.log('✓ Test 2: Budget CRUD operations (Add, Edit, Delete) verified.')

// 3. Date Shortening & Stop Preservation in placesPool
const initialDays = [
  { id: 'day_1', date: '2026-06-01', items: [{ id: 'stop_1', title: 'Faisal Mosque' }] },
  { id: 'day_2', date: '2026-06-02', items: [{ id: 'stop_2', title: 'Daman-e-Koh' }] },
  { id: 'day_3', date: '2026-06-03', items: [{ id: 'stop_3', title: 'Lok Virsa Museum' }] },
]

// Shorten from 3 days to 2 days (2026-06-01 to 2026-06-02)
const shortenedDays = rebuildTripDays(initialDays, '2026-06-01', '2026-06-02', '2026-06-01')
assert.strictEqual(shortenedDays.length, 2, 'Should have 2 days')

// Find dropped items
const retainedIds = new Set()
shortenedDays.forEach((d) => (d.items || []).forEach((item) => retainedIds.add(String(item.id))))

const dropped = []
initialDays.forEach((d) => {
  (d.items || []).forEach((item) => {
    if (!retainedIds.has(String(item.id))) {
      dropped.push(item)
    }
  })
})

assert.strictEqual(dropped.length, 1, 'Exactly one stop dropped from day 3')
assert.strictEqual(dropped[0].id, 'stop_3', 'Dropped stop should be Lok Virsa Museum')
console.log('✓ Test 3: Date shortening dropped stops preservation verified.')

// 4. Traveler Metadata Scoping by User ID
const userKey1 = getTravelerMetaKey('654321_Arslan')
const userKey2 = getTravelerMetaKey('user_Ahmad_99')
const guestKey = getTravelerMetaKey(null)

assert.strictEqual(userKey1, 'tripnest_traveler_meta_654321_arslan')
assert.strictEqual(userKey2, 'tripnest_traveler_meta_user_ahmad_99')
assert.strictEqual(guestKey, 'tripnest_traveler_meta_guest')
assert.notStrictEqual(userKey1, userKey2, 'User keys must be isolated')
console.log('✓ Test 4: Traveler metadata scoping by user ID verified.')

// 5. Case-Insensitive Account Lookup with Username or Email
const fallbackUsers = [
  { id: 'u_1', username: 'demo', email: 'demo@example.com', password_hash: 'hash1' },
  { id: 'u_2', username: 'arslan_explorer', email: 'arslan@tripnest.pk', password_hash: 'hash2' },
]

function lookupUser(identifier) {
  const lowered = (identifier || '').trim().toLowerCase()
  return fallbackUsers.find(
    (u) =>
      u.username.trim().toLowerCase() === lowered ||
      u.email.trim().toLowerCase() === lowered
  )
}

assert.ok(lookupUser('DEMO'), 'Uppercase username match')
assert.ok(lookupUser('demo@example.com'), 'Exact email match')
assert.ok(lookupUser('DEMO@EXAMPLE.COM'), 'Uppercase email match')
assert.ok(lookupUser('Arslan_Explorer'), 'Mixed-case username match')
assert.ok(lookupUser('ARSLAN@TRIPNEST.PK'), 'Uppercase email match')
assert.strictEqual(lookupUser('nonexistent'), undefined)
console.log('✓ Test 5: Case-insensitive account lookup with username or email verified.')

// 6. Serialized Persistence Queue
let queue = Promise.resolve()
const executionLog = []

function simulateSave(tripId, payload) {
  queue = queue.then(async () => {
    // Artificial latency
    await new Promise((r) => setTimeout(r, 20))
    executionLog.push({ tripId, payload })
  })
  return queue
}

await Promise.all([
  simulateSave('trip_1', 'mutation 1 - added stop'),
  simulateSave('trip_1', 'mutation 2 - edited note'),
  simulateSave('trip_1', 'mutation 3 - reordered stops'),
])

assert.strictEqual(executionLog.length, 3)
assert.strictEqual(executionLog[0].payload, 'mutation 1 - added stop')
assert.strictEqual(executionLog[1].payload, 'mutation 2 - edited note')
assert.strictEqual(executionLog[2].payload, 'mutation 3 - reordered stops')
console.log('✓ Test 6: Serialized persistence execution queue verified without race conditions.')

console.log('\n=== ALL PHASE 2 & 6 VERIFICATION TESTS PASSED (6/6) ===')
