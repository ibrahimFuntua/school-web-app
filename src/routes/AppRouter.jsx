import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import ProtectedRoute from './ProtectedRoute'
import RoleRouter from './RoleRouter'
import ReportCardsPage from '../pages/teacher/ReportCardsPage'
import HeadReportCards from '../pages/headmaster/ReportCards'

// Auth
import Login from '../pages/auth/Login'
import ResetPassword from '../pages/auth/ResetPassword'

// Admin
import AdminDashboard from '../pages/admin/Dashboard'
import StudentList from '../pages/admin/students/StudentList'
import StudentForm from '../pages/admin/students/StudentForm'
import StudentProfile from '../pages/admin/students/StudentProfile'
import StaffList from '../pages/admin/staff/StaffList'
import StaffForm from '../pages/admin/staff/StaffForm'
import StaffProfile from '../pages/admin/staff/StaffProfile'
import ClassList from '../pages/admin/classes/ClassList'
import SubjectList from '../pages/admin/subjects/SubjectList'
import SectionList from '../pages/admin/sections/SectionList'
import DepartmentList from '../pages/admin/departments/DepartmentList'
import FeeStructure from '../pages/admin/fees/FeeStructure'
import RecordPayment from '../pages/admin/fees/RecordPayment'
import FeeReports from '../pages/admin/fees/FeeReports'
import OutstandingFees from '../pages/admin/fees/OutstandingFees'
import SessionManager from '../pages/admin/sessions/SessionManager'
import SchoolSettings from '../pages/admin/settings/SchoolSettings'
import TeacherSettings from '../pages/teacher/Settings'
import PromoteStudents from '../pages/admin/students/PromoteStudents'
import Announcements from '../pages/admin/announcements/Announcements'
import TeacherAnnouncementsPage from '../pages/teacher/AnnouncementsPage'
import ParentAnnouncements from '../pages/parent/Announcements'

// Headmaster
import HeadmasterDashboard from '../pages/headmaster/Dashboard'

// Teacher
import TeacherDashboard from '../pages/teacher/Dashboard'
import AttendancePage from '../pages/teacher/AttendancePage'
import AttendanceSummaryPage from '../pages/teacher/AttendanceSummaryPage'
import GradesPage from '../pages/teacher/GradesPage'

// Parent
import ParentDashboard from '../pages/parent/Dashboard'
import ParentAttendance from '../pages/parent/Attendance'
import ParentGrades from '../pages/parent/Grades'
import ParentFees from '../pages/parent/Fees'
import ParentReportCard from '../pages/parent/ReportCard'
import ParentList from '../pages/admin/parents/ParentList'
import ParentSettings from '../pages/parent/Settings'

const AppRouter = () => {
  const initialize = useAuthStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [])

  return (
    <BrowserRouter>
      <Routes>

        <Route path="/admin/parents" element={
          <ProtectedRoute allowedRoles={['Admin', 'Headmaster']}>
            <ParentList />
          </ProtectedRoute>
        } />
        {/* parent settings */}
        <Route path="/parent/settings" element={
          <ProtectedRoute allowedRoles={['Parent']}>
            <ParentSettings />
          </ProtectedRoute>
        } />
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Role redirect */}
        <Route path="/" element={
          <ProtectedRoute>
            <RoleRouter />
          </ProtectedRoute>
        } />

        {/* ---- ADMIN ROUTES ---- */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/students" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <StudentList />
          </ProtectedRoute>
        } />
        <Route path="/admin/students/enroll" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <StudentForm />
          </ProtectedRoute>
        } />
        <Route path="/admin/students/:id" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <StudentProfile />
          </ProtectedRoute>
        } />
        <Route path="/admin/staff" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <StaffList />
          </ProtectedRoute>
        } />
        <Route path="/admin/staff/register" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <StaffForm />
          </ProtectedRoute>
        } />
        <Route path="/admin/staff/:id" element={
          <ProtectedRoute allowedRoles={['Admin', 'Headmaster']}>
            <StaffProfile />
          </ProtectedRoute>
        } />
        <Route path="/admin/sections" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <SectionList />
          </ProtectedRoute>
        } />
        <Route path="/admin/departments" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <DepartmentList />
          </ProtectedRoute>
        } />
        <Route path="/admin/classes" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <ClassList />
          </ProtectedRoute>
        } />
        <Route path="/admin/subjects" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <SubjectList />
          </ProtectedRoute>
        } />
        <Route path="/admin/fees" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <FeeStructure />
          </ProtectedRoute>
        } />
        <Route path="/admin/fees/payment" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <RecordPayment />
          </ProtectedRoute>
        } />
        <Route path="/admin/fees/reports" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <FeeReports />
          </ProtectedRoute>
        } />
        <Route path="/admin/fees/outstanding" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <OutstandingFees />
          </ProtectedRoute>
        } />
        <Route path="/admin/sessions" element={
          <ProtectedRoute allowedRoles={['Admin',  'Headmaster']}>
            <SessionManager />
          </ProtectedRoute>
        } />
        <Route path="/admin/settings" element={
          <ProtectedRoute allowedRoles={['Admin', 'Headmaster']}>
            <SchoolSettings />
          </ProtectedRoute>
        } />

        {/* Promotion router */}
        <Route path="/admin/students/promote" element={
          <ProtectedRoute allowedRoles={['Admin', 'Headmaster']}>
            <PromoteStudents />
          </ProtectedRoute>
        } />

        {/* ---- HEADMASTER ROUTES ---- */}
        <Route path="/headmaster/dashboard" element={
          <ProtectedRoute allowedRoles={['Headmaster']}>
            <HeadmasterDashboard />
          </ProtectedRoute>
        } />
        <Route path="/headmaster/report-cards" element={
          <ProtectedRoute allowedRoles={['Headmaster']}>
            <HeadReportCards />
          </ProtectedRoute>
        } />

        {/* ---- TEACHER ROUTES ---- */}
        <Route path="/teacher/dashboard" element={
          <ProtectedRoute allowedRoles={['Teacher']}>
            <TeacherDashboard />
          </ProtectedRoute>
        } />
        <Route path="/teacher/attendance" element={
          <ProtectedRoute allowedRoles={['Teacher']}>
            <AttendancePage />
          </ProtectedRoute>
        } />
        <Route path="/teacher/attendance/summary" element={
          <ProtectedRoute allowedRoles={['Teacher']}>
            <AttendanceSummaryPage />
          </ProtectedRoute>
        } />
        <Route path="/teacher/grades" element={
          <ProtectedRoute allowedRoles={['Teacher']}>
            <GradesPage />
          </ProtectedRoute>
        } />
        <Route path="/teacher/report-cards" element={
          <ProtectedRoute allowedRoles={['Teacher']}>
            <ReportCardsPage />
          </ProtectedRoute>
        } />
        <Route path="/teacher/settings" element={
          <ProtectedRoute allowedRoles={['Teacher']}>
            <TeacherSettings />
          </ProtectedRoute>
        } />

        {/* ---- PARENT ROUTES ---- */}
        <Route path="/parent/dashboard" element={
          <ProtectedRoute allowedRoles={['Parent']}>
            <ParentDashboard />
          </ProtectedRoute>
        } />
        <Route path="/parent/attendance" element={
          <ProtectedRoute allowedRoles={['Parent']}>
            <ParentAttendance />
          </ProtectedRoute>
        } />
        <Route path="/parent/grades" element={
          <ProtectedRoute allowedRoles={['Parent']}>
            <ParentGrades />
          </ProtectedRoute>
        } />
        <Route path="/parent/fees" element={
          <ProtectedRoute allowedRoles={['Parent']}>
            <ParentFees />
          </ProtectedRoute>
        } />
        <Route path="/parent/report-card" element={
          <ProtectedRoute allowedRoles={['Parent']}>
            <ParentReportCard />
          </ProtectedRoute>
        } />

        <Route path="/admin/announcements" element={
  <ProtectedRoute allowedRoles={['Admin', 'Headmaster']}>
    <Announcements />
  </ProtectedRoute>
} />
<Route path="/teacher/announcements" element={
  <ProtectedRoute allowedRoles={['Teacher']}>
    <TeacherAnnouncementsPage />
  </ProtectedRoute>
} />
<Route path="/parent/announcements" element={
  <ProtectedRoute allowedRoles={['Parent']}>
    <ParentAnnouncements />
  </ProtectedRoute>
} />
        {/* Unauthorized */}
        <Route path="/unauthorized" element={
          <div className="flex items-center justify-center h-screen">
            <p className="text-red-500 text-xl font-semibold">Access Denied</p>
          </div>
        } />

        {/* Catch-all — anything unmatched sends the user back to the root,
            which RoleRouter/ProtectedRoute then route to the right dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter