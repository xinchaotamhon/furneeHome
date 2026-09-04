const shapes = {
  desk: <><rect x="17" y="42" width="66" height="10" rx="3"/><rect x="22" y="52" width="6" height="36"/><rect x="72" y="52" width="6" height="36"/><rect x="31" y="55" width="38" height="4" opacity=".35"/></>,
  lowDeskWood: <><path d="M14 40h72l-9 14H23z"/><path d="M25 54h7l-5 30h-6zm43 0h7l4 30h-6z"/><path d="M31 57h38v4H31z" opacity=".35"/></>,
  lowDeskPlastic: <><rect x="14" y="36" width="72" height="18" rx="5"/><rect x="20" y="52" width="12" height="30" rx="5"/><rect x="68" y="52" width="12" height="30" rx="5"/><rect x="37" y="42" width="26" height="5" rx="2" fill="#fff" opacity=".28"/></>,
  chair: <><rect x="30" y="20" width="40" height="34" rx="7"/><rect x="26" y="54" width="48" height="10" rx="4"/><rect x="31" y="63" width="6" height="27"/><rect x="63" y="63" width="6" height="27"/></>,
  lamp: <><path d="M31 37h38L59 16H41z"/><rect x="47" y="37" width="6" height="36"/><path d="M34 82c0-7 6-12 16-12s16 5 16 12z"/></>,
  shelf: <><rect x="22" y="12" width="7" height="78"/><rect x="71" y="12" width="7" height="78"/><rect x="22" y="16" width="56" height="7"/><rect x="22" y="48" width="56" height="7"/><rect x="22" y="81" width="56" height="7"/><rect x="33" y="25" width="8" height="22" opacity=".55"/><rect x="44" y="29" width="12" height="18" opacity=".35"/></>,
  cabinet: <><rect x="22" y="25" width="56" height="57" rx="4"/><rect x="29" y="33" width="42" height="18" rx="2" opacity=".45"/><circle cx="50" cy="42" r="2"/><rect x="29" y="56" width="42" height="18" rx="2" opacity=".3"/><circle cx="50" cy="65" r="2"/><rect x="29" y="82" width="6" height="8"/><rect x="65" y="82" width="6" height="8"/></>,
  mirror: <><circle cx="50" cy="45" r="30"/><circle cx="50" cy="45" r="24" fill="#eaf1ef" opacity=".9"/><path d="M30 68l-7 19h54l-7-19" opacity=".55"/></>,
  rug: <><ellipse cx="50" cy="55" rx="41" ry="25"/><path d="M18 52c18 8 45 8 64 0M24 64c16 6 36 6 52 0" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="3"/></>,
  rack: <><rect x="20" y="16" width="6" height="71"/><rect x="74" y="16" width="6" height="71"/><rect x="20" y="16" width="60" height="6"/><path d="M50 22v13m0 0-12 8m12-8 12 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/><rect x="15" y="86" width="18" height="5"/><rect x="67" y="86" width="18" height="5"/></>,
  curtain: <><rect x="11" y="14" width="78" height="5" rx="2"/><path d="M18 19h31v69H12c9-20-2-43 6-69zm64 0H51v69h37c-9-20 2-43-6-69z"/><path d="M28 20c-4 24 5 43-2 67m46-67c4 24-5 43 2 67" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="3"/></>,
  plant: <><path d="M50 56C30 49 26 34 31 23c13 3 20 14 19 33zm2 0c20-7 24-22 19-33-13 3-20 14-19 33zm-3 2c-15-8-25-4-31 3 8 11 19 14 31-3zm4 0c15-8 25-4 31 3-8 11-19 14-31-3z"/><path d="M50 50v22" fill="none" stroke="currentColor" strokeWidth="4"/><path d="M31 68h38l-6 24H37z" opacity=".72"/></>,
};

export default function ProductArtwork({ product, className = '', onImageError }) {
  const imageSource = product.image || product.sourceImages?.[0] || '';
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
      style={{ color: product.color, fill: product.color }}
    >
      {shapes[product.visualType] || shapes.desk}
    </svg>
  );
}
import { useEffect, useState } from 'react';
