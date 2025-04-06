# ISLE to go

Thanks for stopping by!

This is a fan-made, web-based game inspired by a well-known board game involving resource trading, settlement building, and exploration at sea. It was developed in 2023/24 for private, non-commercial use only, primarily as a project to experiment with WebGL, WebRTC, and WebSockets – and out of great appreciation for the original.
If you enjoy this kind of game, please consider supporting the official version by purchasing the real board game!

# Use

To host a game server with secure WebSocket, you will need to create a keychain, for example using **Let's Encrypt**. Then you need to put the files `cert.pem`, `chain.pem`, `fullchain.pem` and `privkey.pem` into `server/cert/`. It is advisable to move the `server/` directory to another place outside of the base directory. You can then use your regular web server, which needs to be configured to support PHP, to host the contents of the base directory. Via `python3 server.py` in your `server/` directory you may start the WebSocket game server. You might need to install some dependencies such as the asyncio and websocket libraries.

If you want to run a LAN game, WSS might not work, in which case you can switch to unsecure WS by changing `local_ws = False` to `True` in `server/server.py` and `const LOCAL_WS = false` to `true` in `index.php`.

Enjoy! Sam

![isle-screenshot](https://github.com/user-attachments/assets/1591d077-9792-4c5e-8f0e-bbd6931564d0)
