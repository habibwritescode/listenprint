import {
  RECORD_VERSION,
  createMemoryLibraryStore,
  readArtistDetailsRecord,
  readLibraryRecord,
  readPartialScanRecord,
} from './library-store.ts'
import type { LibraryStore, SavedArtistDetails } from './library-store.ts'

export const DATABASE_NAME = 'listenprint'
const DATABASE_VERSION = 1
const RECORDS = 'records'
const ARTIST_DETAILS = 'artistDetails'

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function openDatabase(indexedDB: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(RECORDS)
      request.result.createObjectStore(ARTIST_DETAILS)
    }
    request.onsuccess = () => {
      const db = request.result
      // Lets a future version of the app in another tab upgrade the database instead of waiting on this one.
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'))
  })
}

export async function openIndexedDbStore(indexedDB: IDBFactory): Promise<LibraryStore> {
  const db = await openDatabase(indexedDB)

  const read = async (storeName: string, key: string) =>
    settle(db.transaction(storeName, 'readonly').objectStore(storeName).get(key))

  const write = async (storeNames: string[], apply: (transaction: IDBTransaction) => void) => {
    const transaction = db.transaction(storeNames, 'readwrite')
    apply(transaction)
    await completed(transaction)
  }

  return {
    persistent: true,
    async loadLibrary() {
      return readLibraryRecord(await read(RECORDS, 'library'))
    },
    async saveLibrary(library) {
      await write([RECORDS], (transaction) => {
        const records = transaction.objectStore(RECORDS)
        records.put({ version: RECORD_VERSION, library }, 'library')
        records.delete('scan')
      })
    },
    async loadPartialScan() {
      return readPartialScanRecord(await read(RECORDS, 'scan'))
    },
    async savePartialScan(scan) {
      await write([RECORDS], (transaction) => {
        transaction.objectStore(RECORDS).put({ version: RECORD_VERSION, scan }, 'scan')
      })
    },
    async discardPartialScan() {
      await write([RECORDS], (transaction) => transaction.objectStore(RECORDS).delete('scan'))
    },
    async loadArtistDetails() {
      const store = db.transaction(ARTIST_DETAILS, 'readonly').objectStore(ARTIST_DETAILS)
      const [keys, values] = await Promise.all([settle(store.getAllKeys()), settle(store.getAll())])
      const records: Record<string, SavedArtistDetails> = {}
      keys.forEach((key, index) => {
        const record = readArtistDetailsRecord(values[index])
        if (record && typeof key === 'string') records[key] = record
      })
      return records
    },
    async saveArtistDetails(artistId, record) {
      await write([ARTIST_DETAILS], (transaction) =>
        transaction.objectStore(ARTIST_DETAILS).put({ version: RECORD_VERSION, record }, artistId),
      )
    },
    async clear() {
      // Clears the stores rather than deleting the database, which other open tabs would block.
      await write([RECORDS, ARTIST_DETAILS], (transaction) => {
        transaction.objectStore(RECORDS).clear()
        transaction.objectStore(ARTIST_DETAILS).clear()
      })
    },
  }
}

/**
 * IndexedDB when it opens; otherwise the memory store, whose `persistent: false` lets the UI say so. Takes a getter
 * because some browsers throw from `window.indexedDB` itself when site data is blocked.
 */
export async function openLibraryStore(getIndexedDB: () => IDBFactory | undefined): Promise<LibraryStore> {
  try {
    const indexedDB = getIndexedDB()
    return indexedDB ? await openIndexedDbStore(indexedDB) : createMemoryLibraryStore()
  } catch {
    return createMemoryLibraryStore()
  }
}
