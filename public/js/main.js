// establish socket connection
var socket = io.connect(window.location.hostname + ":" + window.location.port);

var maxClickerSize = 170; // bigger = easier, smaller = harder
var clickerSpeed = 9; // higher = longer, lower = faster

var colorRGBtoName = {
  '0,0,255': 'blue',
  '0,128,0': 'green',
  '255,165,0': 'orange',
  '255,0,0': 'red'
};

var ticker;   // time left on ticker
var timer;  // actual timer setinterval
var activeGame = false;
var myColor;
var numPlayers = 1;
var lastClickCoords = {};

// console.log('sending join room public');
// socket.emit('joinRoom', {room: 'public'});
// $('#curRoom').text('public');

var chooseRoom = function(roomToGo) {

  roomToGo = roomToGo || $('#customRoomName').val();

  $('#statusPanel').fadeOut(1000);
  $('#roomChooser').fadeOut(1000, function() {

    socket.emit('joinRoom', {room: roomToGo});
    $('#curRoom').text(roomToGo);

    setStatus('Waiting for other players');
    $('#rulesPanel').removeClass('hider');
    $('#bottomStatus').show();
    $('#backRoomButton').prop('disabled', false);
  });

};

var showCustomText = function() {
  $('#customText').fadeIn();
};

var setStatus = function(text, length, cb) {
  $('#statusPanel').show();
  $('#statusPanel').html(text);

  if (length) {
    setTimeout(function() {
      $('#statusPanel').fadeOut(200, cb);
    }, length-200);
  }

};

var showTitleScreen = function(cb) {

  setTimeout(function() {
    $('#circle-battle-icon').fadeIn(3000);
  }, 500);

  $('#circle-text').animate({top: '130px'}, 3500, 'easeOutQuart');
  $('#battle-text').animate({bottom: '240px'}, 3500, 'easeOutQuart', function() {



    setTimeout(function() {
      $('#titleScreen').fadeOut('slow', function() {

        cb();

      });
    }, 900);


  });

};

var backToRoomChooser = function() {

  socket.emit('leaveRoom');
  socket.emit('requestRoomTotals');

  ticker = 0;   // time left on ticker
  window.clearInterval(timer);
  timer = null;  // actual timer setinterval
  activeGame = false;
  myColor = null;
  numPlayers = 0;

  // if there are circles clear them
  $('#gamearea').find('.circle').fadeOut(200, function() {
    $(this).remove();
  });

  $('#rulesPanel').addClass('hider');
  $('#ticker').hide();
  $('#bottomStatus').hide();

  $('#roomChooser').show();
  setStatus('Choose a room');

  $('#colorBox').addClass('hider');

  console.log('leaving room');
  $('#curRoom').text('');

  $('#backRoomButton').prop('disabled', true);

};

socket.on('startGame', function(data) {

  if (!activeGame) {
      console.log('new game');
      $('#backRoomButton').prop('disabled', true);  // no back to room during countdown
      $('#rulesPanel').addClass('hider');
      setStatus('3', 1000, function() {

        if (numPlayers > 1) {
          setStatus('2', 1000, function() {

            if (numPlayers > 1) {
              setStatus('1', 1000, function() {

                if (numPlayers > 1) {
                  setStatus('GO!', 1000, function() {

                    if (numPlayers > 1) {

                          socket.emit('addToRound');    // for keeping track of the users playing the current round

                          // GAME STARTING..........
                          activeGame = true;

                          // setup ticker
                          ticker = 30;
                          $('#ticker').text(ticker);
                          $('#ticker').show();
                          $('#backRoomButton').prop('disabled', false);

                          timer = setInterval(function() {
                            ticker--;
                            $('#ticker').text(ticker);
                            if (ticker === 0) {
                              // GAME FINISHED.......
                              $('#gamearea').find('.circle').stop();
                              window.clearInterval(timer);
                              timer = null;
                              activeGame = false;
                              $('#ticker').hide();
                              $('#bottomStatus').hide();
                              calculateWinner();
                            }
                          }, 1000);

                    } else {
                      backToWaiting();
                    }

                  });
                } else {
                  backToWaiting();
                }

              });
            } else {
              backToWaiting();
            }

          });
        } else {
          backToWaiting();
        }

      });

  }
});

socket.on('playerCount', function(data) {

    numPlayers = data.count;
    $('#numPlayers').text(numPlayers);
    if (numPlayers === 1) {
      activeGame = false;
      backToWaiting();
    }

});

socket.on('roomTotals', function(data) {

  $('#beginner-count').text("(" + data.beginnerCount[0] + "/" + data.beginnerCount[1] + ")");
  $('#intermediate-count').text("(" + data.intermediateCount[0] + "/" + data.intermediateCount[1] + ")");
  $('#advanced-count').text("(" + data.advancedCount[0] + "/" + data.advancedCount[1] + ")");

});

socket.on('setSettings', function(data) {

    maxClickerSize = data.maxClickerSize;
    clickerSpeed = data.clickerSpeed;

});

var backToWaiting = function() {

  window.clearInterval(timer);
  timer = null;
  $('#ticker').fadeOut();
  $('#rulesPanel').removeClass('hider');
  $('#backRoomButton').prop('disabled', false);
  clearCircles();
  setStatus('Waiting for other players');

};

var clearCircles = function() {
  $('#gamearea').find('.circle').fadeOut(1500, function() {
    $(this).remove();
  });
}

var calculateWinner = function() {

  console.log('calculating');
  setStatus('Calculating winner...');

  var $copyBoard = $('#gamearea').find('.circle').clone();

  $('#hiddenGameArea').append($copyBoard);

  html2canvas($('#hiddenGameArea'), {
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
        console.log(colorScores);

        var sendablePixelData = {};
        var importantRGB = Object.keys(colorRGBtoName);
        for (var i = 0; i < importantRGB.length; i++) {
          sendablePixelData[importantRGB[i]] = (colorScores[importantRGB[i]]) ? colorScores[importantRGB[i]] : 0;
        }
        console.log('sendable'  + JSON.stringify(sendablePixelData));
        socket.emit('finishedCalc', {pixelData: sendablePixelData});

        setStatus('Calculating winner-sent...');
        $('#hiddenGameArea').empty();



    }

  });

}

socket.on('winner', function(data) {

    window.clearInterval(timer);
    timer = null;
    activeGame = false;
    $('#ticker').hide();

    var topColor = data.topColor;
    console.log('topColor: ' + topColor);

    // display winner and winBy
    setStatus('winner: ' + ((colorRGBtoName[topColor]) ? colorRGBtoName[topColor] + '<br><br>and won by...<br><i>' + data.winBy + ' points</i>'  : 'tie'), 4000, function() {

        // update high score table if user is winner
        if (colorRGBtoName[topColor] === myColor) {

          $('#streakGames').text( parseInt($('#streakGames').text()) + 1 );
          $('#streakPoints').text( parseInt($('#streakPoints').text()) + data.winBy );

          // and then compare the currentstreak's gamecount with the topstreak gamecount
          if ($('#streakGames').text() > $('#topGames').text() ) {

            $('#topGames').text( $('#streakGames').text() );
            $('#topPoints').text( $('#streakPoints').text() );

          }

        } else {

          // if not winner then reset current streak
          $('#streakGames').text('00');
          $('#streakPoints').text('00000');

        }

        // back to the waiting for new game
        setStatus('Waiting for new<br>game to start');
        $('#rulesPanel').removeClass('hider');
        $('#bottomStatus').show();

    });

    setTimeout(function() {
      clearCircles();
    }, 1000);

});


socket.on('setColor', function(data) {

  myColor = data.color;

  if (myColor) {

    $('.circle').css('background-color', myColor);
    $('#colorBox').text(myColor);
    $('#colorBox').css('background-color', myColor);
    $('#colorBox').removeClass('watch-mode');
    $('#colorBox').removeClass('hider');
    console.log('my color...' + myColor);

  } else {

    // didnt get a color because room is currently full
    console.log('waiting for there to be space in the room');
    $('#colorBox').text('WATCHING');
    $('#colorBox').attr('class', 'watch-mode');

  }


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

  setTimeout(function() {

    socket.emit('requestRoomTotals');
    showTitleScreen(function() {

      setStatus('Choose a room');
      $('#roomChooser').show();

    });

  }, 200);

  var xPos,   // coordinates of current click
      yPos;

  // ONCE THE DOM HAS LOADED...

  // FIRST OFF INITIALIZATIONS


  // event handlers

  // mouse

  $('#gamearea').on('mousedown touchstart', function (e) {

    if (activeGame && myColor !== null) {

      var elm = $(this);
      xPos = (e.type.toLowerCase() === 'mousedown')
                    ? e.pageX
                    : e.originalEvent.touches[0].pageX;
      xPos -= elm.offset().left;
      yPos = (e.type.toLowerCase() === 'mousedown')
                    ? e.pageY
                    : e.originalEvent.touches[0].pageY;
      yPos -= elm.offset().top;

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
      }, maxClickerSize * clickerSpeed, 'linear', function() {

        if (lastClickCoords.xPos !== xPos || lastClickCoords.yPos !== yPos) {

          // if user holds down for full second
          $('#yourClicker').hide();
          console.log('here');
          socket.emit('addCircle', {x: xPos, y: yPos, rad: maxClickerSize, col: myColor});
          lastClickCoords.xPos = xPos;
          lastClickCoords.yPos = yPos;
        }

      });

      console.log(xPos, yPos);
      e.preventDefault();

    }


  });

  $('#gamearea').on('mouseup touchend', function(e) {

    if (activeGame && myColor !== null) {

      if (lastClickCoords.xPos !== xPos || lastClickCoords.yPos !== yPos) {

        $('#yourClicker').stop();
        $('#yourClicker').hide();
        console.log('there');
        socket.emit('addCircle', {x: xPos, y: yPos, rad: $('#yourClicker').width(), col: myColor});
        lastClickCoords.xPos = xPos;
        lastClickCoords.yPos = yPos;

        e.preventDefault();

      }

    }


  });

  $(window).blur(function() {
    console.log('blur');
    //backToRoomChooser();
  });


  //END INITS



});
