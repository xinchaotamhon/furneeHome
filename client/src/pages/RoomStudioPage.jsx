import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import ProductArtwork from "../components/product/ProductArtwork";
import { useAuth } from "../context/AuthContext";
import { useCollection } from "../context/CollectionContext";
import { useProducts } from "../context/ProductContext";
import useDebounce from "../hooks/useDebounce";
import { createRoomPreview } from "../services/roomPreviewService";
import {
  estimateRoomCameraParameters,
  solveCameraFromUserLines,
} from "../utils/cameraSolver";
import {
  compositeRoomPreview,
  createProductReferenceImages,
  createRoomPreviewImages,
  getProductImageSource,
  getProductPreviewStyle,
} from "../utils/roomPreviewCanvas";
import { normalizeText } from "../utils/normalizeText";

const CORNER_COLORS = ["#e87648", "#5f8f72", "#4c89b6", "#a56cbd"];
const GUEST_SESSION_KEY = "furneehome_guest_studio_session";
const HANDOFF_KEY = "furneehome-room-design-to-open";
const PRODUCTS_PER_PAGE = 6;
const MAX_PLACEMENTS = 12;
const INSPIRATION_CANDIDATE_COUNT = 9;
const INITIAL_TARGET = { x: 50, y: 72 };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function getStorageKey(user) {
  return user
    ? `furneehome_user_studio_${user.id || user._id || user.email || "user"}`
    : GUEST_SESSION_KEY;
}
function readSavedStudioSession(user) {
  try {
    const key = getStorageKey(user);
    // A room photo only belongs to the tab currently being edited. Older
    // signed-in sessions are moved once so they no longer occupy localStorage.
    let raw = sessionStorage.getItem(key);
    if (!raw && user) {
      raw = localStorage.getItem(key);
      if (raw) {
        sessionStorage.setItem(key, raw);
        localStorage.removeItem(key);
      }
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSavedStudioSession(user, data) {
  try {
    sessionStorage.setItem(getStorageKey(user), JSON.stringify(data));
  } catch {
    /* A large photo can exceed browser storage. */
  }
}
function readCollectionHandoff() {
  try {
    let raw = sessionStorage.getItem(HANDOFF_KEY);
    // One-time compatibility for a handoff created before this change.
    if (!raw) {
      raw = localStorage.getItem(HANDOFF_KEY);
      if (raw) localStorage.removeItem(HANDOFF_KEY);
    }
    if (!raw) return null;
    sessionStorage.removeItem(HANDOFF_KEY);
    const saved = JSON.parse(raw);
    return {
      ...saved,
      placements: saved.placements || saved.sceneItems || saved.items || [],
    };
  } catch {
    return null;
  }
}
function toPercentTarget(target = INITIAL_TARGET) {
  const x = Number(target.x ?? INITIAL_TARGET.x);
  const y = Number(target.y ?? INITIAL_TARGET.y);
  return { x: x <= 1 ? x * 100 : x, y: y <= 1 ? y * 100 : y };
}
function normalizeCorners(points = []) {
  return points.slice(0, 4).map((point, index) => ({
    ...point,
    id: point.id || `corner-saved-${index}`,
    index: index + 1,
    ...toPercentTarget(point),
    color: point.color || CORNER_COLORS[index],
    label: point.label || `Điểm ${index + 1}`,
  }));
}
function normalizeRotation(value) {
  return (((((value || 0) + 180) % 360) + 360) % 360) - 180;
}
function productSnapshot(product) {
  if (!product) return null;
  return {
    _id: product._id,
    id: product.id,
    name: product.name,
    image: product.image,
    transparentImage: product.transparentImage,
    category: product.category,
    categoryName: product.categoryName,
    defaultScale: product.defaultScale,
    visualType: product.visualType,
    color: product.color,
    dimensionsCm: product.dimensionsCm || {},
    usageType: product.usageType || 'unknown',
    placementSurface: product.placementSurface || 'unknown',
    aiDescription: product.aiDescription || '',
    sourceUrl: product.sourceUrl || product.shopeeSearchUrl || '',
  };
}
function getProductCategory(product) {
  return (
    (typeof product?.category === "object"
      ? product.category?.name
      : product?.category) ||
    product?.categoryName ||
    "Khác"
  );
}

function inferProductFacts(product) {
  const snapshot = productSnapshot(product) || {};
  const name = normalizeText(`${product?.name || ''} ${getProductCategory(product)}`);
  const lowTable = /(?:\bban\b[\w\s-]{0,24}\b(?:ngoi\s+bet|bet|thap)\b|\blow\s+table\b|\blap\s+desk\b)/.test(name);
  const hangingOrganizer = /(?:ke|tui|ngan)[\w\s-]{0,18}treo[\w\s-]{0,18}tu\s+quan\s+ao/.test(name);
  const wallOnly = /(?:treo\s+tuong|gan\s+tuong|wall[-\s]?mounted|\bden\s+tuong\b)/.test(name)
    && !/(?:de\s+san|dat\s+san|hoac\s+de\s+san)/.test(name);
  const tabletop = /(?:kep\s+ban|den(?:\s+led)?\s+ban|de\s+tren\s+ban|de\s+ban|tabletop|desk\s+lamp)/.test(name);
  const floorFurniture = /(?:de\s+san|dat\s+san|trai\s+san|\bden\s+cay\b)/.test(name)
    || /(?:ban|ghe|tu|ke|giuong|sofa|tham|rug|carpet)/.test(normalizeText(getProductCategory(product)));
  const usageType = snapshot.usageType !== 'unknown'
    ? snapshot.usageType
    : lowTable ? 'floor-seating' : 'unknown';
  let placementSurface = snapshot.placementSurface || 'unknown';
  if (placementSurface === 'unknown') {
    if (wallOnly) placementSurface = 'wall';
    else if (tabletop) placementSurface = 'tabletop';
    else if (!hangingOrganizer && (lowTable || floorFurniture)) placementSurface = 'floor';
  }
  const aiDescription = snapshot.aiDescription || (lowTable
    ? 'Bàn thấp để ngồi bệt; giữ mặt bàn thấp và chân ngắn.'
    : hangingOrganizer
      ? 'Kệ vải mềm phải treo từ thanh ngang trong tủ quần áo; không đặt đứng trên sàn và không biến thành tủ cứng.'
      : 'Giữ đúng hình dáng, màu, vật liệu, tỷ lệ và cấu tạo trong ảnh tham chiếu; không thay bằng món cùng loại khác.');
  return {
    dimensionsCm: snapshot.dimensionsCm || {},
    usageType,
    placementSurface,
    aiDescription,
  };
}
function isCompactInspirationProduct(product) {
  const facts = inferProductFacts(product);
  const name = normalizeText(`${product?.name || ''} ${getProductCategory(product)}`);
  const { width, depth, height } = facts.dimensionsCm || {};
  const knownCompactSize = Number(width) > 0 && Number(depth) > 0
    && Number(width) <= 90 && Number(depth) <= 70 && (!Number(height) || Number(height) <= 140);
  const compactSurface = facts.placementSurface === 'wall' || facts.placementSurface === 'tabletop';
  const compactName = /(?:den\s+(?:ban|kep)|ban\s+(?:bet|thap)|tham|goi|tranh|guong|dong\s+ho|ke\s+(?:nho|mini)|hop|gio)/.test(name);
  const bulkyName = /(?:giuong|sofa|tu\s+quan\s+ao|tu\s+vai|gian\s+phoi|gia\s+treo\s+quan\s+ao)/.test(name);
  return !bulkyName && (knownCompactSize || compactSurface || compactName);
}
function getProductRole(product) {
  const name = normalizeText(`${product?.name || ''} ${getProductCategory(product)}`);
  if (/(?:gian\s+phoi|gia\s+treo|tu\s+vai|treo\s+quan\s+ao)/.test(name)) return 'clothes-storage';
  if (/(?:\bban\b|desk|table)/.test(name)) return 'table';
  if (/(?:\bghe\b|sofa|chair|stool)/.test(name)) return 'seating';
  if (/(?:\bden\b|lamp|light)/.test(name)) return 'lighting';
  if (/(?:tham|rem|goi|nem|rug|curtain|cushion)/.test(name)) return 'textile';
  if (/(?:tranh|guong|dong\s+ho|wall\s+decor)/.test(name)) return 'wall-decor';
  if (/(?:\bke\b|\btu\b|gia\s+do|shelf|cabinet|drawer)/.test(name)) return 'storage';
  return normalizeText(getProductCategory(product)) || 'other';
}
function pickRandomCatalogProducts(products, unavailableIds, limit = 3) {
  const shuffled = products
    .filter((product) => {
      const id = product._id || product.id;
      return id && getProductImageSource(product) && !unavailableIds.has(id);
    })
    .map((product) => ({ product, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map(({ product }) => product);
  const compact = shuffled.filter(isCompactInspirationProduct);
  const pool = [...compact, ...shuffled.filter((product) => !compact.includes(product))];
  const selected = [];
  const roles = new Set();
  for (const product of pool) {
    const role = getProductRole(product);
    if (roles.has(role)) continue;
    selected.push(product);
    roles.add(role);
    if (selected.length === limit) return selected;
  }
  for (const product of pool) {
    if (!selected.includes(product)) selected.push(product);
    if (selected.length === limit) break;
  }
  return selected;
}
function inspirationProductSnapshot(product) {
  const image = getProductImageSource(product);
  return {
    productId: product?._id || product?.id || '',
    productName: product?.name || 'Sản phẩm FurneeHome',
    image: image?.startsWith('data:') ? '' : (image || ''),
    sourceUrl: product?.sourceUrl || product?.shopeeSearchUrl || '',
  };
}
function createPlacement(product, target, zIndex) {
  return {
    id: `placement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: product._id || product.id,
    productName: product.name,
    product: productSnapshot(product),
    target,
    scale: 1,
    rotation: 0,
    isFlipped: false,
    zIndex,
  };
}
function migrateLegacyPlacement(saved) {
  if (Array.isArray(saved?.placements))
    return saved.placements.map((placement, index) => ({
      ...placement,
      id: placement.id || `placement-saved-${index}`,
      target: toPercentTarget(placement.target),
      isFlipped: Boolean(placement.isFlipped ?? placement.flip),
      zIndex: placement.zIndex ?? index + 1,
    }));
  if (!saved?.hasTarget || !saved?.selectedId) return [];
  return [
    {
      id: "placement-legacy",
      productId: saved.selectedId,
      productName: saved.selectedProductName || "Sản phẩm đã chọn",
      product: saved.selectedProduct || null,
      target: toPercentTarget(saved.target),
      scale: saved.scale || 1,
      rotation: saved.rotation || 0,
      isFlipped: Boolean(saved.isFlipped ?? saved.flip),
      zIndex: 1,
    },
  ];
}
function buildCameraParameters(corners, imageSize) {
  const width = imageSize.width || 1000;
  const height = imageSize.height || 1000;
  const fallback = estimateRoomCameraParameters(width, height);
  if (corners.length < 4) return fallback;
  const points = corners.map((corner) => ({
    x: (corner.x / 100) * width,
    y: (corner.y / 100) * height,
  }));
  return (
    solveCameraFromUserLines(
      [
        [points[0], points[1]],
        [points[3], points[2]],
      ],
      [
        [points[0], points[3]],
        [points[1], points[2]],
      ],
      width,
      height,
    ) || fallback
  );
}
function resizeImageForAi(source, maxEdge = 1280, quality = 0.9) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(
        1,
        maxEdge / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => reject(new Error("Không thể đọc ảnh phòng."));
    image.src = source;
  });
}

function ProductFactsFields({ facts, onChange }) {
  return <div className="studio-facts">
    <label>Cách sử dụng
      <select value={facts.usageType || 'unknown'} onChange={(event) => onChange({ ...facts, usageType: event.target.value })}>
        <option value="unknown">Chưa xác định — giữ đúng ảnh mẫu</option>
        <option value="floor-seating">Đồ thấp, dùng khi ngồi bệt</option>
        <option value="standard">Đồ cao/thông thường</option>
      </select>
    </label>
    <details>
      <summary>Kích thước & đặc điểm cần giữ</summary>
      <p>Chỉ nhập số đo thật từ người bán; không biết thì để trống. Ảnh AI không thay thế việc đo phòng.</p>
      <div className="studio-dimensions">
        {[['width', 'Rộng'], ['depth', 'Sâu'], ['height', 'Cao']].map(([key, label]) =>
          <label key={key}>{label} (cm)<input type="number" min="1" max="1000" step="0.1" value={facts.dimensionsCm?.[key] || ''}
            onChange={(event) => onChange({ ...facts, dimensionsCm: { ...facts.dimensionsCm, [key]: event.target.value ? Number(event.target.value) : undefined } })} /></label>)}
      </div>
      <label>Đặt ở đâu?<select value={facts.placementSurface || 'unknown'} onChange={(event) => onChange({ ...facts, placementSurface: event.target.value })}>
        <option value="unknown">Theo ảnh mẫu</option><option value="floor">Trên sàn</option><option value="wall">Treo tường</option><option value="tabletop">Trên mặt bàn/kệ</option>
      </select></label>
      <label>Đặc điểm không được đổi<textarea maxLength="300" value={facts.aiDescription || ''} placeholder="Ví dụ: bàn chân ngắn, ngồi bệt; không thêm ghế cao" onChange={(event) => onChange({ ...facts, aiDescription: event.target.value })} /></label>
    </details>
  </div>;
}

function DesignBriefFields({ value, onChange }) {
  const presets = [
    ['Góc học ngồi bệt', { purpose: 'Học tập, ngồi bệt với bàn thấp', style: 'Gỗ sáng, gọn gàng', keepClear: 'Cửa ra vào, lối đi và cửa nhà vệ sinh', avoid: 'Bàn cao, ghế cao; đồ chắn lối đi' }],
    ['Phòng trọ gọn', { purpose: 'Sinh hoạt và cất đồ trong phòng nhỏ', style: 'Tối giản, tiết kiệm diện tích', keepClear: 'Lối đi, cầu thang và cửa ra vào', avoid: 'Đồ cồng kềnh, quá nhiều đồ trang trí' }],
    ['Góc thư giãn', { purpose: 'Đọc sách và thư giãn', style: 'Ấm áp, vật liệu tự nhiên', keepClear: 'Cửa sổ và lối di chuyển', avoid: 'Đổi tường, sàn hoặc ánh sáng phòng gốc' }],
  ];
  return <div className="studio-brief-form">
    <div className="studio-presets">{presets.map(([label, fields]) => <button type="button" key={label} onClick={() => onChange(fields)}>{label}</button>)}</div>
    {[['purpose', 'Dùng phòng để làm gì?', 'Ví dụ: học tập ngồi bệt', 80], ['style', 'Phong cách', 'Ví dụ: gỗ sáng, tối giản', 80], ['keepClear', 'Giữ trống', 'Ví dụ: trước cửa WC, lối cầu thang', 120], ['avoid', 'Không thay đổi', 'Ví dụ: không đổi bàn thấp thành bàn cao', 120]].map(([key, label, placeholder, maxLength]) =>
      <label key={key}>{label}<input value={value[key] || ''} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange({ ...value, [key]: event.target.value })} /></label>)}
  </div>;
}

export default function RoomStudioPage() {
  const location = useLocation();
  const { user, openRegister } = useAuth();
  const { products } = useProducts();
  const { saveRoomTemplate } = useCollection();
  const [savedInitial] = useState(
    () => readCollectionHandoff() || readSavedStudioSession(user),
  );
  const [roomImage, setRoomImage] = useState(savedInitial?.roomImage || "");
  const [roomFileName, setRoomFileName] = useState(
    savedInitial?.roomFileName || "",
  );
  const [imageSize, setImageSize] = useState(
    savedInitial?.imageSize || { width: 0, height: 0 },
  );
  const [markedCorners, setMarkedCorners] = useState(() =>
    normalizeCorners(savedInitial?.markedCorners),
  );
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  // Chỉ thao tác chọn hiện tại mới cho phép đặt món; không tự chọn món đầu tiên.
  const [selectedId, setSelectedId] = useState(() => location.state?.product?._id || location.state?.product?.id || '');
  const [unavailableProductIds, setUnavailableProductIds] = useState(() => new Set());
  const [selectedFacts, setSelectedFacts] = useState(() => (location.state?.product ? productSnapshot(location.state.product) : {}));
  const [needsAccount, setNeedsAccount] = useState(false);
  const [placements, setPlacements] = useState(() =>
    migrateLegacyPlacement(savedInitial),
  );
  const [selectedPlacementId, setSelectedPlacementId] = useState(
    savedInitial?.selectedPlacementId || null,
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("products");
  const [layoutPane, setLayoutPane] = useState("edit");
  const [isCompactScreen, setIsCompactScreen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 640px)").matches,
  );
  const [message, setMessage] = useState(
    savedInitial?.roomImage
      ? "Đã khôi phục phiên phòng thử trước đó."
      : "Tải ảnh phòng để bắt đầu thử ý tưởng hoặc đặt sản phẩm.",
  );
  const [resultImage, setResultImage] = useState(
    savedInitial?.resultImage || "",
  );
  const [resultMode, setResultMode] = useState(
    savedInitial?.designMode ||
      savedInitial?.resultMode ||
      (savedInitial?.resultImage ? "placement" : ""),
  );
  const [resultMatchesLayout, setResultMatchesLayout] = useState(savedInitial?.resultMatchesLayout !== false);
  const [showResult, setShowResult] = useState(
    savedInitial?.showResult ?? Boolean(savedInitial?.resultImage),
  );
  const [elapsedMs, setElapsedMs] = useState(savedInitial?.elapsedMs || null);
  const [resultInfo, setResultInfo] = useState(
    savedInitial?.resultInfo || null,
  );
  const [inspirationProducts, setInspirationProducts] = useState(
    () => (savedInitial?.inspirationProducts || []).slice(0, 3),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastFailedPlacementId, setLastFailedPlacementId] = useState(null);
  const [roomRequest, setRoomRequest] = useState(
    savedInitial?.userPrompt || savedInitial?.roomRequest || "",
  );
  const [designBrief, setDesignBrief] = useState(savedInitial?.designBrief || {
    purpose: '', style: '', keepClear: '', avoid: '',
  });
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 });
  const stageViewportRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const placementsRef = useRef(placements);
  const requestSequenceRef = useRef(0);
  const generationRef = useRef(false);
  const debouncedQuery = useDebounce(query);
  placementsRef.current = placements;

  useEffect(() => {
    setPlacements((current) =>
      current.map((placement) => {
        const product = products.find(
          (item) =>
            item._id === placement.productId || item.id === placement.productId,
        );
        if (!product) return placement;
        return {
          ...placement,
          product: {
            ...(placement.product || {}),
            ...productSnapshot(product),
            ...(placement.productFacts || {}),
          },
          productName: product.name,
        };
      }),
    );
  }, [products]);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updateScreenSize = () => setIsCompactScreen(mediaQuery.matches);
    updateScreenSize();
    mediaQuery.addEventListener("change", updateScreenSize);
    return () => mediaQuery.removeEventListener("change", updateScreenSize);
  }, []);
  useEffect(() => {
    const viewport = stageViewportRef.current;
    if (!viewport || !roomImage) return undefined;
    const updateBox = (entry) =>
      setStageBox({
        width: entry?.contentRect.width || viewport.clientWidth,
        height: entry?.contentRect.height || viewport.clientHeight,
      });
    const observer = new ResizeObserver(([entry]) => updateBox(entry));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [roomImage]);
  useEffect(() => {
    writeSavedStudioSession(user, {
      roomImage,
      roomFileName,
      imageSize,
      markedCorners,
      selectedId,
      placements,
      selectedPlacementId,
      resultImage,
      resultMode,
      resultMatchesLayout,
      showResult,
      elapsedMs,
      resultInfo,
      inspirationProducts,
      roomRequest,
      designBrief,
    });
  }, [
    user,
    roomImage,
    roomFileName,
    imageSize,
    markedCorners,
    selectedId,
    placements,
    selectedPlacementId,
    resultImage,
    resultMode,
    resultMatchesLayout,
    showResult,
    elapsedMs,
    resultInfo,
    inspirationProducts,
    roomRequest,
    designBrief,
  ]);

  const selectedProduct =
    products.find(
      (product) => product._id === selectedId || product.id === selectedId,
    ) || null;
  const displayedInspirationProducts = useMemo(() => inspirationProducts.map((saved) => {
    const catalogProduct = products.find(
      (product) => product._id === saved.productId || product.id === saved.productId,
    );
    return {
      ...(catalogProduct || {}),
      ...saved,
      _id: saved.productId || catalogProduct?._id,
      id: saved.productId || catalogProduct?.id,
      name: saved.productName || catalogProduct?.name,
      image: saved.image || catalogProduct?.image,
      sourceUrl: saved.sourceUrl || catalogProduct?.sourceUrl || catalogProduct?.shopeeSearchUrl || '',
    };
  }), [inspirationProducts, products]);
  const chooseProduct = (product) => {
    setSelectedId(product._id || product.id);
    const facts = { ...productSnapshot(product), ...inferProductFacts(product) };
    setSelectedFacts(facts);
    setIsMarkingMode(false);
    setShowResult(false);
    setMessage(`Đã chọn ${product.name}. Kiểm tra công năng, rồi bấm vị trí trong ảnh để tạo.`);
  };
  const markProductUnavailable = (product) => {
    const id = product._id || product.id;
    setUnavailableProductIds((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
    if (id === selectedId) {
      setSelectedId('');
      setMessage(`${product.name} chưa có ảnh tham chiếu. Admin cần tải ảnh trước khi dùng trong phòng thử.`);
    }
  };
  const activePlacement =
    placements.find((placement) => placement.id === selectedPlacementId) ||
    null;
  const categories = useMemo(
    () => [...new Set(products.map(getProductCategory).filter(Boolean))],
    [products],
  );
  const filteredProducts = useMemo(() => {
    const search = normalizeText(debouncedQuery.trim());
    return products.filter(
      (product) =>
        (!category || getProductCategory(product) === category) &&
        (!search ||
          normalizeText(
            `${product.name || ""} ${getProductCategory(product)}`,
          ).includes(search)),
    ).sort((left, right) => {
      const leftMissing = unavailableProductIds.has(left._id || left.id);
      const rightMissing = unavailableProductIds.has(right._id || right.id);
      return Number(leftMissing) - Number(rightMissing);
    });
  }, [products, debouncedQuery, category, unavailableProductIds]);
  const productsPerPage = isCompactScreen ? 3 : PRODUCTS_PER_PAGE;
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / productsPerPage),
  );
  const visibleProducts = filteredProducts.slice(
    (page - 1) * productsPerPage,
    page * productsPerPage,
  );
  const activeResult = Boolean(resultImage && showResult && !isGenerating);
  const displayedImage = activeResult ? resultImage : roomImage;
  const imageRatio =
    imageSize.width && imageSize.height
      ? imageSize.width / imageSize.height
      : 4 / 3;
  const viewportRatio =
    stageBox.width && stageBox.height
      ? stageBox.width / stageBox.height
      : imageRatio;
  const mediaStyle =
    viewportRatio > imageRatio
      ? {
          height: "100%",
          width: `${(imageRatio / viewportRatio) * 100}%`,
          aspectRatio: imageRatio,
        }
      : {
          width: "100%",
          height: `${(viewportRatio / imageRatio) * 100}%`,
          aspectRatio: imageRatio,
        };
  useEffect(
    () => setPage((current) => Math.min(current, totalPages)),
    [totalPages],
  );

  const getTarget = (event) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Number(
        clamp(((event.clientX - rect.left) / rect.width) * 100, 1, 99).toFixed(
          1,
        ),
      ),
      y: Number(
        clamp(((event.clientY - rect.top) / rect.height) * 100, 1, 99).toFixed(
          1,
        ),
      ),
    };
  };
  const updatePlacement = (id, updates) => {
    setResultMatchesLayout(false);
    setShowResult(false);
    const next = placementsRef.current.map((placement) =>
      placement.id === id ? { ...placement, ...updates } : placement,
    );
    placementsRef.current = next;
    setPlacements(next);
    return next;
  };
  const movePlacementLayer = (id, direction) => {
    const current = placementsRef.current;
    if (current.length < 2) return current;
    setResultMatchesLayout(false);
    setShowResult(false);
    if (direction === "front") {
      const zIndex =
        Math.max(...current.map((placement) => placement.zIndex || 0)) + 1;
      return updatePlacement(id, { zIndex });
    }

    const next = current.map((placement) =>
      placement.id === id
        ? { ...placement, zIndex: 0 }
        : { ...placement, zIndex: (placement.zIndex || 0) + 1 },
    );
    placementsRef.current = next;
    setPlacements(next);
    return next;
  };
  const stopResultView = (
    text = "Bạn có thể tiếp tục chỉnh bố cục hiện tại.",
  ) => {
    setShowResult(false);
    setMessage(text);
  };

  const renderScene = async (sceneSnapshot, changedPlacementId = null) => {
    const scene = sceneSnapshot.slice(0, MAX_PLACEMENTS).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map((placement) => ({
      ...placement,
      product:
        placement.product ||
        products.find(
          (item) =>
            item._id === placement.productId || item.id === placement.productId,
        ),
    }));
    if (!roomImage || !scene.length || generationRef.current) return;
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    const hadResult = Boolean(resultImage);
    const previousShowResult = showResult;
    generationRef.current = true;
    setIsGenerating(true);
    setLastFailedPlacementId(null);
    setShowResult(false);
    setMessage(`Đang hoàn thiện bố cục ${scene.length} món bằng AI…`);
    try {
      const guideImages = await createRoomPreviewImages({
        roomSource: roomImage,
        placements: scene,
        cameraParams: buildCameraParameters(markedCorners, imageSize),
      });
      const focus =
        scene.find((placement) => placement.id === changedPlacementId) ||
        scene[scene.length - 1];
      const productName = `Interior scene: ${scene
        .map((placement) => placement.productName || placement.product?.name)
        .filter(Boolean)
        .join(", ")}`.slice(0, 200);
      const result = await createRoomPreview({
        ...guideImages,
        roomImageDataUrl: await resizeImageForAi(roomImage, 1280),
        smallRoomImageDataUrl: guideImages.roomImageDataUrl,
        productName,
        userPrompt: roomRequest.trim(),
        designBrief,
        sceneProducts: scene.map((item) => ({
          name: item.productName || item.product?.name || 'Sản phẩm đã lưu',
          ...productSnapshot(item.product),
          target: { x: item.target.x / 100, y: item.target.y / 100 },
        })),
        imageSize,
        placement: {
          x: Number((focus.target.x / 100).toFixed(4)),
          y: Number((focus.target.y / 100).toFixed(4)),
          anchor: "bottom-center",
        },
      });
      const finalImage = result.imageDataUrl?.startsWith("data:image/")
        ? result.imageDataUrl
        : await compositeRoomPreview({
            roomSource: roomImage,
            resultSource: result.imageDataUrl,
            editRegion: guideImages.editRegion,
          });
      if (!finalImage?.startsWith("data:image/"))
        throw new Error("Ảnh AI không hợp lệ.");
      if (requestId !== requestSequenceRef.current) return;
      setResultImage(finalImage);
      setResultMode("placement");
      setResultMatchesLayout(true);
      setNeedsAccount(false);
      setShowResult(true);
      setElapsedMs(result.elapsedMs || null);
      setResultInfo({
        provider: result.provider || "",
        model: result.model || "",
      });
      setMessage(`Đã tạo ảnh AI cho toàn bộ ${scene.length} sản phẩm.`);
    } catch (error) {
      if (requestId !== requestSequenceRef.current) return;
      setLastFailedPlacementId(changedPlacementId);
      if (hadResult) setShowResult(previousShowResult);
      setNeedsAccount(error.code === 'GUEST_LIMIT_REACHED');
      setMessage(`${error.message || 'AI chưa tạo được ảnh.'} Bố cục vẫn được giữ.`);
    } finally {
      if (requestId === requestSequenceRef.current) {
        generationRef.current = false;
        setIsGenerating(false);
      }
    }
  };

  const generateInspiration = async () => {
    if (!roomImage) {
      setMessage('Hãy tải ảnh phòng trước khi dùng Gợi ý AI.');
      return;
    }
    if (generationRef.current) return;
    // Keep a few extra, distinct-category candidates so broken image URLs can
    // be skipped and replaced while the payload still contains at most 3 refs.
    const suggestedProducts = pickRandomCatalogProducts(
      products,
      unavailableProductIds,
      INSPIRATION_CANDIDATE_COUNT,
    );
    if (!suggestedProducts.length) {
      setMessage('Chưa có sản phẩm đủ ảnh để tạo gợi ý.');
      return;
    }
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    const hadResult = Boolean(resultImage);
    const previousShowResult = showResult;
    generationRef.current = true;
    setIsGenerating(true);
    setShowResult(false);
    setLastFailedPlacementId(null);
    setMessage('Đang tạo gợi ý AI…');
    try {
      const [resizedRoom, smallRoomImage, references] = await Promise.all([
        resizeImageForAi(roomImage, 1280),
        resizeImageForAi(roomImage, 511),
        createProductReferenceImages(suggestedProducts, 3),
      ]);
      const result = await createRoomPreview({
        mode: "inspiration",
        roomImageDataUrl: resizedRoom,
        smallRoomImageDataUrl: smallRoomImage,
        productImageDataUrls: references.productImageDataUrls,
        sceneProducts: references.products.map((product) => ({
          productId: product._id || product.id,
          name: product.name,
          ...inferProductFacts(product),
          target: { x: 0.5, y: 0.75 },
        })),
        userPrompt: roomRequest.trim(),
        designBrief,
        imageSize,
      });
      if (!result.imageDataUrl?.startsWith("data:image/"))
        throw new Error("Ảnh ý tưởng không hợp lệ.");
      if (requestId !== requestSequenceRef.current) return;
      setResultImage(result.imageDataUrl);
      setResultMode("inspiration");
      setInspirationProducts(references.products.slice(0, 3).map(inspirationProductSnapshot));
      setResultMatchesLayout(true);
      setNeedsAccount(false);
      setShowResult(true);
      setElapsedMs(result.elapsedMs || null);
      setResultInfo({
        provider: result.provider || "",
        model: result.model || "",
      });
      setMessage('');
    } catch (error) {
      if (requestId !== requestSequenceRef.current) return;
      if (hadResult) setShowResult(previousShowResult);
      setNeedsAccount(error.code === 'GUEST_LIMIT_REACHED');
      setMessage(`${error.message || 'Chưa tạo được gợi ý.'} Bố cục vẫn được giữ.`);
    } finally {
      if (requestId === requestSequenceRef.current) {
        generationRef.current = false;
        setIsGenerating(false);
      }
    }
  };

  const addPlacement = (target, product = selectedProduct && { ...selectedProduct, ...selectedFacts }) => {
    if (!roomImage || !target) {
      setMessage("Hãy tải ảnh phòng trước khi đặt sản phẩm.");
      return;
    }
    if (!product || generationRef.current) return;
    if (placementsRef.current.length >= MAX_PLACEMENTS) {
      setMessage(`Mỗi phòng thử tối đa ${MAX_PLACEMENTS} sản phẩm.`);
      return;
    }
    if (activeResult)
      stopResultView("Đã quay lại bố cục để đặt thêm sản phẩm.");
    const placement = createPlacement(
      product,
      target,
      Math.max(0, ...placementsRef.current.map((item) => item.zIndex || 0)) + 1,
    );
    const next = [...placementsRef.current, placement];
    setResultMatchesLayout(false);
    placementsRef.current = next;
    setPlacements(next);
    setSelectedPlacementId(placement.id);
    setIsMarkingMode(false);
    setSelectedId('');
    void renderScene(next, placement.id);
  };
  const removePlacement = (id) => {
    setResultMatchesLayout(false);
    const next = placementsRef.current.filter(
      (placement) => placement.id !== id,
    );
    placementsRef.current = next;
    setPlacements(next);
    setSelectedPlacementId(null);
    stopResultView();
    if (!next.length) setMessage("Đã xóa hết sản phẩm khỏi bố cục.");
  };
  const handleStageClick = (event) => {
    if (
      !roomImage ||
      dragRef.current?.moved ||
      activeResult ||
      generationRef.current
    )
      return;
    const target = getTarget(event);
    if (!target) return;
    if (isMarkingMode) {
      if (markedCorners.length >= 4) return;
      const index = markedCorners.length;
      const corner = {
        id: `corner-${Date.now()}-${index}`,
        index: index + 1,
        x: target.x,
        y: target.y,
        color: CORNER_COLORS[index],
        label: `Điểm sàn ${index + 1}`,
      };
      setMarkedCorners((current) => [...current, corner]);
      setResultMatchesLayout(false);
      if (index === 3) {
        setIsMarkingMode(false);
        setMessage(
          "Đã có ô tham chiếu sàn. Bạn có thể đặt sản phẩm hoặc bỏ qua bước này.",
        );
      } else setMessage(`Đã chấm điểm ${index + 1}/4 trên vùng sàn.`);
      return;
    }
    if (!selectedProduct || activeTab !== 'products') {
      setMessage('Chọn một sản phẩm trong tab Sản phẩm trước, rồi bấm vị trí muốn đặt.');
      return;
    }
    addPlacement(target);
  };
  const handlePlacementPointerDown = (event, placement) => {
    if (activeResult || generationRef.current) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { id: placement.id, moved: false };
    setSelectedPlacementId(placement.id);
  };
  const handleStagePointerMove = (event) => {
    if (!dragRef.current || generationRef.current) return;
    const target = getTarget(event);
    if (!target) return;
    dragRef.current.moved = true;
    updatePlacement(dragRef.current.id, { target });
  };
  const handleStagePointerUp = () => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.moved) {
      const next = placementsRef.current;
      stopResultView("Đang tạo lại ảnh AI cho vị trí mới.");
      void renderScene(next, drag.id);
    }
    window.setTimeout(() => {
      dragRef.current = null;
    }, 0);
  };
  const uploadRoom = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      const image = loadEvent.target?.result;
      if (!image) return;
      let optimizedImage;
      try {
        optimizedImage = await resizeImageForAi(image, 1600, 0.86);
      } catch {
        setMessage("Không thể đọc ảnh phòng này. Hãy thử một ảnh khác.");
        return;
      }
      requestSequenceRef.current += 1;
      generationRef.current = false;
      setIsGenerating(false);
      setRoomImage(optimizedImage);
      setSelectedId('');
      setSelectedFacts({});
      setNeedsAccount(false);
      setRoomRequest('');
      setDesignBrief({ purpose: '', style: '', keepClear: '', avoid: '' });
      setResultMatchesLayout(true);
      setRoomFileName(file.name);
      setImageSize({ width: 0, height: 0 });
      setMarkedCorners([]);
      setPlacements([]);
      setSelectedPlacementId(null);
      setResultImage("");
      setResultMode("");
      setInspirationProducts([]);
      setShowResult(false);
      setElapsedMs(null);
      setResultInfo(null);
      setIsMarkingMode(false);
      setLastFailedPlacementId(null);
      setMessage(
        "Ảnh đã sẵn sàng. Bạn có thể đặt sản phẩm ngay hoặc tạo một gợi ý cả phòng.",
      );
    };
    reader.readAsDataURL(file);
  };
  const saveCollection = async () => {
    if (!roomImage || (!placements.length && !resultImage)) {
      setMessage(
        "Hãy tạo một ý tưởng hoặc đặt ít nhất một sản phẩm trước khi lưu.",
      );
      return;
    }
    const latest = activePlacement || placements[placements.length - 1] || {};
    const savingInspiration = resultMatchesLayout && resultMode === 'inspiration';
    const latestProduct =
      latest.product ||
      products.find(
        (item) => item._id === latest.productId || item.id === latest.productId,
      );
    const imageReference = (value) => value?.startsWith('data:') ? '' : (value || '');
    const compactPlacement = (placement) => ({
      id: placement.id,
      productId: placement.productId,
      productName: placement.productName,
      productFacts: {
        dimensionsCm: placement.product?.dimensionsCm || {},
        usageType: placement.product?.usageType || 'unknown',
        placementSurface: placement.product?.placementSurface || 'unknown',
        aiDescription: placement.product?.aiDescription || '',
      },
      image: imageReference(placement.product?.image || placement.image),
      transparentImage: imageReference(placement.product?.transparentImage || placement.transparentImage),
      target: {
        x: Number((placement.target.x / 100).toFixed(4)),
        y: Number((placement.target.y / 100).toFixed(4)),
      },
      scale: placement.scale || 1,
      rotation: normalizeRotation(placement.rotation),
      flip: Boolean(placement.isFlipped),
      zIndex: placement.zIndex || 1,
    });
    let savedRoomImage = roomImage;
    let savedResultImage = resultMatchesLayout ? resultImage : '';
    try {
      [savedRoomImage, savedResultImage] = await Promise.all([
        resizeImageForAi(roomImage, 1280, 0.82),
        savedResultImage ? resizeImageForAi(savedResultImage, 1280, 0.82) : Promise.resolve(''),
      ]);
    } catch {
      setMessage('Không thể chuẩn bị ảnh để lưu. Hãy thử lại.');
      return;
    }
    await saveRoomTemplate({
      name:
        savingInspiration
          ? "Ý tưởng cả phòng"
          : `Phòng thử với ${placements.length} sản phẩm`,
      productId: latest.productId,
      productName: latest.productName || "",
      productImage: imageReference(getProductImageSource(latestProduct)),
      roomImage: savedRoomImage,
      target: latest.target
        ? {
            x: Number((latest.target.x / 100).toFixed(4)),
            y: Number((latest.target.y / 100).toFixed(4)),
            anchor: "bottom-center",
          }
        : undefined,
      scale: latest.scale,
      rotation: normalizeRotation(latest.rotation),
      flip: latest.isFlipped,
      placements: savingInspiration ? [] : placements.map(compactPlacement),
      inspirationProducts: savingInspiration ? inspirationProducts.slice(0, 3) : [],
      markedCorners: markedCorners.map((corner) => ({
        x: Number((corner.x / 100).toFixed(4)),
        y: Number((corner.y / 100).toFixed(4)),
      })),
      imageSize,
      resultImage: savedResultImage,
      resultMatchesLayout,
      designMode: savingInspiration ? 'inspiration' : 'placement',
      userPrompt: roomRequest.trim(),
      designBrief,
      model: resultInfo
        ? [resultInfo.provider, resultInfo.model].filter(Boolean).join(" · ")
        : "",
      elapsedMs,
    });
    setMessage("Đã lưu ảnh và các cài đặt hiện tại vào Bộ sưu tập.");
  };
  const resetStudio = () => {
    requestSequenceRef.current += 1;
    generationRef.current = false;
    setIsGenerating(false);
    setRoomImage("");
    setSelectedId('');
    setSelectedFacts({});
    setNeedsAccount(false);
    setRoomRequest('');
    setDesignBrief({ purpose: '', style: '', keepClear: '', avoid: '' });
    setResultMatchesLayout(true);
    setRoomFileName("");
    setImageSize({ width: 0, height: 0 });
    setMarkedCorners([]);
    setPlacements([]);
    setSelectedPlacementId(null);
    setResultImage("");
    setResultMode("");
    setInspirationProducts([]);
    setShowResult(false);
    setElapsedMs(null);
    setResultInfo(null);
    setIsMarkingMode(false);
    setLastFailedPlacementId(null);
    setMessage("Đã làm mới Phòng thử.");
  };
  const renderPlacementStyle = (placement) => {
    const product =
      placement.product ||
      products.find(
        (item) =>
          item._id === placement.productId || item.id === placement.productId,
      );
    const base = getProductPreviewStyle(
      product || {},
      placement.target,
      placement.isFlipped,
      buildCameraParameters(markedCorners, imageSize),
    );
    return {
      ...base,
      zIndex: placement.zIndex,
      transform: `${base.transform} rotate(${normalizeRotation(placement.rotation)}deg) scale(${placement.scale || 1})`,
    };
  };

  return (
    <main className="studio-page" aria-label="Phòng thử nội thất AI">
      <section className="studio-workspace">
        <header className="studio-toolbar">
          <div className="studio-brand">
            <span>PHÒNG THỬ</span>
            <strong>{roomFileName || "Studio nội thất"}</strong>
            <small>
              {placements.length
                ? `${placements.length} món trong bố cục`
                : "Ảnh thật · ý tưởng thật"}
            </small>
          </div>
          <div className="studio-toolbar-actions">
            <label className="button button-small button-secondary">
              Tải ảnh
              <input
                type="file"
                accept="image/*"
                onChange={uploadRoom}
                hidden
              />
            </label>
            {roomImage && (
              <button
                type="button"
                className="button button-small button-secondary"
                onClick={resetStudio}
              >
                Làm mới
              </button>
            )}
            {resultImage && (
              <button
                type="button"
                className="button button-small button-secondary"
                disabled={isGenerating}
                onClick={() =>
                  setShowResult((current) => {
                    const next = !current;
                    setMessage(
                      next
                        ? "Đang xem ảnh AI gần nhất."
                        : "Đang xem ảnh phòng gốc và bố cục để chỉnh sửa.",
                    );
                    return next;
                  })
                }
              >
                {showResult ? "Ảnh gốc" : "Ảnh AI gần nhất"}
              </button>
            )}
            <button
              type="button"
              className="button button-small"
              disabled={
                isGenerating ||
                !roomImage ||
                (!placements.length && !resultImage)
              }
              onClick={saveCollection}
            >
              Lưu
            </button>
          </div>
        </header>
        <section className="studio-canvas-panel">
          {!roomImage ? (
            <label className="studio-upload">
              <input
                type="file"
                accept="image/*"
                onChange={uploadRoom}
                hidden
              />
              <span>⌂</span>
              <strong>Bắt đầu với ảnh căn phòng</strong>
              <small>
                JPG, PNG hoặc WEBP · ảnh luôn hiển thị trọn vẹn trong khung
              </small>
              <i className="button">Chọn ảnh phòng</i>
            </label>
          ) : (
            <div className="studio-stage-viewport" ref={stageViewportRef}>
              <div
                className={`studio-stage ${isMarkingMode ? "is-marking" : ""}`}
                style={mediaStyle}
                ref={stageRef}
                onClick={handleStageClick}
                onPointerMove={handleStagePointerMove}
                onPointerUp={handleStagePointerUp}
                onPointerCancel={handleStagePointerUp}
              >
                <img
                  src={displayedImage}
                  alt={
                    activeResult
                      ? "Kết quả AI cho căn phòng"
                      : "Căn phòng để đặt nội thất"
                  }
                  onLoad={(event) => {
                    if (!activeResult)
                      setImageSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      });
                  }}
                />
                {!activeResult && markedCorners.length > 1 && (
                  <svg
                    className="studio-floor-patch"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <polyline
                      points={markedCorners
                        .map((corner) => `${corner.x},${corner.y}`)
                        .join(" ")}
                    />
                    {markedCorners.length === 4 && (
                      <polygon
                        points={markedCorners
                          .map((corner) => `${corner.x},${corner.y}`)
                          .join(" ")}
                      />
                    )}
                  </svg>
                )}
                {!activeResult &&
                  markedCorners.map((corner) => (
                    <button
                      key={corner.id}
                      type="button"
                      className="studio-corner"
                      style={{
                        left: `${corner.x}%`,
                        top: `${corner.y}%`,
                        "--corner-color": corner.color,
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {corner.index}
                    </button>
                  ))}
                {!activeResult &&
                  placements.map((placement) => {
                    const product =
                      placement.product ||
                      products.find(
                        (item) =>
                          item._id === placement.productId ||
                          item.id === placement.productId,
                      );
                    const source = getProductImageSource(product);
                    return (
                      <button
                        key={placement.id}
                        type="button"
                        className={`studio-product-placement ${placement.id === selectedPlacementId ? "selected" : ""}`}
                        style={renderPlacementStyle(placement)}
                        onPointerDown={(event) =>
                          handlePlacementPointerDown(event, placement)
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedPlacementId(placement.id);
                          setActiveTab("layout");
                          setLayoutPane("edit");
                        }}
                        title={placement.productName}
                      >
                        {source ? (
                          <img
                            src={source}
                            alt={placement.productName}
                            draggable="false"
                          />
                        ) : (
                          <ProductArtwork
                            product={product || { name: placement.productName }}
                          />
                        )}
                      </button>
                    );
                  })}
                {isGenerating && (
                  <div className="studio-loader" role="status">
                    <span className="room-spinner" />
                    <strong>Đang tạo ảnh AI</strong>
                    <small>Ảnh và bố cục gốc vẫn được giữ.</small>
                  </div>
                )}
                {activeResult && (
                  <div className="studio-result-label">
                    <strong>
                      {resultMode === "inspiration"
                        ? "Gợi ý cả phòng"
                        : "Ảnh AI bố cục"}
                    </strong>
                    <span>
                      {elapsedMs
                        ? `${(elapsedMs / 1000).toFixed(1)} giây`
                        : "Vừa tạo xong"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        stopResultView(
                          resultMode === "inspiration"
                            ? "Đã quay lại ảnh phòng gốc; ý tưởng AI chỉ là tham khảo."
                            : "Đã quay lại bố cục để chỉnh từng sản phẩm.",
                        )
                      }
                    >
                      {resultMode === "inspiration"
                        ? "Xem ảnh gốc"
                        : "Chỉnh bố cục"}
                    </button>
                  </div>
                )}
                {activeResult && resultMode === "inspiration" && displayedInspirationProducts.length > 0 && (
                  <details
                    className="studio-result-products"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <summary>{displayedInspirationProducts.length} sản phẩm được chọn</summary>
                    <div className="studio-result-products-list">
                      {displayedInspirationProducts.map((product) => (
                        <div className="studio-result-product" key={product.productId || product._id || product.id}>
                          <ProductArtwork product={product} />
                          <strong title={product.name}>{product.name}</strong>
                          {product.sourceUrl && (
                            <a href={product.sourceUrl} target="_blank" rel="noreferrer">Xem</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {!activeResult && (
                  <div className="studio-stage-tip">
                    {isMarkingMode
                      ? `${markedCorners.length}/4 · bấm trong vùng sàn`
                      : selectedProduct ? 'Đã chọn món · bấm vị trí để đặt và tạo ảnh' : 'Chọn sản phẩm trước · không tự đặt khi bấm ảnh'}
                  </div>
                )}
              </div>
            </div>
          )}
          {(message || (needsAccount && !user)) && (
            <p className="studio-status" role="status">
              {isGenerating && <span className="loading-dot" />}
              {message}
              {needsAccount && !user && <button type="button" className="studio-login-link" onClick={openRegister}>Đăng ký để tiếp tục</button>}
            </p>
          )}
        </section>
        <aside className="studio-inspector">
          <nav className="studio-tabs" aria-label="Công cụ Phòng thử">
            <button
              type="button"
              className={activeTab === "products" ? "active" : ""}
              onClick={() => setActiveTab("products")}
            >
              Chọn món
            </button>
            <button
              type="button"
              className={activeTab === "brief" ? "active" : ""}
              onClick={() => setActiveTab("brief")}
            >
              Mong muốn
            </button>
            <button
              type="button"
              className={activeTab === "layout" ? "active" : ""}
              onClick={() => setActiveTab("layout")}
            >
              Bố cục
            </button>
            <button
              type="button"
              className="studio-ai-trigger"
              disabled={isGenerating}
              onClick={generateInspiration}
            >
              {isGenerating ? 'Đang tạo…' : '✦ Gợi ý AI'}
            </button>
          </nav>
          <div className="studio-tab-content">
            {activeTab === 'brief' && <section className="studio-tab-panel">
              <div className="studio-panel-heading">
                <h1>Mong muốn</h1>
                <button
                  type="button"
                  className="text-button danger studio-brief-clear"
                  disabled={!roomRequest.trim() && !Object.values(designBrief).some((value) => String(value || '').trim())}
                  onClick={() => {
                    setRoomRequest('');
                    setDesignBrief({ purpose: '', style: '', keepClear: '', avoid: '' });
                    setResultMatchesLayout(false);
                    setMessage('Đã xóa nội dung mong muốn.');
                  }}
                >
                  Xóa nội dung
                </button>
              </div>
              <DesignBriefFields value={designBrief} onChange={(value) => { setDesignBrief(value); setResultMatchesLayout(false); }} />
              <label className="studio-prompt"><span>Chi tiết khác</span><textarea value={roomRequest} maxLength="300" onChange={(event) => { setRoomRequest(event.target.value); setResultMatchesLayout(false); }} placeholder="Ví dụ: để khoảng trống trước tủ để mở cánh" /></label>
            </section>}
            {activeTab === "products" && (
              <section className="studio-tab-panel studio-products-tab">
                <div className="studio-panel-heading">
                  <div>
                    <p className="studio-kicker">1. CHỌN MÓN → 2. BẤM VỊ TRÍ</p>
                    <h1>{selectedProduct ? 'Kiểm tra món đã chọn' : 'Bạn muốn thử món nào?'}</h1>
                  </div>
                  <small>
                    {placements.length}/{MAX_PLACEMENTS}
                  </small>
                </div>
                {selectedProduct ? <div className="studio-selected-product">
                  <div className="studio-selected-summary"><ProductArtwork product={selectedProduct} onImageError={() => markProductUnavailable(selectedProduct)} /><strong>{selectedProduct.name}</strong></div>
                  <ProductFactsFields facts={selectedFacts} onChange={setSelectedFacts} />
                  <p>Bấm trong ảnh phòng để đặt món và tạo ảnh. Muốn thử nhiều món, chọn tiếp từng món sau đó.</p>
                  <button type="button" className="button button-small button-secondary" onClick={() => { setSelectedId(''); setMessage('Đã bỏ chọn. Bấm ảnh sẽ không thêm món.'); }}>Chọn món khác / hủy chọn</button>
                </div> : <>
                <div className="studio-product-filters">
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Tìm bàn, ghế, đèn…"
                    aria-label="Tìm sản phẩm"
                  />
                  <select
                    value={category}
                    onChange={(event) => {
                      setCategory(event.target.value);
                      setPage(1);
                    }}
                    aria-label="Lọc danh mục"
                  >
                    <option value="">Tất cả danh mục</option>
                    {categories.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="studio-product-grid">
                  {visibleProducts.map((product) => {
                    const id = product._id || product.id;
                    const imageUnavailable = unavailableProductIds.has(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`studio-product-card ${id === selectedId ? "selected" : ""} ${imageUnavailable ? "image-unavailable" : ""}`}
                        disabled={imageUnavailable}
                        title={imageUnavailable ? 'Admin cần thêm ảnh tham chiếu trước khi thử món này' : product.name}
                        onClick={() => {
                          chooseProduct(product);
                        }}
                      >
                        <ProductArtwork product={product} onImageError={() => markProductUnavailable(product)} />
                        <span>{product.name}</span>
                        {imageUnavailable && <small>Chưa có ảnh</small>}
                      </button>
                    );
                  })}
                </div>
                </>}
                {!visibleProducts.length && (
                  <p className="studio-empty">
                    Không tìm thấy sản phẩm phù hợp.
                  </p>
                )}
                <div className="studio-pagination">
                  <button
                    type="button"
                    className="button button-small button-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    ←
                  </button>
                  <span>
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="button button-small button-secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    →
                  </button>
                </div>
              </section>
            )}
            {activeTab === "layout" && (
              <section className="studio-tab-panel studio-layout-tab">
                <div className="studio-panel-heading">
                  <div>
                    <p className="studio-kicker">PHỐI CẢNH & CHỈNH SỬA</p>
                    <h1>Bố cục của bạn</h1>
                  </div>
                  <small>
                    {markedCorners.length
                      ? `${markedCorners.length}/4 điểm sàn`
                      : "Tùy chọn"}
                  </small>
                </div>
                <div
                  className="studio-layout-switch"
                  role="tablist"
                  aria-label="Công cụ bố cục"
                >
                  <button
                    type="button"
                    className={layoutPane === "edit" ? "active" : ""}
                    aria-selected={layoutPane === "edit"}
                    onClick={() => setLayoutPane("edit")}
                  >
                    Chỉnh món
                  </button>
                  <button
                    type="button"
                    className={layoutPane === "floor" ? "active" : ""}
                    aria-selected={layoutPane === "floor"}
                    onClick={() => setLayoutPane("floor")}
                  >
                    Căn sàn (tùy chọn)
                  </button>
                </div>
                {layoutPane === "floor" && (
                  <div className="studio-floor-tools">
                    <p>
                      <strong>Ô tham chiếu sàn</strong> là tùy chọn. Nếu dùng,
                      chấm bốn góc một hình chữ nhật có thật trên sàn (tấm thảm chữ nhật, mép ván hoặc đường gạch) theo
                      thứ tự trước trái → sau trái → sau phải → trước phải.
                      Không vẽ một ô tưởng tượng trên sàn trơn; không thấy mốc rõ thì bỏ qua. Bước này chỉ căn hướng, không đo chính xác kích thước phòng.
                    </p>
                    <div>
                      <button
                        type="button"
                        className="button button-small button-secondary"
                        disabled={!roomImage || isGenerating}
                        onClick={() => {
                          setMarkedCorners([]);
                          setResultMatchesLayout(false);
                          setIsMarkingMode(true);
                          stopResultView(
                            "Bấm 4 điểm trong vùng sàn nhìn thấy. Có thể bỏ qua nếu ảnh khó xác định.",
                          );
                        }}
                      >
                        Chấm ô sàn
                      </button>
                      <button
                        type="button"
                        className="button button-small button-secondary"
                        disabled={!markedCorners.length}
                        onClick={() => {
                          setMarkedCorners((current) => current.slice(0, -1));
                          setResultMatchesLayout(false);
                        }}
                      >
                        Xóa điểm
                      </button>
                      <button
                        type="button"
                        className="button button-small button-secondary"
                        disabled={!markedCorners.length && !isMarkingMode}
                        onClick={() => {
                          setMarkedCorners([]);
                          setIsMarkingMode(false);
                          setResultMatchesLayout(false);
                          setMessage("Đã bỏ qua ô tham chiếu sàn.");
                        }}
                      >
                        Bỏ qua
                      </button>
                    </div>
                  </div>
                )}
                {layoutPane === "edit" && (
                  <>
                    {activePlacement ? (
                      <div className="studio-placement-tools">
                        <strong>{activePlacement.productName}</strong>
                        <ProductFactsFields facts={activePlacement.product || activePlacement.productFacts || {}} onChange={(facts) => updatePlacement(activePlacement.id, { product: { ...activePlacement.product, ...facts } })} />
                        <div className="studio-control-row">
                          <span>Kích thước</span>
                          <button
                            type="button"
                            onClick={() =>
                              updatePlacement(activePlacement.id, {
                                scale: Number(
                                  clamp(
                                    activePlacement.scale - 0.1,
                                    0.4,
                                    1.8,
                                  ).toFixed(1),
                                ),
                              })
                            }
                          >
                            −
                          </button>
                          <b>{Math.round(activePlacement.scale * 100)}%</b>
                          <button
                            type="button"
                            onClick={() =>
                              updatePlacement(activePlacement.id, {
                                scale: Number(
                                  clamp(
                                    activePlacement.scale + 0.1,
                                    0.4,
                                    1.8,
                                  ).toFixed(1),
                                ),
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                        <div className="studio-control-row">
                          <span>Xoay</span>
                          <button
                            type="button"
                            onClick={() =>
                              updatePlacement(activePlacement.id, {
                                rotation: normalizeRotation(
                                  activePlacement.rotation - 15,
                                ),
                              })
                            }
                          >
                            ↺
                          </button>
                          <b>{normalizeRotation(activePlacement.rotation)}°</b>
                          <button
                            type="button"
                            onClick={() =>
                              updatePlacement(activePlacement.id, {
                                rotation: normalizeRotation(
                                  activePlacement.rotation + 15,
                                ),
                              })
                            }
                          >
                            ↻
                          </button>
                        </div>
                        <div className="studio-layout-actions">
                          <button
                            type="button"
                            className="button button-small button-secondary"
                            disabled={placements.length < 2}
                            onClick={() =>
                              movePlacementLayer(activePlacement.id, "back")
                            }
                          >
                            Đưa ra sau
                          </button>
                          <button
                            type="button"
                            className="button button-small button-secondary"
                            disabled={placements.length < 2}
                            onClick={() =>
                              movePlacementLayer(activePlacement.id, "front")
                            }
                          >
                            Đưa ra trước
                          </button>
                          <button
                            type="button"
                            className="button button-small button-secondary"
                            onClick={() =>
                              updatePlacement(activePlacement.id, {
                                isFlipped: !activePlacement.isFlipped,
                              })
                            }
                          >
                            Lật ngang
                          </button>
                          <button
                            type="button"
                            className="button button-small button-danger"
                            onClick={() => removePlacement(activePlacement.id)}
                          >
                            Xóa món
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="studio-empty">
                        Chọn một sản phẩm trên ảnh để chỉnh kích thước, xoay
                        hoặc lật.
                      </div>
                    )}
                    <div className="studio-render-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={!placements.length || isGenerating}
                        onClick={() =>
                          void renderScene(
                            placementsRef.current,
                            activePlacement?.id,
                          )
                        }
                      >
                        Tạo lại ảnh bố cục
                      </button>
                      {lastFailedPlacementId && (
                        <small>
                          Ảnh trước chưa thành công; bạn có thể thử lại khi đã
                          sẵn sàng.
                        </small>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
