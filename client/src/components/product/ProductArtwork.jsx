import { useEffect, useState } from 'react';

export default function ProductArtwork({ product, className = '', onImageError }) {
  const imageSource = product.transparentImage || product.image || product.sourceImages?.[0] || '';
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageSource]);

  if (imageSource && !imageFailed) {
    return <img className={`product-artwork ${className}`} src={imageSource} alt={product.name} draggable="false" onError={() => {
      setImageFailed(true);
      onImageError?.();
    }} />;
  }

  return (
    <svg
      className={`product-artwork ${className}`}
      viewBox="0 0 100 100"
      role="img"
      aria-label={product.name}
      style={{ color: product.color || '#1e5d47', fill: 'currentColor' }}
    >
      <rect x="16" y="37" width="68" height="13" rx="4" />
      <rect x="22" y="50" width="7" height="36" rx="2" />
      <rect x="71" y="50" width="7" height="36" rx="2" />
      <path d="M30 56h40" fill="none" stroke="white" strokeOpacity=".35" strokeWidth="4" />
    </svg>
  );
}
