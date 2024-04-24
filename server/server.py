# main server script. run this.

import json
import asyncio
import websockets
import ssl
from room import User, Room
from siedler import GameError

local_ws = True


async def handler(socket, path):

    async def error(msg):
        await socket.send(json.dumps({ 'alert' : str(msg) }))

    while True:

        try:
            data = await socket.recv()
            query = json.loads(data)
            act = query.pop('do')

        except websockets.exceptions.ConnectionClosed as e:
            print('Connection lost.', 'Message:', e)
            user = User.find(socket)
            if user is not None:
                user.alive = False
                await user.remove()
            return

        except GameError as e:
            print('Bad request by client.', 'Received:', data, 'Error:', e)
            continue

        if act == 'enter':
            if not 'room' in query or not 'name' in query:
                continue
                
            room_name = query['room']
            user_name = query['name']
            key = query['key'] if 'key' in query else None

            # new room / open existing room
            room = Room.open(room_name)
            user = User(socket, user_name)

            try:
                await room.enter(user, key)

            except GameError as e:
                await error(e)
                await user.remove()

        else:
            try:
                user = User.find(socket)
                if user is None:
                    if act != 'exit':
                        await error('Not logged in.')

                elif act == 'exit':
                    await user.remove()

                elif act == 'send' and 'msg' in query:
                    to = query['to'] if 'to' in query else None
                    await user.message(to, **query['msg'])

                elif act == 'move' and 'x' in query and 'y' in query:
                    x, y = (query['x'], query['y']) if user.room.game is None else (user.x, user.y)
                    await user.move(x, y)

                elif act == 'status' and 'msg' in query:
                    await user.status(query['msg'])

                elif act == 'new_game':
                    await user.room.new_game(user, query['scenario'], query['debug'])

                elif act == 'new_editor':
                    await user.room.new_editor(user, query['scenario'] if 'scenario' in query else None)

                elif act == 'delete_scenario':
                    await user.room.delete_scenario(query['scenario'])

                elif act == 'quit_game':
                    await user.room.quit_game()

                elif act == 'game' and 'what' in query:
                    await user.game_action(query['what']) # object containing the move

                elif act == 'editor' and 'what' in query:
                    await room.editor_action(query['what'])
                    
            except GameError as e:
                print(f'Could not execute {act}. Error:', e)


if local_ws:
    # WS:
    start_server = websockets.serve(handler, "localhost", 8080)
else:
    # WSS (Raspi):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain('server/cert/fullchain.pem', 'server/cert/privkey.pem')
    start_server = websockets.serve(handler, "0.0.0.0", 8765, ssl=ctx)


asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
