import re
import json
import secrets
import string
import random
from tools import GameError, combine, strip_func

class Siedler:
    def __init__(self, room, scenario_name, debug_auth=None):
        debug_password = "fl31sch"
        self.debug = debug_auth == debug_password

        if len(room.members) not in [3,4] and not self.debug:
            raise GameError('You need 3 or 4 players to play ISLE.')

        try:
            f = open(f"scenarios/{scenario_name}.json")
            scenario = json.loads(f.read())
        except FileNotFoundError as e:
            raise GameError("Scenario does not exist.")
        except json.decoder.JSONDecodeError as e:
            raise GameError(e)

        self.resources = dict(forest='lumber', hills= 'brick', pasture='wool', fields='grain', mountains='ore', river='gold')
        self.room = room
        self.players = [Siedler.Player(self, user, i) for i,user in enumerate(random.sample(list(room.members.values()), len(room.members)))]
        self.active_idx = 0
        self.active_player = self.players[self.active_idx]
        self.build_options = None
        self.initial_phase = True
        self.largest_army = None
        self.longest_road = None
        self.last_dice = None
        self.card_played = None
        self.setup_board(scenario)
        self.setup_cards()
        self.setup_queue()

    class Player:
        def __init__(self, parent, user, idx):
            self.user = user
            self.parent = parent
            self.id = user.id
            self.idx = idx
            self.name = user.name
            self.color = user.color
            self.storage = (dict(lumber=20, brick=20, wool=20, grain=20, ore=20)
                if parent.debug else dict(lumber=0, brick=0, wool=0, grain=0, ore=0))
            self.figures = dict(village=5, city=4, road=15, ship=15)
            self.storage_queue = dict()
            self.cards = []
            self.cards_blocked = []
            self.ships_blocked = []
            self.colonies = []
            self.ship_moved = False
            self.score = 0
            self.harbors = []
            self.knights = 0
            self.road_max = 0
            self.vp = 2
            self.key = self.generate_password(30)

        def generate_password(self, length):
            options = string.ascii_uppercase + string.ascii_lowercase + string.digits
            return "".join([secrets.choice(options) for i in range(length)])

        def storage_size(self):
            return sum(self.storage.values())

        async def store(self, hidden=False, collect=False, **kwargs):
            result = combine(self.storage, kwargs)
            if 'gold' in result: del result['gold']
            if min(result.values()) < 0: return False
            self.storage = result
            exchg = { k:v for k,v in kwargs.items() if v != 0 }
            exchg_hidden = dict(generic=sum(kwargs.values())) # currently no need for separate generic loss and gain
            resources = combine(self.storage_queue, exchg)
            resources_hidden = combine(self.storage_queue, exchg_hidden)
            if collect:
                self.storage_queue = resources_hidden if hidden and player != self else resources
            else:
                if 'gold' in resources:
                    self.parent.pick_resources(self.idx, resources['gold'], f"You have produced gold, pick {resources['gold']} resources.")
                    del resources['gold']
                self.storage_queue = dict()
                for player in self.parent.players:
                    r = resources_hidden if hidden and player != self else resources
                    await player.user.receive(at='game', do='exchange', id=self.id, resources=r) # tell everyone
                await self.get_storage() # tell myself

            return True

        async def get_storage(self):
            await self.user.receive(at='game', do='storage', resources=self.storage)

        async def get_cards(self):
            await self.user.receive(at='game', do='cards', cards=strip_func(self.cards))

        async def pay_for(self, structure):
            if structure == 'card':
                if len(self.parent.cards) > 0 and await self.store(wool=-1, grain=-1, ore=-1):
                    card = self.parent.cards.pop()
                    if card['type'] == 'victory_point':
                        self.vp += 1
                    self.cards.append(card)
                    self.cards_blocked.append(len(self.cards)-1)
                    await self.user.room.broadcast(at='game', do='buy_card', id=self.id)
                    return True
                return False

            if structure == 'move_ship':
                return True

            if self.figures[structure] == 0:
                return False

            if structure == 'road':
                ok = await self.store(lumber=-1, brick=-1)
            elif structure == 'ship':
                ok = await self.store(lumber=-1, wool=-1)
            elif structure == 'village':
                ok = await self.store(lumber=-1, brick=-1, wool=-1, grain=-1)
                if ok: self.vp += 1
            elif structure == 'city':
                ok = await self.store(grain=-2, ore=-3)
                if ok: self.vp += 1

            if not ok: return False
            self.figures[structure] -= 1
            if structure == 'city':
                self.figures['village'] += 1
            return True

    # end of class Player

    def is_crossing(self, x, y):
        return (x % 5) % 2 == 1

    def on_board(self, x, y, edge=False):
        xlimit = self.edge_dim_x if edge else self.width
        ylimit = self.edge_dim_y if edge else self.height
        return x < xlimit and x >= 0 and y < ylimit and y >= 0

    def adj_filter(self, adj_list, edge=False):
        return [(x,y) for x,y in adj_list if self.on_board(x,y,edge)]

    # field coord, direction -> coord in edges
    # direction: counterclockwise, starting left
    def hex_adj_edges(self, x, y, crossing=False):
        a = ([(0,0),(2,0),(4,0),(5,0),(7,1),(4,1)] if not crossing
            else [(1,0),(3,0),(6,0),(8,1),(6,1),(3,1)])
        return self.adj_filter([(5*x+dx, y+dy) for dx,dy in a], True)

    # adjacent field coords
    def hex_adj_hexes(self, x, y):
        a = [(-1,0), (0,1), (1,1), (1,0), (0,-1), (-1,-1)]
        return self.adj_filter([(x+x0,y+y0) for x0,y0 in a])

    # coord in edges -> surrounding terrain coord
    def edge_adj_hexes(self, x, y):
        a = [(-1,0), (-1,-1), (0,-1)]
        i = (x % 5) // 2 # edge index -> shift a
        hx = x // 5
        adj = [(hx,y), (hx+a[i][0], y+a[i][1])]
        if self.is_crossing(x,y):
            adj.append((hx+a[i+1][0], y+a[i+1][1]))
        return self.adj_filter(adj)

    # edge coord -> surrounding edges
    # same_type = skip one edge
    def edge_adj_edges(self, x, y, same_type=False):
        i = x % 5
        if self.is_crossing(x,y):
            if i==1 and same_type: a = [(-3,0), (2,0), (2,1)]
            elif i==3 and same_type: a = [(-2,0), (3,0), (-2,-1)]
            elif i==1: a = [(-2,0), (1,0), (-1,0)]
            elif i==3: a = [(-1,0), (1,0), (-3,-1)]
            return self.adj_filter([(x+m,y+n) for m,n in a], True)
        else:
            if not same_type:
                return self.adj_filter([(x+3,y+1) if i==0 else (x-1,y), (x+2,y) if i==4 else (x+1,y)], True)
            u = set(self.edge_adj_edges(x,y))
            return list(set().union(*[self.edge_adj_edges(x2,y2) for x2,y2 in u]) - {(x,y)})

    # check out where i can build what
    def calc_build_options(self, todo):
        f = lambda x: x
        if 'expected' in todo:
            if todo['expected'] == 'build':
                f = lambda x: list(set(x).intersection(set(todo['what'])))
            else:
                self.build_options = None
                return

        self.build_options = [[f(self.can_build(x, y, self.initial_phase)) for x in range(self.edge_dim_x)] for y in range(self.edge_dim_y)]

        # find front ships:
        if not self.active_player.ship_moved:
            for y in range(self.edge_dim_y):
                for x in range(self.edge_dim_x):
                    if (x,y) in self.active_player.ships_blocked: continue
                    edge = self.edges[y][x]
                    if edge is not None and edge['structure'] == 'ship' and edge['owner_index'] == self.active_idx:
                        for cx,cy in self.edge_adj_edges(x,y):
                            if (self.edges[cy][cx] is None or self.edges[cy][cx]['owner_index'] != self.active_idx) and True not in [self.edges[ey][ex] is not None
                                and self.edges[ey][ex]['structure'] == 'ship' and self.edges[ey][ex]['owner_index'] == self.active_idx 
                                for ex,ey in self.edge_adj_edges(cx,cy) if (ex,ey) != (x,y)]:
                                    self.build_options[y][x] = ['move_ship']

        # pirate takes away some options:
        if self.pirate is not None:
            for x,y in self.hex_adj_edges(self.pirate[0], self.pirate[1]):
                self.build_options[y][x] = list(set(self.build_options[y][x])-{'move_ship','ship'})

    # edge coord -> list of possible structures
    def can_build(self, x, y, initial_phase=False):
        if not self.on_board(x,y,True):
            return []

        # is something already there? what can we build?
        options = ['road','ship'] if not self.base_game else ['road']
        if self.is_crossing(x, y):
            options = ['village']
        edge = self.edges[y][x]
        if edge is not None:
            if edge['structure'] == 'village' and edge['owner_index'] == self.active_idx and not initial_phase:
                return ['city']
            else:
                return []

        # are we on the island?
        terrains = { self.board[hy][hx]['terrain'] for (hx,hy) in self.edge_adj_hexes(x,y) if self.board[hy][hx] is not None }
        if len(terrains) == 0: return [] # no mans land
        if terrains == {'water'}:
            if 'ship' in options: options = ['ship']
            else: return []
        if 'water' not in terrains and 'ship' in options:
            options.remove('ship')

        if not self.is_crossing(x, y):
            # road/ship connects to something we own?
            cut = set()
            for cx,cy in self.edge_adj_edges(x,y):
                cross = self.edges[cy][cx]
                if cross is not None:
                    if cross['owner_index'] == self.active_idx:
                        if initial_phase:
                            for ex,ey in self.edge_adj_edges(cx,cy):
                                if self.edges[ey][ex] is not None:
                                    return []
                        return options
                elif not initial_phase:
                    for ex,ey in self.edge_adj_edges(cx,cy):
                        edge = self.edges[ey][ex]
                        if edge is not None and edge['owner_index'] == self.active_idx:
                            cut.add(edge['structure'])
            return list(cut.intersection(set(options)))
        else:
            # distance to other village/city:
            for ex,ey in self.edge_adj_edges(x,y,same_type=True):
                if self.edges[ey][ex] is not None:
                    return []

            # connection to own road
            if 'village' in options:
                # if this is the initial phase make sure we are allowing a village here
                if initial_phase and all(self.board[hy][hx] is None or 'init' not in self.board[hy][hx] or self.board[hy][hx]['init']
                    for hx,hy in self.edge_adj_hexes(x,y)):
                    return options
                for ex,ey in self.edge_adj_edges(x,y):
                    edge = self.edges[ey][ex]
                    if edge is not None and edge['owner_index'] == self.active_idx:
                        return options

        return []

    def setup_board(self, scenario):
        self.base_game = scenario['base_game']
        self.board = scenario['board']
        self.width = scenario['width']
        self.height = scenario['height']
        self.edge_dim_x = 5 * (self.width+1)
        self.edge_dim_y = self.height+1
        self.edges =  [[None for x in range(self.edge_dim_x)] for y in range(self.edge_dim_y)] # [None]*k does not work in 2d
        self.reward_discovery = scenario['reward_discovery']
        self.reward_island = scenario['reward_island']
        self.vp_limit = scenario['vp_limit']

        robber_options = []

        def search_and_act(d, search, act):
            for i in (list(d.keys()) if type(d) == dict else range(len(d))):
                if type(d[i]) in [dict,list]:
                    search_and_act(d[i], search, act)
                if type(i) == str:
                    match = re.match(search, i)
                    if match is not None:
                        tmp = d[i]
                        del d[i]
                        d[match.group(1)] = act(tmp)
                elif type(d) == list and type(d[i]) == str:
                    match = re.match(search, d[i])
                    if match is not None:
                        d[i] = act(match.group(1))

        try:
            search_and_act(scenario, r"_e(.+)", lambda d: [x.copy() if type(x) in [dict,list] else x for x,n in d for c in range(n)]) # expand
            search_and_act(scenario, r"_s(.+)", lambda l: random.sample(l, len(l))) # shuffle
            search_and_act(scenario, r"_r(.+)", lambda l: scenario[l].pop() if l in scenario else l) # replace
            search_and_act(scenario, r"_r(.+)", lambda l: scenario[l].pop() if l in scenario else l) # replace again!
        except IndexError as e:
            raise GameError('Could not load the game, scenario file is erroneous.')

        self.board = scenario['board']

        # find islands for VP reward ("colonies") via dfs
        colonies = 0
        def dfs_reward(x,y,idx):
            if self.board[y][x] is None or self.board[y][x]['terrain'] == 'water': return
            if 'island' not in self.board[y][x] and 'reward' in self.board[y][x] and self.board[y][x]['reward']:
                self.board[y][x]['island'] = idx
                for hx,hy in self.hex_adj_hexes(x,y):
                    dfs_reward(hx,hy,idx)

        for y in range(self.height):
            for x in range(self.width):
                dfs_reward(x,y,colonies)
                colonies += 1

        # hide hidden tiles from the board
        self.hidden_hexes = dict()
        for y in range(self.height):
            for x in range(self.width):
                if self.board[y][x] is not None and 'hidden' in self.board[y][x] and self.board[y][x]['hidden']:
                    self.hidden_hexes[(x,y)] = self.board[y][x]
                    self.board[y][x] = { 'terrain': 'hidden', 'init': False }

        robber_options = scenario['robber'] if 'robber' in scenario else [(x,y) for y in range(self.height) for x in range(self.width)
            if self.board[y][x] is not None and self.board[y][x]['terrain'] == 'desert']
        pirate_options = scenario['pirate'] if 'pirate' in scenario else [(x,y) for y in range(self.height) for x in range(self.width)
            if self.board[y][x] is not None and self.board[y][x]['terrain'] == 'water']

        self.robber = tuple(random.choice(robber_options)) if len(robber_options) > 0 else None
        self.pirate = tuple(random.choice(pirate_options)) if len(pirate_options) > 0 and not self.base_game else None

        # move adjacent 6 and 8
        def n(x,y):
            return self.board[y][x]['number'] if self.board[y][x] is not None and 'number' in self.board[y][x] else None
        def is_option(x,y):
            return all(n(hx,hy) not in [6,8] for hx,hy in self.hex_adj_hexes(x,y)) and self.board[y][x]['terrain'] != 'river'

        options = { (x,y) for y in range(self.height) for x in range(self.width) if n(x,y) not in [None,6,8] and is_option(x,y) }
        problems = [ (x,y) for y in range(self.height) for x in range(self.width) if n(x,y) in [6,8] and not is_option(x,y) ]
        random.shuffle(problems)

        for x,y in problems:
            if not is_option(x,y) and len(options) > 0: # possibly the problem was already solved
                sx,sy = random.choice(list(options))
                # print(f"swapping {self.board[y][x]['number']} and {self.board[sy][sx]['number']}")
                self.board[y][x]['number'], self.board[sy][sx]['number'] = self.board[sy][sx]['number'], self.board[y][x]['number']
                options -= {(sx,sy)} | set(self.hex_adj_hexes(sx,sy))
                options |= { (ox,oy) for ox,oy in set(self.hex_adj_hexes(x,y)) if n(ox,oy) not in [None,6,8] and is_option(ox,oy) }


    def describe(self):
        return {
            'width' : self.width,
            'height' : self.height,
            'board' : self.board,
            'edges' : self.edges,
            'active' : self.active_player.id,
            'robber' : self.robber,
            'pirate' : self.pirate,
            'dice' : self.last_dice,
            'card' : self.card_played
        }


    def get_info(self, idx):
        player = self.players[idx]
        return {
            'resources' : player.storage_size(),
            'cards' : len(player.cards),
            'knights' : player.knights,
            'road_max' : player.road_max,
            'vp' : player.vp,
            'style' : {
                'road_max' : 'gold' if self.longest_road == idx else None,
                'knights' : 'gold' if self.largest_army == idx else None
            }
        }


    async def update_index2id(self):
        idx2id = { i:p.id for i,p in enumerate(self.players) }
        await self.room.broadcast(at='game', do='index', idx2id=idx2id)


    async def update_player_info(self):
        for i,player in enumerate(self.players):
            await self.room.broadcast(at='game', do='info', id=player.id, info=self.get_info(i))


    async def build(self, structure, x, y):
        self.edges[y][x] = {
            'structure' : structure,
            'color' : self.active_player.color,
            'owner_index' : self.active_idx
        }

        if structure == 'move_ship':
            self.active_player.ship_moved = True
            self.edges[y][x] = None
            self.active_player.figures['ship'] += 1
            self.queue.append(dict(func=self.free_build, what=['ship'], expected='build', description=f'Place ship.'))
            await self.room.broadcast(at='game', do='remove', what='ship', x=x, y=y)
            return

        if structure == 'village':
            # check harbors and colonization rewards:
            for hx,hy in self.edge_adj_hexes(x,y):
                if self.board[hy][hx] != None:
                    if 'harbor' in self.board[hy][hx]:
                        ex, ey = self.hex_adj_edges(hx, hy)[self.board[hy][hx]['harbor']['direction']]
                        if (x,y) in self.edge_adj_edges(ex, ey):
                            self.active_player.harbors.append(self.board[hy][hx]['harbor']['type'])

                    if 'island' in self.board[hy][hx] and self.board[hy][hx]['island'] not in self.active_player.colonies:
                        if not self.initial_phase and self.reward_island > 0:
                            self.active_player.vp += self.reward_island
                            text = f"<div class='icon resources'></div><br />{self.active_player.name} has settled on a new island. <b>+{self.reward_island} VP</b>"
                            await self.room.broadcast(dialog=text, title='Award', style='gold')
                        self.active_player.colonies.append(self.board[hy][hx]['island'])

        if structure == 'ship':
            self.active_player.ships_blocked.append((x,y))

        # re-evaluate road lengths (maybe only do if necessary)
        # quick & dirty: compare to see if the longest road was affected
        award = False

        if structure in ['village','road','ship']:
            laureate = self.players[self.longest_road] if self.longest_road is not None else None
            old_length = max([p.road_max for p in self.players])
            new_length = self.calc_road_length()

            if new_length <= old_length:
                if laureate is not None and (laureate.road_max < new_length or new_length < 5):
                    laureate.vp -= 2
                    self.longest_road = None

                    if new_length >= 5:
                        longest_players = [i for i,p in enumerate(self.players) if p.road_max == new_length]
                        if len(longest_players) == 1:
                            self.longest_road = longest_players[0]
                            self.players[self.longest_road].vp += 2
                            award = True

            else: # new > old can only happen if the active player got longer
                if self.active_player.road_max >= 5:
                    if self.longest_road is None:
                        self.active_player.vp += 2
                        self.longest_road = self.active_idx
                        award = True
                    elif self.active_player.road_max > self.players[self.longest_road].road_max:
                        self.players[self.longest_road].vp -= 2
                        self.active_player.vp += 2
                        self.longest_road = self.active_idx
                        award = True

        if award:
            text = f"<div class='icon road_max'></div><br />{self.players[self.longest_road].name} now has the longest road. <b>+2 VP</b>"
            await self.room.broadcast(dialog=text, title='Award', style='gold')

        await self.room.broadcast(at='game', do='build', x=x, y=y, what=self.edges[y][x])

        # discover terrain
        if structure in ['ship','road']:
            for cx,cy in self.edge_adj_edges(x,y):
                for hx,hy in self.edge_adj_hexes(cx,cy):
                    if (hx,hy) in self.hidden_hexes:
                        discovery = self.board[hy][hx] = self.hidden_hexes[hx,hy]
                        del self.hidden_hexes[hx,hy]
                        await self.room.broadcast(at='game', do='discover', x=hx, y=hy, what=discovery)
                        if self.reward_discovery and discovery['terrain'] not in ['desert','water']:
                            await self.active_player.store(**{ self.resources[discovery['terrain']] : 1 })

    # main routine
    # called by server.py
    async def move(self, user, action, **kwargs):
        # check if all players are present:
        if any(player.id not in self.room.members for player in self.players):
            await user.receive(alert='Please wait until all players are logged in.')
            return

        # check if move was initiated by active player:
        if user.id != self.active_player.id:
            await user.receive(alert='Dude, it is not your turn.')
            return

        if len(self.queue) == 0:
            await user.receive(alert='Game has finished.')
            return

        todo = self.queue.pop() # dict containing: func, expected, description, player

        try:
            if 'expected' in todo and action != todo['expected']:
                raise GameError('Different action taken.')

            # is something on our to-do list?
            if 'func' in todo:
                await todo['func'](**(kwargs | { 'args' : todo }))

            # nothing on to-do list, regular move:
            elif action == 'build':
                x, y, structure = kwargs['x'], kwargs['y'], kwargs['structure']

                if not self.on_board(x,y,True) or structure not in self.build_options[y][x]:
                    await user.receive(alert=f'Cannot build {structure} here.')
                elif not await self.active_player.pay_for(structure):
                    await user.receive(alert=f'Insufficient funds or no {structure} left.')
                else:
                    await self.build(structure, x, y)

            elif action == 'finish':
                self.card_played = None
                next_player = (self.active_idx + 1) % len(self.players)
                self.queue.append(dict(player=next_player, func=self.dice, expected='dice', description='Throw the dice.'))

            elif action == 'card':
                if 'use' in kwargs:
                    i = kwargs['use']
                    if self.card_played is not None and not self.debug:
                        await user.receive(alert='You can only use one card per round.')
                    elif i in self.active_player.cards_blocked:
                        await user.receive(alert='You must wait until your next turn to use this card.')
                    else:
                        cards = self.active_player.cards
                        if await cards[i]['func']():
                            await self.room.broadcast(at='game', do='use_card', card=strip_func(cards[i]), id=self.active_player.id)
                            self.card_played = strip_func(cards[i])
                            cards[i] = cards[-1]
                            cards.pop()
                            if len(cards) in self.active_player.cards_blocked:
                                self.active_player.cards_blocked.append(i)
                                self.active_player.cards_blocked.remove(len(cards))
                elif 'get' in kwargs:
                    await self.active_player.get_cards()
                elif 'buy' in kwargs:
                    if not await self.active_player.pay_for('card'):
                        await user.receive(alert='Insufficient funds.')

            elif action == 'trade':
                self.queue.append(dict(func=self.trade, expected='point', player=self.active_idx,
                    clickables=list(range(len(self.players))),
                    description='Pick a player to trade with.'))

            else:
                raise GameError('You can build, trade, or finish your round.')
                return

        except GameError as e:
            await user.receive(alert=f'Expected: {todo["description"]}<br />{str(e)}')
            self.queue.append(todo) # sth went wrong. try again.

        await self.prompt()

    async def prompt(self):
        if self.active_player.vp >= self.vp_limit: # victory!
            await self.room.broadcast(at='game', do='win', id=self.active_player.id, description=f"{self.active_player.name} won.")
            await self.room.broadcast(dialog=f'<div class="icon trophy"></div><br />{self.active_player.name} has <b>{self.active_player.vp} VP</b> and wins!', title='Game over', style='gold')
            for player in self.players:
                for card in player.cards:
                    await self.room.broadcast(at='game', do='use_card', card=strip_func(card), id=player.id)
            self.queue.clear()
            return

        if len(self.queue) == 0:
            self.queue.append(dict(description='It is your turn.'))

        todo = strip_func(self.queue[-1])
        if 'player' in todo:
            self.active_idx = todo['player']
            self.active_player = self.players[self.active_idx]

        await self.room.broadcast(at='game', do='active', id=self.active_player.id, description=f"It is {self.active_player.name}'s turn.")
        await self.room.broadcast(at='game', do='cursor', clickables=None)

        await self.update_player_info()
        self.calc_build_options(todo)
        await self.active_player.user.receive(at='game', do='cursor', clickables=self.build_options)
        await self.active_player.user.receive(at='game', do='await', **todo)

    async def dice(self, args):
        self.initial_phase = False

        a, b = random.randint(1,6), random.randint(1,6)

        if a + b == 7 and not self.debug:
            # robber strikes
            self.queue.append(dict(player=self.active_idx, func=self.robber_place, expected='robber', description='Move robber or pirate.'))
            for idx,player in enumerate(self.players):
                if player.storage_size() > 7:
                    lose = player.storage_size() // 2
                    self.queue.append(dict(player=idx, func=self.robber_loot, expected='exchange',
                        description=f'Robber is looting, you lose {lose} resources.'))

        await self.room.broadcast(at='game', do='dice', result=[a, b])
        self.last_dice = [a, b]

        for y in range(self.height):
            for x in range(self.width):
                field = self.board[y][x]
                if field is not None and 'number' in field and field['number'] == a + b and (x, y) != self.robber:
                    # harvest:
                    for cx, cy in self.hex_adj_edges(x,y,True):
                        crossing = self.edges[cy][cx]
                        if crossing is not None:
                            amount = 1 if crossing['structure'] == 'village' else 2
                            resource = self.resources[field['terrain']]
                            await self.players[crossing['owner_index']].store(collect=True, **{resource : amount})

        for player in self.players:
            await player.store() # flush changes

        self.active_player.cards_blocked = []
        self.active_player.ships_blocked = []
        self.active_player.ship_moved = False

    async def trade(self, args, **kwargs):
        def neg(res): return { k:(-v) for k,v in res.items() }

        empty = dict(lumber=0, brick=0, wool=0, grain=0, ore=0)
        if 'resources' not in kwargs:
            opponent = kwargs['player']
            description = 'Harbor trade.' if opponent == self.active_idx else f'Make an offer to {self.players[opponent].name}.'
            self.queue.append(dict(player=self.active_idx, description='It is your turn.'))
            self.queue.append(dict(func=self.trade, expected='exchange', description=description, setup=empty, opponent=opponent))
        else:
            opponent = self.players[args['opponent']]
            offer = args['setup']

            if kwargs['resources'] == empty:
                # cancellation
                self.queue[-1]['description'] = 'Trade aborted.'
            elif self.active_player == opponent:
                # harbor trading
                exch = 0
                for resource,value in kwargs['resources'].items():
                    if value < 0:
                        div = 4
                        if resource in self.active_player.harbors:
                            div = 2
                        elif 'generic' in self.active_player.harbors:
                            div = 3
                        if value % div != 0:
                            raise GameError(f'Illegal port trade: {resource} must be a multiple of {div}')
                        exch += value / div
                    else:
                        exch += value

                if exch == 0 and await self.active_player.store(**kwargs['resources']):
                    self.queue[-1]['description'] = 'Trade completed.'
                else:
                    raise GameError(f'Illegal port trade: Incorrect prices, or resources unavailable.')

            elif kwargs['resources'] == offer:
                # offer and counteroffer match
                if not await self.active_player.store(**offer):
                    raise GameError(f'{self.active_player.name} proposed an invalid trade.')
                if not await opponent.store(**neg(offer)):
                    await self.active_player.store(**neg(offer)) # undo it!
                    raise GameError(f'{opponent.name} proposed an invalid trade.')
                self.queue[-1]['description'] = 'Trade completed.'
            else:
                # propose different counteroffer
                self.queue.append(dict(player=args['opponent'], func=self.trade, expected='exchange', description=f'Make a counteroffer to {self.active_player.name}.',
                    setup=neg(kwargs['resources']), opponent=self.active_idx ))

    async def free_build(self, args, x, y, structure):
        expected = args['what']

        if not self.on_board(x,y,True) or structure not in self.build_options[y][x] or structure not in expected:
            raise GameError( f'Cannot build a {" or ".join(expected)} here.')

        await self.build(structure, x, y)

        if 'payout' in args and args['payout']:
            for hx,hy in self.edge_adj_hexes(x,y):
                if self.board[hy][hx] is not None:
                    terrain = self.board[hy][hx]['terrain']
                    if terrain not in ['water', 'desert']:
                        await self.active_player.store(collect=True, **{ self.resources[terrain] : 1})

            await self.active_player.store()

        self.active_player.figures[structure] -= 1 # no testing needed so far

    async def robber_loot(self, args, resources):
        lose = self.active_player.storage_size() // 2

        if max(resources.values()) > 0:
            raise GameError("You lose resources, don't take any.")
        if -sum(resources.values()) != lose:
            raise GameError(f"You lose {lose} resources, not {-sum(resources.values())}.")

        await self.active_player.store(**resources, hidden=True)

    async def robber_place(self, args, x, y):
        if not self.on_board(x,y) or self.board[y][x] is None or self.board[y][x]['terrain'] == 'hidden' or self.base_game and self.board[y][x]['terrain'] == 'water':
            raise GameError('Cannot place robber or pirate there.')
        if (x,y) in [self.robber, self.pirate]:
            raise GameError('You must move the robber.')

        is_pirate = self.board[y][x]['terrain'] == 'water'
        adj_edges = [ self.edges[ey][ex] for ex,ey in self.hex_adj_edges(x,y,not is_pirate) ]
        adj_players = { e['owner_index'] for e in adj_edges if e is not None and e['owner_index'] != self.active_idx
            and e['structure'] != 'road' and self.players[e['owner_index']].storage_size() > 0 }

        if is_pirate:
            self.pirate = (x,y)
            await self.room.broadcast(at='game', do='pirate', x=x, y=y)
        else:
            self.robber = (x,y)
            await self.room.broadcast(at='game', do='robber', x=x, y=y)

        if len(adj_players) > 0:
            self.queue.append(dict(func=self.robber_steal, expected='point', clickables=list(adj_players),
                description=f'Select player to rob.'))

    async def robber_steal(self, args, player):
        if player not in args['clickables']:
            raise GameError('Attempted to be naughty!')

        p = self.players[player]
        n = p.storage_size()
        if n == 0:
            raise GameError("This player has no resources.")

        r = random.randint(0, n-1)
        for key in p.storage:
            if r >= p.storage[key]:
                r -= p.storage[key]
            else:
                await p.store(**{key : -1}, hidden=True)
                await self.active_player.store(**{key : 1}, hidden=True)
                return

    def pick_resources(self, player_idx, amount, prompt):
        if player_idx != self.active_idx:
            self.queue.append(dict(player=self.active_idx, description='It is your turn.'))
        self.queue.append(dict(player=player_idx, func=self.pick_resources_verify, expected='exchange', description=prompt, amount=amount))

    async def pick_resources_verify(self, args, resources):
        if min(resources.values()) < 0 or sum(resources.values()) != args['amount']:
            raise GameError(f'Please pick {args["amount"]} resources, thanks.')
        await self.active_player.store(**resources)

    def setup_queue(self):
        n = len(self.players)
        a = [i // 2 for i in range(2*n)]
        b = a.copy()
        b.reverse()
        c = a+b
        d = zip(c, (2*n)*[['road','ship'] if not self.base_game else ['road'], ['village']], n*[False, True] + n*[False, False])
        self.queue = [dict(func=self.dice, expected='dice', description='Throw the dice.')]
        self.queue += [dict(player=player, func=self.free_build, what=options, payout=payout,
            expected='build', description=f'Build {" or ".join(options)}.') for player, options, payout in d]

    # development cards:
    async def card_knight(self):
        self.queue.append(dict(player=self.active_idx, func=self.robber_place, expected='robber', description='Move robber or pirate.'))
        self.active_player.knights += 1
        if self.active_player.knights >= 3:
            if self.largest_army == self.active_idx:
                return True
            if self.largest_army is not None:
                if self.players[self.largest_army].knights >= self.active_player.knights:
                    return True
                self.players[self.largest_army].vp -= 2
            self.largest_army = self.active_idx
            self.active_player.vp += 2
            text = f"<div class='icon knights'></div><br />{self.active_player.name} now has the largest army. <b>+2 VP</b>"
            await self.room.broadcast(dialog=text, title='Award', style='gold')

        return True

    async def card_vp(self):
        await self.active_player.user.receive(alert='You cannot use this card.')
        return False

    async def card_monopoly(self):
        self.queue.append(dict(func=self.monopoly_steal, description='Select resource', expected='choose'))
        return True

    async def card_roads(self, **kwargs):
        if 'args' not in kwargs:
            amount = 2
        else:
            await self.free_build(**kwargs)
            amount = kwargs['args']['amount'] - 1

        options = ['road','ship'] if not self.base_game else ['road']

        # check that it is actually possible to build a road or ship
        if amount > 0 and True in [(True in [self.active_player.figures[structure] > 0
        and structure in self.build_options[y][x] for y in range(self.edge_dim_y) for x in range(self.edge_dim_x)]) for structure in ['road', 'ship']]:
            self.queue.append(dict(func=self.card_roads, amount=amount, what=options, expected='build', description=f'Build {" or ".join(options)}.'))
        return True


    async def card_plenty(self):
        self.pick_resources(self.active_idx, 2, 'Pick 2 resources')
        return True

    # queue responder:
    async def monopoly_steal(self, args, resource):
        for i,p in enumerate(self.players):
            if i == self.active_idx: continue
            amount = p.storage[resource]
            await p.store(**{resource : -amount})
            await self.active_player.store(**{resource : amount})

    def setup_cards(self):
        knight = dict(type='knight', title='Knight',
            description='Move robber or pirate. Steal one resource from an owner of an affected structure.', func=self.card_knight)
        monopoly = dict(type='progress', title='Monopoly',
            description='Pick a resource. All other players must give you all of their resources of this type.', func=self.card_monopoly)
        road_building = dict(type='progress', title='Road Building',
            description='Build two roads for free.', func=self.card_roads)
        year_of_plenty = dict(type='progress', title='Year Of Plenty',
            description='Take any two resources from the bank.', func=self.card_plenty)
        victory_point = dict(type='victory_point',
            description='Keep this card. You get one extra victory point.', func=self.card_vp)

        self.cards = 14*[knight] + 2*[monopoly] + 2*[road_building] + 2*[year_of_plenty]

        vp_card_types = ['Library', 'University', 'Great Hall', 'Chapel', 'Market']
        for title in vp_card_types:
            self.cards.append(victory_point | dict(title=title))

        for card in self.cards:
            card['name'] = card['title'].lower().replace(' ','_')

        random.shuffle(self.cards)

    async def start(self):
        pos = [(0.1, 0.6), (0.1, 0.15), (0.8, 0.15), (0.8, 0.6)]

        await self.room.broadcast(at='game', do='load', situation=self.describe())
        await self.update_index2id()
        for (x,y), player in zip(pos, self.players):
            player.pos = (x,y)
            await self.room.members[player.id].move(x,y)
            await player.get_storage()

        await self.prompt()

    def get_key(self, user):
        for player in self.players:
            if player.user == user:
                return player.key

    async def resume(self, user, key):
        for player in self.players:
            if key == player.key and player.id not in self.room.members:
                # set player up
                player.user = user
                player.id = user.id
                player.name = user.name

                # fill user in
                await user.set_color(player.color)
                await user.move(player.pos[0], player.pos[1])
                await user.receive(at='game', do='load', situation=self.describe())
                await player.get_storage()
                await self.update_index2id()
                await self.update_player_info()
                if self.active_player == player:
                    await self.prompt()

                return

        raise GameError('Incorrect link, player already logged in or game does not exist anymore.')

    # calculate all players road lengths and store them.
    # return the longest road length.
    # v 1.1d: phase-1: dfs find ends, phase-2: dfs lengths from ends. now checking ships and roads.
    def calc_road_length(self): #, x=None, y=None):
        marked = [[0 for x in range(self.edge_dim_x)] for y in range(self.edge_dim_y)]
        ends = set()

        def is_mine(x,y,idx):
            return self.edges[y][x] is not None and self.edges[y][x]['owner_index'] == idx
        def obstacle(x,y,idx): # someone elses town is in the way
            return self.edges[y][x] is not None and self.edges[y][x]['owner_index'] != idx
        def is_connected(c,e1,e2): # check that a ship and a road have a town between them
            if self.edges[e1[1]][e1[0]] is None or self.edges[e2[1]][e2[0]] is None: return False
            return is_mine(c[0],c[1],idx) or self.edges[e1[1]][e1[0]]['structure'] == self.edges[e2[1]][e2[0]]['structure']

        def dfs_ends(x,y,idx):
            marked[y][x] = 1
            result = set()

            for cx,cy in self.edge_adj_edges(x,y):
                if obstacle(cx,cy,idx):
                    result |= {(cx,cy,idx)}
                else:
                    branches = [ (ex,ey) for ex,ey in self.edge_adj_edges(cx,cy) if is_mine(ex,ey,idx) ]
                    if len(branches) in [1,3] or not is_connected((cx,cy), branches[0], branches[1]):
                        result |= {(cx,cy,idx)}
                    for ex,ey in branches:
                        if marked[ey][ex] == 0:
                            result |= dfs_ends(ex,ey,idx)

            return result

        def dfs_length(x,y,idx,avoid=None):
            if marked[y][x] == 2 or not is_mine(x,y,idx):
                return 0

            marked[y][x] = 2
            length = 1

            for cx,cy in self.edge_adj_edges(x,y):
                if avoid != (cx,cy) and marked[cy][cx] != 2 and not obstacle(cx,cy,idx):
                    marked[cy][cx] = 2
                    length += max([dfs_length(ex,ey,idx) for ex,ey in self.edge_adj_edges(cx,cy) if is_connected((cx,cy),(x,y),(ex,ey))]+[0])
                    marked[cy][cx] = 1

            marked[y][x] = 1
            return length

        # re-evaluate for all players
        for player in self.players:
            player.road_max = 0

        for ey in range(self.edge_dim_y):
            for ex in range(self.edge_dim_x):
                edge = self.edges[ey][ex]
                if not self.is_crossing(ex,ey) and edge is not None and marked[ey][ex] == 0:
                    idx = edge['owner_index']
                    result = dfs_ends(ex,ey,idx) # search for endings
                    cx,cy = self.edge_adj_edges(ex,ey)[0]
                    ends |= {(cx,cy,idx)} if len(result) == 0 else result

        for cx,cy,idx in ends:
            for ex,ey in self.edge_adj_edges(cx,cy):
                owner = self.players[idx]
                owner.road_max = max(owner.road_max, dfs_length(ex,ey,idx,(cx,cy)))

        return max([p.road_max for p in self.players])
