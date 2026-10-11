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

// A role has to fit the staff type: a Teaching person cannot be a Cleaner.
const TEACHING_ROLES = ['Class Teacher', 'Subject Teacher', 'Head Teacher', 'Other']
const NON_TEACHING_ROLES = ['Head Teacher', 'Accountant', 'Secretary', 'Security', 'Cleaner', 'Other']

export const rolesForType = (type, keep) => {
  const list = type === 'Teaching' ? TEACHING_ROLES : type === 'Non-Teaching' ? NON_TEACHING_ROLES : []
  // keep a role the person already has, even if it no longer fits, so it is not silently lost
  return keep && !list.includes(keep) ? [...list, keep] : list
}