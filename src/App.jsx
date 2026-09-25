import { useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from './services/apiClient.js'
import { createStompClient, subscribeBlueprint } from './lib/stompClient.js'
import { createSocket } from './lib/socketIoClient.js'
import BlueprintCanvas from './components/BlueprintCanvas.jsx'
import CreateBlueprintModal from './components/CreateBlueprintModal.jsx'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'
const IO_BASE = import.meta.env.VITE_IO_BASE ?? 'http://localhost:3001'

export default function App() {
  // RT & Selection State
  const [tech, setTech] = useState('stomp') // 'none' | 'stomp' | 'socketio'
  const [connStatus, setConnStatus] = useState('disconnected') // 'connected' | 'connecting' | 'disconnected' | 'none'
  
  // Author & Blueprints REST State
  const [authorInput, setAuthorInput] = useState('juan')
  const [selectedAuthor, setSelectedAuthor] = useState('juan')
  const [blueprints, setBlueprints] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Selected Blueprint & Points State
  const [currentBp, setCurrentBp] = useState(null)
  const [points, setPoints] = useState([])

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)

  // WebSockets References
  const stompRef = useRef(null)
  const unsubRef = useRef(null)
  const socketRef = useRef(null)

  // 1. Fetch Blueprints by Author
  const handleGetBlueprints = async (targetAuthor = authorInput) => {
    if (!targetAuthor.trim()) return
    setLoading(true)
    setMessage('')
    try {
      const data = await apiClient.getByAuthor(targetAuthor.trim())
      setSelectedAuthor(targetAuthor.trim())
      setBlueprints(data || [])
      
      // Auto-select first blueprint if available
      if (data && data.length > 0) {
        handleSelectBlueprint(data[0])
      } else {
        setCurrentBp(null)
        setPoints([])
      }
    } catch (err) {
      console.error('Error fetching blueprints:', err)
      setMessage('Error consultando los planos del autor.')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    handleGetBlueprints('juan')
  }, [])

  // 2. Total Points Calculation via .reduce()
  const totalUserPoints = useMemo(() => {
    return blueprints.reduce((acc, bp) => acc + (bp.points?.length || 0), 0)
  }, [blueprints])

  // 3. Select a Blueprint to display & collaborate on
  const handleSelectBlueprint = async (bp) => {
    setCurrentBp(bp)
    if (bp.points) {
      setPoints([...bp.points])
    } else {
      try {
        const fullBp = await apiClient.getBlueprint(bp.author, bp.name)
        setPoints(fullBp.points || [])
      } catch (err) {
        setPoints([])
      }
    }
  }

  // 4. WebSocket Real-Time Connection Effect
  useEffect(() => {
    // Cleanup previous connections
    unsubRef.current?.()
    unsubRef.current = null

    if (stompRef.current) {
      stompRef.current.deactivate?.()
      stompRef.current = null
    }

    if (socketRef.current) {
      socketRef.current.disconnect?.()
      socketRef.current = null
    }

    if (tech === 'none' || !currentBp) {
      setConnStatus(tech === 'none' ? 'none' : 'disconnected')
      return
    }

    setConnStatus('connecting')

    if (tech === 'stomp') {
      const client = createStompClient(
        API_BASE,
        () => {
          setConnStatus('connected')
          // Subscribe to blueprint topic
          unsubRef.current = subscribeBlueprint(
            client,
            currentBp.author,
            currentBp.name,
            (upd) => {
              console.log('RT STOMP update received:', upd)
              if (upd.points) {
                setPoints(upd.points)
              } else if (upd.point) {
                setPoints((prev) => [...prev, upd.point])
              }
            }
          )
        },
        () => {
          setConnStatus('disconnected')
        }
      )
      stompRef.current = client
      client.activate()
    } else if (tech === 'socketio') {
      const socket = createSocket(IO_BASE)
      socketRef.current = socket

      socket.on('connect', () => {
        setConnStatus('connected')
        const room = `blueprints.${currentBp.author}.${currentBp.name}`
        socket.emit('join-room', room)
      })

      socket.on('disconnect', () => {
        setConnStatus('disconnected')
      })

      socket.on('blueprint-update', (upd) => {
        console.log('RT Socket.IO update received:', upd)
        if (upd.points) {
          setPoints(upd.points)
        } else if (upd.point) {
          setPoints((prev) => [...prev, upd.point])
        }
      })
    }

    return () => {
      unsubRef.current?.()
      unsubRef.current = null
      stompRef.current?.deactivate?.()
      socketRef.current?.disconnect?.()
    }
  }, [tech, currentBp?.author, currentBp?.name])

  // 5. Canvas Click Handler (Adds Point & Broadcasts via RT)
  const handleAddPoint = (newPoint) => {
    if (!currentBp) return

    // Update local state immediately (Optimistic UX)
    const updatedPoints = [...points, newPoint]
    setPoints(updatedPoints)

    // Broadcast Real-Time event if active
    if (tech === 'stomp' && stompRef.current?.connected) {
      stompRef.current.publish({
        destination: '/app/draw',
        body: JSON.stringify({
          author: currentBp.author,
          name: currentBp.name,
          point: newPoint,
          points: updatedPoints,
        }),
      })
    } else if (tech === 'socketio' && socketRef.current?.connected) {
      const room = `blueprints.${currentBp.author}.${currentBp.name}`
      socketRef.current.emit('draw-event', {
        room,
        author: currentBp.author,
        name: currentBp.name,
        point: newPoint,
        points: updatedPoints,
      })
    }
  }

  // 6. REST CRUD - Save / Update Blueprint (PUT)
  const handleSaveBlueprint = async () => {
    if (!currentBp) return
    try {
      const updatedBp = { ...currentBp, points }
      await apiClient.updateBlueprint(currentBp.author, currentBp.name, updatedBp)
      setMessage(`Plano "${currentBp.name}" guardado exitosamente.`)
      handleGetBlueprints(selectedAuthor)
    } catch (err) {
      console.error('Error saving blueprint:', err)
      setMessage('Error al guardar el plano en el servidor.')
    }
  }

  // 7. REST CRUD - Delete Blueprint (DELETE)
  const handleDeleteBlueprint = async (bpToDelete) => {
    const target = bpToDelete || currentBp
    if (!target) return
    if (!confirm(`¿Estás seguro de eliminar el plano "${target.name}" de ${target.author}?`)) return

    try {
      await apiClient.deleteBlueprint(target.author, target.name)
      setMessage(`Plano "${target.name}" eliminado correctamente.`)
      if (currentBp?.name === target.name && currentBp?.author === target.author) {
        setCurrentBp(null)
        setPoints([])
      }
      handleGetBlueprints(selectedAuthor)
    } catch (err) {
      console.error('Error deleting blueprint:', err)
      setMessage('Error al eliminar el plano.')
    }
  }

  // 8. REST CRUD - Create New Blueprint (POST)
  const handleCreateBlueprint = async (newBpData) => {
    try {
      await apiClient.createBlueprint(newBpData)
      setMessage(`Nuevo plano "${newBpData.name}" creado con éxito.`)
      setAuthorInput(newBpData.author)
      await handleGetBlueprints(newBpData.author)
      handleSelectBlueprint(newBpData)
    } catch (err) {
      console.error('Error creating blueprint:', err)
      setMessage('Error al crear el nuevo plano.')
    }
  }

  return (
    <div className="app-container">
      {/* Header & Tech Selector */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">BP</div>
          <div className="brand-title">
            <h1>BluePrints RealTime</h1>
            <p>Laboratorio 4 — Sockets & STOMP Colaborativo</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Tecnología Real-Time:</label>
            <select className="select" value={tech} onChange={(e) => setTech(e.target.value)}>
              <option value="none">Ninguna (Solo REST CRUD)</option>
              <option value="stomp">STOMP (Spring Boot WebSocket)</option>
              <option value="socketio">Socket.IO (Node.js Server)</option>
            </select>
          </div>

          <div style={{ alignSelf: 'flex-end', paddingBottom: 4 }}>
            {connStatus === 'connected' && (
              <span className="badge badge-connected">
                <span className="pulse-dot" /> Conectado (RT)
              </span>
            )}
            {connStatus === 'connecting' && (
              <span className="badge badge-connecting">
                <span className="pulse-dot" /> Conectando...
              </span>
            )}
            {connStatus === 'disconnected' && (
              <span className="badge badge-disconnected">Desconectado</span>
            )}
            {connStatus === 'none' && (
              <span className="badge badge-none">Sin RT Activo</span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="grid-main">
        {/* Left Column: REST CRUD & Author Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Author Search Box */}
          <div className="card">
            <div className="card-title">
              <span>Buscar Autor</span>
              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setIsModalOpen(true)}>
                + Nuevo Plano
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="input"
                placeholder="Nombre del autor (ej. juan, diego)"
                value={authorInput}
                onChange={(e) => setAuthorInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGetBlueprints()}
              />
              <button className="btn btn-primary" onClick={() => handleGetBlueprints()}>
                Get Blueprints
              </button>
            </div>
          </div>

          {/* Author's Blueprints Table */}
          <div className="card">
            <div className="card-title">
              <span>Planos de: {selectedAuthor || '—'}</span>
            </div>

            {loading ? (
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Cargando planos...</p>
            ) : blueprints.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No se encontraron planos para este autor.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="blueprint-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th style={{ textAlign: 'right' }}>Puntos</th>
                      <th style={{ textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blueprints.map((bp) => {
                      const isActive = currentBp?.name === bp.name && currentBp?.author === bp.author
                      return (
                        <tr key={bp.name} className={isActive ? 'active' : ''}>
                          <td>{bp.name}</td>
                          <td style={{ textAlign: 'right' }}>{bp.points?.length || 0}</td>
                          <td style={{ textAlign: 'center', display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              className={`btn ${isActive ? 'btn-primary' : ''}`}
                              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                              onClick={() => handleSelectBlueprint(bp)}
                            >
                              {isActive ? 'Abierto' : 'Abrir'}
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                              onClick={() => handleDeleteBlueprint(bp)}
                            >
                              &times;
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Total Points using .reduce() */}
            <div className="total-points-card">
              <span className="label">Total Puntos del Autor:</span>
              <span className="val">{totalUserPoints}</span>
            </div>
          </div>

          {message && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#93c5fd',
                fontSize: '0.88rem',
              }}
            >
              {message}
            </div>
          )}
        </div>

        {/* Right Column: Real-Time Canvas Collaboration */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-title">
            <div>
              <span>Plano Actual: </span>
              <strong style={{ color: '#60a5fa' }}>
                {currentBp ? `${currentBp.author} / ${currentBp.name}` : 'Ninguno seleccionado'}
              </strong>
            </div>
            {currentBp && (
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {points.length} puntos trazados
              </span>
            )}
          </div>

          {/* Interactive HTML5 Canvas */}
          <BlueprintCanvas
            points={points}
            width={700}
            height={440}
            onAddPoint={handleAddPoint}
            disabled={!currentBp}
          />

          {/* Canvas Actions */}
          {currentBp && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-success" onClick={handleSaveBlueprint}>
                  Guardar / Actualizar (PUT)
                </button>
                <button className="btn btn-danger" onClick={() => handleDeleteBlueprint(currentBp)}>
                  Eliminar (DELETE)
                </button>
              </div>

              <button className="btn" onClick={() => setPoints([])}>
                Limpiar Puntos
              </button>
            </div>
          )}

          <p style={{ fontSize: '0.82rem', color: '#64748b', fontStyle: 'italic', marginTop: 4 }}>
            💡 Tip para la prueba: Abre esta aplicación en dos pestañas diferentes navegando al mismo plano. Al hacer clic en el Canvas, verás cómo los puntos se replican en vivo a través de {tech === 'stomp' ? 'STOMP WebSockets' : tech === 'socketio' ? 'Socket.IO Rooms' : 'REST (manual)'}.
          </p>
        </div>
      </div>

      {/* Modal for creating a new blueprint */}
      <CreateBlueprintModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateBlueprint}
      />
    </div>
  )
}
