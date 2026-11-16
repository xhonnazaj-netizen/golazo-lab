import { useSyncExternalStore } from 'react'
import { subscribe, getVersion } from './engine.js'
export function useEngine(){ return useSyncExternalStore(subscribe, getVersion) }
