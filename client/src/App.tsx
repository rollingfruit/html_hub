import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext';
import UserHome from './pages/UserHome';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import UserDashboard from './pages/UserDashboard';
import './App.css';

const App = () => (
  <AuthProvider>
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/*" element={<UserHome />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<UserDashboard />} />
        </Routes>
      </main>
    </div>
  </AuthProvider>
);

export default App;
