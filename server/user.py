import json
import random
from tools import GameError

class User:

    all = {} # socket -> user
    user_count = 0

    @staticmethod
    def find(socket):
        return User.all[socket] if socket in User.all else None

    def __init__(self, socket, user_name):
        if socket not in User.all:
            self.name = user_name
            self.id = User.user_count
            self.socket = socket
            self.x = random.random() * 0.5 + 0.25
            self.y = random.random() * 0.5 + 0.25
            self.msg = u'\U0001F600'
            self.color = None
            self.room = None
            self.alive = True
            User.all[socket] = self
            User.user_count += 1 # mod max users
        else:
            raise GameError("User already exists")

    async def error(self, msg):
        await self.socket.send(json.dumps({ 'alert' : str(msg) }))

    # sends a message from this user to another user to(id).
    async def message(self, to, **msg):
        msg['id'] = self.id
        await self.room.message(to, **msg)

    # message to this user
    async def receive(self, **msg):
        if self.alive:
            await self.socket.send(json.dumps(msg))
        else:
            print(f'Attempted to send a message to dead user {self.name}')

    # remove user from room and User.all
    async def remove(self):
        if self.room is not None:
            await self.room.leave(self)
        if self.socket in User.all:
            User.all.pop(self.socket)

    # move user around
    async def move(self, x, y):
        self.x, self.y = x, y
        await self.room.broadcast(self.id, at='user', do='move', id=self.id, x=x, y=y)

    async def status(self, msg):
        self.msg = msg
        await self.room.broadcast(self.id, at='user', do='status', id=self.id, msg=self.msg)

    async def set_color(self, color):
        self.color = color
        await self.room.broadcast(self.id, at='user', do='color', id=self.id, color=color)

    async def game_action(self, what):
        if self.room.game is not None:
            await self.room.game.move(self, **what)
            
