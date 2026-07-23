import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ClientesPage from './pages/ClientesPage';
import ProductosPage from './pages/ProductosPage';
import CuadrePage from './pages/CuadrePage';
import ZonasPage from './pages/ZonasPage';
import GestionPage from './pages/GestionPage';
import AnalisisPage from './pages/AnalisisPage';
import OperacionesFallidasPage from './pages/OperacionesFallidasPage';
import PerfilAdminPage from './pages/PerfilAdminPage';
import OnboardingPage from './pages/OnboardingPage';
import UpdatePrompt from './components/UpdatePrompt';

function RootRedirect() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (user && role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/login" replace />;
}

function AdminRoutes() {
  return (
    <Layout>
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="productos" element={<ProductosPage />} />
        <Route path="cuadre" element={<CuadrePage />} />
        <Route path="zonas" element={<ZonasPage />} />
        <Route path="gestion" element={<GestionPage />} />
        <Route path="analisis" element={<AnalisisPage />} />
        <Route path="pendientes" element={<OperacionesFallidasPage />} />
        <Route path="perfil" element={<PerfilAdminPage />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <AdminRoutes />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <UpdatePrompt />
      </AuthProvider>
    </BrowserRouter>
  );
}
