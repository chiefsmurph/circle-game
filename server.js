var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var port = process.env.PORT || 5000; // Use the port that Heroku
server.listen(port);

var bodyParser = require('body-parser')
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())


app.use(express.static(__dirname + '/public'));


var count = 238226;


app.get('/getCounter', function(req, res, next) {

  res.json({count: count});



});

app.post('/submit-sig', function(req, res, next) {
  console.log(req.body);

  count++;
  
  res.json({response: 'thank you!  your pledge has been received.'});

  setTimeout(function() {
    io.sockets.emit('status', { count: count });
  }, 1000);
});

io.sockets.on('connection', function (socket) {
  io.sockets.emit('status', { count: count }); // note the use of io.sockets to emit but socket.on to listen
});
