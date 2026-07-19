"use client"

import { useCallback, useSyncExternalStore } from "react"

export type CollectionView = "grid" | "table"

const listeners = new Map<string, Set<() => void>>()

function storageKey(screenKey: string) {
  return `collection-view:${screenKey}`
}

function readView(screenKey: string): CollectionView {
  const value = localStorage.getItem(storageKey(screenKey))
  return value === "table" ? "table" : "grid"
}

function emit(screenKey: string) {
  listeners.get(screenKey)?.forEach((listener) => listener())
}

export function useCollectionView(screenKey: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      const keyListeners = listeners.get(screenKey) ?? new Set()
      keyListeners.add(listener)
      listeners.set(screenKey, keyListeners)
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey(screenKey)) listener()
      }
      window.addEventListener("storage", onStorage)
      return () => {
        keyListeners.delete(listener)
        if (keyListeners.size === 0) listeners.delete(screenKey)
        window.removeEventListener("storage", onStorage)
      }
    },
    [screenKey]
  )
  const getSnapshot = useCallback(() => readView(screenKey), [screenKey])
  const view = useSyncExternalStore(
    subscribe,
    getSnapshot,
    (): CollectionView => "grid"
  )
  const setView = useCallback(
    (nextView: CollectionView) => {
      localStorage.setItem(storageKey(screenKey), nextView)
      emit(screenKey)
    },
    [screenKey]
  )
  return [view, setView] as const
}
