var mongoose = require('mongoose');
var User = mongoose.model('User');
var Fixture = mongoose.model('Fixture');

exports.addUser = function(req, res) {
  User.create(req.body, function(err, user) {
    if(err) return console.log(err);
    res.jsonp(user);
  });
};

exports.getScoreboard = function(req, res) {
  User.find({}, 'username score', function(err, results) {
    res.jsonp(results);
  });
};

exports.updateUser = function(req, res) {
  var username = req.params.username;
  User.update({'username': username}, req.body, function(err, number) {
    if(err) return console.log(err);
    return res.jsonp(202);
  });
};

exports.getUserData = function(req, res) {
  var username = req.params.username;
  User.find({'username': username}, function(err, results) {
    res.jsonp(results);
  });
};

exports.addPredictions = function(req, res) {
  var username = req.params.username;
  // first get the fixture object, assign a score to the prediction
  Fixture.find({'round':req.params.round}, 'fixDate', function(err, results) {
    var date = new Date();
      var predictions = req.body[0].predictions;
      for(var i = 0; i < predictions.length; i++) {
      for(var j = 0; j < results.length; j++) {
        var result = results[j];
        if(result._id == predictions[i].fixture) {
          // wont apply right now using test data
          //if(!result.fixDate || result.fixDate.getTime() <= (date.getTime() + (1000*60*60)))
          //  return res.jsonp(400);
          var predVal = allocatePoints(result.fixDate, date);
          predictions[i]["predictValue"] = predVal;
          break;
        }
      }
    }
    User.update({'username': username}, { $push: {'predictions': { $each: predictions}}},
      {safe: true, upsert: false},
      function(err, number) {
        if(err) return console.log(err);
        return res.jsonp(202);
      }
    );
  });
};

exports.getPredictions = function(req, res) {
  var username = req.params.username;
  User.find({'username': username}, 'predictions', function(err, results) {
    res.jsonp(results);
  });
};

exports.updatePrediction = function(req, res) {
  var username = req.params.username;
  Fixture.findOne({'_id':req.body[0].fixture}, 'fixDate', function(err, result) {
    var date = new Date();
    if(result == null || typeof result == 'undefined' || typeof result.fixDate == 'undefined') // Not functional for dummy data: || result.fixDate.getTime() <= (date.getTime() + (1000*60*45)))
      return res.jsonp(400);
    req.body[0]["predictValue"] = allocatePoints(result.fixDate, date);
    req.body[0]["predictDate"] = date;
    User.findOneAndUpdate({'username': username,
                          'predictions.fixture': req.body[0].fixture},
                          { $set: {'predictions.$': req.body[0]}},
                          {upsert : false, setDefaultsOnInsert: true, runValidators: true},
                          function(err, number) {
      if(err) return console.log(err);
      return res.jsonp(202);
    });
  });
};

exports.findRoundPredictions = function(req, res) {
  var username = req.params.username;
  User.findOne({'username': username}, function(err, uRes) {
    Fixture.find({'round':req.params.round}, function(err, fRes) {
      res.header('Content-type','application/json');
      res.header('Charset','utf8');
      var predictions = uRes.predictions;
      for(var i = 0; i < predictions.length; i++) {
        for(var j = 0; j < fRes.length; j++) {
          var fix = fRes[j];
          if(fix._id == predictions[i].fixture) {
            res.write(JSON.stringify(predictions[i]));
            break;
          }
        }
      }
      res.end();
    });
  });
}

exports.clearRoundPredictions = function(req, res) {
  var username = req.params.username;
  User.findOne({'username': username}, function(err, uRes) {
    Fixture.find({'round':req.params.round}, function(err, fRes) {
      var uPred = [];
      for(var i = uRes.predictions.length-1; i >= 0; i--) {
        for(var j = 0; j < fRes.length; j++) {
          if(fRes[j]._id == uRes.predictions[i].fixture) {
            uRes.predictions.id(uRes.predictions[i]._id).remove();
            break;
          }
        }
      }
      uRes.save(function (err) {
        if (err) return console.log(err);
        return res.jsonp(202);
      });
    });
  });
}

function allocatePoints(fixDate, currDate) {
  if(typeof fixDate === 'undefined' || typeof currDate === 'undefined')
    return 0;
  var diffMins = ((fixDate.getTime() + (1000*60*60)) - currDate.getTime()) / 1000 / 60;
  var minsFromMid = new Date(currDate.getTime());
  minsFromMid.setHours(0);
  minsFromMid.setMinutes(0);
  minsFromMid.setSeconds(0);
  if(diffMins <= 60) {
    return 5;
  } else if(diffMins <= 1440) {
    return 6;
  } else if(diffMins <= ((currDate.getTime() - minsFromMid.getTime()) / 1000 / 60)) {
    return 9;
  } else {
    return 12;
  }
  // preSeason needs to be implemented
}

exports.clearPredictions = function(req, res) {
  User.update({}, {$pull: {'predictions': {}}}, {multi:true}, function(err, number) {
    if(err) return console.log(err);
    return res.jsonp(202);
  });
};

var examples = [{"username":"kekLord999", "password":"Iluvmum", "firstName":"Jerry", "lastName":"Springer", "email":"kekLord@gmail.com"},
    {"username":"***REMOVED***6969", "password":"Ih8craig", "firstName":"***REMOVED***", "lastName":"***REMOVED***erino", "email":"***REMOVED***lord@gmail.com"},
    {"username":"CatLadFandango", "password":"alcohol6", "firstName":"Daniel", "lastName":"Cattlin", "email":"ladladlad@lad.lad"},
    {"username":"SoElBex", "password":"IstoppedSinging", "firstName":"Sophie-Ellis", "lastName":"Bexter", "email":"IdDoMe@gmail.com"},
    {"username":"OverlordChrist", "password":"Shiva4christ", "firstName":"Jesus", "lastName":"Christ", "email":"theRedeemer@heaven.org"}];

exports.dummyData = function(req, res) {
    User.create(examples,
    function(err) {
      if(err)
        return console.log(err);
      return res.jsonp(202);
    }
  );
};

exports.wipe = function(req, res) {
  Fixture.remove({}, function(result) {
    User.remove({}, function(result) {
      return res.jsonp(result);
    });
  });
}