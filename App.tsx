import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TransactionsPage from './pages/Transactions';
import Reconciliation from './pages/Reconciliation';
import Login from './pages/Login';
import BankAccounts from './pages/BankAccounts';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import CardAnalysis from './pages/CardAnalysis';
import AuthCallback from './pages/AuthCallback';
import AuthReset from './pages/AuthReset';
import AcceptInvite from './pages/AcceptInvite';
import AccessDenied from './pages/AccessDenied';
import Profile from './pages/Profile';
import ContentsCourses from './pages/ContentsCourses';
import ContentsTrainings from './pages/ContentsTrainings';
import ContentDetail from './pages/ContentDetail';
import AdminContentList from './pages/AdminContentList';
import AdminContentDetail from './pages/AdminContentDetail';
import AdminTeam from './pages/AdminTeam';
import AdminPackages from './pages/AdminPackages';
import AdminProfile from './pages/AdminProfile';
import CommercialRanking from './pages/CommercialRanking';
import CommercialRecurrence from './pages/CommercialRecurrence';
import CommercialDashboard from './pages/CommercialDashboard';
import CommercialGeo from './pages/CommercialGeo';
import ClinicAssistant from './pages/ClinicAssistant';
import { TransactionTypeEnum } from './types';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider } from './src/auth/AuthProvider';
import RequireSystemAdmin from './components/auth/RequireSystemAdmin';
import AdminLayout from './components/admin/AdminLayout';
import ProtectedContentRoute from './components/auth/ProtectedContentRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/reset" element={<AuthReset />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/access-denied" element={<AccessDenied />} />
          
          <Route path="/" element={
            <ProtectedRoute page="/">
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/incomes" element={
            <ProtectedRoute page="/incomes">
              <TransactionsPage type={TransactionTypeEnum.INCOME} />
            </ProtectedRoute>
          } />
          
          <Route path="/expenses" element={
            <ProtectedRoute page="/expenses">
              <TransactionsPage type={TransactionTypeEnum.EXPENSE} />
            </ProtectedRoute>
          } />

          <Route path="/reconciliation" element={
            <ProtectedRoute page="/reconciliation">
              <Reconciliation />
            </ProtectedRoute>
          } />

          <Route path="/accounts" element={
            <ProtectedRoute page="/accounts">
              <BankAccounts />
            </ProtectedRoute>
          } />

          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />

          <Route path="/card-analysis" element={
            <ProtectedRoute page="/card-analysis">
              <CardAnalysis />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute page="/profile">
              <Profile />
            </ProtectedRoute>
          } />

          <Route path="/contents/courses" element={
            <ProtectedRoute page="/contents/courses">
              <ContentsCourses />
            </ProtectedRoute>
          } />
          <Route path="/contents/trainings" element={
            <ProtectedRoute page="/contents/trainings">
              <ContentsTrainings />
            </ProtectedRoute>
          } />
          <Route path="/contents/:type/:contentId" element={
            <ProtectedContentRoute>
              <ContentDetail />
            </ProtectedContentRoute>
          } />

          {/* Comercial */}
          <Route path="/commercial/dashboard" element={
            <ProtectedRoute page="/commercial/dashboard">
              <CommercialDashboard />
            </ProtectedRoute>
          } />
          <Route path="/commercial/ranking" element={
            <ProtectedRoute page="/commercial/ranking">
              <CommercialRanking />
            </ProtectedRoute>
          } />
          <Route path="/commercial/recurrence" element={
            <ProtectedRoute page="/commercial/recurrence">
              <CommercialRecurrence />
            </ProtectedRoute>
          } />
          <Route path="/commercial/geo" element={
            <ProtectedRoute page="/commercial/geo">
              <CommercialGeo />
            </ProtectedRoute>
          } />
          <Route path="/assistant" element={
            <ProtectedRoute page="/assistant">
              <ClinicAssistant />
            </ProtectedRoute>
          } />

          <Route
            path="/admin"
            element={
              <RequireSystemAdmin>
                <AdminLayout />
              </RequireSystemAdmin>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Admin initialTab="overview" />} />
            <Route path="clinics" element={<Admin initialTab="clinics" />} />
            <Route path="users" element={<Admin initialTab="users" />} />
            <Route path="team" element={<AdminTeam />} />
            <Route path="packages" element={<AdminPackages />} />
            <Route path="content" element={<AdminContentList />} />
            <Route path="content/:id" element={<AdminContentDetail />} />
            <Route path="profile" element={<AdminProfile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
