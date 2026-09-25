import { Client } from '@stomp/stompjs'

export function createStompClient(baseUrl, onConnectCallback, onErrorCallback) {
  const client = new Client({
    brokerURL: `${baseUrl.replace(/\/$/, '')}/ws-blueprints`,
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: (frame) => {
      console.log('STOMP Conectado:', frame)
      onConnectCallback?.(frame)
    },
    onStompError: (frame) => {
      console.error('STOMP Error:', frame.headers['message'], frame.body)
      onErrorCallback?.(frame)
    },
  })
  return client
}

export function subscribeBlueprint(client, author, name, onMsg) {
  const topic = `/topic/blueprints.${author}.${name}`
  console.log(`Suscribiéndose a tópico STOMP: ${topic}`)
  return client.subscribe(topic, (m) => {
    try {
      const payload = JSON.parse(m.body)
      onMsg(payload)
    } catch (e) {
      console.error('Error parseando mensaje STOMP:', e)
    }
  })
}
