import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { X } from 'lucide-react'

const ReportCardView = ({ studentId, termId, sessionId, onClose }) => {
  const { schoolId } = useAuthStore()
  const [data, setData] = useState(null)
  const [school, setSchool] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (studentId && termId) fetchReportCard()
  }, [studentId, termId])

  const fetchReportCard = async () => {
    setLoading(true)
    try {
      const [
        studentRes, gradesRes, attendanceRes,
        reportCardRes, schoolRes, termRes,
      ] = await Promise.all([
        supabase.from('students')
          .select('*, classes(id, name, section), arms(name), sessions(name)')
          .eq('id', studentId).single(),
        supabase.from('grades')
          .select('*, subjects(name)')
          .eq('student_id', studentId)
          .eq('term_id', termId)
          .order('subjects(name)'),
        supabase.from('attendance')
          .select('status')
          .eq('student_id', studentId)
          .eq('term_id', termId),
        supabase.from('report_cards')
          .select('*, next_class:classes(name)')
          .eq('student_id', studentId)
          .eq('term_id', termId)
          .single(),
        supabase.from('schools')
          .select('*, score_config, grade_scale, report_settings, logo_url')
          .eq('id', schoolId).single(),
        supabase.from('terms').select('*').eq('id', termId).single(),
      ])

      const student = studentRes.data
      const grades = gradesRes.data || []
      const attendance = attendanceRes.data || []
      const reportCard = reportCardRes.data
      const term = termRes.data
      const schoolData = schoolRes.data

      // Fetch quality traits
      const { data: traits } = await supabase
        .from('quality_traits')
        .select('*')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('order_number')

      // Fetch social qualities scores
      const qualityQuery = supabase
        .from('social_qualities')
        .select('*')
        .eq('class_id', student.class_id)
        .eq('term_id', termId)
      if (student.arm_id) qualityQuery.eq('arm_id', student.arm_id)
      else qualityQuery.is('arm_id', null)
      const { data: qualityData } = await qualityQuery.single()

      // Get classmates for position calculation
      const { data: classmateIds } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', student.class_id)
        .eq('status', 'Active')

      const allStudentIds = classmateIds?.map(s => s.id) || []

      const { data: allGrades } = await supabase
        .from('grades')
        .select('student_id, total, subject_id')
        .eq('term_id', termId)
        .in('student_id', allStudentIds)

      // Overall position
      const studentTotals = {}
      allStudentIds.forEach(id => { studentTotals[id] = 0 })
      allGrades?.forEach(g => {
        studentTotals[g.student_id] = (studentTotals[g.student_id] || 0) + Number(g.total || 0)
      })
      const myTotal = studentTotals[studentId] || 0
      const overallPosition = Object.values(studentTotals).filter(t => t > myTotal).length + 1
      const totalStudents = allStudentIds.length

      // Subject positions
      const subjectPositions = {}
      const subjectAverages = {}
      grades.forEach(grade => {
        const subjectGrades = allGrades?.filter(g => g.subject_id === grade.subject_id) || []
        const mySubjectScore = Number(grade.total || 0)
        const pos = subjectGrades.filter(g => Number(g.total || 0) > mySubjectScore).length + 1
        subjectPositions[grade.subject_id] = pos

        // Class average per subject
        const sum = subjectGrades.reduce((s, g) => s + Number(g.total || 0), 0)
        subjectAverages[grade.subject_id] = subjectGrades.length > 0
          ? (sum / subjectGrades.length).toFixed(1) : 0
      })

      // Attendance
      const totalPresent = attendance.filter(a =>
        a.status === 'Present' || a.status === 'Late'
      ).length
      const totalDays = attendance.length
      const attendancePct = totalDays > 0
        ? Math.round((totalPresent / totalDays) * 100) : 0

      // Scores
      const totalObtainable = grades.length * 100
      const totalObtained = grades.reduce((s, g) => s + Number(g.total || 0), 0)
      const average = grades.length > 0
        ? (totalObtained / grades.length).toFixed(1) : 0

      const gradeScale = schoolData?.grade_scale || []
      const overallGrade = gradeScale.find(g =>
        Number(average) >= g.min && Number(average) <= g.max
      )
      const scoreConfig = schoolData?.score_config || { max_ca1: 20, max_ca2: 20, max_exam: 60 }
      const reportSettings = schoolData?.report_settings || {}
      const section = student.classes?.section

      const usePosition = section === 'Nursery'
        ? reportSettings.nursery_use_position
        : reportSettings.primary_use_position

      const useGrade = section === 'Nursery'
        ? reportSettings.nursery_use_grade
        : reportSettings.primary_use_grade

      const showSubjectPosition = section === 'Nursery'
        ? reportSettings.nursery_show_subject_position
        : reportSettings.primary_show_subject_position

      setData({
        student, grades, attendance: { totalPresent, totalDays, attendancePct },
        reportCard, totalObtainable, totalObtained,
        average: Number(average), overallGrade,
        overallPosition, totalStudents,
        subjectPositions, subjectAverages,
        qualityData, term, scoreConfig,
        gradeScale, traits: traits || [],
        usePosition, useGrade, showSubjectPosition,
        showAffective: reportSettings.show_affective !== false,
        showPsychomotor: reportSettings.show_psychomotor !== false,
      })
      setSchool(schoolData)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  const getGradeForScore = (score, gradeScale) => {
    const found = gradeScale?.find(g => Number(score) >= g.min && Number(score) <= g.max)
    return found?.grade || '—'
  }

  const buildPrintHTML = () => {
    if (!data || !school) return ''

    const {
      student, grades, attendance, reportCard,
      totalObtainable, totalObtained, average,
      overallGrade, overallPosition, totalStudents,
      subjectPositions, subjectAverages,
      qualityData, term, scoreConfig, gradeScale,
      traits, usePosition, useGrade, showSubjectPosition,
      showAffective, showPsychomotor,
    } = data

    const section = student.classes?.section
    const affectiveTraits = traits.filter(t => t.category === 'affective')
    const psychomotorSkills = traits.filter(t => t.category === 'psychomotor')

    const gradesRows = grades.map((grade, i) => {
      const subjectPos = showSubjectPosition
        ? `<td style="padding:2px 4px;text-align:center;border:1px solid #d1d5db">${ordinal(subjectPositions[grade.subject_id] || 1)}</td>`
        : ''
      const gradeCell = useGrade
        ? `<td style="padding:2px 4px;text-align:center;border:1px solid #d1d5db;font-weight:700;color:${
            grade.grade === 'A' ? '#16a34a' :
            grade.grade === 'B' ? '#2563eb' :
            grade.grade === 'C' ? '#d97706' : '#ef4444'
          }">${grade.grade ?? '—'}</td>`
        : ''

      return `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
          <td style="padding:2px 6px;border:1px solid #d1d5db;font-size:9px">${grade.subjects?.name || ''}</td>
          <td style="padding:2px 4px;text-align:center;border:1px solid #d1d5db;font-size:9px">${grade.ca1 ?? 0}</td>
          <td style="padding:2px 4px;text-align:center;border:1px solid #d1d5db;font-size:9px">${grade.ca2 ?? 0}</td>
          <td style="padding:2px 4px;text-align:center;border:1px solid #d1d5db;font-size:9px">${grade.exam_score ?? 0}</td>
          <td style="padding:2px 4px;text-align:center;border:1px solid #d1d5db;font-weight:700;color:#1E3A8A;font-size:9px">${grade.total ?? 0}</td>
          <td style="padding:2px 4px;text-align:center;border:1px solid #d1d5db;font-size:9px">${subjectAverages[grade.subject_id] ?? 0}</td>
          ${subjectPos}
          ${gradeCell}
          <td style="padding:2px 4px;text-align:center;border:1px solid #d1d5db;font-size:8px">${grade.remark ?? '—'}</td>
          <td style="padding:2px 4px;border:1px solid #d1d5db;width:40px"></td>
        </tr>
      `
    }).join('')

    // Affective traits checkboxes
    const affectiveRows = affectiveTraits.map(trait => {
      const score = qualityData?.trait_scores?.[trait.id] || qualityData?.[trait.key] || 0
      const checks = [1,2,3,4,5].map(n =>
        `<td style="text-align:center;border:1px solid #d1d5db;width:16px;font-size:10px">${score >= n ? '✓' : ''}</td>`
      ).join('')
      return `<tr><td style="padding:1px 4px;border:1px solid #d1d5db;font-size:8px">${trait.name}</td>${checks}</tr>`
    }).join('')

    // Psychomotor skills checkboxes
    const psychomotorRows = psychomotorSkills.map(skill => {
      const score = qualityData?.trait_scores?.[skill.id] || 0
      const checks = [1,2,3,4,5].map(n =>
        `<td style="text-align:center;border:1px solid #d1d5db;width:16px;font-size:10px">${score >= n ? '✓' : ''}</td>`
      ).join('')
      return `<tr><td style="padding:1px 4px;border:1px solid #d1d5db;font-size:8px">${skill.name}</td>${checks}</tr>`
    }).join('')

    const gradeKey = gradeScale.map(g =>
      `<span style="margin-right:8px"><b>${g.grade}</b> ${g.remark} (${g.min}-${g.max})</span>`
    ).join('')

    const positionHTML = usePosition
      ? `<tr><td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">No. in Class</td><td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;text-align:center">${totalStudents}</td></tr>
         <tr><td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">Position</td><td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;text-align:center;font-weight:700;color:#1E3A8A">${ordinal(overallPosition)}</td></tr>`
      : ''

    const subjectPosHeader = showSubjectPosition
      ? `<th style="padding:3px 4px;border:1px solid #6b7280;font-size:8px;background:#1E3A8A;color:white">POSITION IN SUBJECT</th>`
      : ''

    const gradeHeader = useGrade
      ? `<th style="padding:3px 4px;border:1px solid #6b7280;font-size:8px;background:#1E3A8A;color:white">GRADE</th>`
      : ''

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Report Card - ${student?.first_name} ${student?.last_name}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:Arial,sans-serif; font-size:9px; padding:10px; color:#111; }
          table { border-collapse:collapse; }
          @page { size: A4; margin: 10mm; }
        </style>
      </head>
      <body>

        <!-- HEADER -->
        <table style="width:100%;margin-bottom:6px">
          <tr>
            <td style="width:80px;text-align:center;vertical-align:middle">
              ${school.logo_url
                ? `<img src="${school.logo_url}" style="width:70px;height:70px;object-fit:contain" />`
                : `<div style="width:70px;height:70px;border:1px solid #d1d5db;display:flex;align-items:center;justify-content:center;font-size:8px;color:#9ca3af">LOGO</div>`
              }
            </td>
            <td style="text-align:center;vertical-align:middle">
              <div style="font-size:18px;font-weight:700;text-transform:uppercase">${school.name || 'School Name'}</div>
              <div style="font-size:9px">(${section || ''})</div>
              ${school.address ? `<div style="font-size:9px">${school.address}</div>` : ''}
              ${school.motto ? `<div style="font-size:9px">Motto: ${school.motto}</div>` : ''}
            </td>
            <td style="width:80px"></td>
          </tr>
        </table>

        <!-- TITLE -->
        <div style="text-align:center;font-size:11px;font-weight:700;margin-bottom:6px;text-transform:uppercase">
          ${student?.sessions?.name || ''} ${term?.name || ''} REPORT SHEET
        </div>

        <!-- TOP SECTION: Student Info | Attendance | Summary -->
        <table style="width:100%;margin-bottom:6px;border:1px solid #d1d5db">
          <tr>
            <!-- Student Personal Data -->
            <td style="width:35%;vertical-align:top;padding:0">
              <table style="width:100%;border-collapse:collapse">
                <tr><td colspan="2" style="background:#e5e7eb;font-weight:700;font-size:8px;padding:3px 6px;text-align:center;border:1px solid #d1d5db">STUDENT'S PERSONAL DATA</td></tr>
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">Name</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px">${student?.first_name} ${student?.middle_name || ''} ${student?.last_name}</td>
                </tr>
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">Date Of Birth</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px">${student?.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : '—'}</td>
                </tr>
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">Sex</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px">${student?.gender || '—'}</td>
                </tr>
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">Class</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px">${student?.classes?.name || ''}${student?.arms?.name ? ' ' + student.arms.name : ''}</td>
                </tr>
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">Admission No.</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px">${student?.admission_number || '—'}</td>
                </tr>
              </table>
            </td>

            <!-- Attendance -->
            <td style="width:40%;vertical-align:top;padding:0">
              <table style="width:100%;border-collapse:collapse">
                <tr><td colspan="3" style="background:#e5e7eb;font-weight:700;font-size:8px;padding:3px 6px;text-align:center;border:1px solid #d1d5db">ATTENDANCE</td></tr>
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;text-align:center">No. of Times School Opened</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;text-align:center">No. of Times Present</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;text-align:center">No. of Times Absent</td>
                </tr>
                <tr>
                  <td style="padding:4px;border:1px solid #d1d5db;font-size:10px;text-align:center;font-weight:700">${attendance.totalDays}</td>
                  <td style="padding:4px;border:1px solid #d1d5db;font-size:10px;text-align:center;font-weight:700;color:#16a34a">${attendance.totalPresent}</td>
                  <td style="padding:4px;border:1px solid #d1d5db;font-size:10px;text-align:center;font-weight:700;color:#ef4444">${attendance.totalDays - attendance.totalPresent}</td>
                </tr>
                <tr><td colspan="3" style="background:#e5e7eb;font-weight:700;font-size:8px;padding:3px 6px;text-align:center;border:1px solid #d1d5db">TERMINAL DURATION</td></tr>
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;text-align:center">Term Begins</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;text-align:center">Term Ends</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;text-align:center">Next Term Begins</td>
                </tr>
                <tr>
                  <td style="padding:4px;border:1px solid #d1d5db;font-size:9px;text-align:center">${term?.start_date ? new Date(term.start_date).toLocaleDateString('en-GB') : '—'}</td>
                  <td style="padding:4px;border:1px solid #d1d5db;font-size:9px;text-align:center">${term?.end_date ? new Date(term.end_date).toLocaleDateString('en-GB') : '—'}</td>
                  <td style="padding:4px;border:1px solid #d1d5db;font-size:9px;text-align:center">${term?.next_term_begins ? new Date(term.next_term_begins).toLocaleDateString('en-GB') : '—'}</td>
                </tr>
              </table>
            </td>

            <!-- Summary -->
            <td style="width:25%;vertical-align:top;padding:0">
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">TOTAL SCORE OBTAINABLE</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:9px;text-align:center;font-weight:700">${totalObtainable}</td>
                </tr>
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">TOTAL SCORE OBTAINED</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:9px;text-align:center;font-weight:700;color:#1E3A8A">${totalObtained}</td>
                </tr>
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">AVERAGE PERCENTAGE</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:9px;text-align:center;font-weight:700">${average}</td>
                </tr>
                ${positionHTML}
                <tr>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;font-weight:600">PROMOTION</td>
                  <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:8px;text-align:center;font-weight:700;color:${reportCard?.promotion_status === 'Demoted' ? '#ef4444' : '#16a34a'}">${reportCard?.promotion_status || 'Promoted'}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- ACADEMIC PERFORMANCE -->
        <div style="font-size:9px;font-weight:700;text-align:center;background:#e5e7eb;padding:3px;border:1px solid #d1d5db;margin-bottom:0">
          ACADEMIC PERFORMANCE
        </div>
        <table style="width:100%;margin-bottom:4px">
          <thead>
            <tr style="background:#1E3A8A;color:white">
              <th style="padding:3px 6px;border:1px solid #6b7280;font-size:9px;text-align:left;width:30%">SUBJECT</th>
              <th style="padding:3px 4px;border:1px solid #6b7280;font-size:8px;text-align:center">CA<br>${scoreConfig.max_ca1}</th>
              <th style="padding:3px 4px;border:1px solid #6b7280;font-size:8px;text-align:center">CA<br>${scoreConfig.max_ca2}</th>
              <th style="padding:3px 4px;border:1px solid #6b7280;font-size:8px;text-align:center">EXAM<br>${scoreConfig.max_exam}</th>
              <th style="padding:3px 4px;border:1px solid #6b7280;font-size:8px;text-align:center">TOTAL<br>SCORE<br>100</th>
              <th style="padding:3px 4px;border:1px solid #6b7280;font-size:8px;text-align:center">CLASS<br>AVERAGE</th>
              ${subjectPosHeader}
              ${gradeHeader}
              <th style="padding:3px 4px;border:1px solid #6b7280;font-size:8px;text-align:center">REMARKS</th>
              <th style="padding:3px 4px;border:1px solid #6b7280;font-size:8px;text-align:center">SIGN.</th>
            </tr>
          </thead>
          <tbody>${gradesRows}</tbody>
        </table>

        <!-- KEYS TO RATING -->
        <div style="font-size:8px;border:1px solid #d1d5db;padding:3px 6px;margin-bottom:4px">
          <b>KEYS TO RATING: </b>${gradeKey}
        </div>

        <!-- AFFECTIVE & PSYCHOMOTOR -->
        ${showAffective || showPsychomotor ? `
        <table style="width:100%;margin-bottom:4px">
          <tr>
            ${showAffective ? `
            <td style="width:${showPsychomotor ? '50%' : '100%'};vertical-align:top;padding-right:${showPsychomotor ? '4px' : '0'}">
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 4px;border:1px solid #d1d5db;text-align:center">AFFECTIVE TRAITS</td>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 0;border:1px solid #d1d5db;text-align:center">1</td>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 0;border:1px solid #d1d5db;text-align:center">2</td>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 0;border:1px solid #d1d5db;text-align:center">3</td>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 0;border:1px solid #d1d5db;text-align:center">4</td>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 0;border:1px solid #d1d5db;text-align:center">5</td>
                </tr>
                ${affectiveRows}
              </table>
            </td>
            ` : ''}

            ${showPsychomotor ? `
            <td style="width:${showAffective ? '50%' : '100%'};vertical-align:top">
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 4px;border:1px solid #d1d5db;text-align:center">PSYCHOMOTOR SKILLS</td>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 0;border:1px solid #d1d5db;text-align:center">1</td>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 0;border:1px solid #d1d5db;text-align:center">2</td>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 0;border:1px solid #d1d5db;text-align:center">3</td>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 0;border:1px solid #d1d5db;text-align:center">4</td>
                  <td style="background:#e5e7eb;font-weight:700;font-size:8px;padding:2px 0;border:1px solid #d1d5db;text-align:center">5</td>
                </tr>
                ${psychomotorRows}
                <tr>
                  <td colspan="6" style="padding:2px 4px;border:1px solid #d1d5db">
                    <div style="font-size:8px;font-weight:700;margin-bottom:2px">KEYS TO RATING</div>
                    <div style="font-size:8px">1 - Very Poor &nbsp; 2 - Poor &nbsp; 3 - Fair</div>
                    <div style="font-size:8px">4 - Good &nbsp; 5 - Excellent</div>
                  </td>
                </tr>
              </table>
            </td>
            ` : ''}
          </tr>
        </table>
        ` : ''}

        <!-- COMMENTS -->
        <table style="width:100%;border-collapse:collapse;margin-top:4px">
          <tr>
            <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9px">
              <b>Class Teacher's Comments:</b> ${reportCard?.teacher_remark || '___________________________________________'}
              &nbsp;&nbsp;&nbsp; <b>Sign.:</b> _____________________
              &nbsp;&nbsp;&nbsp; <b>Date:</b> ${new Date().toLocaleDateString('en-GB')}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 6px;border:1px solid #d1d5db;font-size:9px">
              <b>HeadTeacher's Comments:</b> ${reportCard?.head_remark || '___________________________________________'}
              &nbsp;&nbsp;&nbsp; <b>Sign.:</b> _____________________
              &nbsp;&nbsp;&nbsp; <b>Date:</b> ${new Date().toLocaleDateString('en-GB')}
            </td>
          </tr>
        </table>

      </body>
      </html>
    `
  }

  const handlePrint = () => {
    const html = buildPrintHTML()
    const printWindow = window.open('', '_blank', 'width=850,height=1100')
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 500)
  }

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8">
        <p className="text-gray-400 animate-pulse">Loading report card...</p>
      </div>
    </div>
  )

  if (!data) return null

  const {
    student, grades, attendance, reportCard,
    totalObtainable, totalObtained, average,
    overallGrade, overallPosition, totalStudents,
    subjectPositions, subjectAverages,
    qualityData, term, scoreConfig, gradeScale,
    traits, usePosition, useGrade, showSubjectPosition,
    showAffective, showPsychomotor,
  } = data

  const affectiveTraits = traits.filter(t => t.category === 'affective')
  const psychomotorSkills = traits.filter(t => t.category === 'psychomotor')
  const section = student?.classes?.section

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-bold text-gray-700">
            Report Card — {student?.first_name} {student?.last_name}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary-light transition"
            >
              🖨️ Print / Download PDF
            </button>
            {onClose && (
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="bg-gray-100 rounded-xl p-4 text-center text-gray-500 text-sm">
            <p className="font-medium">📄 Report Card Preview</p>
            <p className="text-xs mt-1 text-gray-400">
              Click <strong>Print / Download PDF</strong> to see and print the full formatted report card.
              The print version matches the sample format exactly.
            </p>
          </div>

          {/* Quick summary preview */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Student</p>
              <p className="text-sm font-bold text-gray-800 mt-1">
                {student?.first_name} {student?.last_name}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Average</p>
              <p className={`text-2xl font-bold mt-1 ${
                Number(average) >= 70 ? 'text-green-600' :
                Number(average) >= 50 ? 'text-amber-500' : 'text-red-500'
              }`}>{average}%</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">
                {usePosition ? 'Position' : 'Grade'}
              </p>
              <p className="text-2xl font-bold text-primary mt-1">
                {usePosition
                  ? ordinal(overallPosition)
                  : overallGrade?.grade || '—'
                }
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className="text-xs text-gray-400">Total Score</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {totalObtained}/{totalObtainable}
              </p>
            </div>
          </div>

          {/* Grades preview table */}
          <div className="mt-4 bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="text-left px-3 py-2">Subject</th>
                    <th className="text-center px-2 py-2">CA{scoreConfig.max_ca1}</th>
                    <th className="text-center px-2 py-2">CA{scoreConfig.max_ca2}</th>
                    <th className="text-center px-2 py-2">Exam</th>
                    <th className="text-center px-2 py-2">Total</th>
                    <th className="text-center px-2 py-2">Avg</th>
                    {showSubjectPosition && <th className="text-center px-2 py-2">Pos.</th>}
                    {useGrade && <th className="text-center px-2 py-2">Grade</th>}
                    <th className="text-center px-2 py-2">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade, i) => (
                    <tr key={grade.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1.5 font-medium text-gray-800">{grade.subjects?.name}</td>
                      <td className="px-2 py-1.5 text-center">{grade.ca1 ?? 0}</td>
                      <td className="px-2 py-1.5 text-center">{grade.ca2 ?? 0}</td>
                      <td className="px-2 py-1.5 text-center">{grade.exam_score ?? 0}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-primary">{grade.total ?? 0}</td>
                      <td className="px-2 py-1.5 text-center">{subjectAverages[grade.subject_id] ?? 0}</td>
                      {showSubjectPosition && (
                        <td className="px-2 py-1.5 text-center text-xs">
                          {ordinal(subjectPositions[grade.subject_id] || 1)}
                        </td>
                      )}
                      {useGrade && (
                        <td className="px-2 py-1.5 text-center font-bold">
                          <span className={
                            grade.grade === 'A' ? 'text-green-600' :
                            grade.grade === 'B' ? 'text-blue-600' :
                            grade.grade === 'C' ? 'text-amber-600' : 'text-red-500'
                          }>{grade.grade ?? '—'}</span>
                        </td>
                      )}
                      <td className="px-2 py-1.5 text-center text-gray-500">{grade.remark ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReportCardView