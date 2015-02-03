var util = require('util');
var fs = require('fs');

var TileJSON = require('tilejson');
var Canvas = require('canvas')

function padNumber(digits, number) {
    return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
};

var mapname = null;
new TileJSON('tilejson://./' + process.argv[2], function(err, source) {
    if (err) {
        console.log("could not load map: " + err);
        return;
    }

    // used for el-cheapo cb synchronization. if sync.length === guess(x*y),
    // then all callbacks have succeeded and we can try writing the file.
    // sync.slice(-1)[0] will then contain the max_x and max_y coordinate.
    var sync = [[0, 0]];

    mapname = source.data.basename;
    var guess_max_x = 100, guess_max_y = 100;
    for (var x = 0; x < guess_max_x; x++)
        for (var y = 0; y < guess_max_y; y++)
            getTile(x, y);

    function getTile(x, y) {
        source.getTile(source.data.maxzoom, x, y, function(err, data, headers) {
            var last = sync.slice(-1)[0];
            if (err)
                sync.push(last);
            else if (x > last[0] || y > last[1])
                sync.push([x, y]);
            else
                sync.push(last);

            if (err) {
                if (sync.length === (guess_max_x * guess_max_y))
                    writeMap(sync.slice(-1)[0][0], sync.slice(-1)[0][1]);
                return;
            }

            var fname = mapname + "_" + padNumber(2, x) + "-" + padNumber(2, y) + ".png";
            fs.writeFile(fname, data, function(err) {
                if(err) {
                    console.log("error while saving file: " + err);
                    return;
                }
            }); 

            console.log("got tile " + y + ", " + x);
        });
    }

    function writeMap(max_x, max_y) {
        var canvas = new Canvas(256 * max_x, 256 * max_y)
        var ctx = canvas.getContext('2d');
        console.log("done fetching tiles ["+max_x+","+max_y+"]");
        console.log("assembling final map…");
        for (var x = 0; x < max_x; x++) {
            for (var y = 0; y < max_y; y++) {
                (function(x, y) {
                    var fname = mapname + "_" + padNumber(2, x) + "-" + padNumber(2, y) + ".png";
                    fs.readFile(fname, function(err, f) {
                        var img = new Canvas.Image;
                        img.src = f;
                        ctx.drawImage(img, 256 * x, 256 * y, 256, 256);

                        if (x === max_x-1 && y === max_y-1) {
                            mapname = mapname+"_ALL.png";
                            var out = fs.createWriteStream(mapname)
                            var stream = canvas.pngStream();
                            stream.on('data', function(chunk){
                                out.write(chunk);
                            });
                            stream.on('end', function() {
                                console.log("done, see " + mapname);
                            });
                        }
                    });
                })(x, y);
            }
        }
    }
});
