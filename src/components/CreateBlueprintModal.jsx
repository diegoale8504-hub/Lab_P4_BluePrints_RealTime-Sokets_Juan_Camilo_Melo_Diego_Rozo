import { useState } from 'react'

export default function CreateBlueprintModal({ isOpen, onClose, onCreate }) {
  const [author, setAuthor] = useState('')
  const [name, setName] = useState('')
  const [initialPointsText, setInitialPointsText] = useState('[{"x": 100, "y": 100}, {"x": 250, "y": 200}]')

  if (!isOpen) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!author.trim() || !name.trim()) {
      alert('Por favor especifica autor y nombre del plano.')
      return
    }
    try {
      const points = JSON.parse(initialPointsText)
      if (!Array.isArray(points)) {
        throw new Error('Debe ser un arreglo de puntos')
      }
      onCreate({ author: author.trim(), name: name.trim(), points })
      onClose()
    } catch (err) {
      alert('Formato de puntos JSON inválido: ' + err.message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Crear Nuevo Blueprint</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="modal-author">Autor</label>
            <input
              id="modal-author"
              className="input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ej. juan"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="modal-name">Nombre del Plano</label>
            <input
              id="modal-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. plano-3"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="modal-points">Puntos Iniciales (JSON)</label>
            <textarea
              id="modal-points"
              className="input"
              rows={4}
              value={initialPointsText}
              onChange={(e) => setInitialPointsText(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Crear Plano
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
