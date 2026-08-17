import ProductCard from './ProductCard';

export default function ProductGrid({ products }) {
  return <div className="product-grid">{products.map((product) => <ProductCard key={product._id} product={product} />)}</div>;
}
