var pg = require('pg');

const { pgString } = require('./config.js');

pg.connect(pgString, function(err, client, done) {
  console.log({ err })
  var queryText = 'SELECT * FROM highscores';
  client.query(queryText, function(err, result) {
    console.log(err, result)
    done();
    users = result.rows;

  });
});