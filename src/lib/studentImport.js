// Reading and checking a class list (Excel or CSV) before it is imported as students.
// Everything here is plain functions, so it can be tested without the screen.

export const FIELDS = [
  { key: 'full_name', label: 'Full name (one column)', group: 'name', words: ['name', 'fullname', 'studentname', 'nameofstudent', 'pupilname', 'nameofpupil', 'namesofstudents', 'studentsname'] },
  { key: 'first_name', label: 'First name', group: 'name', words: ['firstname', 'first', 'givenname', 'forename'] },
  { key: 'middle_name', label: 'Middle name', group: 'name', words: ['middlename', 'middle', 'othername', 'othernames'] },
  { key: 'last_name', label: 'Surname / last name', group: 'name', words: ['lastname', 'surname', 'familyname', 'last'] },
  { key: 'gender', label: 'Gender', required: true, words: ['gender', 'sex'] },
  { key: 'date_of_birth', label: 'Date of birth', words: ['dateofbirth', 'dob', 'birthdate', 'birthday', 'dateofbirthdob'] },
  { key: 'arm', label: 'Arm', words: ['arm', 'division', 'classarm'] },
  { key: 'department', label: 'Department', words: ['department', 'dept'] },
  { key: 'guardian_name', label: 'Guardian / parent name', words: ['guardianname', 'parentname', 'parent', 'guardian', 'parentguardianname', 'nameofparent', 'nameofguardian', 'parentsname', 'fathername', 'mothername'] },
  { key: 'guardian_relationship', label: 'Relationship to child', words: ['relationship', 'guardianrelationship', 'relationshiptochild', 'relationshiptostudent'] },
  { key: 'guardian_phone', label: 'Guardian phone', words: ['guardianphone', 'parentphone', 'phone', 'phonenumber', 'parentphonenumber', 'guardianphonenumber', 'contactnumber', 'parentcontact', 'gsm', 'mobile', 'parentsphone', 'phoneno', 'parentgsm', 'contact'] },
  { key: 'guardian_email', label: 'Guardian email', words: ['guardianemail', 'parentemail', 'email', 'emailaddress', 'parentemailaddress', 'parentsemail'] },
  { key: 'guardian_occupation', label: 'Guardian occupation', words: ['guardianoccupation', 'parentoccupation', 'occupation'] },
  { key: 'admission_date', label: 'Admission date', words: ['admissiondate', 'dateofadmission', 'dateadmitted'] },
  { key: 'nationality', label: 'Nationality', words: ['nationality'] },
  { key: 'state_of_origin', label: 'State of origin', words: ['stateoforigin', 'state', 'origin'] },
  { key: 'lga_of_origin', label: 'LGA of origin', words: ['lgaoforigin', 'lga', 'localgovernment', 'localgovernmentarea'] },
  { key: 'religion', label: 'Religion', words: ['religion'] },
  { key: 'blood_group', label: 'Blood group', words: ['bloodgroup', 'bloodtype'] },
  { key: 'genotype', label: 'Genotype', words: ['genotype'] },
  { key: 'home_address', label: 'Home address', words: ['homeaddress', 'address', 'residentialaddress'] },
  { key: 'lga_of_residence', label: 'LGA of residence', words: ['lgaofresidence'] },
  { key: 'state_of_residence', label: 'State of residence', words: ['stateofresidence'] },
  { key: 'medical_conditions', label: 'Medical conditions', words: ['medicalconditions', 'medicalcondition', 'healthcondition', 'healthissues', 'medical'] },
  { key: 'emergency_contact_name', label: 'Emergency contact name', words: ['emergencycontactname', 'emergencycontact', 'emergencyname'] },
  { key: 'emergency_contact_phone', label: 'Emergency contact phone', words: ['emergencycontactphone', 'emergencyphone', 'emergencynumber'] },
]

export const TEMPLATE_HEADERS = [
  'Surname', 'First Name', 'Middle Name', 'Gender', 'Date of Birth', 'Arm',
  'Guardian Name', 'Guardian Relationship', 'Guardian Phone', 'Guardian Email',
  'Guardian Occupation', 'Nationality', 'State of Origin', 'LGA of Origin', 'Religion',
  'Blood Group', 'Genotype', 'Home Address', 'Medical Conditions',
  'Emergency Contact Name', 'Emergency Contact Phone',
]
export const TEMPLATE_EXAMPLE = [
  'Abdullahi', 'Aisha', 'Musa', 'Female', '12/05/2015', '',
  'Musa Abdullahi', 'Father', '08031234567', 'musa@example.com',
  'Trader', 'Nigerian', 'Kano', 'Nassarawa', 'Islam',
  'O+', 'AA', '12 Zoo Road, Kano', '',
  'Hauwa Abdullahi', '08051234567',
]

export const RELATIONSHIPS = ['Father', 'Mother', 'Uncle', 'Aunt', 'Other']

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

export const cellText = (v) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v)
  return String(v).replace(/\s+/g, ' ').trim()
}

// The header row is the first row with at least 3 filled cells (skips title lines above it)
export const findHeaderRow = (rows) => {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const filled = (rows[i] || []).filter(c => cellText(c) !== '').length
    if (filled >= 3) return i
  }
  return 0
}

// Guess which column holds which field, from the column titles
export const guessMapping = (headers) => {
  const mapping = {}
  const used = new Set()
  const normHeaders = headers.map(norm)
  // exact matches first
  FIELDS.forEach(f => {
    const idx = normHeaders.findIndex((h, i) => !used.has(i) && h && f.words.includes(h))
    if (idx >= 0) { mapping[f.key] = idx; used.add(idx) }
  })
  // then headers that merely contain a keyword (e.g. "Parent's Phone No."): the longest keyword wins,
  // so "parent phone" is a phone column, not a name column
  const candidates = []
  FIELDS.forEach(f => {
    if (mapping[f.key] !== undefined) return
    normHeaders.forEach((h, i) => {
      if (!h || used.has(i)) return
      f.words.forEach(w => { if (w.length >= 5 && h.includes(w)) candidates.push({ key: f.key, idx: i, len: w.length }) })
    })
  })
  candidates.sort((a, b) => b.len - a.len)
  candidates.forEach(c => {
    if (mapping[c.key] === undefined && !used.has(c.idx)) { mapping[c.key] = c.idx; used.add(c.idx) }
  })
  // a full-name column is not needed when first and last names were both found
  if (mapping.first_name !== undefined && mapping.last_name !== undefined) delete mapping.full_name
  return mapping
}

export const titleCase = (s) => {
  const t = cellText(s)
  if (!t) return ''
  if (t !== t.toUpperCase() && t !== t.toLowerCase()) return t // already mixed case, leave it
  return t.toLowerCase().replace(/(^|[\s\-'’.])([a-z])/g, (m, a, b) => a + b.toUpperCase())
}

export const splitFullName = (full, order) => {
  const parts = cellText(full).split(' ').filter(Boolean)
  if (parts.length === 0) return { first: '', middle: '', last: '' }
  if (parts.length === 1) return { first: parts[0], middle: '', last: '' }
  if (order === 'surname_first') {
    return { last: parts[0], first: parts[1], middle: parts.slice(2).join(' ') }
  }
  return { first: parts[0], last: parts[parts.length - 1], middle: parts.slice(1, -1).join(' ') }
}

export const parseGender = (v) => {
  const t = norm(v)
  if (!t) return { error: 'Gender is missing' }
  if (['m', 'male', 'boy', 'man'].includes(t)) return { value: 'Male' }
  if (['f', 'female', 'girl', 'woman'].includes(t)) return { value: 'Female' }
  return { error: `Gender "${cellText(v)}" is not Male or Female` }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n) => String(n).padStart(2, '0')
const validYmd = (y, m, d) => {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

// Accepts Excel date numbers, 12/05/2015, 12-5-2015, 2015-05-12, "12 May 2015", "May 12, 2015"
export const parseDate = (v) => {
  if (v === '' || v === null || v === undefined) return { value: '' }
  if (typeof v === 'number') {
    if (v < 1 || v > 80000) return { error: `Date "${v}" is not a valid date` }
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000)
    return { value: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` }
  }
  const s = cellText(v)
  if (!s) return { value: '' }
  let m, out
  if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/))) out = validYmd(+m[1], +m[2], +m[3])
  else if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/))) {
    let d = +m[1], mo = +m[2]
    if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t } // 05/13/2015 typed month-first
    out = validYmd(+m[3], mo, d)
  } else if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2})$/))) {
    const yy = +m[3]
    out = validYmd(yy <= 26 ? 2000 + yy : 1900 + yy, +m[2], +m[1])
  } else if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-\/]+([A-Za-z]{3,9})\.?,?[\s\-\/]+(\d{4})$/))) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase())
    out = mi >= 0 ? validYmd(+m[3], mi + 1, +m[1]) : null
  } else if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/))) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
    out = mi >= 0 ? validYmd(+m[3], mi + 1, +m[2]) : null
  }
  return out ? { value: out } : { error: `Date "${s}" is not a valid date` }
}

// Excel drops the leading zero of phone numbers; put it back
export const parsePhone = (v) => {
  if (v === '' || v === null || v === undefined) return ''
  let s = typeof v === 'number' ? String(Math.round(v)) : cellText(v)
  s = s.replace(/[\s\-().]/g, '')
  if (/^\+?234\d{10}$/.test(s)) return '0' + s.replace(/^\+?234/, '')
  if (/^[789]\d{9}$/.test(s)) return '0' + s
  return s
}

export const parseEmail = (v) => {
  const first = cellText(v).split(/[;, ]+/)[0].toLowerCase()
  if (!first) return { value: '' }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(first) ? { value: first } : { error: `Email "${first}" is not valid` }
}

export const parseRelationship = (v) => {
  const t = norm(v)
  if (!t) return ''
  if (['dad', 'daddy', 'father'].includes(t)) return 'Father'
  if (['mum', 'mummy', 'mom', 'mother'].includes(t)) return 'Mother'
  if (['uncle'].includes(t)) return 'Uncle'
  if (['aunt', 'aunty', 'auntie'].includes(t)) return 'Aunt'
  return 'Other'
}

const armKey = (s) => norm(s).replace(/^arm/, '')

// Turn the sheet rows into checked students.
// ctx: { mapping, nameOrder, tidyNames, arms:[{id,name}], defaultArmId, classHasArms,
//        needsDepartment, departments:[{id,name}], defaultDepartmentId, today }
export const buildRows = (dataRows, ctx) => {
  const get = (row, key) => (ctx.mapping[key] === undefined ? '' : row[ctx.mapping[key]])
  const tidy = (s) => (ctx.tidyNames ? titleCase(s) : cellText(s))
  const rows = []

  dataRows.forEach((row, i) => {
    const rowNumber = row.rowNumber ?? i + 1
    const cells = row.cells || row
    const rowGet = (key) => get(cells, key)
    if (cells.every(c => cellText(c) === '')) return // empty line

    const errors = []
    const warnings = []
    const v = {}

    // names
    let first = '', middle = '', last = ''
    if (ctx.mapping.first_name !== undefined || ctx.mapping.last_name !== undefined) {
      first = tidy(rowGet('first_name'))
      middle = tidy(rowGet('middle_name'))
      last = tidy(rowGet('last_name'))
      if (!first && !last && ctx.mapping.full_name !== undefined) {
        const sp = splitFullName(rowGet('full_name'), ctx.nameOrder)
        first = tidy(sp.first); middle = tidy(sp.middle); last = tidy(sp.last)
      }
    } else if (ctx.mapping.full_name !== undefined) {
      const sp = splitFullName(rowGet('full_name'), ctx.nameOrder)
      first = tidy(sp.first); middle = tidy(sp.middle); last = tidy(sp.last)
    }
    if (!first) errors.push('First name is missing')
    if (!last) errors.push('Surname is missing')
    v.first_name = first; v.middle_name = middle; v.last_name = last

    // gender
    const g = parseGender(rowGet('gender'))
    if (g.error) errors.push(g.error); else v.gender = g.value

    // date of birth
    const d = parseDate(rowGet('date_of_birth'))
    if (d.error) errors.push(d.error)
    else if (!d.value) warnings.push('No date of birth')
    else {
      v.date_of_birth = d.value
      const age = (Date.parse(ctx.today) - Date.parse(d.value)) / (365.25 * 86400000)
      if (age < 1) errors.push('Date of birth is in the future or less than a year ago')
      else if (age < 2 || age > 25) warnings.push(`Age ${Math.floor(age)}: check the date of birth`)
    }

    // arm
    const armText = cellText(rowGet('arm'))
    if (armText) {
      const found = (ctx.arms || []).find(a => armKey(a.name) === armKey(armText))
      if (found) v.arm_id = found.id
      else errors.push(`Arm "${armText}" does not exist in this class`)
    } else if (ctx.defaultArmId) {
      v.arm_id = ctx.defaultArmId
    } else if (ctx.classHasArms) {
      errors.push('Arm is missing (choose one above or add an Arm column)')
    }

    // department
    if (ctx.needsDepartment) {
      const depText = cellText(rowGet('department'))
      if (depText) {
        const found = (ctx.departments || []).find(x => norm(x.name) === norm(depText))
        if (found) v.department_id = found.id
        else errors.push(`Department "${depText}" does not exist`)
      } else if (ctx.defaultDepartmentId) {
        v.department_id = ctx.defaultDepartmentId
      } else {
        errors.push('Department is missing')
      }
    }

    // guardian
    v.guardian_name = tidy(rowGet('guardian_name'))
    v.guardian_relationship = parseRelationship(rowGet('guardian_relationship'))
    v.guardian_phone = parsePhone(rowGet('guardian_phone'))
    const e = parseEmail(rowGet('guardian_email'))
    if (e.error) errors.push(e.error); else v.guardian_email = e.value
    v.guardian_occupation = cellText(rowGet('guardian_occupation'))
    if (!v.guardian_name) warnings.push('No guardian name')
    if (!v.guardian_phone) warnings.push('No guardian phone')

    // admission date
    const ad = parseDate(rowGet('admission_date'))
    if (ad.error) errors.push(ad.error)
    else v.admission_date = ad.value || ctx.today

    // optional extras
    ;['nationality', 'state_of_origin', 'lga_of_origin', 'religion', 'blood_group', 'genotype',
      'home_address', 'lga_of_residence', 'state_of_residence', 'medical_conditions',
      'emergency_contact_name', 'emergency_contact_phone'].forEach(k => {
      const raw = rowGet(k)
      v[k] = k === 'emergency_contact_phone' ? parsePhone(raw) : cellText(raw)
    })

    rows.push({ rowNumber, values: v, errors, warnings })
  })
  return rows
}

// Mark rows that are already on the register, or repeated inside the file
export const markDuplicates = (rows, existing, classId) => {
  const keyOf = (v, cls) => [
    cellText(v.first_name).toLowerCase(), cellText(v.last_name).toLowerCase(),
    v.date_of_birth || `class:${cls}`,
  ].join('|')
  const seen = new Set()
  existing.forEach(s => {
    seen.add([cellText(s.first_name).toLowerCase(), cellText(s.last_name).toLowerCase(), s.date_of_birth || `class:${s.class_id}`].join('|'))
  })
  const inFile = new Set()
  return rows.map(r => {
    if (r.errors.length) return { ...r, duplicate: '' }
    const k = keyOf(r.values, classId)
    let duplicate = ''
    if (seen.has(k)) duplicate = 'Already on the register'
    else if (inFile.has(k)) duplicate = 'Repeated in this file'
    inFile.add(k)
    return { ...r, duplicate }
  })
}

// The record saved for one student (the same fields the Enroll form saves)
export const buildStudentRecord = (v, ctx) => {
  const rec = {
    school_id: ctx.schoolId,
    admission_number: ctx.admissionNumber,
    student_id: `STD-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    first_name: v.first_name,
    middle_name: v.middle_name || null,
    last_name: v.last_name,
    gender: v.gender,
    date_of_birth: v.date_of_birth || null,
    class_id: ctx.classId,
    arm_id: v.arm_id || null,
    section: ctx.section,
    session_id: ctx.sessionId,
    department_id: v.department_id || null,
    admission_date: v.admission_date || null,
    status: 'Active',
  }
  ;['guardian_name', 'guardian_relationship', 'guardian_phone', 'guardian_email', 'guardian_occupation',
    'nationality', 'state_of_origin', 'lga_of_origin', 'religion', 'blood_group', 'genotype',
    'home_address', 'lga_of_residence', 'state_of_residence', 'medical_conditions',
    'emergency_contact_name', 'emergency_contact_phone'].forEach(k => { rec[k] = v[k] || null })
  return rec
}

const csvCell = (x) => {
  const s = String(x ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCsv = (rows) => '\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')

export const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
}