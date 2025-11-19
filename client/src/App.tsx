import { NavLink, Route, Routes } from 'react-router-dom';
import UserHome from './pages/UserHome';
import AdminPage from './pages/AdminPage';
import './App.css';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'text-link active' : 'text-link';

const App = () => (
  <div className="app-shell">
    <header className="app-header">
      <h1>ECS HTML 共创平台</h1>
      <nav>
        <NavLink to="/" className={linkClass} end>
          用户主页
        </NavLink>
        <NavLink to="/admin" className={linkClass}>
          管理员入口
        </NavLink>
      </nav>
    </header>
    <main className="app-main">
      <Routes>
        <Route path="/" element={<UserHome />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </main>
  </div>
);

export default App;
