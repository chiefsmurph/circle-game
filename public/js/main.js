// establish socket connection
var socket = io.connect(window.location.hostname + ":" + window.location.port);

var maxClickerSize = 170; // bigger = easier, smaller = harder
var clickerSpeed = 9; // higher = longer, lower = fasterer

// for going from color to rgb
var getRGBfromColor = function( value ) {
    for( var prop in colorRGBtoName ) {
        if( colorRGBtoName.hasOwnProperty( prop ) ) {
             if( colorRGBtoName[ prop ] === value )
                 return prop;
        }
    }
}

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

var ticker;   // time left on ticker
var timer;  // actual timer setinterval
var activeGame = false;
var myColor;
var numPlayers = 1;
var lastClickCoords = {};
var activeClick;
var curRoom;
var highPanelShowing = false;
var highScoreData = [];

var myHighs = {
  curStreak: {
    games: 0,
    points: 0
  },
  topStreak: {
    games: 0,
    points: 0
  }
};

// console.log('sending join room public');
// socket.emit('joinRoom', {room: 'public'});
// $('#curRoom').text('public');

var validateText = function(min, max, el) {

  var badWords = ['fuck', 'cock', 'pus', 'dick', 'bastard', 'cunt', 'ass'];

  var textVal = $(el).val();
  var isValid = true;
  // test min max
  if (textVal.length < min || textVal.length > max) {
    isValid = false;
  }
  // test for alphanumeric
  if (!textVal.match(/^\w+$/)) {
    isValid = false;
  }
  // test for bad words
  for (var i = 0; i < badWords.length; i++) {
    if (textVal.toLowerCase().indexOf(badWords[i]) !== -1) {
      isValid = false;
    }
  }

  return isValid;

};

var showUserScreen = function(cb) {

  $('#loginScreen').show();
  $('#username').focus();
  $('#setUserBtn').on('click', function() {

    if (validateText(3,8,'#username')) {
        // set username
        username = $('#username').val();
        docCookies.setItem('pastusername', username);
        console.log('setting username to ' + username )
        $('#loginScreen').hide();
        cb();
    } else {
      // invalid username
      $('#username').val('');
      $('#username').focus();

    }

  });

};

var chooseRoom = function(roomToGo) {

  roomToGo = roomToGo || $('#customRoomName').val();

  $('#statusPanel').fadeOut(950);
  $('#roomChooser').fadeOut(950);

  setTimeout(function() {

    $('#bottomStatus').html("room: <span id='curRoom'></span> || # of players: <span id='numPlayers'></span>");
    socket.emit('leaveRoom');
    socket.emit('joinRoom', {room: roomToGo});
    $('#curRoom').text(roomToGo);
    curRoom = roomToGo;

    setStatus('Waiting for other players');
    $('#rulesPanel').removeClass('hider');
    $('#backRoomButton').prop('disabled', false);

  }, 1000);

};

var toggleHighs = function() {

  if (!highPanelShowing) {
    $('#highScorePanel').animate({'top': '50px'}, 700, 'easeOutCubic');
    $('#togHSbtn').text('hide high scores');
  } else {
    $('#highScorePanel').animate({'top': '500px'}, 700, 'easeOutCubic');
    $('#togHSbtn').text('view high scores');
  }

  highPanelShowing = !highPanelShowing;
  $('#togHSbtn').removeClass('blue-button');

}

var toggleCustomText = function() {
  $('#customText').fadeToggle(500, function() {
    $('#customRoomName').focus();
  });
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

  setTimeout(function() {
    $('#beta').fadeIn(900);
  }, 2250);

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
  socket.emit('joinRoom', {room: 'lobby'});

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
  $('#bottomStatus').html("total # of battlers: <span id='numPlayers'></span>");
  $('#bottomStatus').show()
  $('#roomChooser').show();
  setStatus('Choose a room');

  $('#colorBox').addClass('hider');

  console.log('leaving room');
  $('#curRoom').text('');
  curRoom = 'lobby';

  $('#backRoomButton').prop('disabled', true);

};

socket.on('highScores', function(data) {

  console.log('received high scores' + JSON.stringify(data));
  $('#highScorePanel tbody').empty();
  highScoreData = data.scoreArr;
  for (var i = 0; i < highScoreData.length; i++) {
    var newRow = $('<tr></tr>');
    newRow.append('<td>' + (i+1) + '</td>');
    for (var field in highScoreData[i]) {
      console.log('this field ' + field + ' and ' + highScoreData[i][field]);
      var newTD = $('<td>' + highScoreData[i][field] + '</td>');
      newRow.append(newTD);
    }
    $('#highScorePanel tbody').append(newRow);
  }

});

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
                              $('#yourClicker').stop();
                              $('#yourClicker').hide();
                              window.clearInterval(timer);
                              timer = null;
                              activeGame = false;
                              $('#ticker').hide();
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
    $('#numPlayers').text(numPlayers + '/' + data.max);
    if (numPlayers === 1) {
      activeGame = false;
      backToWaiting();
    }

});

socket.on('roomTotals', function(data) {

  $('#slower-count').text("(" + data.slowerCount + ")");
  $('#medium-count').text("(" + data.mediumCount + ")");
  $('#faster-count').text("(" + data.fasterCount + ")");
  $('#numPlayers').text( data.totalBattlers );

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

socket.on('congrats', function() {

  $('#togHSbtn').addClass('blue-button');
  console.log('congratulations, you have made a new high score');

});

socket.on('winner', function(data) {

    window.clearInterval(timer);
    timer = null;
    activeGame = false;
    $('#ticker').hide();

    var topColor = data.topColor;
    console.log('topColor: ' + topColor);

    // update high score table if user is winner
    if (colorRGBtoName[topColor].toLowerCase() === myColor.toLowerCase()) {

      myHighs.curStreak.games++;
      myHighs.curStreak.points += data.winBy;
      $('#streakGames span').text( myHighs.curStreak.games );
      $('#streakPoints span').text( myHighs.curStreak.points );

      // and then compare the currentstreak's gamecount with the topstreak gamecount
      if (myHighs.curStreak.games > myHighs.topStreak.games ) {

        myHighs.topStreak.games = myHighs.curStreak.games;
        myHighs.topStreak.points = myHighs.curStreak.points;
        $('#topGames span').text( myHighs.topStreak.games );
        $('#topPoints span').text( myHighs.topStreak.points );

        //check against high score table
        if (highScoreData.length < 10 || (highScoreData[highScoreData.length-1] && myHighs.topStreak.games > highScoreData[highScoreData.length-1].games)) {
          console.log('new hs sending');
          socket.emit('submitHS', {
            username: username,
            games: myHighs.topStreak.games,
            pts: myHighs.topStreak.points
          });
        } else {
          console.log('not a highscore ' + highScoreData.length);
        }

      }

    } else {

      // if not winner then reset current streak
      $('#streakGames span').text('00');
      $('#streakPoints span').text('00000');
      myHighs.curStreak.games = 0;
      myHighs.curStreak.points = 0;

    }

    // display winner and winBy
    setStatus('winner: ' + ((colorRGBtoName[topColor]) ? colorRGBtoName[topColor] + '<br><br>and won by...<br><i>' + data.winBy + ' points</i>'  : 'tie'), 4000, function() {

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

    /*
    // dynamically decide whether white or black text color is better
    var rgb = getRGBfromColor(myColor).split(',');
    console.log(rgb + ' ' + myColor);
    if ( (rgb[0]*0.299 + rgb[1]*0.587 + rgb[2]*0.114) > 186) {
      $('#colorBox').css('color', '#000000');
    } else {
      $('#colorBox').css('color', '#ffffff');
    }
    */

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

    showTitleScreen(function() {

      showUserScreen(function() {

        socket.emit('joinRoom', {room: 'lobby'});
        setStatus('Choose a room');
        $('#roomChooser').show();
        $('#bottomStatus').show();

      });

    });

  }, 200);

  $("#username").val(docCookies.getItem('pastusername'));

  $('#closeHS').click(function() {
    toggleHighs();
  });

  // setup odomoters
  ['#streakGames span', '#streakPoints span', '#topGames span', '#topPoints span'].forEach(function(element) {

    var el = document.querySelector(element);

    var od = new Odometer({
      el: el,
      format: '',
      // Any option (other than auto and selector) can be passed in here
      theme: 'minimal'
    });

  });


  var xPos,   // coordinates of current click
      yPos;

  // ONCE THE DOM HAS LOADED...

  // FIRST OFF INITIALIZATIONS


  // event handlers

  // mouse

  $('#gamearea').on('mousedown touchstart', function (e) {

    if (activeGame && myColor !== null && !activeClick) {

      activeClick = true;

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
          activeClick = false;
        }

      });

      console.log(xPos, yPos);
      e.preventDefault();

    }


  });

  $('#gamearea').on('mouseup touchend', function(e) {

    if (activeGame && myColor !== null) {

      if (lastClickCoords.xPos !== xPos || lastClickCoords.yPos !== yPos) {

        console.log('there');
        socket.emit('addCircle', {x: xPos, y: yPos, rad: $('#yourClicker').width(), col: myColor});
        $('#yourClicker').stop();
        $('#yourClicker').hide();
        $('#yourClicker').css('width', 0);
        $('#yourClicker').css('height', 0);
        lastClickCoords.xPos = xPos;
        lastClickCoords.yPos = yPos;

        e.preventDefault();

      }

      activeClick = false;

    }


  });

  $(window).blur(function() {
    console.log('blur');
    if (curRoom && curRoom !== 'lobby') {
      backToRoomChooser();
    }
  });

  // enter submit
  $("#customRoomName").keypress(function(event) {
      if (event.which == 13) {
          event.preventDefault();
          chooseRoom();
      }
  });


  //END INITS



});
