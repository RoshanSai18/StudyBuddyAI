import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'

// Shared study state for the sidebar and pages: the ranked topics, refreshed after anything that can change them.
const StudyContext = createContext(null)

export function StudyProvider({ children }) {
  const [priorities, setPriorities] = useState([])
  const [offline, setOffline] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const { priorities: rows } = await api.priorities()
      setPriorities(rows)
      setOffline(false)
    } catch (e) {
      if (e.status === 0) setOffline(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(() => ({ priorities, offline, refresh }), [priorities, offline, refresh])
  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>
}

export function useStudy() {
  const ctx = useContext(StudyContext)
  if (!ctx) throw new Error('useStudy must be used inside <StudyProvider>')
  return ctx
}
