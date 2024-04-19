<!DOCTYPE html>
<html lang="en">
    <head>
        <title>CATAN to go</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <link rel="icon" type="image/x-icon" href="images/favicon.ico">
        <link rel="stylesheet" href="style.css?v=<?php echo filemtime('style.css'); ?>" />
        <link rel="stylesheet" href="siedler.css?v=<?php echo filemtime('siedler.css'); ?>" />
        <link rel="stylesheet" href="editor.css?v=<?php echo filemtime('editor.css'); ?>" />
        <link rel="stylesheet" href="responsive.css?v=<?php echo filemtime('responsive.css'); ?>" />
        <script src="https://webrtc.github.io/adapter/adapter-latest.js"></script>
        <script src="jquery-3.7.1.min.js"></script>
        <script src="gl-matrix-min.js"></script>
        <script src="webgl/light.js"></script>
        <script src="webgl/shader.js"></script>
        <script src="webgl/model.js"></script>
        <script src="modelmaker.js"></script>
        <script src="scene.js"></script>
        <script src="server.js"></script>
        <script src="room.js"></script>
        <script src="tools.js"></script>
        <script src="interface.js"></script>
        <script src="person.js"></script>
        <script src="videoconn.js"></script>
        <script src="editor.js"></script>
        <script src="siedler.js"></script>
        <script type="text/javascript"> 

        const DEBUG_AUTH = "<?php echo $_GET['debug'] ?? ""; ?>";
        const LOCAL_WS = true;

        const WSS_URL = LOCAL_WS ? "ws://localhost:8080" : "wss://lutzker.ddns.net:8765";

        var main;

        const imgPreload = () => {
            imgPreload.cache = [];

            <?php
            function search_images($dir) {
                $images = [];
                if ($handle = opendir($dir)) {
                    while (false !== ($entry = readdir($handle))) {
                        if ($entry != "." && $entry != "..") {
                            $path = $dir."/".$entry;
                            if (is_dir($path)) {
                                $images = array_merge($images, search_images($path));
                            } else {
                                $parts = explode('.', $entry);
                                if (in_array($parts[sizeof($parts)-1], ['jpg', 'jpeg', 'png'])) {
                                    $images[] = $path;
                                }
                            }
                        }
                    }
                    closedir($handle);
                }   
                return $images;
            }

            echo "var fnames = " . json_encode(search_images('images')) . ";";
            ?>

            return new Promise((resolve, reject) => {
                fnames.forEach((f) => {
                    var img = new Image();
                    imgPreload.success = 0;
                    img.onload = () => {
                        if (++imgPreload.success == fnames.length)
                            resolve();
                    };
                    img.onerror = reject;
                    img.src = f;
                    imgPreload.cache.push(img);
                });
            });
        }

        const startup = async () => {
            <?php
                $scenarios = array();
                $handle = opendir('scenarios/');
                while (false !== ($entry = readdir($handle))) {
                    $parts = explode('.', $entry);
                    if ($parts[sizeof($parts)-1] == 'json') {
                        array_pop($parts);
                        $scenarios[] = implode('.', $parts);
                    }
                }
                closedir($handle);

                echo "const scenarios = " . json_encode($scenarios) . ";\n";
            ?>

            Siedler.preload();
            await imgPreload('images');
            await Server.connect(WSS_URL);

            <?php
                function is_proper(...$vars) {
                    foreach ($vars as $var)
                        if (preg_match('/[^a-z_\-0-9]/i', $var))
                            return false;

                    return true;
                }

                if (isset($_GET['user'], $_GET['room'], $_GET['key']) && is_proper($_GET['user'], $_GET['room'], $_GET['key']))
                    echo "main = new Interface(scenarios, '{$_GET['user']}', '{$_GET['room']}', '{$_GET['key']}');";
                else
                    echo "main = new Interface(scenarios);";
            ?>
        };

        </script>
    </head>
    <body onload="startup()">

        <div id="main">

            <span id="logo">
                CATAN<br />to go
            </span>

            <div id="login" class="window" title="CATAN to go">
                <div>
                    To play, enter a room:<br />
                    <form id="form_enter">
                        <input type="text" placeholder="My name" id="input_name_user" /><br />
                        <input type="text" placeholder="Room name" id="input_name_room" /><br />
                        <br />
                        <input type="submit" class="default" value="Enter" />
                    </form>
                </div>
            </div>

            <div id="controls">
                <input type="checkbox" id="checkbox_controls" />
                <label for="checkbox_controls">&equiv;</label>
                <div id="room" class="window">
                    <input type="button" value="Play" id="btn_game" />
                    <input type="button" value="Info" id="btn_about" />
                    <input type="button" value="Exit" id="btn_exit" />
                    <br />
                    <span class='custom-label'>Fullscreen</span>
                    <input type="checkbox" id="checkbox_fullscreen" />
                    <label for="checkbox_fullscreen"></label>
                    <span class='custom-label'>Sounds</span>
                    <input type="checkbox" id="checkbox_sounds" checked />
                    <label for="checkbox_sounds"></label>
                    <span class='custom-label'>Videochat</span>
                    <input type="checkbox" id="checkbox_video" />
                    <label for="checkbox_video"></label>
                    <form id="form_chat">
                        <input type="text" placeholder="Chat" id="input_chat" />
                        <input type="submit" value="OK" />
                    </form>
                </div>
            </div>


            <div id="point_action"></div>

            <div id="message"></div>

            <div id="info">
                <div class="structure" id="village">
                    <h2>Village</h2>
                    <svg viewBox='0 0 20 20'>
                        <polygon fill='red' stroke='black' points='10,5 5,10 5,18 15,18 15,10' />
                    </svg>
                    <div class='price'>
                        <div class='icon lumber'></div><div class='icon brick'></div><div class='icon wool'></div><div class='icon grain'></div>
                    </div>
                </div>
                <div class="structure" id="city">
                    <h2>City</h2>
                    <svg viewBox='0 0 20 20'>
                        <polygon fill='red' stroke='black' points='7,3 4,7 4,18 17,18 17,12 10,12 10,7' />
                    </svg>
                    <div class='price'>
                        <div class='icon ore'></div><div class='icon ore'></div><div class='icon ore'></div>
                        <div class='icon grain'></div><div class='icon grain'></div>
                    </div>
                </div>
                <div class="structure" id="road">
                    <h2>Road</h2>
                    <svg viewBox='0 0 20 20'>
                        <polygon fill='red' stroke='black' points='5,3 2,5 15,18 18,15' />
                    </svg>
                    <div class='price'>
                        <div class='icon lumber'></div><div class='icon brick'></div>
                    </div>
                </div>
                <div class="structure" id="ship">
                    <h2>Ship</h2>
                    <svg viewBox='0 0 20 20'>
                        <polygon fill='red' stroke='black' points='2,15 9,15 9,3 16,13 11,13 11,15 18,15 15,18 5,18 ' />
                    </svg>
                    <div class='price'>
                        <div class='icon lumber'></div><div class='icon wool'></div>
                    </div>
                </div>
                <div class="structure" id="card">
                    <h2>Development</h2>
                    <svg viewBox='0 0 20 20'>
                        <rect fill='red' height='16' width='10' stroke='black' x='4' y='2' rx='2' ry='2' />
                    </svg>
                    <div class='price'>
                        <div class='icon wool'></div><div class='icon grain'></div><div class='icon ore'></div>
                    </div>
                </div>
                <div class="structure" id="move_ship">
                    <h2>Move Ship</h2>
                    <svg viewBox='0 0 20 20'>
                        <polygon fill='green' stroke='black' points='2,15 9,15 9,3 16,13 11,13 11,15 18,15 15,18 5,18 ' />
                    </svg>
                </div>
            </div>

        </div> <!-- main -->

    </body>
</html>