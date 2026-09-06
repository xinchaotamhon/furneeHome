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
function normalizeScaleReference(reference) {
  if (!reference || !Array.isArray(reference.points)) return null;
  const points = reference.points.slice(0, 2).map((point) => toPercentTarget(point));
  const lengthCm = Number(reference.lengthCm);
  if (points.length !== 2 || !Number.isFinite(lengthCm) || lengthCm <= 0) return null;
  return { points, lengthCm };
}
function serializeScaleReference(reference) {
  const normalized = normalizeScaleReference(reference);
  if (!normalized) return null;
  return {
    points: normalized.points.map((point) => ({ x: Number((point.x / 100).toFixed(4)), y: Number((point.y / 100).toFixed(4)) })),
    lengthCm: normalized.lengthCm,
  };
}
function productWidthCm(product = {}) {
  return Number(product?.dimensionsCm?.width || product?.dimensionsCm?.widthCm || product?.widthCm || product?.width || 0);
}
function getReferencePixelLength(reference, roomSize = {}) {
  const normalized = normalizeScaleReference(reference);
  const width = Number(roomSize.width);
  const height = Number(roomSize.height);
  if (!normalized || width <= 0 || height <= 0) return 0;
  const [first, second] = normalized.points;
  return Math.hypot((second.x - first.x) * width / 100, (second.y - first.y) * height / 100);
}
function getScaleFromReference(product, target, reference, roomSize) {
  const widthCm = productWidthCm(product);
  const referencePixels = getReferencePixelLength(reference, roomSize);
  const roomWidth = Number(roomSize.width);
  if (!widthCm || !referencePixels || !roomWidth || !reference?.lengthCm) return null;
  const baseWidth = roomWidth * (getProductPreviewStyle(product, target).width.replace('%', '') / 100);
  if (!baseWidth) return null;
  return Number(clamp((referencePixels * widthCm / reference.lengthCm) / baseWidth, 0.4, 1.8).toFixed(2));
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
function createPlacement(product, target, zIndex, scale = 1) {
  return {
    id: `placement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: product._id || product.id,
    productName: product.name,
    product: productSnapshot(product),
    target,
    scale,
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
  const [scaleReference, setScaleReference] = useState(() =>
    normalizeScaleReference(savedInitial?.scaleReference),
  );
  const [scaleLengthInput, setScaleLengthInput] = useState(() =>
    String(savedInitial?.scaleReference?.lengthCm || 80),
  );
  const [scaleProductWidthInput, setScaleProductWidthInput] = useState("");
  const [isMarkingMode, setIsMarkingMode] = useState(false);
  // Chọn món trong danh sách sẽ tạo ngay một placement để người dùng chỉnh trực tiếp trên ảnh.
  const [selectedId, setSelectedId] = useState(() => location.state?.product?._id || location.state?.product?.id || '');
  const [unavailableProductIds, setUnavailableProductIds] = useState(() => new Set());
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
  const pendingProductRef = useRef(location.state?.product || null);
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
      scaleReference: serializeScaleReference(scaleReference),
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
    scaleReference,
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
    const id = product._id || product.id;
    setSelectedId(id);
    setIsMarkingMode(false);
    if (!roomImage) {
      pendingProductRef.current = product;
      setMessage(`Đã chọn ${product.name}. Tải ảnh phòng để đặt món vào khung.`);
      return;
    }
    pendingProductRef.current = null;
    const productWithFacts = { ...product, ...inferProductFacts(product) };
    const initialScale = getScaleFromReference(
      productWithFacts,
      INITIAL_TARGET,
      scaleReference,
      imageSize,
    ) || 1;
    addPlacement(INITIAL_TARGET, productWithFacts, initialScale);
    setMessage(`Đã thêm ${product.name}. Kéo món, kéo nút góc để đổi kích thước hoặc dùng thanh công cụ cạnh món.`);
  };
  useEffect(() => {
    if (!roomImage || !pendingProductRef.current) return;
    const product = pendingProductRef.current;
    pendingProductRef.current = null;
    chooseProduct(product);
  }, [roomImage]);
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
  const activePlacementProduct = activePlacement
    ? activePlacement.product || products.find(
      (item) => item._id === activePlacement.productId || item.id === activePlacement.productId,
    ) || null
    : null;
  const activeProductWidthCm = productWidthCm(activePlacementProduct);
  useEffect(() => {
    setScaleProductWidthInput(activeProductWidthCm ? String(activeProductWidthCm) : "");
  }, [selectedPlacementId, activeProductWidthCm]);
  const applyScaleReference = (
    reference,
    placement = activePlacement,
    widthOverride = Number(scaleProductWidthInput),
  ) => {
    if (!placement) return false;
    const product = placement.product || products.find(
      (item) => item._id === placement.productId || item.id === placement.productId,
    ) || {};
    const widthCm = Number(widthOverride) > 0 ? Number(widthOverride) : productWidthCm(product);
    const productWithWidth = widthCm > 0
      ? { ...product, dimensionsCm: { ...(product.dimensionsCm || {}), width: widthCm } }
      : product;
    const nextScale = getScaleFromReference(productWithWidth, placement.target, reference, imageSize);
    if (!nextScale) {
      setMessage("Nhập chiều rộng thật của món để căn theo mốc.");
      return false;
    }
    updatePlacement(placement.id, {
      scale: nextScale,
      product: productWithWidth,
      productFacts: {
        ...(placement.productFacts || {}),
        dimensionsCm: productWithWidth.dimensionsCm,
      },
    });
    setScaleProductWidthInput(String(widthCm));
    setMessage(`Đã căn tỷ lệ theo mốc ${reference.lengthCm} cm. Bạn vẫn có thể chỉnh tay bằng nút góc.`);
    return true;
  };
  const beginScaleReference = () => {
    const lengthCm = Number(scaleLengthInput);
    if (!Number.isFinite(lengthCm) || lengthCm <= 0 || lengthCm > 1000) {
      setMessage("Nhập chiều dài mốc hợp lệ (1–1000 cm).");
      return;
    }
    if (!roomImage) {
      setMessage("Hãy tải ảnh phòng trước khi đặt mốc tỷ lệ.");
      return;
    }
    setScaleReference({ points: [], lengthCm });
    setIsMarkingMode(true);
    setResultMatchesLayout(false);
    stopResultView("Bấm 2 đầu của một cạnh có số đo thật gần sản phẩm.");
  };
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
      const finalImage = await compositeRoomPreview({
        roomSource: roomImage,
        resultSource: result.imageDataUrl,
        maskSource: guideImages.maskImageDataUrl,
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

  const addPlacement = (
    target,
    product,
    scale = 1,
  ) => {
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
      scale,
    );
    const next = [...placementsRef.current, placement];
    setResultMatchesLayout(false);
    placementsRef.current = next;
    setPlacements(next);
    setSelectedPlacementId(placement.id);
    setIsMarkingMode(false);
    setSelectedId(product._id || product.id);
    setMessage("Đã thêm sản phẩm vào ảnh. Bạn có thể kéo, phóng/thu hoặc chỉnh bằng thanh công cụ cạnh món.");
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
      const currentPoints = scaleReference?.points || [];
      if (currentPoints.length >= 2) return;
      const points = [...currentPoints, target];
      const nextReference = { points, lengthCm: Number(scaleLengthInput) };
      setScaleReference(nextReference);
      setResultMatchesLayout(false);
      if (points.length === 2) {
        setIsMarkingMode(false);
        if (activePlacement) applyScaleReference(nextReference, activePlacement);
        else setMessage("Đã đặt mốc tỷ lệ. Chọn món có số đo để tự căn, hoặc chỉnh tay bằng nút góc.");
      } else setMessage("Đã đặt điểm đầu. Bấm điểm thứ hai của cạnh có số đo thật.");
      return;
    }
    setMessage(
      selectedPlacementId
        ? 'Kéo trực tiếp sản phẩm để di chuyển hoặc dùng nút góc để phóng/thu.'
        : 'Bấm một sản phẩm trong danh sách để thêm món vào giữa/đáy ảnh.',
    );
  };
  const handlePlacementPointerDown = (event, placement) => {
    if (activeResult || generationRef.current) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { id: placement.id, mode: "move", moved: false };
    setSelectedPlacementId(placement.id);
  };
  const handlePlacementResizeStart = (event, placement) => {
    if (activeResult || generationRef.current || !stageRef.current) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = stageRef.current.getBoundingClientRect();
    const anchorX = rect.left + (placement.target.x / 100) * rect.width;
    const anchorY = rect.top + (placement.target.y / 100) * rect.height;
    const startDistance = Math.max(
      12,
      Math.hypot(event.clientX - anchorX, event.clientY - anchorY),
    );
    dragRef.current = {
      id: placement.id,
      mode: "resize",
      moved: false,
      anchorX,
      anchorY,
      startDistance,
      startScale: placement.scale || 1,
    };
    setSelectedPlacementId(placement.id);
  };
  const handleStagePointerMove = (event) => {
    if (!dragRef.current || generationRef.current) return;
    if (dragRef.current.mode === "resize") {
      const distance = Math.max(
        12,
        Math.hypot(
          event.clientX - dragRef.current.anchorX,
          event.clientY - dragRef.current.anchorY,
        ),
      );
      const scale = clamp(
        dragRef.current.startScale * (distance / dragRef.current.startDistance),
        0.4,
        1.8,
      );
      dragRef.current.moved = true;
      updatePlacement(dragRef.current.id, {
        scale: Number(scale.toFixed(2)),
      });
      return;
    }
    const target = getTarget(event);
    if (!target) return;
    dragRef.current.moved = true;
    updatePlacement(dragRef.current.id, { target });
  };
  const handleStagePointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (event.type === 'pointercancel') {
      dragRef.current = null;
      return;
    }
    if (drag.moved) {
      stopResultView(
        drag.mode === "resize"
          ? "Đã cập nhật kích thước. Bấm Tạo ảnh khi bạn muốn AI hoàn thiện căn phòng."
          : "Đã cập nhật vị trí. Bấm Tạo ảnh khi bạn muốn AI hoàn thiện căn phòng.",
      );
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
      setNeedsAccount(false);
      setRoomRequest('');
      setDesignBrief({ purpose: '', style: '', keepClear: '', avoid: '' });
      setResultMatchesLayout(true);
      setRoomFileName(file.name);
      setImageSize({ width: 0, height: 0 });
      setMarkedCorners([]);
      setScaleReference(null);
      setScaleLengthInput('80');
      setScaleProductWidthInput('');
      setPlacements([]);
      setSelectedPlacementId(null);
      setResultImage("");
      setResultMode("");
      setInspirationProducts([]);
      setShowResult(false);
      setElapsedMs(null);
      setResultInfo(null);
      setIsMarkingMode(false);
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
      scaleReference: serializeScaleReference(scaleReference),
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
    setNeedsAccount(false);
    setRoomRequest('');
    setDesignBrief({ purpose: '', style: '', keepClear: '', avoid: '' });
    setResultMatchesLayout(true);
    setRoomFileName("");
    setImageSize({ width: 0, height: 0 });
    setMarkedCorners([]);
    setScaleReference(null);
    setScaleLengthInput('80');
    setScaleProductWidthInput('');
    setPlacements([]);
    setSelectedPlacementId(null);
    setResultImage("");
    setResultMode("");
    setInspirationProducts([]);
    setShowResult(false);
    setElapsedMs(null);
    setResultInfo(null);
    setIsMarkingMode(false);
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
            <button
              type="button"
              className="button button-small studio-generate-trigger"
              disabled={!placements.length || isGenerating}
              onClick={() => void renderScene(placementsRef.current, activePlacement?.id)}
              title="Dùng AI để hoàn thiện bố cục hiện tại"
            >
              {isGenerating ? 'Đang tạo…' : 'Tạo ảnh'}
            </button>
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
                {!activeResult && scaleReference?.points?.length > 0 && (
                  <>
                    <svg className="studio-scale-reference" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <line
                        x1={scaleReference.points[0].x}
                        y1={scaleReference.points[0].y}
                        x2={scaleReference.points[1]?.x ?? scaleReference.points[0].x}
                        y2={scaleReference.points[1]?.y ?? scaleReference.points[0].y}
                      />
                      {scaleReference.points.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="1.1" />)}
                    </svg>
                    {scaleReference.points.length === 2 && (
                      <span
                        className="studio-scale-label"
                        style={{
                          left: `${(scaleReference.points[0].x + scaleReference.points[1].x) / 2}%`,
                          top: `${(scaleReference.points[0].y + scaleReference.points[1].y) / 2}%`,
                        }}
                      >{scaleReference.lengthCm} cm</span>
                    )}
                  </>
                )}
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
                      <div
                        key={placement.id}
                        role="button"
                        tabIndex={0}
                        className={`studio-product-placement ${placement.id === selectedPlacementId ? "selected" : ""}`}
                        style={renderPlacementStyle(placement)}
                        onPointerDown={(event) =>
                          handlePlacementPointerDown(event, placement)
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedPlacementId(placement.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedPlacementId(placement.id);
                          }
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
                        {placement.id === selectedPlacementId && (
                          <>
                            <div
                              className={`studio-placement-toolbar ${placement.target.y < 25 ? "below" : ""}`}
                              role="toolbar"
                              aria-label={`Công cụ ${placement.productName}`}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                type="button"
                                aria-label="Xoay trái"
                                title="Xoay trái"
                                onClick={() => updatePlacement(placement.id, { rotation: normalizeRotation(placement.rotation - 15) })}
                              >↺</button>
                              <button
                                type="button"
                                aria-label="Xoay phải"
                                title="Xoay phải"
                                onClick={() => updatePlacement(placement.id, { rotation: normalizeRotation(placement.rotation + 15) })}
                              >↻</button>
                              <button
                                type="button"
                                aria-label="Đưa ra sau"
                                title="Đưa ra sau"
                                disabled={placements.length < 2}
                                onClick={() => movePlacementLayer(placement.id, "back")}
                              >⇣</button>
                              <button
                                type="button"
                                aria-label="Đưa ra trước"
                                title="Đưa ra trước"
                                disabled={placements.length < 2}
                                onClick={() => movePlacementLayer(placement.id, "front")}
                              >⇡</button>
                              <button
                                type="button"
                                aria-label="Lật ngang"
                                title="Lật ngang"
                                onClick={() => updatePlacement(placement.id, { isFlipped: !placement.isFlipped })}
                              >⇋</button>
                            </div>
                            <button
                              type="button"
                              className="studio-placement-delete"
                              aria-label={`Xóa ${placement.productName}`}
                              title="Xóa sản phẩm"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => removePlacement(placement.id)}
                            >×</button>
                            <button
                              type="button"
                              className="studio-placement-resize"
                              aria-label="Kéo để đổi kích thước"
                              title="Kéo để phóng/thu"
                              onPointerDown={(event) => handlePlacementResizeStart(event, placement)}
                              onClick={(event) => event.stopPropagation()}
                            />
                          </>
                        )}
                      </div>
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
                      ? `${scaleReference?.points?.length || 0}/2 · bấm hai đầu mốc`
                      : selectedPlacementId
                        ? 'Kéo món để di chuyển · kéo nút góc để phóng/thu'
                        : 'Chọn sản phẩm ở danh sách để thêm vào ảnh'}
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
              Tỷ lệ
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
                    <p className="studio-kicker">CHỌN MÓN ĐỂ THÊM VÀO ẢNH</p>
                    <h1>Chọn sản phẩm</h1>
                  </div>
                  <small>
                    {placements.length}/{MAX_PLACEMENTS}
                  </small>
                </div>
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
                <p className="studio-selection-hint">Bấm một món để thêm vào giữa/đáy ảnh. Sau đó kéo trực tiếp trên ảnh để đặt lại.</p>
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
                    <p className="studio-kicker">THÊM MỐC ĐO THẬT</p>
                    <h1>Tỷ lệ thật <small>(tùy chọn)</small></h1>
                  </div>
                  <small>
                    {scaleReference?.points?.length === 2 ? `${scaleReference.lengthCm} cm` : "Chưa đặt mốc"}
                  </small>
                </div>
                <div className="studio-scale-tools">
                  <p>Chọn chiều dài của cạnh/vật có thật gần món rồi đặt đúng 2 đầu mốc trên ảnh.</p>
                  <div className="studio-scale-presets" role="group" aria-label="Chiều dài mốc gợi ý">
                    {[60, 80, 120].map((value) => (
                      <button key={value} type="button" className={Number(scaleLengthInput) === value ? "active" : ""} onClick={() => setScaleLengthInput(String(value))}>{value} cm</button>
                    ))}
                    <label><span>Khác</span><input type="number" min="1" max="1000" value={scaleLengthInput} onChange={(event) => setScaleLengthInput(event.target.value)} aria-label="Chiều dài mốc theo centimet" /> <em>cm</em></label>
                  </div>
                  <button type="button" className="button button-small button-secondary" disabled={!roomImage || isGenerating} onClick={beginScaleReference}>
                    {isMarkingMode ? "Đang chờ 2 điểm trên ảnh…" : "Đặt 2 mốc trên ảnh"}
                  </button>
                  {scaleReference?.points?.length === 2 && <button type="button" className="text-button danger" onClick={() => { setScaleReference(null); setResultMatchesLayout(false); setMessage("Đã xóa mốc tỷ lệ. Sản phẩm vẫn có thể chỉnh tay."); }}>Xóa mốc</button>}
                  {activePlacement && (
                    <div className="studio-scale-product">
                      <strong title={activePlacement.productName}>{activePlacement.productName}</strong>
                      <label>
                        <span>Rộng món</span>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={scaleProductWidthInput}
                          onChange={(event) => setScaleProductWidthInput(event.target.value)}
                          aria-label="Chiều rộng thật của sản phẩm theo centimet"
                        />
                        <em>cm</em>
                      </label>
                      <button
                        type="button"
                        className="button button-small button-secondary"
                        disabled={!scaleReference || scaleReference.points.length !== 2 || !(Number(scaleProductWidthInput) > 0)}
                        onClick={() => applyScaleReference(scaleReference, activePlacement)}
                      >
                        Căn tỷ lệ
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
