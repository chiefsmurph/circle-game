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

// CONFIG

var currentUserId = 0;
var lobbyCount = 0;
//var possibleColors = ['orange', 'green', 'blue', 'red', 'yellow', 'purple', 'tomato', 'tan', 'silver', 'salmon', 'slateblue', 'saddlebrown', 'plum', 'PaleVioletRed', 'Navy', 'OliveDrab'];
var possibleColors = ['orange', 'green', 'blue', 'red', 'yellow', 'purple'];
var roomSettings = {
  'beginner': {
    maxClickerSize: 180,
    clickerSpeed: 12,
    maxPeople: 4
  },
  'intermediate': {
    maxClickerSize: 110,
    clickerSpeed: 5,
    maxPeople: 4
  },
  'advanced': {
    maxClickerSize: 60,
    clickerSpeed: 3,
    maxPeople: 4
  }
};

// WHATS A ROOM?

var rooms = {};

var newRoom = function(roomName) {

  rooms[roomName] = {};
  rooms[roomName].numPlayers = 0;               // realtime count of number of players
  rooms[roomName].curPlayingQueue = [];         // queue of userId's of people in current game
  rooms[roomName].inGame = false;               // is there an active game going on in this room?
  rooms[roomName].finishedCalc = 0;             // number of players that have calculated and sent in the RGBcount for the current game
  rooms[roomName].numWaitingForNewGame = 0;     // number of people waiting for new game to start
  rooms[roomName].waitingForSpaceQueue = [];    // queue of userId's of people waiting for space in the room ('watch mode')
  rooms[roomName].RGBCounts = {};               // object to hold rgb data for each user
  rooms[roomName].timerToStart = null;          // timer before new game (adds 5sec for each join)
  rooms[roomName].maxPeople = (function() {
    if (roomSettings.hasOwnProperty(roomName)) {
      return roomSettings[roomName].maxPeople
    } else {
      return 4; // custom rooms default
    }
  })();

  // color -> userId
  rooms[roomName].colorBank = {};
  rooms[roomName].socketBank = {};       // userId -> Socket


  // HELPER FUNCTIONS

  rooms[roomName].sendAll = function(event, obj) {   // void

    io.sockets.in(roomName).emit(event, obj);

  };

  rooms[roomName].checkAndStart = function() {  // void

    if (rooms[roomName].numPlayers > 1) {

      io.sockets.in(roomName).emit('startGame');

      rooms[roomName].inGame = true;
      rooms[roomName].finishedCalc = 0;
      rooms[roomName].numWaitingForNewGame = 0;
      rooms[roomName].RGBCounts = {};
      rooms[roomName].timerToStart = null;

      console.log('start game num: ' + rooms[roomName].numPlayers);

    } else {
      console.log('only ' + rooms[roomName].numPlayers + ' are here currently');
    }

  };

  rooms[roomName].waitFiveThenCheckAndStart = function(t) {   // void

    if (rooms[roomName].timerToStart) {
      clearTimeout(rooms[roomName].timerToStart);
      rooms[roomName].timerToStart = null;
    }
    rooms[roomName].timerToStart = setTimeout( function() {

        rooms[roomName].checkAndStart();

    }, t || 5000);

  };

  rooms[roomName].hasAllRGBCounts = function() {    // boolean

    var hasAllOfThem = true;
    for (var i = 0; i < rooms[roomName].curPlayingQueue.length; i++) {
      if ( !rooms[roomName].RGBCounts.hasOwnProperty(rooms[roomName].curPlayingQueue[i]) ) {
        hasAllOfThem = false;
      }
    }
    return hasAllOfThem;

  };

  // more important room methods

  rooms[roomName].setupNewUser = function(id, sock) {

    var col = rooms[roomName].getUnusedColorName();
    console.log('col ' + col);
    rooms[roomName].numPlayers++;
    rooms[roomName].colorBank[id] = col;
    rooms[roomName].socketBank[id] = sock;

    sock.emit('setColor', {color: col});

    if (!col) {
      console.log('adding ' + id + ' to queue');
      rooms[roomName].waitingForSpaceQueue.push(id);
    }

    rooms[roomName].sendAll('playerCount', {
      count: rooms[roomName].numPlayers,
      max: rooms[roomName].maxPeople
    });
    updateLobbyTotals();

  };

  rooms[roomName].userLeaving = function(id) {
    rooms[roomName].numPlayers--;
    rooms[roomName].curPlayingQueue.splice(rooms[roomName].curPlayingQueue.indexOf(id), 1);     // remove user from the room queue

    // remove user from socketBank
    rooms[roomName].socketBank[id] = null;
    delete rooms[roomName].socketBank[id];
    // remove user from colorBand
    rooms[roomName].colorBank[id] = null;
    delete rooms[roomName].colorBank[id];

    rooms[roomName].sendAll('playerCount', {
      count: rooms[roomName].numPlayers,
      max: rooms[roomName].maxPeople
    });
    updateLobbyTotals();

    if (rooms[roomName].numPlayers < 2) {
      // stop game if only one person in room
      rooms[roomName].inGame = false;
      rooms[roomName].finishedCalc = 0;
      rooms[roomName].numWaitingForNewGame = 0;
      rooms[roomName].RGBCounts = {};
      clearTimeout(rooms[roomName].timerToStart);
      rooms[roomName].timerToStart = null;
    }

  };

  rooms[roomName].getUnusedColorName = function() {

    if (rooms[roomName].numPlayers < rooms[roomName].maxPeople) {

        var allColors = possibleColors.slice(0);
        console.log('allcols' + allColors + ' and ' + possibleColors);
        var takenColors = new Array;
        for (var col in rooms[roomName].colorBank) {
          takenColors.push(rooms[roomName].colorBank[col]);
        }
        console.log('takencols' + JSON.stringify(takenColors));
        var remainingColors = allColors.filter(function(i) {
          return takenColors.indexOf(i) < 0;
        });
        console.log('remainingColors ' + remainingColors);
        if (remainingColors.length) {
          return remainingColors[ Math.floor( Math.random() * remainingColors.length ) ];
        }
        return null;    // only would occur if maxPeople > possibleColors / unlikely

    } else {

        // reached room size limit
        return null;

    }

  };

}

// ONE global HELPER function
var updateLobbyTotals = function() {

  var getRoomCount = function(rname) {
      return (rooms[rname]) ? rooms[rname].numPlayers : 0;
  };

  io.sockets.in('lobby').emit('roomTotals', {

    beginnerCount: getRoomCount('beginner'),
    intermediateCount: getRoomCount('intermediate'),
    advancedCount: getRoomCount('advanced'),
    totalBattlers: ['beginner', 'intermediate', 'advanced'].reduce(function(total, rname) {
      return total + getRoomCount(rname);
    }, 0) + lobbyCount

  });

};


// SOCKET STUFF


io.sockets.on('connection', function (socket) {

  var myUserId = currentUserId;
  var myRoom = null;

  currentUserId++;

  var passColorOff = function() {   // void

    if (rooms[myRoom] && rooms[myRoom].colorBank[myUserId] && rooms[myRoom].waitingForSpaceQueue.length > 0) {
      // person in front of the queue gets the person leaving's old color
      var passed = false;
      while (!passed) {
        var firstInLine = rooms[myRoom].waitingForSpaceQueue.shift(); // id of first in line
        console.log('giving color ' + rooms[myRoom].colorBank[myUserId] + ' to user ' + firstInLine);
        if (rooms[myRoom].socketBank[ firstInLine ]) {
          rooms[myRoom].socketBank[ firstInLine ].emit('setColor', {color: rooms[myRoom].colorBank[myUserId] });
          rooms[myRoom].colorBank[ firstInLine ] = rooms[myRoom].colorBank[myUserId];
          passed = true
        }
        if (rooms[myRoom].waitingForSpaceQueue.length > 0 && rooms[myRoom].waitingForSpaceQueue[0]) passed = true;
      }
    } else {
      console.log('couldnt pass color off ' + myUserId + ' ' + myRoom + ' ' + rooms[myRoom].colorBank[myUserId] + ' and ' + rooms[myRoom].waitingForSpaceQueue);
    }

  };

  socket.on('disconnect', function() {
    console.log(myUserId + ' ' + myRoom + ' disconnected');
    if (myRoom === 'lobby') {
      lobbyCount--;
      updateLobbyTotals();
    } else if (rooms[myRoom]) {
      passColorOff();
      rooms[myRoom].userLeaving(myUserId);
    }

  });

  socket.on('addToRound', function(data) {

    rooms[myRoom].curPlayingQueue.push(myUserId);

  });

  socket.on('leaveRoom', function() {

    if (myRoom) {

      console.log('user' + myUserId + ' leaving ' + myRoom);
      socket.leave(myRoom);

      if (myRoom !== 'lobby') {

        passColorOff();
        rooms[myRoom].userLeaving(myUserId);
        rooms[myRoom].colorBank[myUserId] = null;
        delete rooms[myRoom].colorBank[myUserId];
        myRoom = null;

      } else {

        lobbyCount--;

      }

    }

  });


  socket.on('joinRoom', function(data) {

    if (myRoom !== data.room) {  // ignore duplicate requests to join room

      myRoom = data.room;
      socket.join(myRoom);

      if (myRoom !== 'lobby') {

          console.log('user number ' + myUserId + ' joining room "' + myRoom + '"');

          if (!rooms[myRoom]) {
            newRoom(myRoom);
          }

          rooms[myRoom].setupNewUser(myUserId, socket);

          if (roomSettings.hasOwnProperty(myRoom)) {
            console.log('setSettings: ' + JSON.stringify(roomSettings[myRoom]) + ' in ' + myRoom);
            rooms[myRoom].sendAll('setSettings', roomSettings[myRoom]);
          }

          if (rooms[myRoom].inGame) {
            // of already in game then
            rooms[myRoom].numWaitingForNewGame++;
          } else {
            // CHECK AND IF MORE THAN ONE PERSON HERE START A GAME
            rooms[myRoom].waitFiveThenCheckAndStart();
          }

      } else {

        lobbyCount++;
        updateLobbyTotals();

      }

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

      rooms[myRoom].sendAll('winner', {
        topColor: (winBy !== 0) ? sortableScores[0][0] : '0,0,0', // tie if tie or nothing on the board
        winBy: winBy
      });

      console.log('game over and all users finishedcalc');
      rooms[myRoom].finishedCalc = 0;
      rooms[myRoom].inGame = false;
      rooms[myRoom].numWaitingForNewGame = 0;
      rooms[myRoom].RGBCounts = {};
      rooms[myRoom].timerToStart = null;
      rooms[myRoom].curPlayingQueue = [];
      rooms[myRoom].socketBank = {};
      rooms[myRoom].waitFiveThenCheckAndStart(12000); // wait 12 then start

    };

  });


  socket.on('addCircle', function(circle) {
    console.log('circle: ' +  JSON.stringify(circle) + ' goes to ' + myRoom);
    rooms[myRoom].sendAll('newCircle', {x: circle.x, y: circle.y, rad: circle.rad, col: circle.col});
  });

});
