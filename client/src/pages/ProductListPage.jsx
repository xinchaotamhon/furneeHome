import { useEffect, useMemo, useState } from 'react';
import ProductGrid from '../components/product/ProductGrid';
import { useProducts } from '../context/ProductContext';
import { normalizeText } from '../utils/normalizeText';

function getCategoryName(product) {
  if (typeof product.category === 'object') {
    return product.category?.name || product.categoryName || 'Nội thất';
  }
  return product.category || product.categoryName || 'Nội thất';
}

function hasImage(product) {
  return Boolean(product.transparentImage || product.image || product.sourceImages?.[0]);
}

export default function ProductListPage() {
  const { products, loading } = useProducts();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);

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
    const imageFirst = (a, b) => Number(hasImage(b)) - Number(hasImage(a));
    if (sort === 'low') return [...result].sort((a, b) => imageFirst(a, b) || Number(a.price || 0) - Number(b.price || 0));
    if (sort === 'high') return [...result].sort((a, b) => imageFirst(a, b) || Number(b.price || 0) - Number(a.price || 0));
    return [...result].sort(imageFirst);
  }, [products, search, category, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / 12));
  const visibleProducts = filteredProducts.slice((page - 1) * 12, page * 12);

  useEffect(() => setPage(1), [search, category, sort]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  return (
    <main className="container page">
      <div className="page-heading split-heading">
        <div><h1>Sản phẩm</h1><p>Tìm món đồ phù hợp và thử ngay trong ảnh phòng.</p></div>
        <div className="result-count"><strong>{filteredProducts.length}</strong><span>sản phẩm phù hợp</span></div>
      </div>
      <section className="catalog-toolbar" aria-label="Bộ lọc sản phẩm">
        <input type="search" placeholder="Tìm tên sản phẩm" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp">
          <option value="default">Mặc định</option>
          <option value="low">Giá thấp đến cao</option>
          <option value="high">Giá cao đến thấp</option>
        </select>
      </section>
      <div className="category-pills">
        {categories.map((item) => <button className={category === item ? 'active' : ''} type="button" key={item} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      {loading && !products.length ? (
        <p className="muted">Đang tải sản phẩm…</p>
      ) : filteredProducts.length ? (
        <>
          <ProductGrid products={visibleProducts} />
          {pageCount > 1 && (
            <nav className="simple-pagination catalog-pagination" aria-label="Chuyển trang sản phẩm">
              <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Trước</button>
              <span>Trang {page}/{pageCount}</span>
              <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Sau</button>
            </nav>
          )}
        </>
      ) : (
        <div className="empty-state"><h2>Không tìm thấy sản phẩm</h2><p>Hãy thử từ khóa hoặc danh mục khác.</p></div>
      )}
    </main>
  );
}
