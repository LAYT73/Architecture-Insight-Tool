import { useCallback, useMemo, useState } from 'react'
import { loadProjectFromFiles } from '../core/file/projectAnalysis'
import { createSampleSnapshot } from '../core/file/projectSample'
import type { ProjectFilters, ProjectFileType, ProjectLayer, ProjectSnapshot } from '../core/file/projectTypes'

const initialSnapshot = createSampleSnapshot()

function createInitialFilters(snapshot: ProjectSnapshot): ProjectFilters {
  return {
    search: '',
    layers: snapshot.layers,
    types: snapshot.fileTypes,
    violationsOnly: false,
  }
}

export function useProjectExplorer() {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot>(initialSnapshot)
  const [filters, setFilters] = useState<ProjectFilters>(() => createInitialFilters(initialSnapshot))
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceLabel, setSourceLabel] = useState(initialSnapshot.rootName)

  const updateSearch = useCallback((search: string) => {
    setFilters((current) => ({ ...current, search }))
  }, [])

  const updateLayers = useCallback((layers: ProjectLayer[]) => {
    setFilters((current) => ({ ...current, layers }))
  }, [])

  const updateTypes = useCallback((types: ProjectFileType[]) => {
    setFilters((current) => ({ ...current, types }))
  }, [])

  const updateViolationsOnly = useCallback((violationsOnly: boolean) => {
    setFilters((current) => ({ ...current, violationsOnly }))
  }, [])

  const selectFile = useCallback((fileId: string | null) => {
    setSelectedFileId(fileId)
  }, [])

  const loadProject = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)

    if (fileArray.length === 0) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const nextSnapshot = await loadProjectFromFiles(fileArray)
      setSnapshot(nextSnapshot)
      setSourceLabel(nextSnapshot.rootName)
      setFilters(createInitialFilters(nextSnapshot))
      setSelectedFileId(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить выбранную папку.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const availableLayers = useMemo(() => snapshot.layers, [snapshot.layers])
  const availableTypes = useMemo(() => snapshot.fileTypes, [snapshot.fileTypes])

  return {
    snapshot,
    filters,
    selectedFileId,
    selectFile,
    availableLayers,
    availableTypes,
    isLoading,
    error,
    sourceLabel,
    loadProject,
    updateSearch,
    updateLayers,
    updateTypes,
    updateViolationsOnly,
  }
}
