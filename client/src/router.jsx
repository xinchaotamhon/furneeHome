import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import { useAuth } from './context/AuthContext';
import AdminOrdersPage from './pages/AdminOrdersPage';
import AdminPage from './pages/AdminPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import CollectionPage from './pages/CollectionPage';
import FeedbackPage from './pages/FeedbackPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ProductListPage from './pages/ProductListPage';
import ProfilePage from './pages/ProfilePage';
import RoomStudioPage from './pages/RoomStudioPage';

function AdminRoute() {
  const { user, openLogin } = useAuth();
  if (user?.role === 'admin' || user?.role === 'superadmin') return <AdminPage />;
  return (
    <main className="container page access-denied">
      <h1>Khu vực quản trị</h1>
      <p>Đăng nhập bằng tài khoản quản trị để tiếp tục.</p>
      <button className="button" type="button" onClick={() => openLogin('login')}>
        Đăng nhập
      </button>
    </main>
  );
}

function AdminOrdersRoute() {
  const { user, openLogin } = useAuth();
  if (user?.role === 'admin' || user?.role === 'superadmin') return <AdminOrdersPage />;
  return (
    <main className="container page access-denied">
      <h1>Khu vực quản trị đơn hàng</h1>
      <p>Đăng nhập bằng tài khoản quản trị để tiếp tục.</p>
      <button className="button" type="button" onClick={() => openLogin('login')}>
        Đăng nhập
      </button>
    </main>
  );
}

const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/products', element: <ProductListPage /> },
      { path: '/products/:id', element: <ProductDetailPage /> },
      { path: '/cart', element: <CartPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/orders', element: <OrderHistoryPage /> },
      { path: '/room-studio', element: <RoomStudioPage /> },
      { path: '/collection', element: <CollectionPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/feedback', element: <FeedbackPage /> },
      { path: '/admin', element: <AdminRoute /> },
      { path: '/admin/orders', element: <AdminOrdersRoute /> },
      { path: '/room-3d', element: <Navigate to="/room-studio" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default router;
