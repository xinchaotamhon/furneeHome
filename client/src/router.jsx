import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import { useAuth } from './context/AuthContext';
import AdminPage from './pages/AdminPage';
import CollectionPage from './pages/CollectionPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import ProductListPage from './pages/ProductListPage';
import PublicCollectionDetailPage from './pages/PublicCollectionDetailPage';
import PublicCollectionsPage from './pages/PublicCollectionsPage';
import RoomStudioPage from './pages/RoomStudioPage';

function AdminRoute() {
  const { user, openLogin } = useAuth();
  if (user?.role === 'admin') return <AdminPage />;
  return <main className="container page access-denied"><span>🔒</span><h1>Khu vực quản trị</h1><p>Bạn cần đăng nhập bằng vai trò Admin để mở trang này.</p><button className="button" type="button" onClick={openLogin}>Mở đăng nhập</button></main>;
}

const router = createBrowserRouter([{
  element: <MainLayout />,
  children: [
    { path: '/', element: <HomePage /> },
    { path: '/products', element: <ProductListPage /> },
    { path: '/collection', element: <CollectionPage /> },
    { path: '/collections/public', element: <PublicCollectionsPage /> },
    { path: '/collections/public/:shareSlug', element: <PublicCollectionDetailPage /> },
    { path: '/room-studio', element: <RoomStudioPage /> },
    { path: '/cart', element: <Navigate to="/collection" replace /> },
    { path: '/room-3d', element: <Navigate to="/room-studio" replace /> },
    { path: '/admin', element: <AdminRoute /> },
    { path: '*', element: <NotFoundPage /> },
  ],
}]);

export default router;
