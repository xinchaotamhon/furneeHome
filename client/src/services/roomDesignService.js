import apiClient from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? null;
}

const roomDesignService = {
  async listMine() {
    return unwrap(await apiClient.get('/room-designs')) || [];
  },

  async create(payload) {
    return unwrap(await apiClient.post('/room-designs', payload));
  },

  async update(id, payload) {
    return unwrap(await apiClient.patch(`/room-designs/${id}`, payload));
  },

  async remove(id) {
    return unwrap(await apiClient.delete(`/room-designs/${id}`));
  },

  async listPublic() {
    return unwrap(await apiClient.get('/room-designs/public')) || [];
  },

  async getPublic(shareSlug) {
    return unwrap(await apiClient.get(`/room-designs/public/${encodeURIComponent(shareSlug)}`));
  },

  async reuse(id) {
    return unwrap(await apiClient.post(`/room-designs/${id}/reuse`));
  },
};

export default roomDesignService;
