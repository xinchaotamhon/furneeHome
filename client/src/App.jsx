import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CollectionProvider } from './context/CollectionContext';
import { ProductProvider } from './context/ProductContext';
import router from './router';

export default function App() {
  return (
    <AuthProvider>
      <ProductProvider>
        <CollectionProvider>
          <RouterProvider router={router} />
        </CollectionProvider>
      </ProductProvider>
    </AuthProvider>
  );
}
