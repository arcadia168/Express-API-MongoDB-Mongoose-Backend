var mongoose = require('mongoose');
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

exports.getGroupedFixtures = function(req, res) {
  Fixture.find({}, function(err, results) {
    var data = JSON.parse(results);
    var newData = { rounds : [] };
    var set = new MiniSet();
    for(var i = 0; i < data.length; i++) {
      var obj = data[i]
      for(var key in obj) {
        if(key == 'round') {
          // if this round already exists in the list add it
          // else make a new JSON object
          var roundNum = Number(obj[key].toString());
          if(set.has(roundNum)) {
            newData.rounds[roundNum].data.push(JSON.stringify(obj));
          } else {
            var data = JSON.parse('{\"round\":\"'+roundNum+'\",\"data\":['+JSON.stringify(obj)+']}');
            newData.rounds.push(data);
            set.add(roundNum);
          }
          break;
        }
      }
    }
    
    return res.send(newData.stringify());
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
  var round = req.params.round;
  Fixture.remove({'round': round}, function(result){
    return res.send(result);
  });
};

var examples = [{"homeTeam":"Oldham", "awayTeam":"Ipswitch","round":"1"},
    {"homeTeam":"***REMOVED***teshire", "awayTeam":"Walton", "round":"1"},
    {"homeTeam":"Applestown", "awayTeam":"Oranges", "round":"1");
    {"homeTeam":"Eggs", "awayTeam":"Cat and Fanny", "round":"1"},
    {"homeTeam":"Mancshire", "awayTeam":"Manctown", "round":"1"},
    {"homeTeam":"London", "awayTeam":"Nodnol", "round":"2"},
    {"homeTeam":"Red Wine", "awayTeam":"White Wine", "round":"2"},
    {"homeTeam":"Chadderfornia", "awayTeam":"Detroyton", "round":"2"},
    {"homeTeam":"Wensleydale", "awayTeam":"The Letter C", "round":"2"},
    {"homeTeam":"Jerusalem", "awayTeam":"Alpha Centurai", "round":"2"}];

exports.dummyData = function(res, res) {
    Fixture.create(examples,
    function(err) {
      if(err)
        return console.log(err);
      return res.send(202);
    }
  );
};