var mongoose = require('mongoose');
require('../models/fixturemodel');
var Fixture = mongoose.model('Fixture');

exports.getFixtures = function(req, res) {
  Fixture.find({}, function(err, results) {
    return res.send(results);
  });
};

exports.getRound = function(req, res) {
  var round = req.params.round;
  Fixture.find({'round': round}, function(err, result) {
    return res.send(result);
  });
};

exports.addFixtures = function(req, res) {
  Fixture.create(req.body, function(err, fixture) {
    if(err) return console.log(err);
    return res.send(fixture);
  });
};

exports.clearFixtures = function(req, res) {
  Fixture.remove({}, function(result) {
    return res.send(result);
  });
};

exports.clearRound = function() {
  var round = req.params.id;
  Fixture.remove({'round': round}, function(result){
    return res.send(result);
  });
};

// homeTeam, awayTeam, round, fixDate, fixResult
exports.import = function(req, res) {
  Fixture.create(
    {"homeTeam": "Oldham", "awayTeam": "Ipswitch", "round": "1"},
    {"homeTeam": "***REMOVED***teshire", "awayTeam": "Walton", "round": "1"},
    {"homeTeam": "Applestown", "awayTeam": "Oranges", "round": "1"},
    {"homeTeam": "Eggs", "awayTeam": "Cat and Fanny", "round": "1"},
    {"homeTeam": "Mancshire", "awayTeam": "Manctown", "round": "1"},
    {"homeTeam": "London", "awayTeam": "Nodnol", "round": "2"},
    {"homeTeam": "Red Wine", "awayTeam": "White Wine", "round": "2"},
    {"homeTeam": "Chadderfornia", "awayTeam": "Detroyton", "round": "2"},
    {"homeTeam": "Wensleydale", "awayTeam": "The Letter C", "round": "2"},
    {"homeTeam": "Jerusalem", "awayTeam": "Alpha Centurai", "round": "2"},
    function(err) {
      if(err)
        return console.log(err);
      return res.send(202);
    }
  );
};