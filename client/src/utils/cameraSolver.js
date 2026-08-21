/**
 * cameraSolver.js - Thuật toán Camera Matching & Vanishing Points trích xuất từ fSpy
 * Giải toán phối cảnh 3D từ các đường thẳng song song trong ảnh để tính toán:
 * 1. Điểm tụ (Vanishing Points VP1, VP2)
 * 2. Tiêu cự camera (Focal Length f)
 * 3. Ma trận xoay camera 3D (Rotation Matrix 3x3)
 * 4. Phép chiếu phối cảnh sàn (Ground Plane) & vách tường (Wall Plane)
 * 
 * Zero dependencies - 100% Vanilla JavaScript thuần.
 */

export class Vector3D {
  constructor(x = 0, y = 0, z = 0) {
    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
    this.z = Number(z) || 0;
  }

  get length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalized() {
    const l = this.length;
    return l > 1e-8 ? new Vector3D(this.x / l, this.y / l, this.z / l) : new Vector3D(0, 0, 0);
  }

  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other) {
    return new Vector3D(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }

  subtracted(other) {
    return new Vector3D(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  added(other) {
    return new Vector3D(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  scaled(factor) {
    return new Vector3D(this.x * factor, this.y * factor, this.z * factor);
  }
}

/**
 * Tìm giao điểm của 2 đoạn thẳng 2D (Điểm tụ Vanishing Point)
 * line1: [{x, y}, {x, y}], line2: [{x, y}, {x, y}]
 */
export function computeLineIntersection(line1, line2) {
  if (!line1 || !line2 || line1.length < 2 || line2.length < 2) return null;
  const p1 = line1[0];
  const p2 = line1[1];
  const p3 = line2[0];
  const p4 = line2[1];

  const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denominator) < 1e-7) return null; // 2 đường song song hoàn toàn

  const t1 = p1.x * p2.y - p1.y * p2.x;
  const t2 = p3.x * p4.y - p3.y * p4.x;

  return {
    x: (t1 * (p3.x - p4.x) - (p1.x - p2.x) * t2) / denominator,
    y: (t1 * (p3.y - p4.y) - (p1.y - p2.y) * t2) / denominator,
  };
}

/**
 * Tính tiêu cự camera (Focal length) từ 2 điểm tụ trực giao và tâm ảnh P(0,0)
 * Theo mục 3.2 tài liệu fSpy (Guillou et al.)
 */
export function computeFocalLength(vp1, vp2, p = { x: 0, y: 0 }) {
  if (!vp1 || !vp2) return null;
  const dirFuFv = new Vector3D(vp1.x - vp2.x, vp1.y - vp2.y).normalized();
  const fvP = new Vector3D(p.x - vp2.x, p.y - vp2.y);
  const proj = dirFuFv.dot(fvP);
  const puv = {
    x: proj * dirFuFv.x + vp2.x,
    y: proj * dirFuFv.y + vp2.y,
  };

  const pPuv = new Vector3D(p.x - puv.x, p.y - puv.y).length;
  const fvPuv = new Vector3D(vp2.x - puv.x, vp2.y - puv.y).length;
  const fuPuv = new Vector3D(vp1.x - puv.x, vp1.y - puv.y).length;

  const fSq = fvPuv * fuPuv - pPuv * pPuv;
  if (fSq <= 0) return null;

  return Math.sqrt(fSq);
}

/**
 * Tính ma trận xoay Camera 3x3 từ 2 điểm tụ và tiêu cự f
 */
export function computeCameraRotation(vp1, vp2, f, p = { x: 0, y: 0 }) {
  const ofu = new Vector3D(vp1.x - p.x, vp1.y - p.y, -f);
  const ofv = new Vector3D(vp2.x - p.x, vp2.y - p.y, -f);

  const u = ofu.normalized();
  const v = ofv.normalized();
  const w = u.cross(v).normalized();

  return [
    [u.x, v.x, w.x],
    [u.y, v.y, w.y],
    [u.z, v.z, w.z],
  ];
}

/**
 * Giải phối cảnh camera từ các đường gióng do người dùng vẽ trên ảnh bất kỳ
 * @param {Array} axisLinesX - Mảng 2 đường song song trục X: [ [{x,y},{x,y}], [{x,y},{x,y}] ]
 * @param {Array} axisLinesY - Mảng 2 đường song song trục Y: [ [{x,y},{x,y}], [{x,y},{x,y}] ]
 * @param {number} width - Chiều rộng ảnh
 * @param {number} height - Chiều cao ảnh
 */
export function solveCameraFromUserLines(axisLinesX, axisLinesY, width = 1000, height = 1000) {
  if (!axisLinesX || !axisLinesY || axisLinesX.length < 2 || axisLinesY.length < 2) {
    return null;
  }

  // Chuyển đổi tọa độ từ pixel về hệ tọa độ tâm ảnh (Image Plane Coordinates: gốc tại tâm (0,0))
  const halfW = width / 2;
  const halfH = height / 2;

  const toCenterCoord = (pt) => ({
    x: pt.x - halfW,
    y: pt.y - halfH,
  });

  const linesX = [
    [toCenterCoord(axisLinesX[0][0]), toCenterCoord(axisLinesX[0][1])],
    [toCenterCoord(axisLinesX[1][0]), toCenterCoord(axisLinesX[1][1])],
  ];

  const linesY = [
    [toCenterCoord(axisLinesY[0][0]), toCenterCoord(axisLinesY[0][1])],
    [toCenterCoord(axisLinesY[1][0]), toCenterCoord(axisLinesY[1][1])],
  ];

  const vp1 = computeLineIntersection(linesX[0], linesX[1]);
  const vp2 = computeLineIntersection(linesY[0], linesY[1]);

  if (!vp1 || !vp2) return null;

  const focalLength = computeFocalLength(vp1, vp2, { x: 0, y: 0 }) || (halfW * 1.25);
  const rotationMatrix = computeCameraRotation(vp1, vp2, focalLength, { x: 0, y: 0 });

  // Tính góc nghiêng sàn và hướng nhìn camera
  const pitchRad = Math.atan2(rotationMatrix[2][1], rotationMatrix[2][2]);
  const yawRad = Math.atan2(-rotationMatrix[2][0], Math.sqrt(rotationMatrix[2][1] ** 2 + rotationMatrix[2][2] ** 2));

  return {
    calibrated: true,
    focalLength,
    vanishingPoints: [vp1, vp2],
    rotationMatrix,
    pitchDeg: Number(((pitchRad * 180) / Math.PI).toFixed(1)),
    yawDeg: Number(((yawRad * 180) / Math.PI).toFixed(1)),
  };
}

/**
 * Tự động ước lượng phối cảnh phòng trọ tiêu chuẩn (Default Heuristic Solver)
 */
export function estimateRoomCameraParameters(imageWidth, imageHeight) {
  const halfW = imageWidth / 2;
  const halfH = imageHeight / 2;

  const vp1 = { x: -halfW * 1.85, y: -halfH * 0.15 };
  const vp2 = { x: halfW * 2.20, y: -halfH * 0.18 };

  const focalLength = computeFocalLength(vp1, vp2, { x: 0, y: 0 }) || (halfW * 1.25);
  const rotationMatrix = computeCameraRotation(vp1, vp2, focalLength, { x: 0, y: 0 });

  const pitchRad = Math.atan2(rotationMatrix[2][1], rotationMatrix[2][2]);
  const yawRad = Math.atan2(-rotationMatrix[2][0], Math.sqrt(rotationMatrix[2][1] ** 2 + rotationMatrix[2][2] ** 2));

  return {
    calibrated: false,
    focalLength,
    vanishingPoints: [vp1, vp2],
    rotationMatrix,
    pitchDeg: Number(((pitchRad * 180) / Math.PI).toFixed(1)),
    yawDeg: Number(((yawRad * 180) / Math.PI).toFixed(1)),
  };
}

/**
 * Tính toán biến đổi phối cảnh 2D & 3D (Perspective Skew & Rotation)
 * dựa theo kết quả giải Camera fSpy (hoặc solver tự động)
 */
export function computeProductPerspectiveTransform(target, isWall = false, isFlipped = false, cameraParams = null) {
  const targetX = Number.isFinite(target?.x) ? target.x : 50;

  if (isWall) {
    return {
      cssTransform: isFlipped ? 'translate(-50%, -100%) scaleX(-1)' : 'translate(-50%, -100%)',
      canvasTransform: [1, 0, 0, 1, 0, 0],
    };
  }

  // Nếu người dùng đã căn chỉnh bằng thước fSpy: Sử dụng góc nghiêng chính xác từ ma trận
  let baseRotateY = 16;
  let baseSkewY = -1.8;
  let canvasSkewY = -0.038;

  if (cameraParams && cameraParams.calibrated) {
    const pitch = Math.abs(cameraParams.pitchDeg || 20);
    const yaw = Math.abs(cameraParams.yawDeg || 15);
    baseRotateY = Math.min(28, Math.max(8, yaw * 1.1));
    baseSkewY = -Number((pitch * 0.08).toFixed(2));
    canvasSkewY = -Number((pitch * 0.0016).toFixed(4));
  }

  // Tường trái (x < 42%) -> Bẻ góc 3/4 quay vào trong phòng
  if (targetX < 42) {
    const intensity = Math.min(1.5, Math.max(0.5, (42 - targetX) / 25));
    const rotateYDeg = Number((baseRotateY * intensity).toFixed(1));
    const skewYDeg = Number((baseSkewY * intensity).toFixed(2));
    const cSkewY = Number((canvasSkewY * intensity).toFixed(4));

    return {
      cssTransform: `translate(-50%, -100%) ${isFlipped ? 'scaleX(-1)' : ''} perspective(650px) rotateY(${rotateYDeg}deg) skewY(${skewYDeg}deg)`,
      canvasTransform: [1, cSkewY, 0, 0.965, 0, 0],
      wallSide: 'left',
    };
  }

  // Tường phải (x > 58%) -> Bẻ góc 3/4 quay sang trái
  if (targetX > 58) {
    const intensity = Math.min(1.5, Math.max(0.5, (targetX - 58) / 25));
    const rotateYDeg = Number((-baseRotateY * intensity).toFixed(1));
    const skewYDeg = Number((-baseSkewY * intensity).toFixed(2));
    const cSkewY = Number((-canvasSkewY * intensity).toFixed(4));

    return {
      cssTransform: `translate(-50%, -100%) ${isFlipped ? 'scaleX(-1)' : ''} perspective(650px) rotateY(${rotateYDeg}deg) skewY(${skewYDeg}deg)`,
      canvasTransform: [1, cSkewY, 0, 0.965, 0, 0],
      wallSide: 'right',
    };
  }

  // Giữa phòng / Tường sau -> Đứng diện mạo thẳng
  return {
    cssTransform: `translate(-50%, -100%) ${isFlipped ? 'scaleX(-1)' : ''}`,
    canvasTransform: [1, 0, 0, 1, 0, 0],
    wallSide: 'center',
  };
}
