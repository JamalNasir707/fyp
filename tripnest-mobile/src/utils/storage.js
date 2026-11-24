/**
 * Resilient App Storage Utility for TripNest Mobile
 * 
 * Provides cross-platform persistent key-value storage:
 * - Uses expo-file-system/legacy on Native (Android / iOS)
 * - Uses window.localStorage on Web
 * - Graceful in-memory fallback with zero crash risks
 */

let inMemoryStore = {}
const STORAGE_FILE_NAME = 'tripnest_app_storage.json'

let FileSystem = null
try {
  FileSystem = require('expo-file-system/legacy')
} catch (e1) {
  try {
    FileSystem = require('expo-file-system')
  } catch (e2) {
    FileSystem = null
  }
}

async function getStorageFilePath() {
  if (FileSystem && FileSystem.documentDirectory) {
    return `${FileSystem.documentDirectory}${STORAGE_FILE_NAME}`
  }
  return null
}

async function readAllStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_FILE_NAME)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return inMemoryStore
    }
  }

  const path = await getStorageFilePath()
  if (path && FileSystem && FileSystem.readAsStringAsync && FileSystem.getInfoAsync) {
    try {
      const info = await FileSystem.getInfoAsync(path)
      if (info?.exists) {
        const text = await FileSystem.readAsStringAsync(path)
        return text ? JSON.parse(text) : {}
      }
    } catch {
      // Degrade to memory cache
    }
  }
  return inMemoryStore
}

async function writeAllStorage(data) {
  inMemoryStore = data

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_FILE_NAME, JSON.stringify(data))
      return
    } catch {}
  }

  const path = await getStorageFilePath()
  if (path && FileSystem && FileSystem.writeAsStringAsync) {
    try {
      await FileSystem.writeAsStringAsync(path, JSON.stringify(data))
    } catch {}
  }
}

export const appStorage = {
  async getItem(key) {
    try {
      const data = await readAllStorage()
      return data[key] !== undefined ? data[key] : null
    } catch {
      return inMemoryStore[key] !== undefined ? inMemoryStore[key] : null
    }
  },

  async setItem(key, value) {
    try {
      const data = await readAllStorage()
      data[key] = value
      await writeAllStorage(data)
    } catch {
      inMemoryStore[key] = value
    }
  },

  async removeItem(key) {
    try {
      const data = await readAllStorage()
      delete data[key]
      await writeAllStorage(data)
    } catch {
      delete inMemoryStore[key]
    }
  },

  async clear() {
    inMemoryStore = {}
    const path = await getStorageFilePath()
    if (path && FileSystem && FileSystem.deleteAsync) {
      try {
        await FileSystem.deleteAsync(path, { idempotent: true })
      } catch {}
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_FILE_NAME)
      } catch {}
    }
  },
}

export default appStorage

