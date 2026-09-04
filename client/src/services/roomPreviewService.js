const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
    const error = new Error(body?.message || 'Không thể tạo bản chân thực.');
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }

  return body.data;
}
