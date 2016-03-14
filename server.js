var pg = require('pg');
var express = require('express');
var util = require('util');
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
    //console.log('updated high scores');
    io.sockets.emit('highScores', {scoreArr: highScoreData});
    done();
  });

};


app.get('/removeScore', function(req, res, next) {

  pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
    //console.log('deleting username ' + req.query.user + ' in table');

    client.query('DELETE from highscores WHERE username=\'' + req.query.user + '\'', function(err, result) {

      //console.log('err ' + err + ' and result ' + result);
      done();
      updateScoresAndEmit(client, done);
      res.send(JSON.stringify(result));


    });

  });

});

app.get('/showdb', function(req, res, next) {

  pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
    client.query('SELECT * from highscores', function(err, result) {

      updateScoresAndEmit(client, done);
      res.send(JSON.stringify(result.rows));

    });

  });

});

app.get('/clearScores', function(req, res, next) {

  pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
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

// CREATE TABLE players (playerId serial primary key, username VARCHAR(20) not null, dateset VARCHAR(20) not null, starscaught INT)

/*
pg.connect(process.env.DATABASE_URL, function(err, client) {
  var query = client.query('ALTER TABLE highscores ALTER COLUMN dateset type varchar(40)');
  console.log('adding pledge col');
  query.on('row', function(row) {
    console.log('row: ' + JSON.stringify(row));
  });
});
*/

// ALTER TABLE players ALTER COLUMN handshake VARCHAR(20);

// CONFIG

var currentUserId = 0;
var lobbyCount = 0;
//var possibleColors = ['orange', 'green', 'blue', 'red', 'yellow', 'purple', 'tomato', 'tan', 'salmon', 'slateblue', 'saddlebrown', 'plum', 'PaleVioletRed', 'Navy', 'OliveDrab'];
var possibleColors = ['orange', 'green', 'blue', 'red', 'yellow', 'purple'];
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
  },
  'smaller': {
    maxClickerSize: 60,
    clickerSpeed: 0.05,
    maxPeople: 6
  },
  'middle': {
    maxClickerSize: 110,
    clickerSpeed: 0.05,
    maxPeople: 6
  },
  'larger': {
    maxClickerSize: 180,
    clickerSpeed: 0.05,
    maxPeople: 6
  }
};

// high score setup

var highScoreData = [];

var updateHighScores = function(client, cb) {       // void

  var handleResult = function(result) {

      //console.log('high score rows' + JSON.stringify(result));
      if (result) highScoreData = result.rows;
      //console.log('hs data ' + highScoreData);
      if (cb) cb();

  }

  if (!client) {
      pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
        //console.log(err);
        client.query('SELECT username, dateset, games, points FROM highscores ORDER BY games DESC, points DESC LIMIT 10', function(err, result) {

          console.log(' err ' + err);
          handleResult(result);
          done()

        });

      });
  } else {

    client.query('SELECT username, dateset, games, points FROM highscores ORDER BY games DESC, points DESC LIMIT 10', function(err, result) {

      //console.log(' err ' + err);
      handleResult(result);

    });

  }

}
updateHighScores();

// WHATS A BOT?

var botNames = ["COMPUTER", "manik", "turnip", "nashua", "remla", "tarren", "zenbot", "durnery", "ronad", "tona", "tempest", "larry", "karalata", "lucy"];
var bots = [];

var Bot = function(options) {

  var bot = {};

  bot.gameGoing = false;

  bot.joinRoom = function(roomName) {

    console.log('bot joining ' + roomName);

    if (bot.roomName) {
      bot.leaveRoom();
    }

    lobbyCount--;
    updateLobbyTotals();

    bot.roomName = roomName;
    bot.room = rooms[roomName];
    bot.room.setupNewUser(bot.id, null, bot.username, function(col) {
      bot.color = col;
    });

  };

  bot.goToRandomRoom = function() {
    bot.joinRoom(Object.keys(roomSettings)[Math.floor(Math.random() * Object.keys(roomSettings).length)]);
  };

  bot.setupBot = function() {

    bot.id = currentUserId;
    currentUserId++;
    bot.username = botNames[bots.length];

    lobbyCount++;
    if (options && options.roomName) {
      bot.joinRoom(options.roomName);
    } else {
      bot.goToRandomRoom();
    }

  };
  bot.setupBot();

  bot.startingGame = function() {

    var settings = roomSettings[bot.roomName];
    var maxClickerSize = settings.maxClickerSize;
    var clickerSpeed = settings.clickerSpeed;
    var myskillspeed = (clickerSpeed>1) ? Math.round(Math.random() * 700) + 100 : Math.round(Math.random() * 550) + 200;

    var shootCircle = function() {

      var shootRad = (Math.random() > 0.6) ? maxClickerSize : Math.round((maxClickerSize/2)+Math.floor(Math.random() * (maxClickerSize /2) ));
      var variationSpeed = (Math.random() > 0.5) ? Math.round(Math.random() * 300) : Math.round(Math.random() * 200) * -1;
      var randCoefficient = Math.round(Math.random() * 60) / 10;

      setTimeout(function() {

        if (bot.room && bot.room.lastReceived) {

            // 60% - full maxClickerSize
            // 40% - random between 50% - 100% of maxClickerSize
          var shootCoords;
          if (Math.random() > randCoefficient) {
            shootCoords = {
              x: (Math.random() > 0.5) ? bot.room.lastReceived.x + Math.round(Math.random() * ( (500 - Math.round(shootRad/2)) - bot.room.lastReceived.x) ) : Math.round(shootRad/2) + Math.floor(Math.random() * bot.room.lastReceived.x),
              y: (Math.random() > 0.5) ? bot.room.lastReceived.y + Math.round(Math.random() * ( (500 - Math.round(shootRad/2)) - bot.room.lastReceived.y) ) : Math.round(shootRad/2) + Math.floor(Math.random() * bot.room.lastReceived.y)
            }
          } else {
            shootCoords = getRandomCoords();
          }

          bot.room.sendAll('newCircle', {x: shootCoords.x, y: shootCoords.y, rad: shootRad, col: bot.color});
          //console.log('shooting ' + bot.color + ' circle to room ' + bot.roomName);

        }

        if (bot.gameGoing) {  // keep shooting circles or auto stops when game is over (30 sec);
          shootCircle();
        }

      }, (shootRad*clickerSpeed) + myskillspeed + variationSpeed);

    }

    // wait three seconds then go!

    setTimeout(function() {

        bot.gameGoing = true;
        shootCircle();    // start chooting them
        setTimeout(function() {
          // gameover
          bot.stopGame();

        }, 30000);

    }, 3500);

  };

  bot.leaveRoom = function() {
    if (bot.room) {
      passColorOff(bot.id, bot.roomName);
      bot.room.userLeaving(bot.id, true);
      bot.room = null;
      bot.roomName = null;
      lobbyCount++;
      updateLobbyTotals();
    }
  };

  bot.sleepAndAwake = function(cb) {
    if (bot.room === null) {  // must currently be in lobby
      lobbyCount--;
      updateLobbyTotals();
      setTimeout(function() {
        lobbyCount++;
        updateLobbyTotals();
        if (cb) cb();
      }, 5000 + Math.round(Math.random() * 189000));
    }
  };

  bot.stopGame = function() {

    bot.gameGoing = false;
    if (Math.random() < 0.2) {
      // 20% chance of leaveroom and then join other random room
      //console.log('bot leaving then joining');
      setTimeout(function() {

        bot.leaveRoom();
        if (Math.random() < 0.3) {
          //console.log('sleeping a bot');
          // go to sleep bot!
          bot.sleepAndAwake(function() {
            bot.goToRandomRoom();
          });

        } else {
          // dont go to sleep bot just go back into another room
          setTimeout(function() {
            bot.goToRandomRoom();
          }, 1000 + Math.round(Math.random() * 6000));
        }

      }, 4000 + Math.round(Math.random() * 6000));

    }

  };

  return bot;

};

// WHATS A ROOM?

var rooms = {};

var Room = function(options) {
  var room = {};
  room.roomName = options.roomName;
  room.numPlayers = 0;               // realtime count of number of players
  room.curPlayingQueue = [];         // queue of userId's of people in current game
  room.inGame = false;               // is there an active game going on in this room?
  room.finishedCalc = 0;             // number of players that have calculated and sent in the RGBcount for the current game
  room.numWaitingForNewGame = 0;     // number of people waiting for new game to start
  room.waitingForSpaceQueue = [];    // queue of userId's of people waiting for space in the room ('watch mode')
  room.RGBCounts = {};               // object to hold rgb data for each user
  room.humans = [];
  room.lastReceived = getRandomCoords();
  // room.removeBotTimeout = null; // jic

  room.getRGBCountsSize = function() {
    // for rgbcounts count
    var size = 0, key;
    for (key in room.RGBCounts) {
        if (room.RGBCounts.hasOwnProperty(key)) size++;
    }
    return size;

  }

  room.timerToStart = null;          // timer before new game (adds 5sec for each join)
  room.maxPeople = (function() {
    if (roomSettings.hasOwnProperty(room.roomName)) {
      return roomSettings[room.roomName].maxPeople
    } else {
      return 4; // custom rooms default
    }
  })();

  // the gold
  room.userBank = {};  // { uid: {username: 'xxxx', color: 'red'} }
  room.socketBank = {};  // {uid: socket, ...}
  // HELPER FUNCTIONS

  room.sendAll = function(event, obj) {   // void

    io.sockets.in(room.roomName).emit(event, obj);

    if (event === "newCircle") {
      room.lastReceived.x = obj.x;
      room.lastReceived.y = obj.y;
    }

  };

  room.getBots = function() {   // array of Bots
    return bots.filter(function(bot) {
      return (bot.roomName === room.roomName);
    });
  };

  room.checkAndStart = function() {  // void

    if (room.humans.length > 0 && room.numPlayers > 1) {

      io.sockets.in(room.roomName).emit('startGame');

      room.getBots().forEach(function(bot) {
        bot.startingGame();
      });

      room.inGame = true;
      room.finishedCalc = 0;
      room.numWaitingForNewGame = 0;
      room.RGBCounts = {};
      room.timerToStart = null;

      //console.log('start game num: ' + room.numPlayers);

    } else {
      //console.log('only ' + room.numPlayers + ' are here currently');
    }

  };

  room.waitFiveThenCheckAndStart = function(t) {   // void

    if (room.timerToStart) {
      clearTimeout(room.timerToStart);
      room.timerToStart = null;
    }
    room.timerToStart = setTimeout( function() {

        room.checkAndStart();

    }, t || 5000);

  };

  room.hasAllRGBCounts = function() {    // boolean

    var hasAllOfThem = true;
    for (var i = 0; i < room.curPlayingQueue.length; i++) {
      if ( !room.RGBCounts.hasOwnProperty(room.curPlayingQueue[i]) ) {
        hasAllOfThem = false;
      }
    }

    // just in case something weird happens
    if (/*!hasAllOfThem === false && */room.getRGBCountsSize() === room.curPlayingQueue.length) {
      //console.log('sending off because rgbcounts size ' + room.getRGBCountsSize() + ' equals numplayers ' + room.numPlayers);
      hasAllOfThem = true;
    }
    //console.log('rgbcounts size ' + room.getRGBCountsSize() + ' equals numplayers ' + room.numPlayers);
    return hasAllOfThem;

  };

  // more important room methods
  room.setupNewUser = function(id, sock, username, cb) {

    var col = room.getUnusedColorName();
    if (cb) cb(col);    // for bots
    //console.log('col ' + col);
    room.numPlayers++;

    room.userBank[id] = {
      username: username,
      color: col
    };

    room.socketBank[id] = sock;

    if (sock) {   // the new user being added is a human if sock exists otherwise its just a BOT
      sock.emit('setColor', {color: col});
      room.humans.push(id);

      // check if any other people are in the room
      if (room.numPlayers === 1) {
        // if not then send a bot!
        setTimeout(function() {
          var newBot = findUnusedBot();
          if (newBot) {
            newBot.joinRoom(room.roomName);
          }
        }, 400 + Math.floor(Math.random() * 2500))

      } else if (room.humans.length > 1) {
        // if more than one human remove bots on join
        console.log('removing more than one human')
        getAllBotsInRoom(room.roomName).forEach(function(bot) {
          bot.leaveRoom();
        });
      }
    }

    if (!col) {
      //console.log('adding ' + id + ' to queue');
      room.waitingForSpaceQueue.push(id);
    }

    room.sendAll('playerCount', {
      count: room.numPlayers,
      max: room.maxPeople
    });

    room.sendAll('usersColors', {
      usersColors: room.userBank
    });

    updateLobbyTotals();

  };

  room.userLeaving = function(id, botBool) {
    room.numPlayers--;
    room.curPlayingQueue.splice(room.curPlayingQueue.indexOf(id), 1);     // remove user from the room queue

    // remove from humans
    if (!botBool) {
      console.log('REMOVING HUMAN');
      room.humans.splice(room.humans.indexOf(id), 1);

      // if no humans left then remove the bots too
      setTimeout(function() {
        if (room.humans.length === 0) {
          console.log('removing because no humans left after leaving')
          getAllBotsInRoom(room.roomName).forEach(function(bot) {
            bot.leaveRoom();
          });
        }
      }, 1000 + (Math.random()*2200));

    }

    // remove from userBank
    room.userBank[id] = null;
    delete room.userBank[id];

    // remove from socketBank
    room.socketBank[id] = null;
    delete room.socketBank[id];

    room.sendAll('playerCount', {
      count: room.numPlayers,
      max: room.maxPeople
    });

    room.sendAll('usersColors', {
      usersColors: room.userBank
    });

    updateLobbyTotals();

    if (Object.keys(room.RGBCounts).length > 0) {
      checkAndHandleWinners(room.roomName);
    }

    if (room.numPlayers < 2 || room.humans.length < 1) {
      // stop game if only one person in room
      room.inGame = false;
      room.finishedCalc = 0;
      room.numWaitingForNewGame = 0;
      room.RGBCounts = {};
      clearTimeout(room.timerToStart);
      room.timerToStart = null;
      if (!botBool) {
        room.getBots().forEach(function(bot) {
          bot.stopGame();     // stop bots
        });
      }
    }

  };

  room.getUnusedColorName = function() {

    if (room.numPlayers < room.maxPeople) {

        var allColors = possibleColors.slice(0);
        //console.log('allcols' + allColors + ' and ' + possibleColors);
        var takenColors = new Array;
        for (var user in room.userBank) {
          if (room.userBank.hasOwnProperty(user)) {
            takenColors.push(room.userBank[user].color);
          }
        }
        //console.log('takencols' + JSON.stringify(takenColors));
        var remainingColors = allColors.filter(function(i) {
          return takenColors.indexOf(i) < 0;
        });
        //console.log('remainingColors ' + remainingColors);
        if (remainingColors.length) {
          return remainingColors[ Math.floor( Math.random() * remainingColors.length ) ];
        }
        return null;    // only would occur if maxPeople > possibleColors / unlikely

    } else {

        // reached room size limit
        return null;

    }

  };

  return room;
};

// global HELPER FUNCTIONS

var getRandomCoords = function() {  // object {x: int, y: int}
    // assumes 500x500 board
    return {
      x: 20 + Math.floor(Math.random() * 460),
      y: 20 + Math.floor(Math.random() * 460)
    };
};

var updateLobbyTotals = function() {    // void

  var getRoomCount = function(rname) {
      return (rooms[rname]) ? rooms[rname].numPlayers : 0;
  };

  io.sockets.in('lobby').emit('roomTotals', {

    slowerCount: getRoomCount('slower'),
    mediumCount: getRoomCount('medium'),
    fasterCount: getRoomCount('faster'),
    smallerCount: getRoomCount('smaller'),
    middleCount: getRoomCount('middle'),
    largerCount: getRoomCount('larger'),
    totalBattlers: ['slower', 'medium', 'faster', 'smaller', 'middle', 'larger'].reduce(function(total, rname) {
      return total + getRoomCount(rname);
    }, 0) + lobbyCount

  });

};

var checkAndHandleWinners = function(myRoom, force) {      // void

      if (rooms[myRoom] && (rooms[myRoom].hasAllRGBCounts() || force) && rooms[myRoom].inGame) {

        //console.log('rooms my room rgbcounts: ' + JSON.stringify(rooms[myRoom].RGBCounts));

        // compute the winning rgb
        var avgRGBCounts = {};
        for (var userId in rooms[myRoom].RGBCounts) {

          for (var rgb in rooms[myRoom].RGBCounts[userId]) {
            //console.log('rgb ' + rgb);
            // first sum them all up for each of the colors
            var curRGB = rooms[myRoom].RGBCounts[userId].rgb;
            //console.log('user id ' + userId + ' rgb ' + rgb + ' val ' + rooms[myRoom].RGBCounts[userId][rgb]);
            avgRGBCounts[rgb] = (avgRGBCounts[rgb]) ? avgRGBCounts[rgb] + rooms[myRoom].RGBCounts[userId][rgb] : rooms[myRoom].RGBCounts[userId][rgb];
          }
        }

        //console.log('sum-avgRGBcounts1: ' + JSON.stringify(avgRGBCounts));

        for (var rgb in avgRGBCounts) {

          // and here we divide by the number of players in the current game
          avgRGBCounts[rgb] = avgRGBCounts[rgb] / Object.keys(rooms[myRoom].RGBCounts).length;

        }

        //console.log('avgRGBcounts2: ' + JSON.stringify(avgRGBCounts));

        // now that we have the average rgb data
        // figure out the top score

        // new way of determining top score
        var sortableScores = [];
        for (var color in avgRGBCounts) {
              sortableScores.push([color, avgRGBCounts[color]]);
        }
        sortableScores.sort(function(a, b) {return b[1] - a[1]});
        //console.log('sortablescores ' + JSON.stringify(sortableScores));
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

        //
        /*
        console.log('sending winner to the curplayingqueue ' + JSON.stringify(rooms[myRoom].curPlayingQueue));
        for (var i=0; i < rooms[myRoom].curPlayingQueue.length; i++) {
          var curPlayer = rooms[myRoom].curPlayingQueue[i];
          if (rooms[myRoom].socketBank[curPlayer]) {
            console.log('sending to ' + curPlayer );
            rooms[myRoom].socketBank[curPlayer].emit('winner', {
              topColor: (winBy !== 0) ? sortableScores[0][0] : '0,0,0', // tie if tie or nothing on the board
              winBy: winBy
            });
          }
        }
        */
        var winColor = (winBy !== 0) ? sortableScores[0][0] : '0,0,0';
        rooms[myRoom].sendAll('winner', {
          topColor: winColor, // tie if tie or nothing on the board
          winBy: winBy
        });

        console.log('game over in ' + myRoom + ' winningColor: ' + winColor);

        //console.log('game over and all users finishedcalc');

        // game over reset
        rooms[myRoom].finishedCalc = 0;
        rooms[myRoom].inGame = false;
        rooms[myRoom].numWaitingForNewGame = 0;
        rooms[myRoom].RGBCounts = {};
        rooms[myRoom].timerToStart = null;
        rooms[myRoom].curPlayingQueue = [];
        rooms[myRoom].waitFiveThenCheckAndStart(12000); // wait 12 then start
        clearTimeout(rooms[myRoom].waitingToRush);
        rooms[myRoom].waitingToRush = null;

      };

};

var passColorOff = function(id, room) {   // void

  if (rooms[room] && rooms[room].userBank[id].color && rooms[room].waitingForSpaceQueue.length > 0) {
    // person in front of the queue gets the person leaving's old color
    var passed = false;
    while (!passed) {
      var firstInLine = rooms[room].waitingForSpaceQueue.shift(); // id of first in line
      if (firstInLine===undefined) {passed = true;}
      //console.log('giving color ' + rooms[myRoom].userBank[myUserId].color + ' to user ' + firstInLine);
      if (rooms[room] && rooms[room].socketBank[id] && rooms[room].socketBank[id][ firstInLine ]) {
        rooms[room].socketBank[firstInLine].emit('setColor', {color: rooms[room].userBank[id].color });
        rooms[room].userBank[firstInLine].color = rooms[room].userBank[id].color;
        rooms[room].curPlayingQueue.push(firstInLine);
        passed = true;
      } else if (rooms[room].waitingForSpaceQueue.length > 0) {
        passed = true;
      }
    }
  } else {
    //console.log('couldnt pass color off ' + myUserId + ' ' + myRoom + ' and numplayers ' + rooms[myRoom].numPlayers);
  }

};

var getAllBotsInRoom = function(roomName) {

  return bots.filter(function(bot) {
    return (bot.roomName === roomName);
  });

}

var findUnusedBot = function() {  // returns a Bot

  for (var i = 0; i < bots.length; i++) {
    if (bots[i].roomName === null) {
      return bots[i];
    }
  }

  // if reached here... then
  // all bots are in rooms
  // find a bot in a room with no humans

  for (var i = 0; i < bots.length; i++) {
    if (bots[i].room && bots[i].room.humans.length === 0) {
      return bots[i];
    }
  }

};

//init main rooms
Object.keys(roomSettings).forEach(function(r) {
  rooms[r] = Room({roomName: r});
})

// init bots
for (var i=0; i<1; i++) {
  bots.push(Bot());
}

// BANNED IPs

var bannedIps = [];

// SOCKET LISTENERS
io.sockets.on('connection', function (socket) {

  var clientIp = socket.handshake.headers['x-forwarded-for'];
  clientIp = (clientIp && clientIp.indexOf(',') > -1) ? clientIp.split(',')[1].trim() : clientIp;
  console.log('user clientip ' + clientIp + ' approaches.');

  // dont respond to bad ip's
  if (bannedIps.indexOf(clientIp) === -1) {

      // first send high score data
      socket.emit('highScores', {scoreArr: highScoreData});

      var myUserId = currentUserId;
      var myUsername;
      var myRoom = null;

      currentUserId++;



      socket.on('disconnect', function() {
        //console.log(myUserId + ' ' + myRoom + ' disconnected');
        if (myRoom === 'lobby') {
          lobbyCount--;
          updateLobbyTotals();
        } else if (rooms[myRoom]) {
          passColorOff(myUserId, myRoom);
          rooms[myRoom].userLeaving(myUserId);
          // update room userandcolors
          rooms[myRoom].sendAll('usersColors', {
            usersColors: rooms[myRoom].userBank
          });
        }

      });

      socket.on('addToRound', function(data) {

        rooms[myRoom].curPlayingQueue.push(myUserId);

      });

      socket.on('leaveRoom', function() {

        if (myRoom) {

          //console.log('user' + myUserId + ' leaving ' + myRoom);
          socket.leave(myRoom);

          if (myRoom !== 'lobby') {

            passColorOff(myUserId, myRoom);
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
          if (!myUsername) {
            console.log(JSON.stringify(data));
            if (data.uid) myUsername = data.uid;
            console.log(myUsername + ' just logged in (' + myUserId + ') with clientIp ' + clientIp );
          }
          socket.join(myRoom);

          if (myRoom !== 'lobby') {

              //console.log('user number ' + myUserId + ' joining room "' + myRoom + '" with ' + myUsername);

              if (!rooms[myRoom]) {
                rooms[myRoom] = Room({roomName: myRoom});
              }

              rooms[myRoom].setupNewUser(myUserId, socket, myUsername);
              console.log('setting up ' + myUserId + 'with username ' + myUsername);

              if (roomSettings.hasOwnProperty(myRoom)) {
                //console.log('setSettings: ' + JSON.stringify(roomSettings[myRoom]) + ' in ' + myRoom);
                rooms[myRoom].sendAll('setSettings', roomSettings[myRoom]);
              }

              if (rooms[myRoom].inGame) {
                // of already in game then
                socket.emit('alreadyInGame');
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

        if (!rooms[myRoom].waitingToRush) {
          rooms[myRoom].waitingToRush = setTimeout(function() {
            console.log('had to force it');
            checkAndHandleWinners(myRoom, true);   // force it!
          }, 5000);
        }

        //console.log('user finishedcalc');
        rooms[myRoom].finishedCalc++;
        rooms[myRoom].RGBCounts[myUserId] = data.pixelData;

        checkAndHandleWinners(myRoom);

      });

      socket.on('submitHS', function(data) {

        //console.log('inserting score...' + JSON.stringify(data));

          pg.connect(process.env.DATABASE_URL + "?ssl=true", function(err, client, done) {
            //console.log('about to insert');
            var dateNow = new Date().toISOString().slice(0, 10);
            dateNow = dateNow.substr(5) + '-' + dateNow.substr(0, 4);
            var queryText = 'UPDATE "highscores" SET "games"=' + data.games + ', "points"=' + data.pts + ' WHERE "username"=\'' + data.username + '\' AND "games"<' + data.games + ' AND "dateset"=\'' + dateNow + '\'';

            //console.log(queryText);

            client.query(queryText, function(err, result) {

              //console.log( err, result);
              done();

              if (err || result.rowCount === 0) {

                // okay so we couldnt update when username sent in a record today...
                // but dont go ahead and insert if they already sent in a better record today
                client.query('SELECT * FROM "highscores" WHERE "username"=\'' + data.username + '\' AND "dateset"=\'' + dateNow + '\'', function(err, result) {

                  //console.log('select from highscores where username and dateset');
                  //console.log('err for this ' + err);
                  //console.log('result here ' + JSON.stringify(result));

                  if (result.rowCount === 0) {
                    // only go ahead with the insert if they havent had any records from the same day that are less than data.games

                        var queryText = 'INSERT INTO "highscores" ("username", "dateset", "games", "points") VALUES ($1, $2, $3, $4)';

                        //console.log(queryText);

                        client.query(queryText, [data.username, dateNow, data.games, data.pts], function(err, result) {
                          //console.log('here' + JSON.stringify(result) + ' ' + err);
                          if (!err) {
                            //console.log('no error');
                            done();

                            socket.emit('congrats');
                            updateScoresAndEmit(client, done);


                          } else {
                            //console.log('err ' + err);
                          }
                          //console.log('now here');

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
        //console.log('circle: ' +  JSON.stringify(circle) + ' goes to ' + myRoom);
        rooms[myRoom].sendAll('newCircle', {x: circle.x, y: circle.y, rad: circle.rad, col: circle.col});
      });

      socket.on('chat', function(data) {

        console.log('CHAT::' + myUsername + ' says ' + data.msg, myUsername, 'sad');

        if (myUsername) {

          var MAP = { '&': '&amp;',
                  '<': '&lt;',
                  '>': '&gt;',
                  '"': '&quot;',
                  "'": '&#39;'};

          function escapeHTML (s, forAttribute) {
              return s.replace(forAttribute ? /[&<>'"]/g : /[&<>]/g, function(c) {
                  return MAP[c];
              });
          }

          console.log('CHAT::' + myUsername + ' says ' + data.msg);

          io.sockets.emit('chatMsg', {
            username: myUsername,
            msg: escapeHTML(data.msg)
          });

        }

      });

      socket.on('log', function(data) {
        console.log(JSON.stringify(data));
      });

  } else {
    console.log("WARNING: BLOCKED ATTEMPT FROM " + clientIp);
  }


});
