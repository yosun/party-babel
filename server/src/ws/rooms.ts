import type { InputMode } from '@party-babel/shared';

export interface RoomUser {
  userId: string;
  displayName: string;
  speakLang: string;
  targetLang: string;
  connId: string;
  ws: import('ws').WebSocket;
}

export interface Room {
  roomId: string;
  inputMode: InputMode;
  users: Map<string, RoomUser>;
  visualizeEnabled: boolean;
  createdAt: number;
}

const rooms = new Map<string, Room>();

export function getOrCreateRoom(roomId: string, inputMode: InputMode): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      roomId,
      inputMode,
      users: new Map(),
      visualizeEnabled: false,
      createdAt: Date.now(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function addUserToRoom(room: Room, user: RoomUser): void {
  room.users.set(user.userId, user);
}

export function removeUserByConn(connId: string): { roomId: string; userId: string } | undefined {
  for (const [roomId, room] of rooms) {
    for (const [userId, user] of room.users) {
      if (user.connId === connId) {
        room.users.delete(userId);
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
        return { roomId, userId };
      }
    }
  }
  return undefined;
}

export function broadcastToRoom(roomId: string, message: object, excludeUserId?: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(message);
  for (const [uid, user] of room.users) {
    if (uid === excludeUserId) continue;
    if (user.ws.readyState === 1) {
      user.ws.send(payload);
    }
  }
}

export function sendToUser(roomId: string, userId: string, message: object): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const user = room.users.get(userId);
  if (user && user.ws.readyState === 1) {
    user.ws.send(JSON.stringify(message));
  }
}

export function getRoomState(room: Room) {
  return {
    type: 'room_state' as const,
    roomId: room.roomId,
    users: Array.from(room.users.values()).map(u => ({
      userId: u.userId,
      displayName: u.displayName,
      speakLang: u.speakLang,
      targetLang: u.targetLang,
    })),
    inputMode: room.inputMode,
  };
}

export function getAllRooms(): Room[] {
  return Array.from(rooms.values());
}
