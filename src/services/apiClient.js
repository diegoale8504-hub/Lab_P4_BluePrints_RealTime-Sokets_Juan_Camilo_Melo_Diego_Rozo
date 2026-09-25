const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'

// In-memory mock store for offline/demo resilience if Spring REST backend is not currently running
const mockStore = {
  juan: [
    { author: 'juan', name: 'plano-1', points: [{ x: 50, y: 50 }, { x: 200, y: 150 }, { x: 350, y: 80 }] },
    { author: 'juan', name: 'plano-2', points: [{ x: 100, y: 100 }, { x: 300, y: 300 }] },
  ],
  diego: [
    { author: 'diego', name: 'casa-campo', points: [{ x: 80, y: 120 }, { x: 180, y: 220 }, { x: 280, y: 120 }] },
  ],
}

export const apiClient = {
  // GET /api/blueprints?author=:author or /api/blueprints/:author
  getByAuthor: async (author) => {
    try {
      const res = await fetch(`${API_BASE}/api/blueprints?author=${encodeURIComponent(author)}`)
      if (!res.ok) throw new Error(`HTTP error ${res.status}`)
      const data = await res.json()
      return Array.isArray(data) ? data : (data.data || [])
    } catch (err) {
      console.warn('REST API unavailable, using local mock data:', err.message)
      const cleanAuthor = author.toLowerCase().trim()
      return mockStore[cleanAuthor] || [
        { author: cleanAuthor, name: 'plano-ejemplo', points: [{ x: 60, y: 60 }, { x: 240, y: 180 }] }
      ]
    }
  },

  // GET /api/blueprints/:author/:name
  getBlueprint: async (author, name) => {
    try {
      const res = await fetch(`${API_BASE}/api/blueprints/${encodeURIComponent(author)}/${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error(`HTTP error ${res.status}`)
      return await res.json()
    } catch (err) {
      console.warn('REST API unavailable, loading blueprint from local mock:', err.message)
      const cleanAuthor = author.toLowerCase().trim()
      const list = mockStore[cleanAuthor] || []
      const found = list.find((b) => b.name === name)
      return found || { author, name, points: [{ x: 50, y: 50 }, { x: 150, y: 150 }] }
    }
  },

  // POST /api/blueprints
  createBlueprint: async (blueprint) => {
    try {
      const res = await fetch(`${API_BASE}/api/blueprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blueprint),
      })
      if (!res.ok) throw new Error(`HTTP error ${res.status}`)
      return await res.json()
    } catch (err) {
      console.warn('REST API unavailable, creating blueprint in local mock:', err.message)
      const cleanAuthor = blueprint.author.toLowerCase().trim()
      if (!mockStore[cleanAuthor]) mockStore[cleanAuthor] = []
      mockStore[cleanAuthor].push(blueprint)
      return blueprint
    }
  },

  // PUT /api/blueprints/:author/:name
  updateBlueprint: async (author, name, blueprintData) => {
    try {
      const res = await fetch(`${API_BASE}/api/blueprints/${encodeURIComponent(author)}/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blueprintData),
      })
      if (!res.ok) throw new Error(`HTTP error ${res.status}`)
      return await res.json()
    } catch (err) {
      console.warn('REST API unavailable, updating blueprint in local mock:', err.message)
      const cleanAuthor = author.toLowerCase().trim()
      if (mockStore[cleanAuthor]) {
        const idx = mockStore[cleanAuthor].findIndex((b) => b.name === name)
        if (idx !== -1) {
          mockStore[cleanAuthor][idx] = blueprintData
        }
      }
      return blueprintData
    }
  },

  // DELETE /api/blueprints/:author/:name
  deleteBlueprint: async (author, name) => {
    try {
      const res = await fetch(`${API_BASE}/api/blueprints/${encodeURIComponent(author)}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`HTTP error ${res.status}`)
      return true
    } catch (err) {
      console.warn('REST API unavailable, deleting blueprint from local mock:', err.message)
      const cleanAuthor = author.toLowerCase().trim()
      if (mockStore[cleanAuthor]) {
        mockStore[cleanAuthor] = mockStore[cleanAuthor].filter((b) => b.name !== name)
      }
      return true
    }
  },
}
