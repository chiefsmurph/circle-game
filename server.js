var pg = require('pg');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var connectionString = "postgres://mbxlvabrzzicaj:*PASSWORD*@*HOST*:*PORT:/*DATABASE*"

var port = process.env.PORT || 5000; // Use the port that Heroku
server.listen(port);

console.log('listening for http and socket requests on port ' + port);

var bodyParser = require('body-parser')
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
app.use(express.static(__dirname + '/public'));

var updateScoresAndEmit = function(client, done) {

  updateHighScores(client, function() {
    console.log('updated high scores');
    io.sockets.emit('highScores', {scoreArr: highScoreData});
    done();
  });

};

// for rgbcounts count
Object.prototype.size = function() {
    var size = 0, key;
    for (key in this) {
        if (this.hasOwnProperty(key)) size++;
    }
    return size;
};

app.get('/removeScore', function(req, res, next) {

  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    console.log('deleting username ' + req.query.user + ' in table');

    client.query('DELETE from highscores WHERE username=\'' + req.query.user + '\'', function(err, result) {

      console.log('err ' + err + ' and result ' + result);
      done();
      updateScoresAndEmit(client, done);
      res.send(JSON.stringify(result));


    });

  });

});

app.get('/showdb', function(req, res, next) {

  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    client.query('SELECT * from highscores', function(err, result) {

      updateScoresAndEmit(client, done);
      res.send(JSON.stringify(result.rows));

    });

  });

});

app.get('/clearScores', function(req, res, next) {

  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    client.query('DELETE FROM highscores', function(err, result) {

      res.send(JSON.stringify(result.rows));

    });

  });

});

// INIT HIGH SCORE TABLE

/*
pg.connect(process.env.DATABASE_URL, function(err, client) {
  var query = client.query('CREATE TABLE highscores (scoreId serial primary key, username VARCHAR(20) not null, dateset DATE, games INT, points INT)');
  console.log('adding pledge col');
  query.on('row', function(row) {
    console.log('row: ' + JSON.stringify(row));
  });
});
*/

/*
pg.connect(process.env.DATABASE_URL, function(err, client) {
  var query = client.query('ALTER TABLE highscores ALTER COLUMN dateset type varchar(40)');
  console.log('adding pledge col');
  query.on('row', function(row) {
    console.log('row: ' + JSON.stringify(row));
  });
});
*/

// CONFIG

var currentUserId = 0;
var lobbyCount = 0;
var possibleColors = ['orange', 'green', 'blue', 'red', 'yellow', 'purple', 'tomato', 'tan', 'salmon', 'slateblue', 'saddlebrown', 'plum', 'PaleVioletRed', 'Navy', 'OliveDrab'];
//var possibleColors = ['orange', 'green', 'blue', 'red', 'yellow', 'purple'];
var roomSettings = {
  'slower': {
    maxClickerSize: 180,
    clickerSpeed: 12,
    maxPeople: 6
  },
  'medium': {
    maxClickerSize: 110,
    clickerSpeed: 5,
    maxPeople: 6
  },
  'faster': {
    maxClickerSize: 60,
    clickerSpeed: 3,
    maxPeople: 6
  }
};

// high score setup

var highScoreData = [];

var updateHighScores = function(client, cb) {       // void

  var handleResult = function(result) {

      console.log('high score rows' + JSON.stringify(result));
      if (result) highScoreData = result.rows;
      console.log('hs data ' + highScoreData);
      if (cb) cb();

  }

  if (!client) {
      pg.connect(process.env.DATABASE_URL, function(err, client, done) {
        console.log(err);
        client.query('SELECT username, dateset, games, points FROM highscores ORDER BY games DESC LIMIT 10', function(err, result) {

          console.log(' err ' + err);
          handleResult(result);
          done()

        });

      });
  } else {

    client.query('SELECT username, dateset, games, points FROM highscores ORDER BY games DESC LIMIT 10', function(err, result) {

      console.log(' err ' + err);
      handleResult(result);

    });

  }

}
updateHighScores();

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

  // the gold
  rooms[roomName].userBank = {};  // { uid: {username: 'xxxx', color: 'red', socket: Socket} }

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

    // just in case something weird happens
    if (rooms[roomName].RGBCounts.size() === rooms[roomName].numPlayers) {
      hasAllOfThem = true;
    }

    return hasAllOfThem;

  };

  // more important room methods

  rooms[roomName].getUsersAndColors = function() {  // returns an object

    var result = {};
    for (var key in rooms[roomName].userBank) {
      var curUser = rooms[roomName].userBank[key];
      result[key] = {
        username: curUser[username],
        color: curUser[color]
      }
    }

    return result;

  };

  rooms[roomName].setupNewUser = function(id, sock, username) {

    var col = rooms[roomName].getUnusedColorName();
    console.log('col ' + col);
    rooms[roomName].numPlayers++;

    rooms[roomName].userBank[id] = {
      username: username,
      color: col,
      socket: sock
    };

    sock.emit('setColor', {color: col});

    if (!col) {
      console.log('adding ' + id + ' to queue');
      rooms[roomName].waitingForSpaceQueue.push(id);
    }

    rooms[roomName].sendAll('playerCount', {
      count: rooms[roomName].numPlayers,
      max: rooms[roomName].maxPeople
    });

    rooms[roomName].sendAll('usersColors', {
      usersColors: rooms[roomName].getUsersAndColors()
    });

    updateLobbyTotals();

  };

  rooms[roomName].userLeaving = function(id) {
    rooms[roomName].numPlayers--;
    rooms[roomName].curPlayingQueue.splice(rooms[roomName].curPlayingQueue.indexOf(id), 1);     // remove user from the room queue

    // remove from userBank
    rooms[roomName].userBank[id] = null;
    delete rooms[roomName].userBank[id];

    rooms[roomName].sendAll('playerCount', {
      count: rooms[roomName].numPlayers,
      max: rooms[roomName].maxPeople
    });

    rooms[roomName].sendAll('usersColors', {
      usersColors: rooms[roomName].getUsersAndColors()
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
        for (var user in rooms[roomName].userBank) {
          if (rooms[roomName].userBank.hasOwnProperty(user)) {
            takenColors.push(rooms[roomName].userBank[color]);
          }
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

    slowerCount: getRoomCount('slower'),
    mediumCount: getRoomCount('medium'),
    fasterCount: getRoomCount('faster'),
    totalBattlers: ['slower', 'medium', 'faster'].reduce(function(total, rname) {
      return total + getRoomCount(rname);
    }, 0) + lobbyCount

  });

};


// SOCKET STUFF


io.sockets.on('connection', function (socket) {

  // first send high score data
  socket.emit('highScores', {scoreArr: highScoreData});

  var myUserId = currentUserId;
  var myUsername;
  var myRoom = null;

  currentUserId++;

  var passColorOff = function() {   // void

    if (rooms[myRoom] && rooms[myRoom].userBank[myUserId].color && rooms[myRoom].waitingForSpaceQueue.length > 0) {
      // person in front of the queue gets the person leaving's old color
      var passed = false;
      while (!passed) {
        var firstInLine = rooms[myRoom].waitingForSpaceQueue.shift(); // id of first in line
        if (firstInLine===undefined) {passed = true;}
        console.log('giving color ' + rooms[myRoom].userBank[myUserId].color + ' to user ' + firstInLine);
        if (rooms[myRoom].userBank[myUserId].socket[ firstInLine ]) {
          rooms[myRoom].userBank[firstInLine].socket.emit('setColor', {color: rooms[myRoom].userBank[myUserId].color });
          rooms[myRoom].userBank[firstInLine].color = rooms[myRoom].userBank[myUserId].color;
          passed = true;
        } else if (rooms[myRoom].waitingForSpaceQueue.length > 0) {
          passed = true;
        }
      }
    } else {
      console.log('couldnt pass color off ' + myUserId + ' ' + myRoom + ' and numplayers ' + rooms[myRoom].numPlayers);
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
      // update room userandcolors
      rooms[roomName].sendAll('usersColors', {
        usersColors: rooms[roomName].getUsersAndColors()
      });
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

      } else {

        lobbyCount--;

      }

      myRoom = null;

    }

  });


  socket.on('joinRoom', function(data) {

    if (myRoom !== data.room) {  // ignore duplicate requests to join room

      myRoom = data.room;
      myUsername = data.uid;
      socket.join(myRoom);

      if (myRoom !== 'lobby') {

          console.log('user number ' + myUserId + ' joining room "' + myRoom + '"');

          if (!rooms[myRoom]) {
            newRoom(myRoom);
          }

          rooms[myRoom].setupNewUser(myUserId, socket, myUsername);

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

      console.log('sending winner to the curplayingqueue ' + JSON.stringify(rooms[myRoom].curPlayingQueue));
      for (var i=0; i < rooms[myRoom].curPlayingQueue.length; i++) {
        var curPlayer = rooms[myRoom].curPlayingQueue[i];
        if (rooms[myRoom].userBank[curPlayer].socket) {
          console.log('sending to ' + curPlayer );
          rooms[myRoom].userBank[curPlayer].socket.emit('winner', {
            topColor: (winBy !== 0) ? sortableScores[0][0] : '0,0,0', // tie if tie or nothing on the board
            winBy: winBy
          });
        }
      }

      console.log('game over and all users finishedcalc');
      rooms[myRoom].finishedCalc = 0;
      rooms[myRoom].inGame = false;
      rooms[myRoom].numWaitingForNewGame = 0;
      rooms[myRoom].RGBCounts = {};
      rooms[myRoom].timerToStart = null;
      rooms[myRoom].curPlayingQueue = [];
      rooms[myRoom].waitFiveThenCheckAndStart(12000); // wait 12 then start

    };

  });

  socket.on('submitHS', function(data) {

    console.log('inserting score...' + JSON.stringify(data));

      pg.connect(process.env.DATABASE_URL, function(err, client, done) {
        console.log('about to insert');
        var dateNow = new Date().toISOString().slice(0, 10);
        dateNow = dateNow.substr(5) + '-' + dateNow.substr(0, 4);
        var queryText = 'UPDATE "highscores" SET "games"=' + data.games + ', "points"=' + data.pts + ' WHERE "username"=\'' + data.username + '\' AND "games"<' + data.games + ' AND "dateset"=\'' + dateNow + '\'';

        console.log(queryText);

        client.query(queryText, function(err, result) {

          console.log( err, result);
          done();

          if (err || result.rowCount === 0) {

            // okay so we couldnt update when username sent in a record today...
            // but dont go ahead and insert if they already sent in a better record today
            client.query('SELECT * FROM "highscores" WHERE "username"=\'' + data.username + '\' AND "dateset"=\'' + dateNow + '\'', function(err, result) {

              console.log('select from highscores where username and dateset');
              console.log('err for this ' + err);
              console.log('result here ' + JSON.stringify(result));

              if (result.rowCount === 0) {
                // only go ahead with the insert if they havent had any records from the same day that are less than data.games

                    var queryText = 'INSERT INTO "highscores" ("username", "dateset", "games", "points") VALUES ($1, $2, $3, $4)';

                    console.log(queryText);

                    client.query(queryText, [data.username, dateNow, data.games, data.pts], function(err, result) {
                      console.log('here' + JSON.stringify(result) + ' ' + err);
                      if (!err) {
                        console.log('no error');
                        done();

                        socket.emit('congrats');
                        updateScoresAndEmit(client, done);


                      } else {
                        console.log('err ' + err);
                      }
                      console.log('now here');

                    });

              }

            });


          } else {

            // update worked
            socket.emit('congrats');
            updateScoresAndEmit(client, done);

          }

        });

      });

  });

  socket.on('addCircle', function(circle) {
    console.log('circle: ' +  JSON.stringify(circle) + ' goes to ' + myRoom);
    rooms[myRoom].sendAll('newCircle', {x: circle.x, y: circle.y, rad: circle.rad, col: circle.col});
  });

});
