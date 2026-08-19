const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function createRoomPreview(payload) {
  const response = await fetch(`${API_BASE_URL}/room-previews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || 'Không thể tạo bản chân thực.');
  }

  return body.data;
}
