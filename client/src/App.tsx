import { NavLink, Route, Routes } from 'react-router-dom';
import UserHome from './pages/UserHome';
import AdminPage from './pages/AdminPage';
import './App.css';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'text-link active' : 'text-link';

const App = () => (
  <div className="app-shell">
    <main className="app-main">
      <Routes>
        <Route path="/" element={<UserHome />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </main>
  </div>
);

export default App;
