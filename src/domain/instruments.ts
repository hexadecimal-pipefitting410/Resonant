import type { InstrumentRef } from './types'

export interface InstrumentSummary extends InstrumentRef {
  packId: string
  family: string
  variant?: string
  instrument?: string
  bank?: string
  installed: boolean
}

export interface InstrumentPackSummary {
  id: string
  name: string
  version: string
  format: string
  bytes: number
  source?: string
  installedAt: string
  instrumentCount: number
}

export interface InstrumentLibraryState {
  root: string
  packs: InstrumentPackSummary[]
  instruments: InstrumentSummary[]
  bytes: number
}

export interface SampleZone {
  sample?: string
  rootKey: number
  loKey: number
  hiKey: number
  loVel: number
  hiVel: number
  tune?: number
  gainDb?: number
  loopMode?: string
  loopStart?: number
  loopEnd?: number
  oneShot?: boolean
  data?: ArrayBuffer
  extension?: string
  originalPitch?: number
  keyRangeLow?: number
  keyRangeHigh?: number
  velRangeLow?: number
  velRangeHigh?: number
  coarseTune?: number
  fineTune?: number
  sampleRate?: number
  file?: string
}

export interface ResolvedInstrument {
  instrument: InstrumentSummary
  data?: ArrayBuffer
  zones?: SampleZone[]
  preset?: { zones?: SampleZone[]; [key: string]: unknown }
}

export interface InstrumentDownloadProgress {
  phase: 'download' | 'index'
  label: string
  received: number
  total: number
}

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

export function chooseZone(zones: SampleZone[], pitch: number, velocity: number) {
  const midiVelocity = Math.round(Math.max(0, Math.min(1, velocity)) * 127)
  const matching = zones.filter((zone) => {
    const loKey = zone.loKey ?? zone.keyRangeLow ?? 0
    const hiKey = zone.hiKey ?? zone.keyRangeHigh ?? 127
    const loVel = zone.loVel ?? zone.velRangeLow ?? 0
    const hiVel = zone.hiVel ?? zone.velRangeHigh ?? 127
    return pitch >= loKey && pitch <= hiKey && midiVelocity >= loVel && midiVelocity <= hiVel
  })
  return matching[0] ?? zones.reduce<SampleZone | undefined>((best, zone) => {
    const root = zone.rootKey ?? Math.round((zone.originalPitch ?? 6000) / 100)
    const bestRoot = best ? best.rootKey ?? Math.round((best.originalPitch ?? 6000) / 100) : -999
    return !best || Math.abs(root - pitch) < Math.abs(bestRoot - pitch) ? zone : best
  }, undefined)
}
