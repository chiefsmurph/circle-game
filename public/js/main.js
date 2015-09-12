// establish socket connection
var socket = io.connect(window.location.hostname + ":" + window.location.port);
var myColor;

socket.on('setColor', function(data) {
  myColor = data.color;
  $('.circle').css('background-color', myColor);
  console.log('my color...' + myColor);
});
// setup counter watching socket
socket.on('newCircle', function (data) {
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

});



$(function() {

  var xPos,
      yPos;

  // ONCE THE DOM HAS LOADED...

  // FIRST OFF INITIALIZATIONS


  $('#gamearea').mousedown(function (e) {

      var maxClickerSize = 170;

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
      }, maxClickerSize * 40, 'linear', function() {

        // if user holds down for full second
        $('#yourClicker').hide();
        socket.emit('addCircle', {x: xPos, y: yPos, rad: maxClickerSize, col: myColor});

      });



      console.log(xPos, yPos);
  });

  $('#gamearea').mouseup(function() {

    $('#yourClicker').stop();
    $('#yourClicker').hide();
    socket.emit('addCircle', {x: xPos, y: yPos, rad: $('#yourClicker').width(), col: myColor});

  });


  //END INITS



});
