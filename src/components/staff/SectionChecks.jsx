// Tick every section a staff member works in
const SectionChecks = ({ sections, selectedIds, onToggle, required }) => {
  // Sections this person is in that the editor does not manage: they stay as they are
  const hidden = selectedIds.filter(id => !sections.some(s => s.id === id)).length

  return (
    <div className="sm:col-span-2">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Sections {required && <span className="text-red-500">*</span>}
      </label>
      <p className="text-xs text-gray-400 mb-2">
        Tick every section this person works in. The Head Teacher or Principal of each ticked section can see them.
        Leave all unticked for staff who work for the whole school (managed by the Admin only).
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {sections.map(s => (
          <label key={s.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.includes(s.id)}
              onChange={() => onToggle(s.id)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-gray-700">{s.name}</span>
          </label>
        ))}
      </div>
      {hidden > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          This person also works in {hidden} other section{hidden === 1 ? '' : 's'} that you do not manage. Those stay as they are.
        </p>
      )}
    </div>
  )
}

export default SectionChecks