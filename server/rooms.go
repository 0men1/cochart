package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Room struct {
	ID         string
	Broadcast  chan *Message
	Clients    map[*Client]bool
	Register   chan *Client
	Unregister chan *Client
}

type Message struct {
	Data   []byte
	Sender *Client
}

type Client struct {
	Conn        *websocket.Conn
	DisplayName string
	Send        chan []byte
	Room        *Room
}

type Action struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
}

type RoomManager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

var roomManager = &RoomManager{
	rooms: make(map[string]*Room),
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: Restrict in production
	},
}

func (rm *RoomManager) GetRoom(roomId string) (*Room, bool) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	room, ok := rm.rooms[roomId]
	return room, ok
}

func (rm *RoomManager) AddRoom(room *Room) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.rooms[room.ID] = room
}

func (rm *RoomManager) RemoveRoom(roomId string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	delete(rm.rooms, roomId)
}

func (c *Client) startRead() {
	defer func() {
		c.Room.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure) {
				log.Printf("Read error: %v", err)
			}
			break
		}

		message = bytes.TrimSpace(message)
		c.Room.Broadcast <- &Message{
			Data:   message,
			Sender: c,
		}
	}
}

func (c *Client) startWrite() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))

			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (r *Room) start() {
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
					roomManager.RemoveRoom(r.ID)
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

func JoinRoom(w http.ResponseWriter, r *http.Request) {
	roomId := r.URL.Query().Get("roomId")
	displayName := r.URL.Query().Get("displayName")

	room, ok := roomManager.GetRoom(roomId)
	if !ok {
		log.Printf("Room not found: %s", roomId)
		http.Error(w, "Room not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade error: %v", err)
		return
	}

	client := &Client{
		Conn:        conn,
		Send:        make(chan []byte, 256),
		DisplayName: displayName,
		Room:        room,
	}

	room.Register <- client
}

func CreateRoom(w http.ResponseWriter, r *http.Request) {
	roomId := uuid.New().String()

	room := &Room{
		ID:         roomId,
		Broadcast:  make(chan *Message, 256),
		Clients:    make(map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}

	roomManager.AddRoom(room)
	go room.start()

	response := map[string]string{
		"roomId": roomId,
		"url":    fmt.Sprintf("/chart/room/%s", roomId),
	}

	log.Printf("Created room: %s\n", roomId)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
