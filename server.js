var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var port = process.env.PORT || 5000; // Use the port that Heroku
server.listen(port);

console.log('listening for http and socket requests on port ' + port);

var bodyParser = require('body-parser')
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())


app.use(express.static(__dirname + '/public'));


var numPlayers = 0;
var possibleColors = ['orange', 'green', 'blue', 'red'];
var count = 50;

io.sockets.on('connection', function (socket) {

  socket.on('disconnect', function() {
    console.log('user left');
    numPlayers--;
  })

  numPlayers++;
  socket.emit('setColor', {color: possibleColors[ numPlayers % possibleColors.length ]});
  if (numPlayers > 1) {
    io.sockets.emit('startGame');
    console.log('start game')
  } else {
    console.log('only ' + numPlayers + ' are here currently');
  }
  socket.on('addCircle', function(circle) {
    console.log('circle: ' +  JSON.stringify(circle));
    io.sockets.emit('newCircle', {x: circle.x, y: circle.y, rad: circle.rad, col: circle.col});
  });

  setTimeout(function() {
        count = 50;
        console.log('sending status ' + count);
    io.sockets.emit('newCircle', { x: count, y: count, rad: 30 }); // note the use of io.sockets to emit but socket.on to listen
  }, 2000);

  setTimeout(function() {
    count = 100;
    io.sockets.emit('newCircle', { x: count, y: count, rad: 60 }); // note the use of io.sockets to emit but socket.on to listen
    console.log('sending status ' + count);
  }, 5000);

});

io.sockets.on('addCircle', function(socket) {

});
