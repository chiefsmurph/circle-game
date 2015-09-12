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

var rooms = {};

var newRoom = function(roomName) {

  rooms[roomName] = {};
  rooms[roomName].numPlayers = 0;
  rooms[roomName].curPlayerId = 0;
  rooms[roomName].inGame = false;
  rooms[roomName].finishedCalc = 0;
  rooms[roomName].waitingCount = 0;

  rooms[roomName].checkAndStart = function() {

    if (rooms[roomName].numPlayers > 1) {
      setTimeout(function() {
        io.sockets.in(roomName).emit('startGame');
        rooms[roomName].inGame = true;
        rooms[roomName].waitingCount = 0;
      }, 1000);
      console.log('start game num: ' + rooms[roomName].numPlayers);

    } else {
      console.log('only ' + rooms[roomName].numPlayers + ' are here currently');
    }

  };

}

var currentUserId = 0;
var playerIdToRoom = {};

var possibleColors = ['orange', 'green', 'blue', 'red'];


io.sockets.on('connection', function (socket) {

  var myUserId = currentUserId;
  var myRoom = 'public';

  currentUserId++;

  socket.on('disconnect', function() {
    console.log(myUserId + ' ' + myRoom + ' disconnected');
    if (rooms[myRoom]) {
      rooms[myRoom].numPlayers--;

      if (rooms[myRoom].numPlayers === 1) {
        rooms[myRoom].inGame = false;
        io.sockets.in(myRoom).emit('loner');
      }
    }


  });

  socket.on('joinRoom', function(data) {

    myRoom = data.room;

    playerIdToRoom[myUserId] = myRoom;
    socket.join(myRoom);

    console.log('user number ' + myUserId + ' joining room "' + myRoom + '"');

    if (!rooms[myRoom]) {
      newRoom(myRoom);
    }

    rooms[myRoom].numPlayers++;
    rooms[myRoom].curPlayerId++;
    socket.emit('setColor', {color: possibleColors[ rooms[myRoom].curPlayerId % possibleColors.length ]});

    if (rooms[myRoom].inGame) {
      rooms[myRoom].waitingCount++;
    } else {

      // CHECK AND IF MORE THAN ONE PERSON HERE START A GAME
      rooms[myRoom].checkAndStart();

    }


  });

  socket.on('finishedCalc', function() {
    console.log('user finishedcalc');
    rooms[myRoom].finishedCalc++;
    if (rooms[myRoom].numPlayers === rooms[myRoom].finishedCalc + rooms[myRoom].waitingCount) {
      console.log('game over and all users finishedcalc');
      rooms[myRoom].finishedCalc = 0;
      setTimeout(function() {

        rooms[myRoom].checkAndStart();

      }, 5000); // wait 5 sec before starting new game
    }
  });


  socket.on('addCircle', function(circle) {
    console.log('circle: ' +  JSON.stringify(circle) + ' goes to ' + myRoom);
    io.sockets.in(myRoom).emit('newCircle', {x: circle.x, y: circle.y, rad: circle.rad, col: circle.col});
  });

});
