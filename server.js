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
var inGame = false;
var finishedCalc = 0;

io.sockets.on('connection', function (socket) {

  var checkAndStart = function() {

    if (numPlayers > 1) {
      setTimeout(function() {
        io.sockets.emit('startGame');
        inGame = true;
      }, 1000);
      console.log('start game')

    } else {
      console.log('only ' + numPlayers + ' are here currently');
    }

  };

  socket.on('disconnect', function() {
    console.log('user left');
    numPlayers--;
    if (numPlayers === 1) {
      inGame = false;
      io.sockets.emit('loner');
    }
  });

  socket.on('finishedCalc', function() {
    console.log('user finishedcalc');
    finishedCalc++;
    if (numPlayers === finishedCalc) {
      console.log('game over and all users finishedcalc');
      finishedCalc = 0;
      setTimeout(function() {

        checkAndStart();

      }, 5000); // wait 5 sec before starting new game
    }
  })

  numPlayers++;
  socket.emit('setColor', {color: possibleColors[ numPlayers % possibleColors.length ]});


  checkAndStart();

  socket.on('addCircle', function(circle) {
    console.log('circle: ' +  JSON.stringify(circle));
    io.sockets.emit('newCircle', {x: circle.x, y: circle.y, rad: circle.rad, col: circle.col});
  });

});

io.sockets.on('addCircle', function(socket) {

});
