import json
from error import GameError

class Editor:
	def __init__(self, room):
		self.height = 0
		self.width = 0
		self.shift_x = 0
		self.shift_y = 0
		self.vp_limit = 10
		self.reward_discovery = True
		self.reward_colony = 2
		self.board = [[]]
		self.room = room
		# self._snumbers0 = [5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11] # standard setup

	def lookup(self,x,y):
		return self.board[y][x] if x < self.width and y < self.height and x >= 0 and y >= 0 else None

	def resizeBoard(self, width, height, shift_x, shift_y):
		board = [[self.lookup(x-shift_x, y-shift_y) for x in range(width)] for y in range(height)]
		self.board = board
		self.width = width
		self.height = height

	async def describeTo(self, user):
		situation = { k:v for k,v in vars(self).items() if k != 'room'}
		await user.receive(at='editor', do='load', situation=situation)

	async def move(self, action, **kwargs):
		if action == 'save' and 'name' in kwargs:
			await self.save(**kwargs)

		elif action == 'pile' and 'name' in kwargs and 'content' in kwargs:
			vars(self)[kwargs['name']] = kwargs['content']
			await self.room.broadcast(at='editor', do='pile', name=kwargs['name'], content=kwargs['content'])

		elif action == 'robber' and 'x' in kwargs and 'y' in kwargs:
			x, y = kwargs['x'] + self.shift_x, kwargs['y'] + self.shift_y
			if self.lookup(x,y) is None or type(self.lookup(x,y)) != dict:
				raise GameError('No terrain here.')
			figure = 'pirate' if self.board[y][x]['terrain'] == 'water' else 'robber'
			if figure not in vars(self):
				vars(self)[figure] = []

			remove = [x,y] in vars(self)[figure]
			await self.room.broadcast(at='editor', do=figure, x=kwargs['x'], y=kwargs['y'], remove=remove)
			if remove:
				vars(self)[figure].remove([x,y])
			else:
				vars(self)[figure].append([x,y])

		elif action == 'board' and 'x' in kwargs and 'y' in kwargs and 'hex' in kwargs:
			x, y = kwargs['x'] + self.shift_x, kwargs['y'] + self.shift_y
			if self.width == 0 and self.height == 0:
				self.resizeBoard(1, 1, 0, 0)
				self.board[0][0] = kwargs['hex']
				self.shift_x, self.shift_y = -x, -y
			else:
				sh_x, sh_y = 0, 0
				w, h = max(x+1, self.width), max(y+1, self.height)
				if x < 0:
					sh_x = -x
					w = self.width - x
					x = 0
				if y < 0:
					sh_y = -y
					h = self.height - y
					y = 0

				if w > self.width or h > self.height:
					self.resizeBoard(w, h, sh_x, sh_y)

				self.shift_x += sh_x
				self.shift_y += sh_y

				if self.board[y][x] is not None:
					await self.room.broadcast(at='editor', do='delete', x=kwargs['x'], y=kwargs['y'], hex=self.board[y][x])
				# else shrink board
				self.board[y][x] = kwargs['hex']

			if kwargs['hex'] is not None:
				await self.room.broadcast(at='editor', do='hex', x=kwargs['x'], y=kwargs['y'], hex=kwargs['hex'])

	async def load(self, name):
		try:
			f = open(f"scenarios/{name}.json", "r")
			self.__dict__ |= json.loads(f.read())
			f.close()
			self.shift_x = self.width // 2
			self.shift_y = self.height // 2
			await self.room.broadcast(at='editor', do='message', msg=f'Scenario {name} loaded.')
		except Exception as e:
			raise GameError(f'Error loading scenario {name}')

	async def save(self, name, **kwargs):
		self.__dict__ |= kwargs

		scenario = { k:v for k,v in vars(self).items() if k not in ['room', 'shift_x', 'shift_y'] }
		try:
			f = open(f"scenarios/{name.lower()}.json", "w")
			f.write(json.dumps(scenario))
			f.close()
			await self.room.broadcast(at='editor', do='message', msg=f'Scenario {name} was saved.')
			await self.room.update_scenarios()
		except Exception as e:
			raise GameError(f'Error occurred, could not save {name}.')

