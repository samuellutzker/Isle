# ISLE to go

Thanks for stopping by!

This web-based adaptation of the base game and Seafarers extension of Catan by Klaus Teuber was developed in 2023/24, for private, non-commercial use only.
The main purpose of making yet another implementation of this game was dabbling around with WebGL, WebRTC, WebSocket and a big appreciation of the game.
If you like it, buy the board game!

# Use

To host a game server with secure WebSocket, you will need to create a keychain, for example using **Let's Encrypt**. Then you need to put the files `cert.pem`, `chain.pem`, `fullchain.pem` and `privkey.pem` into `server/cert/`. It is advisable to move the `server/` directory to another place outside of the base directory. You can then use your regular web server, which needs to be configured to support PHP, to host the contents of the base directory. Via `python3 server.py` in your `server/` directory you may start the WebSocket game server. You might need to install some dependencies such as the asyncio and websocket libraries.

If you want to run a LAN game, WSS might not work, in which case you can switch to unsecure WS by changing `local_ws = False` to `True` in `server/server.py` and `const LOCAL_WS = false` to `true` in `index.php`.

Enjoy! Sam

![isle-screenshot](https://github.com/user-attachments/assets/1591d077-9792-4c5e-8f0e-bbd6931564d0)
