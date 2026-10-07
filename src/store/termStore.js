import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useTermStore = create((set) => ({
  currentSession: null,
  currentTerm: null,

  fetchCurrentTerm: async (schoolId) => {
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single()

    if (session) {
      const { data: term } = await supabase
        .from('terms')
        .select('*')
        .eq('session_id', session.id)
        .eq('is_current', true)
        .single()
      set({ currentSession: session, currentTerm: term })
    }
  },
}))