// establish socket connection
var socket = io.connect(window.location.hostname + ":" + window.location.port);
var count = 0;
var od;

// init odomoter
var el = document.querySelector('#counter');

od = new Odometer({
  el: el,

  // Any option (other than auto and selector) can be passed in here
  theme: 'default'
});


$(function() {

  if (docCookies.getItem('voted')) {
    $('#status-panel').html('Thank you for standing up to the Don and making your voice heard.');
  }

  dialog = $( "#dialog-form" ).dialog({
    autoOpen: false,
    height: 450,
    width: 300,
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
               docCookies.setItem('voted', 'alphabet');
               $('#addone').fadeOut('slow', function() {
                 $('#status-panel').html(data.response);
               });
               console.log(data.response);
             },
             'json' // I expect a JSON response
          );

          dialog.dialog( "close" );

      } else {


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

  $.get( "/getCounter", function( data ) {
    $('#counter').html(data.count);
    console.log(data);
  });


  socket.on('status', function (data) {
    $('#counter').html(data.count);
  });

  $('#addone').click(function() {
    dialog.dialog( "open" );
  });



});
