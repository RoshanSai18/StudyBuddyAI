import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

// Shared study state for the sidebar and pages: the ranked topics and XP/level, refreshed after anything
// that can change them. Pages that already get a fresh `xp` object back from an API call (answering a
// question, finishing a quiz, marking a flashcard) push it straight in via setXp instead of refetching.
const StudyContext = createContext(null)

export function StudyProvider({ children }) {
  const [priorities, setPriorities] = useState([])
  const [xp, setXp] = useState(null)
  const [offline, setOffline] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [{ priorities: rows }, xpData] = await Promise.all([api.priorities(), api.xp()])
      setPriorities(rows)
      setXp(xpData)
      setOffline(false)
    } catch (e) {
      if (e.status === 0) setOffline(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(() => ({ priorities, xp, setXp, offline, refresh }), [priorities, xp, offline, refresh])
  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudy() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudy must be used inside <StudyProvider>')
  return ctx
}
