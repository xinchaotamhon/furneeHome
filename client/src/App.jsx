import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { CollectionProvider } from './context/CollectionContext';
import { ProductProvider } from './context/ProductContext';
import router from './router';

export default function App() {
  return (
    <AuthProvider>
      <ProductProvider>
        <CollectionProvider>
          <CartProvider>
            <RouterProvider router={router} />
          </CartProvider>
        </CollectionProvider>
      </ProductProvider>
    </AuthProvider>
  );
}
