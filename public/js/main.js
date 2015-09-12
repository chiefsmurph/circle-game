// establish socket connection
var socket = io.connect(window.location.hostname + ":" + window.location.port);

// setup counter watching socket
socket.on('newCircle', function (data) {
  console.log('stat');

  var newCircle = $('<div class="circle"></div>');
  newCircle.css('top', data.y);
  newCircle.css('left', data.x);

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

  // ONCE THE DOM HAS LOADED...

  // FIRST OFF INITIALIZATIONS


  $('#gamearea').click(function (e) {
      var elm = $(this);
      var xPos = e.pageX - elm.offset().left;
      var yPos = e.pageY - elm.offset().top;

      console.log(xPos, yPos);
      socket.emit('addCircle', {x: xPos, y: yPos, rad: 40});
  });


  //END INITS



});
