/**
 * Photos you take on the walk, kept in this browser (IndexedDB) and never uploaded. Only the newest
 * few are kept, so they don't fill the disk.
 */
import type { SceneId } from '../content/trail.ts'

export type SavedPhoto = { id: string; scene: SceneId; takenAt: number; blob: Blob }

const DB = 'hut2hut-photos'
const STORE = 'photos'
export const MAX_PHOTOS = 24

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No storage for photos in this browser'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Couldn’t open photo storage'))
  })
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = work(tx.objectStore(STORE))
        tx.oncomplete = () => {
          db.close()
          resolve(req ? req.result : undefined)
        }
        tx.onerror = () => reject(tx.error ?? new Error('Photo storage failed'))
      }),
  )
}

export async function listPhotos(): Promise<SavedPhoto[]> {
  const all = ((await run('readonly', (s) => s.getAll())) ?? []) as SavedPhoto[]
  return all.sort((a, b) => b.takenAt - a.takenAt)
}

export async function savePhoto(blob: Blob, scene: SceneId): Promise<SavedPhoto> {
  const photo: SavedPhoto = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, scene, takenAt: Date.now(), blob }
  await run('readwrite', (s) => s.put(photo))
  const all = await listPhotos()
  for (const old of all.slice(MAX_PHOTOS)) await deletePhoto(old.id)
  return photo
}

export async function deletePhoto(id: string) {
  await run('readwrite', (s) => s.delete(id))
}

export function photoFileName(p: SavedPhoto) {
  const d = new Date(p.takenAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `hut-to-hut-${p.scene}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.jpg`
}
