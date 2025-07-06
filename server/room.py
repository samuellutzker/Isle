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
        return Room.all[room_name] if room_name in Room.all else Room(room_name)

    def __init__(self, room_name):
        Room.all[room_name] = self
        self.members = {} # id -> user
        self.name = room_name
        self.game = None
        if os.path.isfile(self.my_filename()):
            try:
                self.game = Siedler(self)
                self.game.load(self.my_filename())
                os.remove(self.my_filename())
                log(f"Loaded (and deleted) {self.my_filename()}.")
            except Exception as exc:
                print("Error:", exc)
                print("Type:", type(exc).__name__)
                print("Error file info:", exc.__traceback__.tb_frame)
                print("Error line#:", exc.__traceback__.tb_lineno)
        self.is_editor = False
        self.colors = ["red", "blue", "green", "ivory"] # ["indianred", "ivory", "coral", "royalblue"]
        random.shuffle(self.colors)
        log(f'Room {room_name} opened.')

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

    async def enter(self, user, key):
        def proper(s):
            return len(s) > 0 and len(s) < 16 and s.isalnum() and s.isascii()

        if len(self.members) >= Room.capacity:
            raise GameError('Sorry, room is full.')

        if not proper(self.name) or not proper(user.name):
            if not proper(self.name) or len(self.members) == 0:
                self.remove()
            raise GameError('Choose a proper name, please (only alphanumeric, no whitespace).')

        if self.game is not None and key is None and not self.is_editor:
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

        log(f'User {user.name} left room {self.name}.')

        if len(self.members) == 0:
            if self.game is not None:
                if self.is_editor:
                    log(f"Editor in room {self.name} persistent.")
                    return
                else:
                    self.game.save(self.my_filename())
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

    # sends game access key to players
    async def game_key(self, user=None):
        if user is None:
            for i in self.members:
                await self.game_key(self.members[i])
        else:
            key = self.game.get_key(user)
            await user.receive(at='room', do='game_key', key=key)
            log(f'Player {user.name} has key: {key}.')

    async def new_game(self, user, scenario, debug_auth=None):
        await self.quit_game()
        self.game = Siedler(self, scenario, debug_auth)
        await self.broadcast(at='room', do='game', show=True)
        log(f'New game in room {self.name}.')
        await self.game_key()
        await self.game.start()
        self.is_editor = False

    async def new_editor(self, user, scenario):
        await self.quit_game()
        self.game = Editor(self)
        if scenario is not None:
            await self.game.load(scenario)
        await self.broadcast(at='room', do='editor', show=True)
        log(f'New editor in room {self.name}.')
        for i in self.members:
            await self.game.describe_to(self.members[i])
        self.is_editor = True

    async def quit_game(self):
        if self.game is not None:
            self.game = None
            await self.broadcast(at='room', do='editor' if self.is_editor else 'game', show=False)
            await self.broadcast(dialog='Editor was quit.' if self.is_editor else 'Game was quit.')
            log(('Editor' if self.is_editor else 'Game') + f' was quit in room {self.name}.')

    def remove(self):
        Room.all.pop(self.name)
        log(f'Room {self.name} removed.')
