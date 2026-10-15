import TeacherLayout from '../../components/layout/TeacherLayout'
import MarksTrackerView from '../../components/grades/MarksTrackerView'

const MarksTrackerPage = () => (
  <TeacherLayout>
    <MarksTrackerView mode="teacher" />
  </TeacherLayout>
)

export default MarksTrackerPage