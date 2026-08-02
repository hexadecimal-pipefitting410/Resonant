export interface AceStepState {
  root: string
  version: string | null
  installed: boolean
  modelsReady: boolean
  running: boolean
  pid: number | null
  startedAt: string | null
  bytes: number
  outputs: string[]
  profile: {
    dit: string
    languageModel: string
    backend: string
    cpuOffload: boolean
    batchSize: number
  }
}

export interface AceStepProgress {
  phase: 'download' | 'setup' | 'model' | 'starting' | 'generate' | 'ready'
  label: string
  received: number
  total: number
}

export interface AceStepGenerateRequest {
  title?: string
  prompt: string
  lyrics?: string
  instrumental: boolean
  duration: number
  bpm?: number
  keyScale?: string
  language?: string
  seed?: number
}

export interface AceStepGeneration {
  path: string
  name: string
  data: ArrayBuffer
  taskId: string
  metadata: Record<string, unknown>
  seed: string | null
}

export const EMPTY_ACE_STEP_STATE: AceStepState = {
  root: 'Desktop app required', version: null, installed: false, modelsReady: false, running: false,
  pid: null, startedAt: null, bytes: 0, outputs: [],
  profile: { dit: 'acestep-v15-turbo', languageModel: 'acestep-5Hz-lm-0.6B', backend: 'pt', cpuOffload: true, batchSize: 1 },
}
