
const { pgString, pgConfig } = require('./config.js');
const { Pool } = require('pg');
const pool = new Pool(pgConfig)


var express = require('express');
var util = require('util');
var app = express();


var uuid = require('node-uuid');
var async = require('async');



console.log({ pgString });

var port = process.env.PORT || 5000; // Use the port that Heroku
const server = app.listen(port);
const io = require('socket.io')(server);

console.log('listening for http and socket requests on port ' + port);

var bodyParser = require('body-parser')
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
app.use(express.static(__dirname + '/public'));

var updateScoresAndEmit = function() {

  updateHighScores(function() {
    //console.log('updated high scores');
    sendAll('highScores', {scoreArr: highScoreData});
  });

};


var users = [];

// createTables();

// read all users
pool.query('SELECT * FROM highscores', function(err, result) {
  console.log(err, result)
  users = result.rows;
});

users.push({
  username: 'computer',
  score: 132
});

app.get('/removeScore', function(req, res, next) {

  //console.log('deleting username ' + req.query.user + ' in table');

  pool.query('DELETE from highscores WHERE username=\'' + req.query.user + '\'', function(err, result) {

    //console.log('err ' + err + ' and result ' + result);
    updateScoresAndEmit();
    res.send(JSON.stringify(result));
  });

});

app.get('/showdb', function(req, res, next) {

  pool.query('SELECT * from highscores', function(err, result) {

    updateScoresAndEmit(done);
    res.send(JSON.stringify(result.rows));

  });

});

app.get('/clearScores', function(req, res, next) {

  pool.query('DELETE FROM highscores', function(err, result) {

    res.send(JSON.stringify(result.rows));

  });

});


// INIT HIGH SCORE TABLE
async function createTables() {
  await pool.query('CREATE TABLE highscores (scoreId serial primary key, username VARCHAR(20) not null, handshake VARCHAR(40), dateset varchar(40), games INT, points INT, score INT)');
  await pool.query('CREATE TABLE players (playerId serial primary key, username VARCHAR(20) not null, handshake VARCHAR(40), dateset VARCHAR(20) not null, starscaught INT)');
}

// CONFIG

var currentUserId = 0;
var lobbyCount = 0;
//var possibleColors = ['orange', 'green', 'blue', 'red', 'yellow', 'purple', 'tomato', 'tan', 'salmon', 'slateblue', 'saddlebrown', 'plum', 'PaleVioletRed', 'Navy', 'OliveDrab'];
var possibleColors = ['orange', 'green', 'blue', 'red', 'yellow', 'purple'];
var roomSettings = {
  // 'slower': {
  //   maxClickerSize: 110,
  //   clickerSpeed: 12,
  //   maxPeople: 6
  // },
  // 'medium': {
  //   maxClickerSize: 110,
  //   clickerSpeed: 5,
  //   maxPeople: 6
  // },
  // 'faster': {
  //   maxClickerSize: 110,
  //   clickerSpeed: 3,
  //   maxPeople: 6
  // },
  'small': {
    maxClickerSize: 60,
    clickerSpeed: 0,
    maxPeople: 6
  },
  'medium': {
    maxClickerSize: 110,
    clickerSpeed: 0,
    maxPeople: 6
  },
  'large': {
    maxClickerSize: 180,
    clickerSpeed: 0,
    maxPeople: 6
  }
};

// high score setup

var highScoreData = [];

var updateHighScores = function(cb) {       // void
    pool.query('SELECT username, dateset, games, points FROM highscores ORDER BY games DESC, points DESC LIMIT 10', function(err, result) {

      if (result) highScoreData = result.rows;
      //console.log('hs data ' + highScoreData);
      if (cb) cb();

    });
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
    var myskillspeed = Math.round(Math.random() * ((clickerSpeed > 1) ? 300 : 100));

    var shootCircle = function() {

      var shootRad = maxClickerSize;//(Math.random() > 0.6) ? maxClickerSize : Math.round((maxClickerSize/2)+Math.floor(Math.random() * (maxClickerSize /2) ));
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

      }, myskillspeed + randCoefficient * 60);

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
      bot.room.passColorOff(bot.id);
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

  room.checkAndStart = function() {  // void

    if (room.humans.length > 0 && room.numPlayers > 1) {

      io.sockets.in(room.roomName).emit('startGame');

      room.getAllBotsInRoom().forEach(function(bot) {
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

    }, t || 7500);

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
      if (room.numPlayers === 1 && roomSettings.hasOwnProperty(room.roomName)) {
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
        room.getAllBotsInRoom().forEach(function(bot) {
          bot.leaveRoom();
        });

        if (room.inGame) {
          // stop game if only one person in room
          room.inGame = false;
          room.finishedCalc = 0;
          room.numWaitingForNewGame = 0;
          room.RGBCounts = {};
          clearTimeout(room.timerToStart);
          room.timerToStart = null;
          room.getAllBotsInRoom().forEach(function(bot) {
            bot.stopGame();     // stop bots
          });
          room.sendAll('returnToWait');
        }

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
          room.getAllBotsInRoom().forEach(function(bot) {
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
      room.checkAndHandleWinners();
    }

    console.log(room.numPlayers, ' left');

    if (room.numPlayers < 2 || room.humans.length < 1) {
      // stop game if only one person in room
      room.inGame = false;
      room.finishedCalc = 0;
      room.numWaitingForNewGame = 0;
      room.RGBCounts = {};
      clearTimeout(room.timerToStart);
      room.timerToStart = null;
      if (!botBool) {
        room.getAllBotsInRoom().forEach(function(bot) {
          bot.stopGame();     // stop bots
        });
      }
      room.sendAll('returnToWait');
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

  room.convertColorToUsername = function(color) {

    console.log('converting', color);
    console.log(JSON.stringify(room.userBank));

    for (var user in room.userBank) {
      if (room.userBank.hasOwnProperty(user)) {
        if (room.userBank[user].color === color) {
          return room.userBank[user].username;
        }
      }
    }

  };

  room.checkAndHandleWinners = function(force) {

    if (room && (room.hasAllRGBCounts() || force) && room.inGame) {

      //console.log('rooms my room rgbcounts: ' + JSON.stringify(room.RGBCounts));

      // compute the winning rgb
      var avgRGBCounts = {};
      for (var userId in room.RGBCounts) {

        for (var rgb in room.RGBCounts[userId]) {
          //console.log('rgb ' + rgb);
          // first sum them all up for each of the colors
          var curRGB = room.RGBCounts[userId].rgb;
          //console.log('user id ' + userId + ' rgb ' + rgb + ' val ' + room.RGBCounts[userId][rgb]);
          avgRGBCounts[rgb] = (avgRGBCounts[rgb]) ? avgRGBCounts[rgb] + room.RGBCounts[userId][rgb] : room.RGBCounts[userId][rgb];
        }
      }

      //console.log('sum-avgRGBcounts1: ' + JSON.stringify(avgRGBCounts));

      for (var rgb in avgRGBCounts) {

        // and here we divide by the number of players in the current game
        avgRGBCounts[rgb] = avgRGBCounts[rgb] / Object.keys(room.RGBCounts).length;

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

      var sumCounts = 0;
      for (var i = 0; i < sortableScores.length; i++) {
        sumCounts += sortableScores[i][1];
      }

      var winByPerc = Math.round(winBy / sumCounts * 1000);
      console.log(winBy, sumCounts, winByPerc);

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
      console.log('sending winner to the curplayingqueue ' + JSON.stringify(room.curPlayingQueue));
      for (var i=0; i < room.curPlayingQueue.length; i++) {
        var curPlayer = room.curPlayingQueue[i];
        if (room.socketBank[curPlayer]) {
          console.log('sending to ' + curPlayer );
          room.socketBank[curPlayer].emit('winner', {
            topColor: (winBy !== 0) ? sortableScores[0][0] : '0,0,0', // tie if tie or nothing on the board
            winBy: winBy
          });
        }
      }
      */

      var winColorRGB = (winBy !== 0) ? sortableScores[0][0] : '0,0,0';
      var winColorName = (winColorRGB === '0,0,0') ? 'tie' : colorRGBtoName[winColorRGB];
      var winName = (winColorName === 'tie') ? 'tie' : room.convertColorToUsername(winColorName);

      room.sendAll('winner', {
        topColor: winColorRGB,
        topName: winName, // tie if tie or nothing on the board
        winBy: winBy,
        winByPerc: winByPerc
      });

      room.updatePlayersScores({
        winName: winName,
        winByPerc: winByPerc,
        numHumans: room.humans.length
      }, function() {

          console.log('game over in ' + room.roomName + ' winningColor: ' + winColorName + ' winningName ' + winName);

          //console.log('game over and all users finishedcalc');

          // game over reset
          room.finishedCalc = 0;
          room.inGame = false;
          room.numWaitingForNewGame = 0;
          room.RGBCounts = {};
          room.timerToStart = null;
          room.curPlayingQueue = [];
          room.waitFiveThenCheckAndStart(16000); // wait 12 then start
          clearTimeout(room.waitingToRush);
          room.waitingToRush = null;

      });

    };
  };

  room.updatePlayersScores = function(data, cb) {
    console.log('updatePlayersScores', data, room.userBank);
    async.forEach(Object.keys(room.userBank), function(key, next) {
      console.log('key', key);
      var username = room.userBank[key].username;
      console.log('username', username)
      if (username !== 'COMPUTER' && room.waitingForSpaceQueue.indexOf(username) === -1) {
        var usersIndex = findWithAttr(users, 'username', username);
        console.log('usersiNDEX', usersIndex);
        if (usersIndex >= 0) {
          var dbRec = users[usersIndex]; // from array index to user object
          var origScore = dbRec.score;
          var multiplier = (data.winName === username) ? 1 + (data.winByPerc*data.numHumans/2) / 100 : 1 - ((data.winByPerc/3) / 100);
          var newScore = Math.ceil(origScore * multiplier);
          console.log(dbRec.username, origScore, multiplier, newScore);
          updateSinglePlayerScore(dbRec.username, newScore, function(userObj) {
            //send socket update userobj
            console.log('updated ', userObj);
            room.socketBank[key].emit('updateUsrObj', userObj);
            // update the users array
            console.log('current users obj', users[usersIndex]);
            users[usersIndex].handshake = userObj.handshake;
            users[usersIndex].score = userObj.score;
            console.log('after users obj', users[usersIndex]);
            next();
          });
        } else {
          console.log('eh');
          return next();
        }
      } else {
        console.log('here')
        return next();
      }


    }, cb);
  };

  room.passColorOff = function(id) {   // void

    if (room && room.userBank[id].color && room.waitingForSpaceQueue.length > 0) {
      // person in front of the queue gets the person leaving's old color
      var passed = false;
      while (!passed) {
        var firstInLine = room.waitingForSpaceQueue.shift(); // id of first in line
        if (firstInLine===undefined) {passed = true;}
        //console.log('giving color ' + rooms[myRoom].userBank[myUserId].color + ' to user ' + firstInLine);
        if (room && room.socketBank[id] && room.socketBank[id][ firstInLine ]) {
          room.socketBank[firstInLine].emit('setColor', {color: room.userBank[id].color });
          room.userBank[firstInLine].color = room.userBank[id].color;
          room.curPlayingQueue.push(firstInLine);
          passed = true;
        } else if (room.waitingForSpaceQueue.length > 0) {
          passed = true;
        }
      }
    } else {
      //console.log('couldnt pass color off ' + myUserId + ' ' + myRoom + ' and numplayers ' + rooms[myRoom].numPlayers);
    }

  };

  room.getAllBotsInRoom = function() {

    return bots.filter(function(bot) {
      return (bot.roomName === room.roomName);
    });

  };

  return room;
};

// global HELPER FUNCTIONS

var colorRGBtoName = {
  '0,0,255': 'blue',
  '0,128,0': 'green',
  '255,165,0': 'orange',
  '255,0,0': 'red',
  '255,255,0': 'yellow',
  '128,0,128': 'purple',
  '255,99,71': 'tomato',
  '210,180,140': 'tan',
  '250,128,114': 'salmon',
  '106,90,205': 'slateblue',
  '139,69,19': 'saddlebrown',
  '221,160,221': 'plum',
  '219,112,147': 'palevioletred',
  '0,0,128': 'navy',
  '107,142,35': 'olivedrab'
};

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

    smallCount: getRoomCount('small'),
    mediumCount: getRoomCount('medium'),
    largeCount: getRoomCount('large'),
    totalClashers: ['small', 'medium', 'large'].reduce(function(total, rname) {
      return total + getRoomCount(rname);
    }, 0) + lobbyCount

  });

};

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




var verifyUser = function(userObj, cb) {
  console.log('verifying...' + JSON.stringify(userObj));
    var queryText = 'SELECT * FROM highscores WHERE username = \'' + userObj.username + '\' AND handshake = \'' + userObj.handshake + '\'';
    pool.query(queryText, function(err, result) {

      if (err)  console.error(err);
      var authorized = (result.rows.length);
      console.log('checking user ' + userObj.username + ' ' + authorized);
      if (authorized) {
        cb(result.rows[0]);
      } else {
        cb(null);
      }

    });
};

var sendAll = function(evt, obj) {
  io.sockets.emit(evt, obj);
};

var updateSinglePlayerScore = function(username, newScore, cb) {
  var handshake = uuid.v1();
  //console.log('about to insert');
  var queryText = 'UPDATE "highscores" SET "score"=' + newScore + ', "handshake"=\'' + handshake + '\' WHERE "username"=\'' + username + '\'';

  //console.log(queryText);

  pool.query(queryText, function(err, result) {

    console.log( err, result);
    cb({
      username: username,
      handshake: handshake,
      score: newScore
    });
  });
  // cb with new handshake
};

function findWithAttr(array, attr, value) {
  console.log('looking for ', value, ' ', attr, ' in ', array);
    for(var i = 0; i < array.length; i += 1) {
        if(array[i][attr] === value) {
            return i;
        }
    }
}


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
      var myScore;

      currentUserId++;



      socket.on('disconnect', function() {
        //console.log(myUserId + ' ' + myRoom + ' disconnected');
        if (myRoom === 'lobby') {
          lobbyCount--;
          updateLobbyTotals();
        } else if (rooms[myRoom]) {
          rooms[myRoom].passColorOff(myUserId);
          rooms[myRoom].userLeaving(myUserId);
          // update room userandcolors
          rooms[myRoom].sendAll('usersColors', {
            usersColors: rooms[myRoom].userBank
          });
        }

        if (myUsername && myScore) {
          sendAll('chatMsg', {
            username: 'CB',
            msg: '<b><i>' + myUsername + ' (' + myScore + ') just left the chat.</b></i>'
          });
        }

      });


      socket.on('usernameSubmit', function(data) {

        console.log(data.username);
        setTimeout(function() {

          var checkForBadWords = function(name) {
            var includesBad = false;
            var badWords = ['fuck', 'cock', 'pus', 'dick', 'bastard', 'cunt', 'ass', 'nig', 'bitch'];
            for (var i = 0; i < badWords.length; i++) {
              if (data.username.toLowerCase().indexOf(badWords[i]) !== -1) {
                includesBad = true;
              }
            }
            return includesBad;
          };

          var checkForAlreadyUsed = function(name) {
            console.log(users, name);
            var taken = false;
            users.forEach(function(userObj) {
              if (name === userObj.username) {
                taken = true;
              }
            });
            return taken;
          };


          if (data.username.length < 3 || data.username.length > 10) {
            socket.emit('username-feedback', {
              res: 'bad',
              msg: 'must be between 3-10 characters long'
            });
          } else if (data.username.indexOf(' ') !== -1) {
            socket.emit('username-feedback', {
              res: 'bad',
              msg: 'must not include spaces'
            });
          } else if (checkForBadWords(data.username)) {
            socket.emit('username-feedback', {
              res: 'bad',
              msg: 'no curse words'
            });
          } else if (checkForAlreadyUsed(data.username)) {
            socket.emit('username-feedback', {
              res: 'bad',
              msg: 'username already taken'
            });
          } else if (!myUsername) {

            var handshake = uuid.v1();

            console.log('inserting', queryText, [data.username, 'today', 0, 0, 100, handshake]);
            var queryText = 'INSERT INTO highscores (username, dateset, games, points, score, handshake) VALUES($1, $2, $3, $4, $5, $6) RETURNING *';
            pool.query(queryText, [data.username, 'today', 0, 0, 100, handshake], function(err, result) {

              console.log('error', err);
              console.log('result', result);
              username = data.username;
              users.push(result.rows[0]);

              if (err)  console.error(err);

              console.log(JSON.stringify(result));
              console.log('created new user ' + data.username);
              socket.emit('username-feedback', {
                res: 'good',
                msg: 'congratulations, you are good to go',
                score: 100,
                handshake: handshake,
                username: data.username
              });
              myScore = 100;

            });



          }

        }, 1000);
      });

      socket.on('verifyLogin', function(userObj) {
        verifyUser(userObj, function(foundUsr) {
          if (foundUsr) {
            socket.emit('login-feedback', {
              res: true,
              score: foundUsr.score,
              username: foundUsr.username,
              handshake: foundUsr.handshake
            });
            myScore = foundUsr.score;
          } else {
            console.log('NOT FOUND ', userObj);
            socket.emit('login-feedback', {
              res: false
            });
          }
        });
      });

      socket.on('addToRound', function(data) {

        rooms[myRoom].curPlayingQueue.push(myUserId);

      });

      socket.on('leaveRoom', function() {

        if (myRoom) {

          //console.log('user' + myUserId + ' leaving ' + myRoom);
          socket.leave(myRoom);

          if (myRoom !== 'lobby') {

            rooms[myRoom].passColorOff(myUserId);
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
          if (!myUsername && myScore) {
            console.log(JSON.stringify(data));
            if (data.uid) {
              myUsername = data.uid;
              sendAll('chatMsg', {
                username: 'CB',
                msg: '<b><i>' + myUsername + ' (' + myScore + ') just joined the chat.</b></i>'
              });
              console.log(myUsername + ' (' + myScore + ') just logged in (' + myUserId + ') with clientIp ' + clientIp );
            }
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
            rooms[myRoom].checkAndHandleWinners(true);   // force it!
          }, 5000);
        }

        //console.log('user finishedcalc');
        rooms[myRoom].finishedCalc++;
        rooms[myRoom].RGBCounts[myUserId] = data.pixelData;

        rooms[myRoom].checkAndHandleWinners();

      });

      socket.on('submitHS', function(data) {

        console.log('inserting score...' + JSON.stringify(data));

        //console.log('about to insert');
        var textDate = getCurDate();
        var queryText = 'UPDATE "highscores" SET "dateset"=\'' + textDate + '\', "games"=' + data.games + ', "points"=' + data.pts + ' WHERE "username"=\'' + data.username + '\'';

        //console.log(queryText);

        pool.query(queryText, function(err, result) {

          console.log( err, result);

          // if (err || result.rowCount === 0) {
          //
          //   // okay so we couldnt update when username sent in a record today...
          //   // but dont go ahead and insert if they already sent in a better record today
          //   client.query('SELECT * FROM "highscores" WHERE "username"=\'' + data.username + '\' AND "dateset"=\'' + textDate + '\'', function(err, result) {
          //
          //     //console.log('select from highscores where username and dateset');
          //     //console.log('err for this ' + err);
          //     //console.log('result here ' + JSON.stringify(result));
          //
          //     // if (result.rowCount === 0) {
          //     //   // only go ahead with the insert if they havent had any records from the same day that are less than data.games
          //     //
          //     //       var queryText = 'INSERT INTO "highscores" ("username", "dateset", "games", "points") VALUES ($1, $2, $3, $4)';
          //     //
          //     //       //console.log(queryText);
          //     //
          //     //       client.query(queryText, [data.username, textDate, data.games, data.pts], function(err, result) {
          //     //         //console.log('here' + JSON.stringify(result) + ' ' + err);
          //     //         if (!err) {
          //     //           //console.log('no error');
          //     //
          //     //           socket.emit('congrats');
          //     //           updateScoresAndEmit(client, done);
          //     //
          //     //
          //     //         } else {
          //     //           //console.log('err ' + err);
          //     //         }
          //     //         //console.log('now here');
          //     //
          //     //       });
          //     //
          //     // }
          //
          //   });
          //
          //
          // } else {
          //
          //
          //
          // }

          // update worked
          socket.emit('congrats');
          updateScoresAndEmit();

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

          sendAll('chatMsg', {
            username: myUsername,
            msg: escapeHTML(data.msg)
          });

        }

      });

      socket.on('log', function(data) {
        console.log(JSON.stringify(data));
      });

      socket.on('requestTopPlayers', function() {
        console.log('request');
        var queryText = 'SELECT username, score FROM highscores ORDER BY score desc';
        pool.query(queryText, function(err, result) {

          users = result.rows;
          socket.emit('sentTopPlayers', {topPlayers: users.slice(0, 10), force: true});
          //console.log(users)

        });
      });

  } else {
    console.log("WARNING: BLOCKED ATTEMPT FROM " + clientIp);
  }


});

var getCurDate = function() {
  var dateNow = new Date();
  var adjDate = new Date();
  adjDate.setHours(dateNow.getHours() - 5);
  var textDate = adjDate.toISOString().slice(0, 10);
  textDate = textDate.substr(5) + '-' + textDate.substr(0, 4);
  return textDate;
}

console.log(getCurDate());
