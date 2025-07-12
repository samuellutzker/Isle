import os
import os.path
import json
import random
from user import User
from siedler import Siedler
from editor import Editor
from tools import log, GameError

class Room:
    capacity = 4
    all = {} # room_name -> room

    @staticmethod
    def open(room_name):
        return Room.all[room_name.lower()] if room_name.lower() in Room.all else Room(room_name)

    def __init__(self, room_name):
        Room.all[room_name.lower()] = self
        self.members = {} # id -> user
        self.name = room_name
        self.game = None
        self.is_editor = False
        self.colors = ["red", "blue", "green", "ivory"] # ["indianred", "ivory", "coral", "royalblue"]
        random.shuffle(self.colors)
        log(f'Room {room_name} opened.')

        # try to load an existing game
        if os.path.isfile(self.my_filename()):
            try:
                self.game = Siedler(self)
                self.game.load(self.my_filename())
                os.remove(self.my_filename())
                log(f"Loaded (and deleted) {self.my_filename()}.")
            except Exception as exc:
                self.game = None
                log(f'Error loading game: {exc}')

    def my_filename(self):
        return f"games/{self.name.lower()}.json"

    # sends message to a room member to(id)
    async def message(self, to, **msg):
        if to is None:
            await self.broadcast(**msg)
        elif to not in self.members:
            log(f'Attempted to contact someone with id {to} outside of the room.')
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

    async def enter(self, user, key, force):
        def proper(s):
            return len(s) > 0 and len(s) < 16 and s.isalnum() and s.isascii()

        if len(self.members) >= Room.capacity:
            raise GameError('Sorry, room is full.')

        if not proper(self.name) or not proper(user.name):
            if not proper(self.name) or len(self.members) == 0:
                self.remove()
            raise GameError('Choose a proper name, please (only alphanumeric, no whitespace).')

        if self.game is not None and not self.is_editor:
            try:
                if key is None:
                    raise GameError('Access code required to join running game in this room.')
                elif not self.game.resumable(user, key):
                    raise GameError('Incorrect credentials, or player is already logged in.')
            except GameError as e:
                is_forcible = len(self.members) == 0
                if force and is_forcible:
                    self.game = None
                else:
                    await user.receive(prompt=e.message, forcible=is_forcible)
                    self.store_abandoned_game()
                    return

        if any(other.name == user.name for other in self.members.values()):
            raise GameError('A user of that name already exists in this room.')

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

        # refresh scenario list
        await self.update_scenarios()

        log(f'User {user.name} entered room {self.name}.')

        if self.game is not None:
            if self.is_editor:
                await user.receive(at='room', do='editor', show=True)
                await self.game.describe_to(user)
            else:
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
        self.store_abandoned_game()
        log(f'User {user.name} left room {self.name}.')

    def store_abandoned_game(self):
        if len(self.members) == 0:
            if self.game is not None:
                if self.is_editor:
                    log(f"Editor in room {self.name} persistent.")
                    return
                else:
                    self.game.save(self.my_filename())
                    self.game = None
                    log(f"Game in room {self.name} saved to {self.my_filename()}.")
            self.remove()

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

    # sends game access key to players, or sets a new one
    async def game_key(self, user=None, new_key=None):
        if user is None:
            for i in self.members:
                await self.game_key(self.members[i])
        else:
            key = self.game.key(user, new_key)
            if new_key is None:
                await user.receive(at='room', do='game_key', key=key)
            log(f'Player {user.name} has key: {key}.')

    async def new_game(self, user, scenario, debug_auth=None):
        await self.quit_game()
        self.game = Siedler(self, scenario, debug_auth)
        await self.broadcast(at='room', do='game', show=True)
        await self.game_key()
        await self.game.start()
        self.is_editor = False
        log(f'New game in room {self.name}.')

    async def new_editor(self, user, scenario):
        await self.quit_game()
        self.game = Editor(self)
        if scenario is not None:
            await self.game.load(scenario)
        await self.broadcast(at='room', do='editor', show=True)
        for i in self.members:
            await self.game.describe_to(self.members[i])
        self.is_editor = True
        log(f'New editor in room {self.name}.')

    async def quit_game(self):
        if self.game is not None:
            self.game = None
            await self.broadcast(at='room', do='editor' if self.is_editor else 'game', show=False)
            await self.broadcast(dialog='Editor was quit.' if self.is_editor else 'Game was quit.')
            log(('Editor' if self.is_editor else 'Game') + f' was quit in room {self.name}.')

    def remove(self):
        if self.name.lower() in Room.all:
            Room.all.pop(self.name.lower())
            log(f'Room {self.name} removed.')
