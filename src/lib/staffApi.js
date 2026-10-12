import { supabase } from './supabase'

// Calls one of your Supabase edge functions as the signed-in user.
export const callEdgeFunction = async (name, body) => {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.error) {
    throw new Error(result.error || `Request failed (${response.status})`)
  }
  return result
}

// Which app login a staff role gets. Head Teacher and Principal both log in with the
// Headmaster access; which sections each one manages is set on the Sections page.
export const loginRoleFor = (role, staffType) => {
  if (role === 'Head Teacher' || role === 'Principal') return 'Headmaster'
  if (staffType === 'Teaching') return 'Teacher'
  return null
}

// A role has to fit the staff type: a Teaching person cannot be a Cleaner.src/hooks/useSections.js
const TEACHING_ROLES = ['Class Teacher', 'Subject Teacher', 'Head Teacher', 'Principal', 'Other']
const NON_TEACHING_ROLES = ['Head Teacher', 'Principal', 'Accountant', 'Secretary', 'Security', 'Cleaner', 'Other']

export const rolesForType = (type, keep, canPickLeaders = true) => {
  let list = type === 'Teaching' ? TEACHING_ROLES : type === 'Non-Teaching' ? NON_TEACHING_ROLES : []
  // Only an Admin may choose Head Teacher or Principal
  if (!canPickLeaders) list = list.filter(r => r !== 'Head Teacher' && r !== 'Principal')
  // keep a role the person already has, even if it no longer fits, so it is not silently lost
  return keep && !list.includes(keep) ? [...list, keep] : list
}