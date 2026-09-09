import { API_BASE_URL } from './apiClient';

export async function createRoomPreview(payload, options = {}) {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`${API_BASE_URL}/room-previews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    if (response.status === 401 && (body?.message === 'Invalid session' || body?.message === 'Invalid account')) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('furneehome-user');
    }
    const message = response.status === 401 && body?.message === 'Invalid session'
      ? 'Phiên đăng nhập đã hết hạn. Bạn có thể đăng nhập lại hoặc thử tiếp với tư cách khách.'
      : (body?.message || 'Không thể tạo bản chân thực.');
    const error = new Error(message);
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }

  return body.data;
}
