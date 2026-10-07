import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { cacheAuthMeta, getCachedAuthMeta } from '../lib/offlineDB'

export const useAuthStore = create((set) => ({
  user: null,
  role: null,
  schoolId: null,
  schoolName: null,
  schoolLogo: null,
  loading: true,

  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setSchoolId: (schoolId) => set({ schoolId }),
  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    set({ loading: true })
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      if (navigator.onLine) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role, school_id')
          .eq('auth_user_id', session.user.id)
          .single()

        // Fetch school details
        let schoolName = null
        let schoolLogo = null
        if (roleData?.school_id) {
          const { data: schoolData } = await supabase
            .from('schools')
            .select('name, logo_url')
            .eq('id', roleData.school_id)
            .single()
          schoolName = schoolData?.name || null
          schoolLogo = schoolData?.logo_url || null
        }

        if (roleData) cacheAuthMeta(roleData.role, roleData.school_id, schoolName, schoolLogo)

        set({
          user: session.user,
          role: roleData?.role || null,
          schoolId: roleData?.school_id || null,
          schoolName,
          schoolLogo,
        })
      } else {
        // Offline — can't confirm role/school from the server, so trust
        // the cached session and use whatever was cached last time we
        // were online, instead of leaving role/schoolId as null
        const cached = getCachedAuthMeta()
        set({
          user: session.user,
          role: cached.role,
          schoolId: cached.schoolId,
          schoolName: cached.schoolName,
          schoolLogo: cached.schoolLogo,
        })
      }
    }
    set({ loading: false })
  },

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role, school_id')
      .eq('auth_user_id', data.user.id)
      .single()
    //
    let schoolName = null
    let schoolLogo = null
    if (roleData?.school_id) {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name, logo_url')
        .eq('id', roleData.school_id)
        .single()
      schoolName = schoolData?.name || null
      schoolLogo = schoolData?.logo_url || null
    }

    set({
      user: data.user,
      role: roleData?.role || null,
      schoolId: roleData?.school_id || null,
      schoolName,
      schoolLogo,
    })
    return roleData?.role
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, role: null, schoolId: null })
  },
}))