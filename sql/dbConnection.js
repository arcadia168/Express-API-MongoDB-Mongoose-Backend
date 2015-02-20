var mysql = require('mysql');
var connection = mysql.createConnection({
  host: 'nodejs-getin.rhcloud.com',
  user: 'adminVX1eNS8',
  password: 'z1_A4P-mWgDr'
});

exports.begin = function() {
  connection.connect(function(err) {
    if(err) {
      console.error('error connecting: ' + err.stack);
      return;
    }
    
    console.log('connected as id ' + connection.threadId);
  });
}

exports.finish = function() {
  connection.end(function(err) {
    if(err) {
      console.error('error terminating connection: ' + err.stack);
    }
  });
}

exports.registerUser = function(username, password, firstName, lastName, email) {
  connection.query('INSERT INTO UserData SET ?', {username: 'username', hashed: 'password',
    firstName: 'firstName', lastName: 'lastName', email: 'email'},
    function(err, result) {
      if (err) throw err;

      // The only return is the user Id which isn't required
      // console.log(result.insertId);
    }
  );
}

exports.insertPrediction = function(userId, fixtureId, prediction, callback) {
  connection.query('INSERT INTO Prediction SET ?', {userId: 'userId', fixtureId: 'fixtureId',
    prediction: 'prediction', date: 'predictDate'},
    function(err, result) {
      if (err) throw err;

      // The only return is the user Id which isn't required
      // console.log(result.insertId);
    }
  );
}

exports.updatePrediction = function(userId, fixtureId, prediction, callback) {
}

exports.getPredictions = function(userId, callback) {
}

exports.getPredictionResults = function(userId, callback) {
}

exports.getFixtures = function(callback) {
}