// establish socket connection
var socket = io.connect(window.location.hostname + ":" + window.location.port);
var maxClickerSize = 170;
var ticker;   // time left on ticker
var timer;  // actual timer setinterval
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
          ticker = 30;
          $('#ticker').text(ticker);
          $('#ticker').show();
          timer = setInterval(function() {
            ticker--;
            $('#ticker').text(ticker);
            if (ticker === 0) {
              // game finished
              window.clearInterval(timer);
              activeGame = false;
              $('#ticker').hide();
              calculateWinner();
            }
          }.bind(this), 1000);

        });
      });
    });
  });
});

socket.on('loner', function() {

    window.clearInterval(timer);
    $('#ticker').fadeOut();
    clearCircles();
    setStatus('Waiting for other players');
});

var clearCircles = function() {
  $('#gamearea').find('.circle').fadeOut(1500, function() {
    $(this).remove();
  });
}

var calculateWinner = function() {

  var colorRGBtoName = {
    '0,0,255': 'blue',
    '0,128,0': 'green',
    '255,165,0': 'orange',
    '255,0,0': 'red'
  };

  console.log('calculating');
  setStatus('Calculating winner...');

  html2canvas($('#gamearea'), {
    onrendered: function(canvas) {

        console.log('got the canvas');
        console.log('canvas' + canvas);

        var c = canvas.getContext('2d');
        var colorScores = {};

        var pixelData = c.getImageData(0, 0, canvas.width, canvas.height).data;

        for (var i = 0; i < pixelData.length; i+=4) {

            var rgb = pixelData[i] + ',' + pixelData[i+1] + ',' + pixelData[i+2];
            colorScores[rgb] = (colorScores[rgb]) ? colorScores[rgb] + 1 : 1;

        }

        var topScore = 0;
        var topColor;
        for (var color in colorScores) {
          if (colorScores[color] > topScore && color != "0,0,0" && color != "255,255,255") {
            topScore = colorScores[color];
            topColor = color;
          }
        }

        setStatus('winner: ' + ((colorRGBtoName[topColor]) ? colorRGBtoName[topColor] : 'tie'), 4000, function() {

            socket.emit('finishedCalc');

          setStatus('Waiting for new game to start');

        });

        setTimeout(function() {
          clearCircles();
        }, 1000);

    }

  });

}


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
      }, data.rad * 20);

  }

});



$(function() {

  setStatus('Waiting for other players');

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
      }, maxClickerSize * 9, 'linear', function() {

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
