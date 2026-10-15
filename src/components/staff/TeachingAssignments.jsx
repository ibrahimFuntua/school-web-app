import { classModeOf } from '../../lib/teacherAssignments'

// A list of classes (with arms) to tick
const ClassChecks = ({ classes, selectedClasses, onToggleClass }) => (
  <div className="space-y-3">
    {classes.map((cls) => (
      <div key={cls.id}>
        {!cls.has_arms ? (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedClasses.includes(cls.id)}
              onChange={() => onToggleClass(cls.id)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-gray-700">
              {cls.name}
              <span className="text-xs text-gray-400 ml-2">({cls.section})</span>
            </span>
          </label>
        ) : (
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">
              {cls.name} <span className="text-xs text-gray-400">({cls.section})</span>
            </p>
            <div className="ml-4 space-y-1">
              {cls.arms?.filter(a => a.is_active).map(arm => (
                <label key={arm.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedClasses.includes(`${cls.id}_${arm.id}`)}
                    onChange={() => onToggleClass(cls.id, arm.id)}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-gray-700">{cls.name} {arm.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
)

const card = "bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
const title = "text-sm font-semibold text-gray-700 mb-1 pb-2 border-b border-gray-100"

// Class teacher (Nursery / Primary style), subjects taught and Form Master (Secondary style)
const TeachingAssignments = ({
  classes, subjects, allSections,
  selectedClasses, onToggleClass,
  assignments, onToggleAssignment,
}) => {
  const wholeClassList = classes.filter(c => classModeOf(c, allSections) !== 'by_subject')
  const bySubjectList = classes.filter(c => classModeOf(c, allSections) === 'by_subject')

  return (
    <>
      {wholeClassList.length > 0 && (
        <div className={card}>
          <h2 className={title}>Class Teacher (whole class)</h2>
          <p className="text-xs text-gray-400 mb-4">
            For sections where one teacher handles the whole class, such as Nursery and Primary.
            Select the class(es) this teacher will handle.
          </p>
          <ClassChecks classes={wholeClassList} selectedClasses={selectedClasses} onToggleClass={onToggleClass} />
        </div>
      )}

      {bySubjectList.length > 0 && (
        <>
          <div className={card}>
            <h2 className={title}>Subjects Taught</h2>
            <p className="text-xs text-gray-400 mb-4">
              For each class, tick the subjects this teacher teaches. The teacher can only enter marks
              for these subjects, in these classes.
            </p>
            <div className="space-y-2">
              {bySubjectList.map(cls => {
                const classSubjects = subjects.filter(s => !s.section || s.section === cls.section)
                const armList = cls.has_arms ? (cls.arms || []).filter(a => a.is_active) : []
                // every ticked subject of this class, whole class or one arm
                const picked = assignments.filter(k => k.split('|')[0].split('_')[0] === cls.id).length
                return (
                  <details key={cls.id} className="border border-gray-100 rounded-lg">
                    <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-gray-700 flex items-center justify-between">
                      <span>
                        {cls.name} <span className="text-xs text-gray-400">({cls.section})</span>
                      </span>
                      {picked > 0 && (
                        <span className="text-xs text-primary">{picked} ticked</span>
                      )}
                    </summary>
                    <div className="px-4 pb-3 pt-1 space-y-3">
                      <div>
                        {armList.length > 0 && (
                          <p className="text-xs font-medium text-gray-500 mb-1">Whole class (all arms)</p>
                        )}
                        {classSubjects.length === 0 && (
                          <p className="text-xs text-gray-400">No subjects for this section yet.</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {classSubjects.map(s => (
                            <label key={s.id} className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={assignments.includes(`${cls.id}|${s.id}`)}
                                onChange={() => onToggleAssignment(cls.id, s.id)}
                                className="w-4 h-4 accent-primary"
                              />
                              <span className="text-sm text-gray-700">{s.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {armList.map(arm => (
                        <details key={arm.id} className="border border-gray-100 rounded-lg">
                          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-600">
                            Only {cls.name} {arm.name}
                          </summary>
                          <div className="px-3 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {classSubjects.map(s => (
                              <label key={s.id} className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={assignments.includes(`${cls.id}_${arm.id}|${s.id}`)}
                                  onChange={() => onToggleAssignment(`${cls.id}_${arm.id}`, s.id)}
                                  className="w-4 h-4 accent-primary"
                                />
                                <span className="text-sm text-gray-700">{s.name}</span>
                              </label>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                )
              })}
            </div>
          </div>npm config get cache-dir
          <div className={card}>
            <h2 className={title}>Form Master / Mistress</h2>
            <p className="text-xs text-gray-400 mb-4">
              Tick the class this teacher is the Form Master or Mistress of. They can then call the class
              register and write the report card remarks. This does not give marks for subjects they do not teach.
            </p>
            <ClassChecks classes={bySubjectList} selectedClasses={selectedClasses} onToggleClass={onToggleClass} />
          </div>
        </>
      )}
    </>
  )
}

export default TeachingAssignments