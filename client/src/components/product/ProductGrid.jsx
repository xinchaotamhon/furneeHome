import { useMemo, useState } from 'react';
import ProductCard from './ProductCard';

export default function ProductGrid({ products }) {
  const [failedSources, setFailedSources] = useState(() => new Map());
  const orderedProducts = useMemo(() => [...products].sort((left, right) => {
    const leftMissing = failedSources.get(left._id) === left.image;
    const rightMissing = failedSources.get(right._id) === right.image;
    return Number(leftMissing) - Number(rightMissing);
  }), [products, failedSources]);

  const markMissing = (product) => setFailedSources((current) => {
    if (current.get(product._id) === product.image) return current;
    const next = new Map(current);
    next.set(product._id, product.image);
    return next;
  });

  return <div className="product-grid">{orderedProducts.map((product) => (
    <ProductCard key={product._id} product={product} onReferenceImageError={markMissing} />
  ))}</div>;
}
