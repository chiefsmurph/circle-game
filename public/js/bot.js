// establish socket connection
var socket = io.connect('http://www.circlebattle.com');

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
var clickEquality = 0;

//BOTLOGIC
var sentTo = [];
var lastReceived;
var playersInTheRoom = [];

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

  var badWords = ['fuck', 'cock', 'pus', 'dick', 'bastard', 'cunt', 'ass', 'nig', 'bitch'];

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

var handleUsernameSubmit = function(cb) {   //void
  if (validateText(3,8,'#username')) {
      // set username
      username = $('#username').val();
      docCookies.setItem('pastusername', username);
      //console.log('setting username to ' + username )
      $('#loginScreen').hide();
      if (cb) cb();
  } else {
    // invalid username
    $('#username').val('');
    $('#username').focus();

  }
}

var moveToLobby = function() {
  socket.emit('joinRoom', {room: 'lobby'});
  setStatus('Choose a room');
  $('#roomChooser').show();
  $('#bottomStatus').show();
}

var showUserScreen = function(cb) {

  $('#loginScreen').show();
  $('#username').focus();
  $('#setUserBtn').on('click', function() {

    handleUsernameSubmit(cb);

  });

};

var chooseRoom = function(roomToGo) {

  roomToGo = roomToGo || $('#customRoomName').val();

  $('#statusPanel').fadeOut(950);
  $('#roomChooser').fadeOut(950);
  curRoom = roomToGo;

  setTimeout(function() {

    if (curRoom === roomToGo) {   // make sure nothing has changed since when they clicked

      $('#bottomStatus').html("room: <span id='curRoom'></span> || # of players: <span id='numPlayers'></span>");
      socket.emit('leaveRoom');
      socket.emit('joinRoom', {room: roomToGo, uid: username});
      $('#curRoom').text(roomToGo);


      setStatus('Waiting for other players');
      $('#rulesPanel').removeClass('hider');
      $('#backRoomButton').prop('disabled', false);

    }

  }, 1000);

};

var toggleHighs = function() {

  if (!highPanelShowing) {
    $('#highScorePanel').animate({'top': '50px'}, 700, 'easeOutCubic');
    $('#togHSbtn').text('hide high scores');
  } else {
    $('#highScorePanel').animate({'top': '100vw'}, 700, 'easeOutCubic');
    $('#togHSbtn').text('view high scores');
  }

  highPanelShowing = !highPanelShowing;
  $('#togHSbtn').removeClass('blue-button');

};

var sendChat = function() {

  var chatTxt = $('#msgText').val();
  if (chatTxt) {
    socket.emit('chat', { msg: chatTxt });
    $('#msgText').val('');
  }

};

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

// BOTLOGIC
var startBot = function() {

  //console.log('starting bot');

  var shootCircle = function() {

    var shootRad = (Math.random() > 0.6) ? maxClickerSize : Math.round((maxClickerSize/2)+Math.floor(Math.random() * (maxClickerSize /2) ));

    setTimeout(function() {

      //console.log('shooting bot circle');

      if (lastReceived) {

          // 60% - full maxClickerSize
          // 40% - random between 50% - 100% of maxClickerSize
        var shootX = (Math.random() > 0.5) ? lastReceived.x + Math.round(Math.random() * ( (500 - Math.round(shootRad/2)) - lastReceived.x) ) : Math.round(shootRad/2) + Math.floor(Math.random() * lastReceived.x);
        var shootY = (Math.random() > 0.5) ? lastReceived.y + Math.round(Math.random() * ( (500 - Math.round(shootRad/2)) - lastReceived.y) ) : Math.round(shootRad/2) + Math.floor(Math.random() * lastReceived.y);

        socket.emit('addCircle', {x: shootX, y: shootY, rad: shootRad, col: myColor});

      }

      if (activeGame) {
        shootCircle();
      }

    }, (shootRad*clickerSpeed) + Math.floor(Math.random() * 1200));

  }
  shootCircle();

};

var showTitleScreen = function(cb) {

  setTimeout(function() {
    $('#circle-clash-icon').fadeIn(3000);
  }, 500);

  setTimeout(function() {
    $('#beta').fadeIn(900);
  }, 2250);

  $('#circle-text').animate({top: '130px'}, 3500, 'easeOutQuart');
  $('#clash-text').animate({bottom: '240px'}, 3500, 'easeOutQuart', function() {


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

  // BOTLOGIC
  lastReceived = null;

  // if there are circles clear them
  $('#gamearea').find('.circle').fadeOut(200, function() {
    $(this).remove();
  });

  $('#rulesPanel').addClass('hider');
  $('#ticker').hide();
  $('#bottomStatus').html("clashers online: <span id='numPlayers'></span>");
  $('#bottomStatus').show()
  $('#roomChooser').show();
  setStatus('Choose a room');

  $('#usersAndColors div').slideUp(500, function() {
    $('#chatPanel').animate({'left':'189px'}, 700, function() {
      if (curRoom === 'lobby') {    // make sure
        $('#chatArea').empty();
        $('#chatPanel').addClass('hider');
      }
    });
    $('#usersAndColors table').empty();
    $('#usersAndColors').hide();

  });

  $('#colorBox').addClass('hider');

  //console.log('leaving room');
  $('#curRoom').text('');
  curRoom = 'lobby';

  $('#backRoomButton').prop('disabled', true);

};

socket.on('usersColors', function(data) {
  //console.log('usercolors ' + JSON.stringify(data.usersColors));

  var usersColsTable = $('#usersAndColors table');
  usersColsTable.empty();
  playersInTheRoom = [];

  for (var user in data.usersColors) {
    playersInTheRoom.push(data.usersColors[user].username);
    var newTR = $('<tr></tr>');
    newTR.append('<td><div style="background-color: ' + data.usersColors[user].color + '"></div></td>');  // for the circle
    newTR.append('<td>' + data.usersColors[user].username + '</td>');  // for the username
    usersColsTable.append(newTR);
  }
  usersColsTable.html($('tr',usersColsTable).get().reverse());
  // slideright usercolors
  $('#chatPanel').removeClass('hider');
  $('#chatPanel').animate({'left':'309px'}, 700, function() {

    if (curRoom !== 'lobby') {    // in case they are clicking real fast

      $('#usersAndColors').show();
      $('#usersAndColors div').slideDown();

    }

  });

  // BOTLOGIC
  if (Object.keys(data.usersColors).length < 2) {
    setTimeout(function() {
      backToRoomChooser();
    }, 700 + Math.round(Math.random() * 1500));
  }

});

socket.on('highScores', function(data) {

  console.log(JSON.stringify(data));

  //console.log('received high scores' + JSON.stringify(data));
  $('#highScorePanel tbody').empty();
  highScoreData = data.scoreArr;
  for (var i = 0; i < highScoreData.length; i++) {
    var newRow = $('<tr></tr>');
    newRow.append('<td>' + (i+1) + '</td>');
    for (var field in highScoreData[i]) {
      //console.log('this field ' + field + ' and ' + highScoreData[i][field]);
      var newTD = $('<td>' + highScoreData[i][field] + '</td>');
      newRow.append(newTD);
    }
    $('#highScorePanel tbody').append(newRow);
  }

});

socket.on('alreadyInGame', function() {

  //console.log('alreadyingame');
  setStatus('Waiting for game to finish');

});

socket.on('startGame', function(data) {

  if (!activeGame) {
      console.log('new game');
      console.log('all users: ' + JSON.stringify(playersInTheRoom));
      $('#backRoomButton').prop('disabled', true);  // no back to room during countdown
      $('#rulesPanel').addClass('hider');
      setStatus('3', 1000, function() {

        if (numPlayers > 1) {
          setStatus('2', 1000, function() {

            if (numPlayers > 1) {
              setStatus('1', 1000, function() {

                if (numPlayers > 1) {
                  setStatus('GO!', 1000, function() {

                    if (numPlayers > 1 && !activeGame) {

                          socket.emit('addToRound');    // for keeping track of the users playing the current round

                          // GAME STARTING..........
                          activeGame = true;

                          // BOTLOGIC
                          startBot();

                          // setup ticker
                          ticker = 30;
                          $('#ticker').text(ticker);
                          $('#ticker').show();
                          $('#backRoomButton').prop('disabled', false);
                          clickEquality = 0;

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
                              // BOTLOGIC
                              lastReceived = null;
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
    if (activeGame && numPlayers === 1) {
      activeGame = false;
      backToWaiting();
    } else if (numPlayers < 2) {
      // BOTLOGIC
      setTimeout(function() {
        backToRoomChooser();
      }, 700 + Math.round(Math.random() * 1500));
    }

});

socket.on('chatMsg', function(data) {

  $('#chatArea').append('<b>' + data.username + ':</b> ' + data.msg + '<br>');
  $('#chatArea').scrollTop($('#chatArea')[0].scrollHeight);

});

socket.on('roomTotals', function(data) {

  $('#slower-count').text("(" + data.slowerCount + ")");
  $('#medium-count').text("(" + data.mediumCount + ")");
  $('#faster-count').text("(" + data.fasterCount + ")");
  $('#numPlayers').text( data.totalClashers );

  // BOTLOGIC!

  var followtoroom = function(r) {
    setTimeout(function() {
      chooseRoom(r);

      var meId = playersInTheRoom.indexOf(username);
      var otherId = (meId) ? 0 : 1;
      if (sentTo.indexOf(playersInTheRoom[otherId]) === -1) {
        sentTo.push(playersInTheRoom[otherId]);
        setTimeout(function() {
          socket.emit('chat', { msg: 'hey im a computer, and thats cool and all, but id recommend you calling up a friend or two and challenging them to a game of circle clash' });
        }, 15000);
      }

    }, 300 + (Math.random() * 2000));
  };

  if (data.totalClashers < 4) {
    if (data.slowerCount === 1) {
      followtoroom('slower');
    } else if (data.mediumCount === 1) {
      followtoroom('medium');
    } else if (data.fasterCount === 1) {
      followtoroom('faster');
    }
  }

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

  $('#gamearea').find('.circle').fadeTo(400, 0.5);

  //console.log('calculating');
  setStatus('Calculating winner...');

  var $copyBoard = $('#gamearea').find('.circle').clone();

  $('#hiddenGameArea').append($copyBoard);

  html2canvas($('#hiddenGameArea'), {
    onrendered: function(canvas) {

        //console.log('got the canvas');
        //console.log('canvas' + canvas);

        var c = canvas.getContext('2d');
        var colorScores = {};

        var pixelData = c.getImageData(0, 0, canvas.width, canvas.height).data;

        for (var i = 0; i < pixelData.length; i+=4) {

            var rgb = pixelData[i] + ',' + pixelData[i+1] + ',' + pixelData[i+2];
            colorScores[rgb] = (colorScores[rgb]) ? colorScores[rgb] + 1 : 1;

        }
        //console.log(colorScores);

        var sendablePixelData = {};
        var importantRGB = Object.keys(colorRGBtoName);
        for (var i = 0; i < importantRGB.length; i++) {
          sendablePixelData[importantRGB[i]] = (colorScores[importantRGB[i]]) ? colorScores[importantRGB[i]] : 0;
        }
        //console.log('sendable'  + JSON.stringify(sendablePixelData));
        socket.emit('finishedCalc', {pixelData: sendablePixelData});

        setStatus('Calculating winner-sent...');
        $('#hiddenGameArea').empty();


    }

  });

};

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

    // BOTLOGIC
    //console.log('topColor: ' + topColor);

    // update high score table if user is winner
    if (colorRGBtoName[topColor] && colorRGBtoName[topColor].toLowerCase() === myColor.toLowerCase()) {
      console.log('winner: true');
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
          //console.log('new hs sending');
          // socket.emit('submitHS', {
          //   username: username,
          //   games: myHighs.topStreak.games,
          //   pts: myHighs.topStreak.points
          // });
        } else {
          //console.log('not a highscore ' + highScoreData.length);
        }

      }

    } else {

      // if not winner then reset current streak
      $('#streakGames span').text('00');
      $('#streakPoints span').text('00000');
      myHighs.curStreak.games = 0;
      myHighs.curStreak.points = 0;
      console.log('winner: false');
    }

    $('#rulesPanel').addClass('hider');      // just in case



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
    //console.log('my color...' + myColor);

  } else {

    // didnt get a color because room is currently full
    //console.log('waiting for there to be space in the room');
    $('#colorBox').text('WATCHING');
    $('#colorBox').attr('class', 'watch-mode');

  }


});

// setup counter watching socket
socket.on('newCircle', function (data) {

  if (activeGame) {

      if (data.col != myColor) {
        lastReceived = data;
      }

      //console.log('stat');

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

  $('#gamearea').show();

  setTimeout(function() {

    showTitleScreen(function() {

      console.log('here');

      showUserScreen(function() {

        moveToLobby();

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

    if (activeGame && myColor !== null && !activeClick && clickEquality < 5) {

      activeClick = true;
      clickEquality++;

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
          //console.log('here');
          socket.emit('addCircle', {x: xPos, y: yPos, rad: maxClickerSize, col: myColor});
          lastClickCoords.xPos = xPos;
          lastClickCoords.yPos = yPos;
          activeClick = false;
          clickEquality--;
        }

      });

      //console.log(xPos, yPos);


    }

    e.preventDefault();


  });

  $('#gamearea').on('mouseup touchend', function(e) {

    if (activeGame && myColor !== null) {

      if ((lastClickCoords.xPos !== xPos || lastClickCoords.yPos !== yPos) || clickEquality !== 0) {

        //console.log('there');
        socket.emit('addCircle', {x: xPos, y: yPos, rad: $('#yourClicker').width(), col: myColor});
        $('#yourClicker').stop();
        $('#yourClicker').hide();
        $('#yourClicker').css('width', 0);
        $('#yourClicker').css('height', 0);
        lastClickCoords.xPos = xPos;
        lastClickCoords.yPos = yPos;
        clickEquality--;

      }

      activeClick = false;

    }

    e.preventDefault();


  });

  $(window).blur(function() {
    //console.log('blur');
    if (curRoom && curRoom !== 'lobby') {
      backToRoomChooser();
    }
  });

  // enter submits
  $("#customRoomName").keypress(function(event) {
      if (event.which == 13) {
          event.preventDefault();
          chooseRoom();
      }
  });

  $("#username").keypress(function(event) {
      if (event.which == 13) {
          event.preventDefault();
          handleUsernameSubmit(function() {
            moveToLobby();
          });
      }
  });

  $("#msgText").keypress(function(event) {
      if (event.which == 13) {
          event.preventDefault();
          sendChat();
      }
  });

  //END INITS



});
