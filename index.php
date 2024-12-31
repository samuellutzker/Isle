<!DOCTYPE html>
<html lang="en">
    <head>
        <?php
            // Retrieve all file names with extensions from folder $dir and subfolders
            function folder_walk($dir, ...$extensions) {
                $files = [];
                if ($handle = opendir($dir)) {
                    while (false !== ($entry = readdir($handle))) {
                        if ($entry != "." && $entry != "..") {
                            $path = $dir."/".$entry;
                            if (is_dir($path)) {
                                // Recursive search
                                $files = array_merge($files, folder_walk($path, ...$extensions));
                            } else {
                                $parts = explode('.', $entry);
                                if (in_array($parts[sizeof($parts)-1], $extensions)) {
                                    $files[] = $path;
                                }
                            }
                        }
                    }
                    closedir($handle);
                }
                return $files;
            }

            // Remove path and file extension from all file names in array
            function get_file_roots($fnames) {
                return array_map(fn($name) => preg_replace('/(.*\/|\.[^.]+$)/', '', $name), $fnames);
            }

            // Check if $_GET arguments are acceptable
            function is_proper(...$vars) {
                foreach ($vars as $var)
                    if (preg_match('/[^a-z_\-0-9]/i', $var))
                        return false;

                return true;
            }
        ?>

        <title>CATAN to go</title>

        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">

        <link rel="icon" type="image/x-icon" href="images/favicon.ico">
        <link rel="stylesheet" href="css/style.css?v=<?php echo filemtime('css/style.css'); ?>" />
        <link rel="stylesheet" href="css/siedler.css?v=<?php echo filemtime('css/siedler.css'); ?>" />
        <link rel="stylesheet" href="css/editor.css?v=<?php echo filemtime('css/editor.css'); ?>" />
        <link rel="stylesheet" href="css/responsive.css?v=<?php echo filemtime('css/responsive.css'); ?>" />
        <?php
            $fonts = folder_walk('fonts', 'ttf');

            foreach ($fonts as $font) {
                echo "\n\t\t<link rel=\"preload\" href=\"$font\" as=\"font\" type=\"font/ttf\" crossorigin>";
            }
        ?>


        <script src="https://webrtc.github.io/adapter/adapter-latest.js"></script>
        <script src="js/lib/jquery-3.7.1.min.js"></script>
        <script src="js/lib/gl-matrix-min.js"></script>
        <script src="js/webgl/light.js"></script>
        <script src="js/webgl/shader.js"></script>
        <script src="js/webgl/model.js"></script>
        <script src="js/modelmaker.js"></script>
        <script src="js/scene.js"></script>
        <script src="js/server.js"></script>
        <script src="js/room.js"></script>
        <script src="js/tools.js"></script>
        <script src="js/interface.js"></script>
        <script src="js/person.js"></script>
        <script src="js/videoconn.js"></script>
        <script src="js/editor.js"></script>
        <script src="js/siedler.js"></script>
        <script type="text/javascript">

        const DEBUG_AUTH = "<?php echo $_GET['debug'] ?? ""; ?>";
        const LOCAL_WS = true;

        var main;

        const imgPreload = (fnames) => {
            imgPreload.cache = [];

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
            const WSS_URL = LOCAL_WS ? `ws://${window.location.hostname}:8080` : `wss://${window.location.hostname}:8765`;

            const allImages = <?php echo json_encode(folder_walk('images', 'jpg', 'jpeg', 'png', 'gif')); ?>;
            const audios = <?php echo json_encode(get_file_roots(folder_walk('sounds', 'mp3'))); ?>;
            const scenarios = <?php echo json_encode(get_file_roots(folder_walk('scenarios', 'json'))); ?>;

            Siedler.audioPreload(audios);
            await imgPreload(allImages);
            await Server.connect(WSS_URL);

            <?php
                if (isset($_GET['user'], $_GET['room'], $_GET['key']) && is_proper($_GET['user'], $_GET['room'], $_GET['key']))
                    echo "main = new Interface(scenarios, '{$_GET['user']}', '{$_GET['room']}', '{$_GET['key']}');\n";
                else
                    echo "main = new Interface(scenarios);\n";
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
                    <input type="button" value="Start" id="btn_game" />
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