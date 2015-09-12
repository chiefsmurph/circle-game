// establish socket connection
var socket = io.connect(window.location.hostname + ":" + window.location.port);
var maxClickerSize = 170;
var ticker = 30;
var activeGame = false;
var myColor;

var setStatus = function(text, length, cb) {
  $('#statusPanel').show();
  $('#statusPanel').text(text);

  if (length) {
    setTimeout(function() {
      $('#statusPanel').fadeOut(200, cb);
    }, length-200);
  }

};

socket.on('startGame', function(data) {
  console.log('new game');
  setStatus('3', 1000, function() {
    setStatus('2', 1000, function() {
      setStatus('1', 1000, function() {
        setStatus('GO!', 1000, function() {
          activeGame = true;

          // setup ticker
          $('#ticker').text(ticker);
          var timer = setInterval(function() {
            ticker--;
            $('#ticker').text(ticker);
            if (ticker === 0) {
              clearInterval(timer);
              activeGame = false;
            }
          }, 1000);

        });
      });
    });
  });
});


socket.on('setColor', function(data) {
  myColor = data.color;
  $('.circle').css('background-color', myColor);
  console.log('my color...' + myColor);
});

// setup counter watching socket
socket.on('newCircle', function (data) {

  if (activeGame) {

      console.log('stat');

      var newCircle = $('<div class="circle"></div>');
      newCircle.css('top', data.y);
      newCircle.css('left', data.x);
      newCircle.css('background-color', data.col);

      var endPt = {
        x: data.x - (data.rad / 2),
        y: data.y - (data.rad / 2),
      };

      $('#gamearea').append(newCircle);

      newCircle.animate({
        top: endPt.y,
        left: endPt.x,
        width: data.rad,
        height: data.rad,
        borderTopLeftRadius: data.rad,
        borderTopRightRadius: data.rad,
        borderBottomLeftRadius: data.rad,
        borderBottomRightRadius: data.rad
      }, data.rad * 10);

  }

});



$(function() {

  var xPos,   // coordinates of current click
      yPos;

  // ONCE THE DOM HAS LOADED...

  // FIRST OFF INITIALIZATIONS


  $('#gamearea').mousedown(function (e) {

    if (activeGame) {

      var elm = $(this);
      xPos = e.pageX - elm.offset().left;
      yPos = e.pageY - elm.offset().top;

      var endPt = {
        x: xPos - (maxClickerSize / 2),
        y: yPos - (maxClickerSize / 2),
      };

      $('#yourClicker').css('width', 0);
      $('#yourClicker').css('height', 0);
      $('#yourClicker').css('borderRadius', 0);
      $('#yourClicker').css('top', yPos);
      $('#yourClicker').css('left', xPos);

      $('#yourClicker').show();
      $('#yourClicker').animate({
        top: endPt.y,
        left: endPt.x,
        width: maxClickerSize,
        height: maxClickerSize,
        borderTopLeftRadius: maxClickerSize,
        borderTopRightRadius: maxClickerSize,
        borderBottomLeftRadius: maxClickerSize,
        borderBottomRightRadius: maxClickerSize
      }, maxClickerSize * 20, 'linear', function() {

        // if user holds down for full second
        $('#yourClicker').hide();
        socket.emit('addCircle', {x: xPos, y: yPos, rad: maxClickerSize, col: myColor});

      });

      console.log(xPos, yPos);

    }

  });

  $('#gamearea').mouseup(function() {

    if (activeGame) {

        $('#yourClicker').stop();
        $('#yourClicker').hide();
        socket.emit('addCircle', {x: xPos, y: yPos, rad: $('#yourClicker').width(), col: myColor});

    }

  });


  //END INITS



});
