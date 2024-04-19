import os
import json
import random
from siedler import Siedler, GameError
from editor import Editor
from user import User

class Room:

    capacity = 4

    all = {} # room_name -> room
    
    @staticmethod
    def open(room_name):
        return Room.all[room_name] if room_name in Room.all else Room(room_name)

    def __init__(self, room_name):
        Room.all[room_name] = self
        self.members = {} # id -> user
        self.name = room_name
        self.game = None
        self.editor = None
        self.colors = ["red", "blue", "green", "ivory"] # ["indianred", "ivory", "coral", "royalblue"]
        random.shuffle(self.colors)

    # sends message to a room member to(id)
    async def message(self, to, **msg):
        if to is None:
            await self.broadcast(**msg)
        elif to not in self.members:
            raise GameError('Attempted to contact someone outside of the room.')
        elif self.members[to].alive:
            try:
                await self.members[to].socket.send(json.dumps(msg))
            except Exception as e:
                try:
                    self.members[to].alive = False
                except KeyError as e:
                    pass

    # sends broadcast from sender(id) to room. echo is True for the sender
    async def broadcast(self, sender=None, **msg): 
        for i in self.members.copy():
            if not self.members[i].alive: continue
            try:
                msg['echo'] = i == sender
                msgs = json.dumps(msg)
                await self.members[i].socket.send(msgs)
            except Exception as e:
                try:
                    self.members[i].alive = False
                except KeyError as e:
                    pass


    async def enter(self, user, key):
        def proper(s):
            return len(s) > 0 and len(s) < 16 and s.isalnum() and s.isascii()

        if len(self.members) >= Room.capacity:
            raise GameError('Sorry, room is full.')

        if not proper(self.name) or not proper(user.name):
            if not proper(self.name): self.remove()
            raise GameError('Choose a proper name, please (only alphanumeric, no whitespace).')

        if self.game is not None and key is None:
            raise GameError('A game is running in this room.')

        user.room = self
        user.color = self.colors.pop()

        await user.receive(at='room', do='enter', ok=True)

        # get all current users of the room
        for i in self.members:
            member = self.members[i]
            await user.receive(at='room', do='add_user', id=i, name=member.name, x=member.x, y=member.y, status=member.msg, color=member.color)

        # join room
        self.members[user.id] = user

        # broadcast that i've joined
        await self.broadcast(user.id, at='room', do='add_user', id=user.id, name=user.name, x=user.x, y=user.y, status=user.msg, color=user.color)

        if self.editor is not None:
            await user.receive(at='room', do='editor', show=True)
            await self.editor.describeTo(user)

        elif self.game is not None:
            try:
                await user.receive(at='room', do='game', show=True)
                await self.game.resume(user, key)
                await self.game_key(user)
            except GameError as e:
                await user.receive(at='room', do='enter', ok=False)
                raise GameError(e)

    async def leave(self, user):
        if user.id not in self.members:
            raise GameError('Room: user is already gone.')

        self.colors.append(user.color)

        await self.broadcast(user.id, at='room', do='del_user', id=user.id)

        self.members.pop(user.id)
        user.room = None

        if len(self.members) == 0:
            if self.game is None and self.editor is None:
                self.remove()
                print(f'Room {self.name} removed.')
            else:
                print(f'Game / Editor in room {self.name} persistant.')

    async def update_scenarios(self):
        scenarios = []
        for file in os.listdir(f"scenarios/"):
            if file.endswith('.json'):
                scenarios.append(os.path.splitext(file)[0])
        for i in Room.all:
            await Room.all[i].broadcast(scenarios=scenarios)

    async def delete_scenario(self, name):
        if os.path.exists(f"scenarios/{name}.json"):
            os.remove(f"scenarios/{name}.json")
            await self.update_scenarios()
        else:
            raise GameError(f'Error occurred, could not delete {name}.')

    async def editor_action(self, what):
        if self.editor is not None:
            await self.editor.move(**what)

    async def game_key(self, user=None):
        if user is None:
            for i in self.members:
                await self.game_key(self.members[i])
        else:
           await user.receive(at='room', do='game_key', key=self.game.get_key(user))

    async def new_game(self, user, scenario, debug_auth=None):
        try:
            await self.quit_game()
            self.game = Siedler(self, scenario, debug_auth) # select scenario here
            await self.broadcast(at='room', do='game', show=True)
            await self.game_key()
            await self.game.start()
        except GameError as e:
            await user.error(e)

    async def new_editor(self, user, scenario):
        try:
            await self.quit_game()
            self.editor = Editor(self)
            if scenario is not None:
                await self.editor.load(scenario)
            await self.broadcast(at='room', do='editor', show=True)
            for i in self.members:
                await self.editor.describeTo(self.members[i])
        except GameError as e:
            await user.error(e)


    async def quit_game(self):
        if self.editor is not None:
            self.editor = None
            await self.broadcast(at='room', do='editor', show=False)
            await self.broadcast(notify='Editor was quit.')
        if self.game is not None:
            self.game = None
            await self.broadcast(at='room', do='game', show=False)
            await self.broadcast(notify='Game was quit.')

    def remove(self):
        Room.all.pop(self.name)
