// establish socket connection
const DEVMODE = false;
var socket = DEVMODE ? io.connect("http://localhost:5000", {
  path: '/socket.io',
  // secure: true
}) : io.connect("https://chiefsmurph.com", {
  path: '/circleclash/socket.io',
  secure: true
});
//var socket = io.connect('http://www.circleclash.com');

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

var userObj;

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
var clickerTimeout;

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

var handleUsernameSubmit = function() {   //void
  if (validateText(3,8,'#username')) {

      socket.emit('usernameSubmit', {
        username: $('#username').val()
      });

  } else {
    // invalid username
    $('#username').val('');
    $('#username').focus();

  }
}

var moveToLobby = function() {
  socket.emit('joinRoom', {room: 'lobby', uid: username});
  setStatus('Choose a room');
  $('#roomChooser').show();
  $('#bottomStatus').show();

  changeAudio('jovial');
  setTimeout(function() {
    saySomething( "Circle Clash Party every day at 6:30 PST" );
  }, 500);

  slideOutChat();
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
          // if (audioLoaded === audioToLoad) {
          //   start();
          // }
        }
      }
    });
    return audio;
  }

  if (!!(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) === false) {

    console.debug('yeah')

      audioBank['contemplative'] = loadAudio('audio/contemplative t1.mp3', true, true);
      audioBank['jovial'] = loadAudio('audio/jovial t1 mod.mp3', true, true);
      audioBank['welcome'] = loadAudio('audio/welcome t1 mod vox ALT.mp3', false, true);
      audioBank['anthem'] = loadAudio('audio/30s anthem t1.mp3', false );

      audioBank['small'] = loadAudio('audio/medium lobby.mp3', true );
      audioBank['medium'] = loadAudio('audio/medium lobby mod.mp3', true );
      audioBank['large'] = loadAudio('audio/fast lobby.mp3', true );


  } else {
    console.debug('nah')
  }

};

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

  if (audioBank[c]) {

      if (curAudio) {
        var pastAudio = curAudio;
        audioBank[pastAudio].stop();
      }

      console.log('now playing ' + c);
      
      audioBank[c].play();
      curAudio = c;

  } else {
    console.debug('blocked ' + c);
  }

};

var chooseRoom = function(roomToGo) {

  roomToGo = roomToGo || $('#customRoomName').val();

  $('#statusPanel').fadeOut(950);
  $('#roomChooser').fadeOut(950);
  curRoom = roomToGo;

  if (['small','medium','large'].indexOf(curRoom) !== -1) {
    changeAudio(curRoom);
  }

  setTimeout(function() {

    if (curRoom === roomToGo) {   // make sure nothing has changed since when they clicked

      $('#bottomStatus').html("room: <span id='curRoom'></span> || # of players: <span id='numPlayers'></span>");
      socket.emit('leaveRoom');
      socket.emit('joinRoom', {room: roomToGo, uid: username});
      $('#curRoom').text(roomToGo);

      renderRulesPanel();
      // $('#rulesPanel').removeClass('hider');
      $('#backRoomButton').prop('disabled', false);

    }

  }, 1000);

};

var renderRulesPanel = function() {

  console.log('renderrulespanel');
  return;

  // generate the contents of the rulesPanel
  var rulesList;
  if (['smaller','middle','larger'].indexOf(curRoom) !== -1) {
    // intensity
    rulesList = ['Start clicking.', 'All clicks = max size', 'Cover the maximum playing area and dominate the game with your color!!!'];
  } else {
    // non-intensity rooms
    rulesList = ['Start clicking.', 'Longer clicks = bigger circles', 'Cover the maximum playing area and dominate the game with your color!!!'];
  }

  // render the rulesPanel HTML
  if (!$('#rulesPanel ol').length) {
    $('#rulesPanel').append('<ol></ol>');
  }

  console.log(rulesList);

  $('#rulesPanel ol').empty();
  rulesList.forEach(function(rule) {
    $('#rulesPanel ol').append('<li>' + rule + '</li>');
  });

}

var toggleHighs = function() {

  if (!highPanelShowing) {
    $('#highScorePanel').animate({'top': '10vw'}, 700, 'easeOutCubic');
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
    console.log('chat', { msg: chatTxt });
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
  console.log(text);
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

  setTimeout(function() {
    saySomething( "Circle Clash Party every day at 6:30 PST" );
  }, 500);

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
  $('#bottomStatus').html("clashers online: <span id='numPlayers'></span>");
  $('#bottomStatus').show()
  $('#roomChooser').show();
  setStatus('Choose a room');

  $('#usersAndColors div').slideUp(500, function() {
    // $('#chatPanel').animate({'left':'189px'}, 700, function() {
    //   if (curRoom === 'lobby') {    // make sure
    //     $('#chatArea').empty();
    //     $('#chatPanel').addClass('hider');
    //   }
    // });
    $('#usersAndColors table').empty();
    $('#usersAndColors').hide();

  });

  $('#colorBox').addClass('hider');

  console.log('leaving room');
  $('#curRoom').text('');
  curRoom = 'lobby';

  $('#backRoomButton').prop('disabled', true);

};

var slideOutChat = function() {
  $('#chatPanel').removeClass('hider');
  $('#chatPanel').animate({'left':'259px'}, 700);
};

var setUserScore = function(num) {
  userObj.score = num;
};
var setUserObj = function(data) {
  console.debug('setuserobj', data);
  // set username
  username = data.username;
  docCookies.setItem('pastusername', username);
  console.log('setting username to ' + username );
  userObj = {
    username: data.username,
    handshake: data.handshake,
    score: data.score
  };
  docCookies.setItem('userStatus', JSON.stringify({
    username: data.username,
    handshake: data.handshake
  }), 31536e3, "/");

  $('#userPanel').html(data.username + '<hr><b>' + data.score + '</b>');
}

var renderHStables = function(data) {

  console.log(data);
  var renderHSheaders = function(headers) {
    $('#highScorePanel thead').html(headers.map(function(head) {
      return '<th>' + head + '</th>'
    }).join(''));
  }
  if (data.length) {
    if (Object.keys(data[0]).length === 4) {
      renderHSheaders(['num', 'name', 'date', 'games', 'points']);
    } else {
      renderHSheaders(['num', 'name', 'score']);
    }
    $('#highScorePanel tbody').empty();
    for (var i = 0; i < data.length; i++) {
      var rowClass = (userObj && userObj.username && data[i].username && data[i].username === userObj.username) ? 'selected-hs' : '';
      var newRow = $('<tr class="' + rowClass + '"></tr>');
      newRow.append('<td>' + (i+1) + '</td>');
      for (var field in data[i]) {
        //console.log('this field ' + field + ' and ' + highScoreData[i][field]);
        var newTD = $('<td>' + data[i][field] + '</td>');
        newRow.append(newTD);
      }
      $('#highScorePanel tbody').append(newRow);
    }
  }
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
  $('#usersAndColors').show();
  $('#usersAndColors div').slideDown();

});

socket.on('sentTopPlayers', function(data) {
  console.log(data);
  renderHStables(data.topPlayers);
});

socket.on('highScores', function(data) {

  //console.log(JSON.stringify(data));

  //console.log('received high scores' + JSON.stringify(data));

  highScoreData = data.scoreArr;

  if (highScoreData[0]) {
    setTimeout(function() {
      saySomething( "All hail " + highScoreData[0].username + "!" );
    }, 2000);
  }

  renderHStables(data.scoreArr);

});

socket.on('username-feedback', function(data) {

  $('#username-response').removeClass('good bad');
  $('#username-response').addClass(data.res);
  $('#username-response').text('response: ' + data.msg);

  if (data.res === 'good') {

    // $('#createuser').prop("disabled",true);
    console.debug(data);
    setUserObj(data);
    setTimeout(function() {
      $('#loginScreen').hide();
      moveToLobby();
    }, 700);


  }

});

socket.on('login-feedback', function(data) {

  if (data.res) {
    setUserObj(data);
    $('#loginScreen').hide();
    moveToLobby();
    console.log('welcome back');
  } else {
    console.error('hackz0r');
    setTimeout(function() {
      docCookies.removeItem('userStatus');
      location.reload();
    }, 4000);
  }

});


socket.on('alreadyInGame', function() {

  console.log('alreadyingame');
  setStatus('Waiting for game to finish');

});

socket.on('updateUsrObj', function(data) {
  setUserObj(data);
});

socket.on('returnToWait', function() {
  console.debug('back to waiting');
  activeGame = false;
  backToWaiting();
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
  console.debug(data.username);
  if (data.username === 'CB') {
    $('#chatArea').append('<note>' + data.msg + '</note>');
  } else {
    $('#chatArea').append('<b>' + data.username + ':</b> ' + data.msg + '<br>');
  }
  $('#chatArea').scrollTop($('#chatArea')[0].scrollHeight);
});

socket.on('roomTotals', function(data) {


  $('#small-count').text("(" + data.smallCount + ")");
  $('#medium-count').text("(" + data.mediumCount + ")");
  $('#large-count').text("(" + data.largeCount + ")");
  $('#numPlayers').text( data.totalClashers );

});

socket.on('setSettings', function(data) {

    maxClickerSize = data.maxClickerSize * width / 500;
    clickerSpeed = data.clickerSpeed;

});

var backToWaiting = function() {

  window.clearInterval(timer);
  timer = null;
  $('#ticker').fadeOut();
  renderRulesPanel();
  // $('#rulesPanel').removeClass('hider');
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

          if (docCookies.hasItem('userStatus')) {



             userObj = JSON.parse(docCookies.getItem('userStatus'));
             setStatus('authorizing...')
             socket.emit('verifyLogin', userObj);
             console.log('verify', userObj);

           } else {

             changeAudio('contemplative');
             showUserScreen(function() {

               moveToLobby();

               setTimeout(function() {
                 saySomething('last week\'s winners - tie!...dikfuk & ggrff');
               }, 10000);

             });

           }



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
    var topName = data.topName;
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
    setStatus('winner: ' + ((topName != "tie") ? '<u style="color: rgb(' + topColor + ') !important; background-color: #000">' + topName + '</u><br><br>and won by...<br><i>' + data.winByPerc + '%</i>'  : 'tie'), 6500, function() {

        if (curRoom !== 'lobby') {
          // back to the waiting for new game
          setStatus('Waiting for new<br>game to start');
          renderRulesPanel();
          // $('#rulesPanel').removeClass('hider');
          $('#bottomStatus').show();

          changeAudio(curRoom);
          setTimeout(function() {
            saySomething( "Circle Clash Party every day at 6:30 PST" );
          }, 500);
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

function getWidth() {
  return Math.max(
    document.body.scrollWidth,
    document.documentElement.scrollWidth,
    document.body.offsetWidth,
    document.documentElement.offsetWidth,
    document.documentElement.clientWidth
  );
}

const width = getWidth();
const covertObjToWidth = obj => ({
  ...obj,
  x: obj.x * 500 / width,
  y: obj.y * 500 / width,
  rad: obj.rad * 500 / width,
});

// setup counter watching socket
socket.on('newCircle', function (data) {
  console.log('new circle', data);
  
  if (activeGame) {

    data.x = data.x * width / 500;
    data.y = data.y * width / 500;
    data.rad = data.rad * width / 500;

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

      // removing this because it was a bad idea :(

      // if (clickerSpeed < 1) {
      //   setTimeout(function() {
      //     if (newCircle)
      //       newCircle.remove();
      //   }, 20000);
      // }

  }

});

var urlParams;
(window.onpopstate = function () {
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = window.location.search.substring(1);

    urlParams = {};
    while (match = search.exec(query))
       urlParams[decode(match[1])] = decode(match[2]);
})();


$(function() {

  if (docCookies.getItem('muted') == 'true') {
    toggleMute();
  }

  if (!isMuted && (urlParams['muted'] === '1' || urlParams['muted'] === 'true' )) {
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

    if (!activeGame || !myColor || activeClick || clickEquality >= 5) {
      return;
    }

    console.log('yes')
    activeClick = true;
    clickEquality++;

    var elm = $(this);
    xPos = (e.type.toLowerCase() === 'mousedown')
                  ? e.originalEvent.pageX
                  : e.originalEvent.touches[0].pageX;

    yPos = (e.type.toLowerCase() === 'mousedown')
                  ? e.originalEvent.pageY
                  : e.originalEvent.touches[0].pageY;

    // socket.emit('log', {
    //   offsetLeft: elm.offset().left,
    //   offsetTop: elm.offset().top,
    //   boundingLeft: elm[0].getBoundingClientRect().left,
    //   boundingTop: elm[0].getBoundingClientRect().top,
    //   xPos: xPos,
    //   yPos: yPos,
    //   finX: xPos - elm[0].getBoundingClientRect().left,
    //   finY: yPos - elm.offset().top,
    // });
    console.log(xPos, yPos)
    // what the heck world??!
    xPos -= elm[0].getBoundingClientRect().left;
    yPos -= elm.offset().top;


    var endPt = {
      x: xPos - (maxClickerSize / 2),
      y: yPos - (maxClickerSize / 2),
    };

    var sendCoords = function() {
      const orig = {x: xPos, y: yPos, rad: maxClickerSize, col: myColor};
      const sendObj = covertObjToWidth(orig);
      socket.emit('addCircle', sendObj);
      console.debug('sendCoords sending circle', { orig, sendObj });
      lastClickCoords.xPos = xPos;
      lastClickCoords.yPos = yPos;
    };

    if (lastClickCoords.xPos === xPos && lastClickCoords.yPos === yPos) {
      return;
    }

    if (clickerSpeed) {

      var startRad = maxClickerSize / 6;

      $('#yourClicker').css('width', startRad);
      $('#yourClicker').css('height', startRad);
      $('#yourClicker').css('borderRadius', startRad);
      $('#yourClicker').css('top', yPos - (startRad / 2));
      $('#yourClicker').css('left', xPos - (startRad / 2));
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

          // if user holds down for full length of clickerSpeed
          sendCoords();
          $('#yourClicker').hide();
          activeClick = false;
          clickEquality--;

      });

    } else {

      $('#yourClicker').css({
        top: endPt.y,
        left: endPt.x,
        width: maxClickerSize,
        height: maxClickerSize,
        borderTopLeftRadius: maxClickerSize,
        borderTopRightRadius: maxClickerSize,
        borderBottomLeftRadius: maxClickerSize,
        borderBottomRightRadius: maxClickerSize
      });
      $('#yourClicker').show();

      clickerTimeout = setTimeout(function() {
        $('#yourClicker').hide();
      }, 500);

      sendCoords();

    }


    e.preventDefault();

  });

  $('#gamearea').on('mouseup touchend', function(e) {

    if (activeGame && myColor !== null) {

      if ((lastClickCoords.xPos !== xPos || lastClickCoords.yPos !== yPos) || clickEquality !== 0) {
        const orig = {x: xPos, y: yPos, rad: $('#yourClicker').width(), col: myColor};
        const sendObj = covertObjToWidth(orig);
        socket.emit('addCircle', sendObj);
        console.debug('gamearea sending circle', { orig, sendObj });
        $('#yourClicker').stop(true, false);
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

  // $(window).blur(function() {
  //   console.log('blur');
  //   if (curRoom && curRoom !== 'lobby') {
  //     backToRoomChooser();
  //   }
  // });

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
          handleUsernameSubmit();
      }
  });

  $("#msgText").keypress(function(event) {
      if (event.which == 13) {
          event.preventDefault();
          sendChat();
      }
  });

  $('#HSheader').on('change', function() {
    if ($(this).val() === "overall") {
      console.log('overall');
      socket.emit('requestTopPlayers');
    } else {
      renderHStables(highScoreData);
    }
  });



  preloadAudio();

  start();

  //END INITS



});



const AndroidFullScreen = require('cordova-plugin-fullscreen');
function successFunction()
{
    console.info("It worked!");
}

function errorFunction(error)
{
    console.error(error);
}

function trace(value)
{
    console.log(value);
}

// Is this plugin supported?
AndroidFullScreen.isSupported(successFunction, errorFunction);

// Hide system UI and keep it hidden (Android 4.4+ only)
AndroidFullScreen.immersiveMode(successFunction, errorFunction);