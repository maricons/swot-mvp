// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Orders from './pages/Orders';
import DriverRoute from './pages/DriverRoute';
import Customers from './pages/Customers';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Products from './pages/Products';
import Otif from './pages/Otif';
import Containers from './pages/Containers';
import Fleet from './pages/Fleet';
import Billing from './pages/Billing';
import ResetPassword from './pages/ResetPassword';
import { homeRoute } from './utils/format';
import { ToastProvider } from './components/Toast';

// Without a token it goes to the login; a role without access to the screen goes to its own home
const ProtectedRoute = ({ roles, children }) => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token) return <Navigate to="/" />;
    if (!roles.includes(role)) {
        return <Navigate to={homeRoute(role)} />;
    }
    return children;
};

const MANAGEMENT = ['admin', 'supervisor'];

// path -> [roles allowed, page component]
const ROUTES = {
    '/orders': [['dispatcher', ...MANAGEMENT], Orders],
    '/fleet': [MANAGEMENT, Fleet],
    '/customers': [MANAGEMENT, Customers],
    '/vehicles': [MANAGEMENT, Vehicles],
    '/drivers': [MANAGEMENT, Drivers],
    '/products': [MANAGEMENT, Products],
    '/otif': [MANAGEMENT, Otif],
    '/containers': [['yard', ...MANAGEMENT], Containers],
    '/billing': [MANAGEMENT, Billing],
    '/route': [['driver'], DriverRoute],
};

function App() {
    return (
        <ToastProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    {Object.entries(ROUTES).map(([path, [roles, Page]]) => (
                        <Route key={path} path={path} element={<ProtectedRoute roles={roles}><Page /></ProtectedRoute>} />
                    ))}
                </Routes>
            </Router>
        </ToastProvider>
    );
}

export default App;
