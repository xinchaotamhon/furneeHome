import apiClient from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data ?? null;
}

const roomDesignService = {
  async listMine() {
    return unwrap(await apiClient.get('/room-designs')) || [];
  },

  async getMine(id) {
    return unwrap(await apiClient.get(`/room-designs/mine/${encodeURIComponent(id)}`));
  },

  async create(payload) {
    return unwrap(await apiClient.post('/room-designs', payload));
  },

  async remove(id) {
    return unwrap(await apiClient.delete(`/room-designs/${id}`));
  },
};

export default roomDesignService;
