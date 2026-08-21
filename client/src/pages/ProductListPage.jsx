import { useMemo, useState } from 'react';
import ProductGrid from '../components/product/ProductGrid';
import { useProducts } from '../context/ProductContext';
import { normalizeText } from '../utils/normalizeText';

export default function ProductListPage() {
  const { products } = useProducts();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const [sort, setSort] = useState('default');

  const getCategoryName = (p) => {
    if (typeof p.category === 'object' && p.category?.name) return p.category.name;
    return p.category || p.categoryName || 'Nội thất';
  };

  const categories = useMemo(() => {
    const list = products.map(getCategoryName).filter(Boolean);
    return ['Tất cả', ...Array.from(new Set(list))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = normalizeText(search.trim());
    const result = products.filter((product) => {
      const catName = getCategoryName(product);
      const searchableText = normalizeText(`${product.name} ${catName} ${product.description || ''}`);
      const matchesText = !keyword || searchableText.includes(keyword);
      return matchesText && (category === 'Tất cả' || catName === category);
    });
    if (sort === 'low') return [...result].sort((a, b) => a.price - b.price);
    if (sort === 'high') return [...result].sort((a, b) => b.price - a.price);
    return result;
  }, [products, search, category, sort]);

  return (
    <main className="container page">
      <div className="page-heading split-heading">
        <div><p className="eyebrow">NỘI THẤT & TIỆN ÍCH PHÒNG TRỌ</p><h1>Danh sách sản phẩm</h1><p>Sản phẩm nội thất tiện ích, tối ưu không gian cho sinh viên và người đi làm.</p></div>
        <div className="result-count"><strong>{filteredProducts.length}</strong><span>sản phẩm phù hợp</span></div>
      </div>
      <section className="catalog-toolbar" aria-label="Bộ lọc sản phẩm">
        <input type="search" placeholder="Tìm bàn học, đèn cổ điển..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp">
          <option value="default">Sắp xếp mặc định</option>
          <option value="low">Giá thấp đến cao</option>
          <option value="high">Giá cao đến thấp</option>
        </select>
      </section>
      <div className="category-pills">
        {categories.map((item) => <button className={category === item ? 'active' : ''} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      {filteredProducts.length ? <ProductGrid products={filteredProducts} /> : <div className="empty-state"><h2>Chưa tìm thấy sản phẩm</h2><p>Hãy thử từ khóa hoặc danh mục khác.</p></div>}
    </main>
  );
}
