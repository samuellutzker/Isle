# main server script. run this.

import json
import asyncio
import websockets
import ssl
from room import User, Room
from tools import log, GameError

local_ws = True

async def handler(socket):

    async def error(msg):
        await socket.send(json.dumps({ 'alert' : str(msg) }))

    while True:

        try:
            data = await socket.recv()
            query = json.loads(data)
            act = query.pop('do')

        except websockets.exceptions.ConnectionClosed as e:
            log('Connection lost:', e)
            user = User.find(socket)
            if user is not None:
                user.alive = False
                await user.remove()
            return

        except GameError as e:
            log('Bad request by client.', 'Received:', data, 'Error:', e)
            continue

        if act == 'enter':
            if 'room' not in query or 'name' not in query:
                continue

            room_name = query['room']
            user_name = query['name']
            key = query.get('key')

            # new room / open existing room
            room = Room.open(room_name)
            user = User(socket, user_name)

            try:
                await room.enter(user, key)

            except GameError as e:
                await error(e)
                await user.remove()
                room.store_abandoned_game()

        else:
            user = User.find(socket)
            if user is None:
                if act != 'exit':
                    await error('Not logged in.')
                continue

            try:
                if act == 'exit':
                    await user.remove()

                elif act == 'send' and 'msg' in query:
                    await user.message(query.get('to'), **query['msg'])

                elif act == 'move' and 'x' in query and 'y' in query:
                    x, y = (query['x'], query['y']) if user.room.game is None or user.room.is_editor else (user.x, user.y)
                    await user.move(x, y)

                elif act == 'status' and 'msg' in query:
                    await user.status(query['msg'])

                elif act == 'new_game':
                    await user.room.new_game(user, query.get('scenario'), query.get('debug'))

                elif act == 'new_editor':
                    await user.room.new_editor(user, query.get('scenario'))

                elif act == 'delete_scenario' and 'scenario' in query:
                    await user.room.delete_scenario(query['scenario'])

                elif act == 'set_key':
                    await user.room.game_key(user, query.get('key'))

                elif act == 'quit_game':
                    await user.room.quit_game()

                elif (act == 'game' and not user.room.is_editor or act == 'editor' and user.room.is_editor) and 'what' in query:
                    await user.game_action(query['what']) # object containing the move

                else:
                    log(f'Received illegal query: {data}')

            except GameError as e:
                await error(e)

async def main():
    if local_ws:
        # WS:
        start_server = websockets.serve(handler, "0.0.0.0", 8080)
    else:
        # WSS:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain('server/cert/fullchain.pem', 'server/cert/privkey.pem')
        start_server = websockets.serve(handler, "0.0.0.0", 8765, ssl=ctx)

    async with start_server:
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
