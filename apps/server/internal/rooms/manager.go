package rooms

import "sync"

type RoomManager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

func NewManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*Room),
		mu:    sync.RWMutex{},
	}
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
