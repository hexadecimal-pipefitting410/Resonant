import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { createBlankProject } from '../domain/project'
import type { Project, Workspace } from '../domain/types'

interface Snapshot { project: Project; label: string }
interface State {
  project: Project
  past: Snapshot[]
  future: Snapshot[]
  dirty: boolean
  workspace: Workspace
  selectedTrackId: string
  selectedClipId: string | null
  selectedBlockId: string | null
}

type Action =
  | { type: 'commit'; project: Project; label: string }
  | { type: 'undo' } | { type: 'redo' }
  | { type: 'load'; project: Project }
  | { type: 'saved' }
  | { type: 'workspace'; workspace: Workspace }
  | { type: 'select-track'; trackId: string; clipId?: string | null }
  | { type: 'select-clip'; clipId: string | null }
  | { type: 'select-block'; blockId: string | null }

export function initialState(): State {
  const project = createBlankProject()
  return { project, past: [], future: [], dirty: false, workspace: 'flow', selectedTrackId: project.tracks[0].id, selectedClipId: project.tracks[0].sessionSlots[0], selectedBlockId: null }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'commit': return { ...state, project: action.project, past: [...state.past.slice(-79), { project: state.project, label: action.label }], future: [], dirty: true }
    case 'undo': {
      const snapshot = state.past.at(-1)
      if (!snapshot) return state
      return { ...state, project: snapshot.project, past: state.past.slice(0, -1), future: [{ project: state.project, label: snapshot.label }, ...state.future].slice(0, 80), dirty: true }
    }
    case 'redo': {
      const snapshot = state.future[0]
      if (!snapshot) return state
      return { ...state, project: snapshot.project, past: [...state.past, { project: state.project, label: snapshot.label }].slice(-80), future: state.future.slice(1), dirty: true }
    }
    case 'load': {
      const firstTrack = action.project.tracks[0]
      return { ...state, project: action.project, past: [], future: [], dirty: false, selectedTrackId: firstTrack?.id ?? '', selectedClipId: firstTrack?.sessionSlots[0] ?? null, selectedBlockId: null }
    }
    case 'saved': return { ...state, dirty: false }
    case 'workspace': return { ...state, workspace: action.workspace, selectedBlockId: action.workspace === 'arrange' ? state.selectedBlockId : null }
    case 'select-track': return { ...state, selectedTrackId: action.trackId, selectedClipId: action.clipId === undefined ? state.selectedClipId : action.clipId, selectedBlockId: null }
    case 'select-clip': return { ...state, selectedClipId: action.clipId, selectedBlockId: null }
    case 'select-block': return { ...state, selectedBlockId: action.blockId }
  }
}

interface Store extends State {
  commit(project: Project, label: string): void
  undo(): void
  redo(): void
  load(project: Project): void
  markSaved(): void
  setWorkspace(workspace: Workspace): void
  selectTrack(trackId: string, clipId?: string | null): void
  selectClip(clipId: string | null): void
  selectBlock(blockId: string | null): void
}

const StoreContext = createContext<Store | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const commit = useCallback((project: Project, label: string) => dispatch({ type: 'commit', project, label }), [])
  const value = useMemo<Store>(() => ({
    ...state, commit,
    undo: () => dispatch({ type: 'undo' }), redo: () => dispatch({ type: 'redo' }),
    load: (project) => dispatch({ type: 'load', project }), markSaved: () => dispatch({ type: 'saved' }),
    setWorkspace: (workspace) => dispatch({ type: 'workspace', workspace }),
    selectTrack: (trackId, clipId) => dispatch({ type: 'select-track', trackId, clipId }),
    selectClip: (clipId) => dispatch({ type: 'select-clip', clipId }), selectBlock: (blockId) => dispatch({ type: 'select-block', blockId }),
  }), [state, commit])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useAppStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('AppStoreProvider is missing')
  return store
}
