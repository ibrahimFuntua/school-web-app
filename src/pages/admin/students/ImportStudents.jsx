import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react'
import AdminLayout from '../../../components/layout/AdminLayout'
import { supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/authStore'
import { useTermStore } from '../../../store/termStore'
import { useSections } from '../../../hooks/useSections'
import { useDepartmentConfig } from '../../../hooks/useDepartmentConfig'
import { fetchAllRows } from '../../../lib/feeUtils'
import {
  FIELDS, TEMPLATE_HEADERS, TEMPLATE_EXAMPLE,
  cellText, findHeaderRow, guessMapping, buildRows, markDuplicates,
  buildStudentRecord, generateTempPassword, toCsv,
} from '../../../lib/studentImport'

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white'

const colLetter = (i) => {
  let s = ''
  let n = i
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 }
  return s
}

const downloadFile = (name, text) => {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const ImportStudents = () => {
  const navigate = useNavigate()
  const { schoolId } = useAuthStore()
  const { currentSession } = useTermStore()
  const { sectionNames, restricted, loading: sectionsLoading } = useSections()
  const { departmentSectionName, departmentMode, departments } = useDepartmentConfig()

  const [classes, setClasses] = useState([])
  const [existing, setExisting] = useState([])
  const [classId, setClassId] = useState('')
  const [armId, setArmId] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  const [fileName, setFileName] = useState('')
  const [sheets, setSheets] = useState({})
  const [sheetName, setSheetName] = useState('')
  const [headerRowIdx, setHeaderRowIdx] = useState(0)
  const [mapping, setMapping] = useState({})
  const [nameOrder, setNameOrder] = useState('first_last')
  const [tidyNames, setTidyNames] = useState(true)
  const [createLogins, setCreateLogins] = useState(true)
  const [override, setOverride] = useState({})

  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState([])
  const stopRef = useRef(false)

  // Classes (a Head Teacher / Principal only sees their own sections) and the students already registered
  useEffect(() => {
    const load = async () => {
      if (!schoolId || sectionsLoading) return
      let q = supabase
        .from('classes')
        .select('*, arms(*)')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('name')
      if (restricted) q = q.in('section', sectionNames.length > 0 ? sectionNames : ['__none__'])
      const { data } = await q
      setClasses(data || [])

      try {
        const rows = await fetchAllRows(() =>
          supabase
            .from('students')
            .select('id, first_name, last_name, date_of_birth, class_id')
            .eq('school_id', schoolId)
            .order('id'))
        setExisting(rows)
      } catch (err) {
        console.error('Could not load existing students:', err)
        setError('Could not check for students who are already registered. Please refresh the page.')
      }
    }
    load()
  }, [schoolId, sectionsLoading, restricted, sectionNames.join('|')])

  const selectedClass = classes.find(c => c.id === classId) || null
  const arms = (selectedClass?.arms || []).filter(a => a.is_active)
  const needsDepartment =
    departmentMode === 'by_student' && !!selectedClass && selectedClass.section === departmentSectionName

  useEffect(() => { setArmId(''); setDepartmentId('') }, [classId])

  const rawRows = sheets[sheetName] || []

  // When a new sheet is chosen, find the title row and guess the columns
  useEffect(() => {
    if (rawRows.length === 0) return
    const h = findHeaderRow(rawRows)
    setHeaderRowIdx(h)
    setMapping(guessMapping((rawRows[h] || []).map(cellText)))
    setOverride({})
  }, [sheetName, sheets])

  const changeHeaderRow = (value) => {
    const h = Math.max(0, Math.min(rawRows.length - 1, (parseInt(value, 10) || 1) - 1))
    setHeaderRowIdx(h)
    setMapping(guessMapping((rawRows[h] || []).map(cellText)))
    setOverride({})
  }

  const headers = (rawRows[headerRowIdx] || []).map(cellText)
  const today = new Date().toISOString().split('T')[0]

  const built = useMemo(() => {
    if (rawRows.length === 0 || !selectedClass) return []
    const dataRows = rawRows.slice(headerRowIdx + 1).map((cells, i) => ({ rowNumber: headerRowIdx + 2 + i, cells }))
    const rows = buildRows(dataRows, {
      mapping,
      nameOrder,
      tidyNames,
      arms,
      defaultArmId: armId,
      classHasArms: arms.length > 0,
      needsDepartment,
      departments,
      defaultDepartmentId: departmentId,
      today,
    })
    return markDuplicates(rows, existing, classId)
  }, [rawRows, headerRowIdx, mapping, nameOrder, tidyNames, selectedClass, armId, departmentId, needsDepartment, existing])

  const namesMapped =
    (mapping.first_name !== undefined && mapping.last_name !== undefined) || mapping.full_name !== undefined
  const genderMapped = mapping.gender !== undefined

  const isIncluded = (r) => (r.errors.length > 0 ? false : (override[r.rowNumber] ?? !r.duplicate))
  const includedRows = built.filter(isIncluded)
  const errorCount = built.filter(r => r.errors.length > 0).length
  const duplicateCount = built.filter(r => r.duplicate).length

  const canImport =
    !running && !!selectedClass && !!currentSession && namesMapped && genderMapped && includedRows.length > 0

  const handleFile = async (file) => {
    if (!file) return
    setError('')
    setFinished(false)
    setResults([])
    try {
      const XLSX = await import('xlsx')
      const lower = file.name.toLowerCase()
      let wb
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        // Read CSV as plain text so 12/05/2015 is never reinterpreted as a US date
        const text = (await file.text()).replace(/^\uFEFF/, '')
        wb = XLSX.read(text, { type: 'string', raw: true })
      } else {
        wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      }
      const all = {}
      wb.SheetNames.forEach(n => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' })
        if (rows.some(r => r.some(c => cellText(c) !== ''))) all[n] = rows
      })
      const names = Object.keys(all)
      if (names.length === 0) {
        setError('That file is empty. Please choose a file that has a list of students.')
        return
      }
      setFileName(file.name)
      setSheets(all)
      setSheetName(names[0])
    } catch (err) {
      console.error('Read file error:', err)
      setError('Could not read that file. Please use an Excel (.xlsx, .xls) or CSV file.')
    }
  }

  const downloadTemplate = () => {
    downloadFile('students_import_template.csv', toCsv([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]))
  }

  // Link a guardian to a student, creating the parent and the login when the email is new
  const setUpParent = async (v, studentId, res) => {
    const link = async (parentId) => {
      const { error: linkError } = await supabase
        .from('parent_students')
        .insert([{ parent_id: parentId, student_id: studentId }])
      if (linkError && linkError.code !== '23505') throw linkError
    }

    const { data: existingParent } = await supabase
      .from('parents').select('id, full_name, email').eq('email', v.guardian_email).maybeSingle()
    res.parentEmail = v.guardian_email
    if (existingParent) {
      await link(existingParent.id)
      res.parentNote = 'Linked to an existing parent login'
      return
    }

    const { data: newParent, error: parentError } = await supabase
      .from('parents')
      .insert([{
        school_id: schoolId,
        full_name: v.guardian_name || v.guardian_email,
        email: v.guardian_email,
        phone: v.guardian_phone || null,
      }])
      .select()
      .single()

    if (parentError?.code === '23505') {
      const { data: raceParent } = await supabase
        .from('parents').select('id').eq('email', v.guardian_email).single()
      await link(raceParent.id)
      res.parentNote = 'Linked to an existing parent login'
      return
    }
    if (parentError) throw parentError

    await link(newParent.id)

    const password = generateTempPassword()
    const { data: { session: authSession } } = await supabase.auth.getSession()
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-parent-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`,
        },
        body: JSON.stringify({
          parentId: newParent.id,
          email: v.guardian_email,
          fullName: v.guardian_name || v.guardian_email,
          password,
        }),
      }
    )
    const result = await response.json()
    if (result.error) throw new Error(`parent login not created: ${result.error}`)
    res.password = password
    res.parentNote = 'New parent login created'
  }

  const runImport = async () => {
    if (!canImport) return
    setError('')
    setFinished(false)
    setRunning(true)
    stopRef.current = false

    const toImport = includedRows
    const out = []
    setResults([])
    setProgress({ done: 0, total: toImport.length })

    for (let i = 0; i < toImport.length; i++) {
      if (stopRef.current) break
      const r = toImport[i]
      const v = r.values
      const res = {
        rowNumber: r.rowNumber,
        name: `${v.first_name} ${v.last_name}`,
        status: '',
        admission: '',
        error: '',
        parentEmail: '',
        password: '',
        parentNote: '',
      }
      try {
        const { data: admissionNumber, error: admError } = await supabase
          .rpc('generate_admission_number', { p_school_id: schoolId })
        if (admError) throw admError

        const record = buildStudentRecord(v, {
          schoolId,
          admissionNumber,
          classId: selectedClass.id,
          section: selectedClass.section,
          sessionId: currentSession.id,
        })
        const { data: student, error: insertError } = await supabase
          .from('students').insert([record]).select('id').single()
        if (insertError) throw insertError

        res.status = 'Imported'
        res.admission = admissionNumber

        if (createLogins && v.guardian_email) {
          try {
            await setUpParent(v, student.id, res)
          } catch (parentErr) {
            res.parentNote = `Student saved, but ${parentErr.message || 'the parent could not be set up'}`
          }
        }
      } catch (err) {
        res.status = 'Failed'
        res.error = err.message || String(err)
      }
      out.push(res)
      setResults([...out])
      setProgress({ done: i + 1, total: toImport.length })
    }

    setRunning(false)
    setFinished(true)

    // The students just added must now count as "already registered"
    try {
      const rows = await fetchAllRows(() =>
        supabase
          .from('students')
          .select('id, first_name, last_name, date_of_birth, class_id')
          .eq('school_id', schoolId)
          .order('id'))
      setExisting(rows)
    } catch (err) {
      console.error('Refresh error:', err)
    }
  }

  const importedCount = results.filter(r => r.status === 'Imported').length
  const failed = results.filter(r => r.status === 'Failed')
  const loginsCreated = results.filter(r => r.password).length

  const downloadReport = () => {
    const rows = [['Row', 'Student', 'Class', 'Admission number', 'Result', 'Problem', 'Parent email', 'Temporary password', 'Parent note']]
    results.forEach(r => rows.push([
      r.rowNumber, r.name, selectedClass?.name || '', r.admission, r.status, r.error,
      r.parentEmail, r.password, r.parentNote,
    ]))
    downloadFile(`import_report_${(selectedClass?.name || 'class').replace(/\s+/g, '_')}.csv`, toCsv(rows))
  }

  const fieldsToShow = FIELDS.filter(f => {
    if (f.key === 'arm') return arms.length > 0
    if (f.key === 'department') return needsDepartment
    return true
  })

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Import Students</h1>
          <p className="text-gray-500 text-sm mt-1">
            Add a whole class at once from an Excel or CSV file.
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/students')}
          className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          Back to students
        </button>
      </div>

      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 max-w-4xl">
          {error}
        </div>
      )}

      {!currentSession && (
        <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-4xl">
          <AlertCircle size={16} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">No current session is set. Set one in Sessions &amp; Terms before importing.</p>
        </div>
      )}

      <div className="max-w-4xl space-y-6">
        {/* Step 1: class */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">1. Which class is this file for?</h2>
          <p className="text-xs text-gray-400 mb-4">One file per class works best. Every student in the file joins this class.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Class *</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
                <option value="">Select a class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.section})</option>)}
              </select>
            </div>
            {arms.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Arm (if the whole file is one arm)</label>
                <select value={armId} onChange={(e) => setArmId(e.target.value)} className={inputClass}>
                  <option value="">Use the Arm column</option>
                  {arms.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            {needsDepartment && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Department (if the whole file is one)</label>
                <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputClass}>
                  <option value="">Use the Department column</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: file */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">2. Choose your file</h2>
          <p className="text-xs text-gray-400 mb-4">
            Excel (.xlsx, .xls) or CSV. Your own column titles are fine, you can match them in the next step.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 bg-primary hover:bg-primary-light text-white font-semibold px-5 py-2.5 rounded-lg transition cursor-pointer text-sm">
              <Upload size={16} />
              {fileName ? 'Choose a different file' : 'Choose file'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                className="hidden"
                onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }}
              />
            </label>
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
            >
              <Download size={16} />
              Download a sample file
            </button>
            {fileName && <span className="text-sm text-gray-500">{fileName}</span>}
          </div>
          {Object.keys(sheets).length > 1 && (
            <div className="mt-4 max-w-xs">
              <label className="block text-xs font-medium text-gray-500 mb-1">Sheet</label>
              <select value={sheetName} onChange={(e) => setSheetName(e.target.value)} className={inputClass}>
                {Object.keys(sheets).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Step 3: match columns */}
        {rawRows.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">3. Check the columns</h2>
            <p className="text-xs text-gray-400 mb-4">
              We matched your column titles automatically. Fix anything that is wrong. Fields your file does not have can stay empty.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Column titles are on row</label>
                <input
                  type="number" min="1" max={rawRows.length}
                  value={headerRowIdx + 1}
                  onChange={(e) => changeHeaderRow(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">If names are in one column, they are written</label>
                <select value={nameOrder} onChange={(e) => setNameOrder(e.target.value)} className={inputClass}>
                  <option value="first_last">First name, then surname (Aisha Musa Abdullahi)</option>
                  <option value="surname_first">Surname first (Abdullahi Aisha Musa)</option>
                </select>
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="checkbox" checked={tidyNames} onChange={(e) => setTidyNames(e.target.checked)} />
                  Tidy ALL CAPS names
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {fieldsToShow.map(f => (
                <div key={f.key} className="flex items-center gap-3">
                  <label className="w-44 shrink-0 text-xs text-gray-600">
                    {f.label}{f.required ? ' *' : ''}
                  </label>
                  <select
                    value={mapping[f.key] === undefined ? '' : mapping[f.key]}
                    onChange={(e) => {
                      const val = e.target.value
                      setMapping(m => {
                        const next = { ...m }
                        if (val === '') delete next[f.key]
                        else next[f.key] = parseInt(val, 10)
                        return next
                      })
                    }}
                    className={inputClass}
                  >
                    <option value="">Not in my file</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{colLetter(i)}: {h || '(blank)'}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {(!namesMapped || !genderMapped) && (
              <div className="mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle size={16} className="text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700">
                  Please match the student name column(s) and the Gender column to continue.
                </p>
              </div>
            )}

            <label className="mt-4 flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox" className="mt-1"
                checked={createLogins} onChange={(e) => setCreateLogins(e.target.checked)}
              />
              <span>
                Create parent logins from the guardian email (siblings share one login).
                <span className="block text-xs text-gray-400">
                  Turn this off for a quick test. No parent accounts are created, and guardian details are still saved with each student.
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Step 4: review */}
        {rawRows.length > 0 && selectedClass && namesMapped && genderMapped && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">4. Review</h2>
              <p className="text-xs text-gray-400 mt-1">
                {built.length} rows read · <span className="text-green-600">{includedRows.length} will be imported</span>
                {duplicateCount > 0 && <> · <span className="text-amber-600">{duplicateCount} possible duplicates (not ticked)</span></>}
                {errorCount > 0 && <> · <span className="text-red-500">{errorCount} with problems (fix the file or the matching)</span></>}
              </p>
            </div>
            <div className="overflow-auto max-h-[28rem]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left w-10"></th>
                    <th className="px-2 py-3 text-left">Row</th>
                    <th className="px-4 py-3 text-left">Student</th>
                    <th className="px-4 py-3 text-left">Gender</th>
                    <th className="px-4 py-3 text-left">Born</th>
                    <th className="px-4 py-3 text-left">Guardian</th>
                    <th className="px-4 py-3 text-left">Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {built.map(r => {
                    const v = r.values
                    const bad = r.errors.length > 0
                    return (
                      <tr key={r.rowNumber} className={bad ? 'bg-red-50/50' : r.duplicate ? 'bg-amber-50/50' : ''}>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            disabled={bad || running}
                            checked={isIncluded(r)}
                            onChange={(e) => setOverride(o => ({ ...o, [r.rowNumber]: e.target.checked }))}
                          />
                        </td>
                        <td className="px-2 py-2 text-gray-400">{r.rowNumber}</td>
                        <td className="px-4 py-2 font-medium text-gray-800">
                          {v.first_name} {v.middle_name} {v.last_name}
                        </td>
                        <td className="px-4 py-2 text-gray-600">{v.gender || '—'}</td>
                        <td className="px-4 py-2 text-gray-600">{v.date_of_birth || '—'}</td>
                        <td className="px-4 py-2 text-gray-600">
                          {v.guardian_name || '—'}
                          {v.guardian_phone && <span className="block text-xs text-gray-400">{v.guardian_phone}</span>}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {bad && <span className="text-red-600">{r.errors.join('. ')}</span>}
                          {!bad && r.duplicate && <span className="text-amber-700">{r.duplicate}</span>}
                          {!bad && !r.duplicate && r.warnings.length === 0 && <span className="text-green-600">Ready</span>}
                          {!bad && r.warnings.length > 0 && <span className="block text-gray-400">{r.warnings.join('. ')}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
              <button
                onClick={runImport}
                disabled={!canImport}
                className="bg-primary hover:bg-primary-light text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-50 text-sm"
              >
                {running ? 'Importing...' : `Import ${includedRows.length} student${includedRows.length !== 1 ? 's' : ''}`}
              </button>
              {running && (
                <button
                  onClick={() => { stopRef.current = true }}
                  className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Stop
                </button>
              )}
              <span className="text-xs text-gray-400">
                {running ? 'Keep this page open until it finishes.' : 'You can stop at any time. Students already added stay saved.'}
              </span>
            </div>
          </div>
        )}

        {/* Progress and result */}
        {(running || finished) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {running && (
              <>
                <p className="text-sm text-gray-700 mb-2">
                  Importing {progress.done} of {progress.total}...
                </p>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </>
            )}
            {finished && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle size={20} className="text-green-600" />
                  <p className="font-semibold text-gray-800">
                    {importedCount} student{importedCount !== 1 ? 's' : ''} imported
                    {loginsCreated > 0 ? `, ${loginsCreated} parent login${loginsCreated !== 1 ? 's' : ''} created` : ''}
                    {failed.length > 0 ? `, ${failed.length} failed` : ''}
                  </p>
                </div>
                {failed.length > 0 && (
                  <ul className="text-sm text-red-600 mb-3 list-disc pl-5">
                    {failed.slice(0, 10).map(f => <li key={f.rowNumber}>Row {f.rowNumber}, {f.name}: {f.error}</li>)}
                    {failed.length > 10 && <li>and {failed.length - 10} more (see the report)</li>}
                  </ul>
                )}
                {results.some(r => r.parentNote && r.parentNote.startsWith('Student saved')) && (
                  <p className="text-sm text-amber-700 mb-3">
                    Some students were saved but their parent login could not be created. The report lists them.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={downloadReport}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition"
                  >
                    <Download size={16} />
                    Download report (admission numbers{loginsCreated > 0 ? ' and parent passwords' : ''})
                  </button>
                  <button
                    onClick={() => navigate('/admin/students')}
                    className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-light text-white text-sm font-semibold transition"
                  >
                    View students
                  </button>
                </div>
                {loginsCreated > 0 && (
                  <p className="text-xs text-gray-400 mt-3">
                    The report holds temporary passwords. Give them to the parents, then delete the file.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default ImportStudents