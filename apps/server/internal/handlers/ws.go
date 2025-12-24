package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/0men1/cochart/internal/rooms"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type WSHandler struct {
	Manager  *rooms.RoomManager
	Upgrader websocket.Upgrader
}

func NewWSHandler(manager *rooms.RoomManager) *WSHandler {
	return &WSHandler{
		Manager: manager,
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

func (h *WSHandler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	roomId := uuid.New().String()
	room := rooms.NewRoom(roomId, h.Manager)
	h.Manager.AddRoom(room)
	go room.Start()

	response := map[string]string{
		"roomId": roomId,
		"url":    fmt.Sprintf("/chart/room/%s", roomId),
	}

	log.Printf("Created room: %s\n", roomId)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *WSHandler) JoinRoom(w http.ResponseWriter, r *http.Request) {
	roomId := r.URL.Query().Get("roomId")
	displayName := r.URL.Query().Get("displayName")

	room, ok := h.Manager.GetRoom(roomId)
	if !ok {
		log.Printf("Room not found: %s", roomId)
		http.Error(w, "Room not found", http.StatusNotFound)
		return
	}

	conn, err := h.Upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade error: %v", err)
		return
	}

	client := &rooms.Client{
		Conn:        conn,
		Send:        make(chan []byte, 256),
		DisplayName: displayName,
		Room:        room,
	}

	room.Register <- client
}
