// establish socket connection
var socket = io.connect(window.location.hostname + ":" + window.location.port);
//var socket = io.connect('http://www.circlebattle.com');

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

var audioBank = {};
var audioLoaded = false;   // turns true when all audio loaded
var isMuted = false;
var curAudio = null;

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

var validateText = function(min, max, el) { // boolean

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
      console.log('setting username to ' + username )
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

  changeAudio('jovial');
}

var showUserScreen = function(cb) {

  $('#loginScreen').show();
  $('#username').focus();
  $('#setUserBtn').on('click', function() {

    handleUsernameSubmit(cb);

  });

};

var preloadAudio = function() {

  var audioLoaded = 0;
  var audioToLoad = 3;

  var loadAudio = function(url, loop, necessary) {
    var audio = new Howl({
      urls: [url],
      loop: loop,
      onload: function() {
        if (necessary) {
          audioLoaded++;
          console.log('loaded');
          if (audioLoaded === audioToLoad) {
            start();
          }
        }
      }
    });
    return audio;
  }

  audioBank['contemplative'] = loadAudio('audio/contemplative t1.mp3', true, true);
  audioBank['jovial'] = loadAudio('audio/jovial t1 mod.mp3', true, true);
  audioBank['welcome'] = loadAudio('audio/welcome t1 mod vox.mp3', false, true);
  audioBank['anthem'] = loadAudio('audio/30s anthem t1.mp3', false );

  audioBank['slower'] = loadAudio('audio/slow lobby.mp3', true );
  audioBank['medium'] = loadAudio('audio/medium lobby mod.mp3', true );
  audioBank['faster'] = loadAudio('audio/fast lobby.mp3', true );

  audioBank['smaller'] = audioBank['slower'];
  audioBank['middle'] = audioBank['medium'];
  audioBank['larger'] = audioBank['faster'];

};

preloadAudio();

var toggleMute = function() {
  if (!isMuted) {
    $('#muteunmute').css('background-image', 'url("img/muted.png")');
    $('#muteunmute').css('background-color', 'rgba(244,69,0,0.8)');
    Howler.mute();
    docCookies.setItem('muted', 'true');
  } else {
    $('#muteunmute').css('background-image', 'url("img/unmuted.png")');
    $('#muteunmute').css('background-color', 'rgba(255,255,255,0.9)');
    Howler.unmute();
    docCookies.setItem('muted', 'false');
  }
  isMuted = !isMuted;
}

var changeAudio = function(c) {

  if (curAudio) {
    var pastAudio = curAudio;
    audioBank[pastAudio].fadeOut(0, 500, function() {
      audioBank[pastAudio].stop();
    });
  }

  console.log('now playing ' + c);

  if (!isMuted) {
    audioBank[c].pos(0, 0);
    audioBank[c].volume(1.0);
  }
  audioBank[c].play();
  curAudio = c;

};

var chooseRoom = function(roomToGo) {

  roomToGo = roomToGo || $('#customRoomName').val();

  $('#statusPanel').fadeOut(950);
  $('#roomChooser').fadeOut(950);
  curRoom = roomToGo;

  if (['slower','medium','faster', 'smaller','middle','larger'].indexOf(curRoom) !== -1) {
    changeAudio(curRoom);
  }

  setTimeout(function() {

    if (curRoom === roomToGo) {   // make sure nothing has changed since when they clicked

      $('#bottomStatus').html("room: <span id='curRoom'></span> || # of players: <span id='numPlayers'></span>");
      socket.emit('leaveRoom');
      socket.emit('joinRoom', {room: roomToGo, uid: username});
      $('#curRoom').text(roomToGo);


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
    $('#highScorePanel').animate({'top': '500px'}, 700, 'easeOutCubic');
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
    }, 2500);


  });

};

var saySomething = function(txt) {
  $('#consoleMessage').text('says "' + txt + '"');
  $('#consoleMessage').show();
  setTimeout(function() {
    $('#consoleMessage').fadeOut(3000);
  }, 4000);
};

var backToRoomChooser = function() {

  socket.emit('leaveRoom');
  socket.emit('joinRoom', {room: 'lobby'});

  changeAudio('jovial');

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

  $('#muteunmute').show();
  $('#rulesPanel').addClass('hider');
  $('#ticker').hide();
  $('#bottomStatus').html("total # of battlers: <span id='numPlayers'></span>");
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

  console.log('leaving room');
  $('#curRoom').text('');
  curRoom = 'lobby';

  $('#backRoomButton').prop('disabled', true);

};

socket.on('usersColors', function(data) {
  console.log('usercolors ' + JSON.stringify(data.usersColors));

  var usersColsTable = $('#usersAndColors table');
  usersColsTable.empty();

  for (var user in data.usersColors) {
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

});

socket.on('highScores', function(data) {

  //console.log('received high scores' + JSON.stringify(data));
  $('#highScorePanel tbody').empty();
  highScoreData = data.scoreArr;

  setTimeout(function() {
    saySomething( "All hail " + highScoreData[0].username + "!" );
  }, 11000);

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

  console.log('alreadyingame');
  setStatus('Waiting for game to finish');

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

              setTimeout(function() {
                changeAudio('anthem');
              }, 600);

              setStatus('1', 1000, function() {


                if (numPlayers > 1) {
                  setStatus('GO!', 1000, function() {

                    if (numPlayers > 1 && !activeGame) {

                          socket.emit('addToRound');    // for keeping track of the users playing the current round

                          // GAME STARTING..........
                          activeGame = true;

                          // setup ticker
                          ticker = 30;
                          $('#ticker').text(ticker);
                          $('#ticker').show();
                          $('#backRoomButton').prop('disabled', false);
                          $('#muteunmute').hide();

                          clickEquality = 0;

                          timer = setInterval(function() {
                            ticker--;
                            $('#ticker').text(ticker);
                            if (ticker === 0) {
                              // GAME FINISHED.......
                              $('#gamearea').find('.circle').stop();
                              $('#yourClicker').stop();
                              $('#yourClicker').hide();
                              $('#muteunmute').show();
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
    if (activeGame && numPlayers === 1) {
      activeGame = false;
      backToWaiting();
    } else if (!activeGame && numPlayers > 1) {
      setStatus('Waiting for<br>game to start');
    } else if (!activeGame && numPlayers === 1) {
      setStatus('Waiting for<br>others to join');
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
  $('#smaller-count').text("(" + data.smallerCount + ")");
  $('#middle-count').text("(" + data.middleCount + ")");
  $('#larger-count').text("(" + data.largerCount + ")");
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

  $('#gamearea').find('.circle').fadeTo(400, 0.5);

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

};


var start = function() {

  $('#splashscreen').fadeOut();

  $('#infoPanel').fadeIn(250);
  $('#hiddenGameArea').fadeIn(250);
  $('#topArea').fadeIn(250);

  changeAudio('welcome');

  $('#gamearea').fadeIn(250, function() {

    $('#chatPanel').fadeIn(250);
    $('#usersColors').fadeIn(250);


      setTimeout(function() {

        showTitleScreen(function() {

          changeAudio('contemplative');
          showUserScreen(function() {

            moveToLobby();

          });

        });

      }, 900);

      $("#username").val(docCookies.getItem('pastusername'));

  });

}

// SOCKET STUFF

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
    if (colorRGBtoName[topColor] && colorRGBtoName[topColor].toLowerCase() === myColor.toLowerCase()) {

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

    $('#rulesPanel').addClass('hider');      // just in case



    // display winner and winBy
    setStatus('winner: ' + ((colorRGBtoName[topColor]) ? colorRGBtoName[topColor] + '<br><br>and won by...<br><i>' + data.winBy + ' points</i>'  : 'tie'), 4000, function() {

        if (curRoom !== 'lobby') {
          // back to the waiting for new game
          setStatus('Waiting for new<br>game to start');
          $('#rulesPanel').removeClass('hider');
          $('#bottomStatus').show();

          changeAudio(curRoom);
        }

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

      if (clickerSpeed < 1) {
        setTimeout(function() {
          if (newCircle)
            newCircle.remove();
        }, 20000);
      }

  }

});



$(function() {

  if (docCookies.getItem('muted') == 'true') {
    toggleMute();
  }

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
          console.log('here');
          socket.emit('addCircle', {x: xPos, y: yPos, rad: maxClickerSize, col: myColor});
          lastClickCoords.xPos = xPos;
          lastClickCoords.yPos = yPos;
          activeClick = false;
          clickEquality--;
        }

      });

      console.log(xPos, yPos);
      e.preventDefault();

    }


  });

  $('#gamearea').on('mouseup touchend', function(e) {

    if (activeGame && myColor !== null) {

      if ((lastClickCoords.xPos !== xPos || lastClickCoords.yPos !== yPos) || clickEquality !== 0) {

        console.log('there');
        socket.emit('addCircle', {x: xPos, y: yPos, rad: $('#yourClicker').width(), col: myColor});
        $('#yourClicker').stop();
        $('#yourClicker').hide();
        $('#yourClicker').css('width', 0);
        $('#yourClicker').css('height', 0);
        lastClickCoords.xPos = xPos;
        lastClickCoords.yPos = yPos;
        clickEquality--;

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

  $(window).load(function() {
    // nevermind
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
