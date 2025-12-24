package rooms

import (
	"encoding/json"
	"log"
)

type Room struct {
	ID         string
	Broadcast  chan *Message
	Clients    map[*Client]bool
	Register   chan *Client
	Unregister chan *Client
	Manager    *RoomManager
}

func NewRoom(id string, m *RoomManager) *Room {
	return &Room{
		ID:         id,
		Broadcast:  make(chan *Message, 256),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Clients:    make(map[*Client]bool),
		Manager:    m,
	}
}

func (r *Room) Start() {
	for {
		select {
		case client := <-r.Register:
			r.Clients[client] = true
			activeUsers := len(r.Clients)

			go client.startRead()
			go client.startWrite()

			a := Action{
				Type: "USER_JOINED",
				Payload: map[string]any{
					"displayName":    client.DisplayName,
					"numActiveUsers": activeUsers,
				},
			}

			action, err := json.Marshal(a)
			if err != nil {
				log.Printf("Error marshaling USER_JOINED: %v\n", err)
				continue
			}

			log.Printf("User joined: %s (Room: %s, Total: %d)\n",
				client.DisplayName, r.ID, activeUsers)

			r.broadcastToOthers(action, client)

		case client := <-r.Unregister:
			if _, ok := r.Clients[client]; ok {
				delete(r.Clients, client)
				close(client.Send)

				a := Action{
					Type: "USER_LEFT",
					Payload: map[string]any{
						"displayName": client.DisplayName,
					},
				}

				action, _ := json.Marshal(a)
				r.broadcastToAll(action)

				if len(r.Clients) == 0 {
					log.Printf("Room %s empty, cleaning up\n", r.ID)
					r.Manager.RemoveRoom(r.ID)
					return
				}
			}

		case msg := <-r.Broadcast:
			r.broadcastToOthers(msg.Data, msg.Sender)
		}
	}
}

func (r *Room) broadcastToAll(message []byte) {
	for client := range r.Clients {
		select {
		case client.Send <- message:
		default:
			log.Printf("Removing unresponsive client: %s\n", client.DisplayName)
			close(client.Send)
			delete(r.Clients, client)
		}
	}
}

func (r *Room) broadcastToOthers(message []byte, sender *Client) {
	for client := range r.Clients {
		if client == sender {
			continue
		}

		select {
		case client.Send <- message:
		default:
			log.Printf("Removing unresponsive client: %s\n", client.DisplayName)
			close(client.Send)
			delete(r.Clients, client)
		}
	}
}
