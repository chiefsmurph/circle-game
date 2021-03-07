var pg = require('pg');

const { pgString, pgConfig } = require('./config.js');
const { Pool, Client } = require('pg')
const pool = new Pool(pgConfig)

const client = new Client({
  connectionString: pgString,
})
client.connect();
console.log('after client connect');
client.query('SELECT NOW()', (err, res) => {
  console.log(err, res)
  client.end()
});


var queryText = 'SELECT * FROM highscores';
console.log({ queryText });
pool.query(queryText, (err, response) => {
  console.log(err, result)
});
