// establish socket connection
var socket = io.connect(window.location.hostname + ":" + window.location.port);
var count = 0;
var startCount;

// get the current counter
$.get( "/getCounter", function( data ) {
  //$('#counter').html(data.count);
  startCount = data.count;
  console.log(data);
});

var imagestoload = [
  {
    url: 'img/yorktown-min.jpg',
    element: '#bg img'
  },
  {
    url: '/img/trumpcutout-min.png',
    element: '#trumpman'
  }
];

function loadSprite(src, el) {
    var deferred = $.Deferred();
    var sprite = new Image();
    sprite.onload = function() {
        $(el).attr('src', src);
        deferred.resolve();
    };
    sprite.src = src;
    return deferred.promise();
}

var loaders = [];
for (var i = 0; i < imagestoload.length; i++) {
  loaders.push(loadSprite(imagestoload[i].url, imagestoload[i].element));
}

$.when.apply(null, loaders).done(function() {

  // setup counter watching socket
  socket.on('status', function (data) {
    $('#counter').html(data.count);
  });

  $('#fountainG').fadeOut(500, function() {

    $('#splashscreen').fadeOut(500, function() {

          $('#counter').html(startCount);

    });
  });



});


$(function() {

  // ONCE THE DOM HAS LOADED...

  // first off load the images for the page




  // FIRST OFF INITIALIZATIONS


  // only after the images have loaded and the splash screen fadeout should the dialog
  var el = document.querySelector('#counter');

  var od = new Odometer({
    el: el,

    // Any option (other than auto and selector) can be passed in here
    theme: 'plaza'
  });


  // jquery dialog
  dialog = $( "#dialog-form" ).dialog({
    autoOpen: false,
    height: 440,
    width: 270,
    modal: true,
    // open: function(event, ui) {
    //   $( "#dialog-form" ).css('overflow', 'hidden');
    // },
    buttons: {
      "Sign the pledge": function() {

          var tosend = {
            name: $('#name').val(),
            email: $('#email').val()
          };

          if (validateForm()) {

            $.post( '/submit-sig', tosend, function(data) {

                 $('#addone').fadeOut('slow', function() {
                   if (data.error) {
                     $('#status-panel').html(data.error);
                   } else {
                     docCookies.setItem('voted', 'alphabet');
                     $('#status-panel').html(data.response);
                   }
                 });
                 console.log(data.response);
               },
               'json' // I expect a JSON response
            );

            dialog.dialog( "close" );

        }

      },
      Cancel: function() {
        dialog.dialog( "close" );
      }
    },
    close: function() {
      $('form#new-sig').find("input[type=text], textarea").val("");
      $('form#new-sig').find("input[type=text], textarea").removeClass( "ui-state-error" );
    }
  });

  // check if they have already pledged

  if (docCookies.getItem('voted')) {
    $('#status-panel').html('Thank you for standing up to the Don and making your voice heard.');
  }

  // and "pledge" button event handler

  $('#addone').click(function() {
    dialog.dialog( "open" );
  });

  //END INITS



});
