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
  rooms[roomName].numPlayers = 0;       // realtime count of number of players
  rooms[roomName].curPlayingQueue = [];  // queue of current players (contains id's)
  rooms[roomName].curPlayerId = 0;      // increments for each player that joins the room
  rooms[roomName].inGame = false;       // is there an active game going on in this room?
  rooms[roomName].finishedCalc = 0;     // number of players that have calculated and sent in the RGBcount for the current game
  rooms[roomName].waitingCount = 0;     // number of people waiting to play
  rooms[roomName].RGBCounts = {};       // object to hold rgb data for each user
  rooms[roomName].timerToStart = null;  // timer before new game (adds 5sec for each join)

  rooms[roomName].checkAndStart = function() {

    if (rooms[roomName].numPlayers > 1) {

      io.sockets.in(roomName).emit('startGame');

      rooms[roomName].inGame = true;
      rooms[roomName].finishedCalc = 0;
      rooms[roomName].waitingCount = 0;
      rooms[roomName].RGBCounts = {};
      rooms[roomName].timerToStart = null;

      console.log('start game num: ' + rooms[roomName].numPlayers);

    } else {
      console.log('only ' + rooms[roomName].numPlayers + ' are here currently');
    }

  };

  rooms[roomName].waitFiveThenCheckAndStart = function(t) {

    if (rooms[roomName].timerToStart) {
      clearTimeout(rooms[roomName].timerToStart);
      rooms[roomName].timerToStart = null;
    }
    rooms[roomName].timerToStart = setTimeout( function() {

        rooms[roomName].checkAndStart();

    }, t || 5000);

  };

  rooms[roomName].hasAllRGBCounts = function() {

    var hasAllOfThem = true;
    for (var i = 0; i < rooms[roomName].curPlayingQueue.length; i++) {
      if ( !rooms[roomName].RGBCounts.hasOwnProperty(rooms[roomName].curPlayingQueue[i]) ) {
        hasAllOfThem = false;
      }
    }
    return hasAllOfThem;

  };

}

var currentUserId = 0;
var possibleColors = ['orange', 'green', 'blue', 'red'];
var roomSettings = {
  'beginner': {
    maxClickerSize: 180,
    clickerSpeed: 12
  },
  'intermediate': {
    maxClickerSize: 110,
    clickerSpeed: 5
  },
  'advanced': {
    maxClickerSize: 60,
    clickerSpeed: 3
  }
};

io.sockets.on('connection', function (socket) {

  var myUserId = currentUserId;
  var myRoom = 'public';

  currentUserId++;

  socket.on('disconnect', function() {
    console.log(myUserId + ' ' + myRoom + ' disconnected');
    if (rooms[myRoom]) {
      rooms[myRoom].numPlayers--;
      rooms[myRoom].curPlayingQueue.splice(rooms[myRoom].curPlayingQueue.indexOf(myUserId), 1);    // remove current user from their room

      io.sockets.in(myRoom).emit('playerCount', {count: rooms[myRoom].numPlayers});
      if (rooms[myRoom].numPlayers === 1) {
        rooms[myRoom].inGame = false;
        rooms[myRoom].finishedCalc = 0;
        rooms[myRoom].waitingCount = 0;
        rooms[myRoom].RGBCounts = {};
        rooms[myRoom].timerToStart = null;
      }
    }


  });

  socket.on('addToRound', function(data) {

    rooms[myRoom].curPlayingQueue.push(myUserId);

  });

  socket.on('joinRoom', function(data) {

    myRoom = data.room;
    socket.join(myRoom);

    console.log('user number ' + myUserId + ' joining room "' + myRoom + '"');

    if (!rooms[myRoom]) {
      newRoom(myRoom);
    }

    rooms[myRoom].numPlayers++;
    rooms[myRoom].curPlayerId++;

    socket.emit('setColor', {color: possibleColors[ rooms[myRoom].curPlayerId % possibleColors.length ]});
    io.sockets.in(myRoom).emit('playerCount', {count: rooms[myRoom].numPlayers});

    if (roomSettings.hasOwnProperty(myRoom)) {
      console.log('setSettings: ' + JSON.stringify(roomSettings[myRoom]) + ' in ' + myRoom);
      io.sockets.in(myRoom).emit('setSettings', roomSettings[myRoom]);
    }

    if (rooms[myRoom].inGame) {
      rooms[myRoom].waitingCount++;
    } else {
      // CHECK AND IF MORE THAN ONE PERSON HERE START A GAME
      rooms[myRoom].waitFiveThenCheckAndStart();
    }


  });

  socket.on('finishedCalc', function(data) {

    console.log('user finishedcalc');
    rooms[myRoom].finishedCalc++;
    rooms[myRoom].RGBCounts[myUserId] = data.pixelData;

    if (rooms[myRoom].hasAllRGBCounts()) {

      console.log('rooms my room rgbcounts: ' + JSON.stringify(rooms[myRoom].RGBCounts));

      // compute the winning rgb
      var avgRGBCounts = {};
      for (var userId in rooms[myRoom].RGBCounts) {

        for (var rgb in rooms[myRoom].RGBCounts[userId]) {
          console.log('rgb ' + rgb);
          // first sum them all up for each of the colors
          var curRGB = rooms[myRoom].RGBCounts[userId].rgb;
          console.log('user id ' + userId + ' rgb ' + rgb + ' val ' + rooms[myRoom].RGBCounts[userId][rgb]);
          avgRGBCounts[rgb] = (avgRGBCounts[rgb]) ? avgRGBCounts[rgb] + rooms[myRoom].RGBCounts[userId][rgb] : rooms[myRoom].RGBCounts[userId][rgb];
        }
      }

      console.log('sum-avgRGBcounts1: ' + JSON.stringify(avgRGBCounts));

      for (var rgb in avgRGBCounts) {

        // and here we divide by the number of players in the current game
        avgRGBCounts[rgb] = avgRGBCounts[rgb] / Object.keys(rooms[myRoom].RGBCounts).length;

      }

      console.log('avgRGBcounts2: ' + JSON.stringify(avgRGBCounts));

      // now that we have the average rgb data
      // figure out the top score

      // new way of determining top score
      var sortableScores = [];
      for (var color in avgRGBCounts) {
            sortableScores.push([color, avgRGBCounts[color]]);
      }
      sortableScores.sort(function(a, b) {return b[1] - a[1]});
      console.log('sortablescores ' + JSON.stringify(sortableScores));
      var winBy = Math.round((sortableScores[0][1] - sortableScores[1][1]) / 10);

      // old way of determining top score

      // var topScore = 0;
      // var topColor;
      // for (var color in avgRGBCounts) {
      //   if (avgRGBCounts[color] > topScore) {
      //     topScore = avgRGBCounts[color];
      //     topColor = color;
      //   }
      // }

      io.sockets.in(myRoom).emit('winner', {
        topColor: (winBy !== 0) ? sortableScores[0][0] : '0,0,0', // tie if tie or nothing on the board
        winBy: winBy
      });

      console.log('game over and all users finishedcalc');
      rooms[myRoom].finishedCalc = 0;
      rooms[myRoom].inGame = false;
      rooms[myRoom].finishedCalc = 0;
      rooms[myRoom].waitingCount = 0;
      rooms[myRoom].RGBCounts = {};
      rooms[myRoom].timerToStart = null;
      rooms[myRoom].curPlayingQueue = [];

      rooms[myRoom].waitFiveThenCheckAndStart(10000);


    };

  });


  socket.on('addCircle', function(circle) {
    console.log('circle: ' +  JSON.stringify(circle) + ' goes to ' + myRoom);
    io.sockets.in(myRoom).emit('newCircle', {x: circle.x, y: circle.y, rad: circle.rad, col: circle.col});
  });

});
