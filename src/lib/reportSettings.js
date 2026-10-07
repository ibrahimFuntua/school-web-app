// Report-card display settings are stored per section NAME in
// report_settings.section_settings, so any section a school creates works.
// Schools that saved settings before sections became dynamic still have the old
// nursery_* / primary_* flags - those are used as the fallback.
export const DEFAULT_SECTION_SETTINGS = {
  use_position: true,
  show_subject_position: true,
  use_grade: true,
}

export const getSectionReportSettings = (reportSettings, sectionName) => {
  const rs = reportSettings || {}
  const saved = rs.section_settings?.[sectionName]
  if (saved) return { ...DEFAULT_SECTION_SETTINGS, ...saved }

  const prefix = sectionName === 'Nursery' ? 'nursery' : 'primary'
  const legacy = {
    use_position: rs[`${prefix}_use_position`],
    show_subject_position: rs[`${prefix}_show_subject_position`],
    use_grade: rs[`${prefix}_use_grade`],
  }
  Object.keys(legacy).forEach(k => legacy[k] === undefined && delete legacy[k])
  return { ...DEFAULT_SECTION_SETTINGS, ...legacy }
}