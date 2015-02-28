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
    //this line done got errors
    debugger;
    var predictions = req.body.predictions;
    for(var i = 0; i < predictions.length; i++) {
      for(var j = 0; j < results.length; j++) {
        var result = results[j];
        if(result._id == predictions[i].fixture) {
          // wont apply right now using test data
          //if(!result.fixDate || result.fixDate.getTime() <= (date.getTime() + (1000*60*60)))
          //  return res.jsonp(400);
          var predVal = allocatePoints(result.fixDate, date);
          predictions[i]["predictValue"] = predVal;
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
    if(typeof result == 'undefined' || typeof result.fixDate == 'undefined' || result.fixDate.getTime() <= (date.getTime() + (1000*60*45)))
      return res.jsonp(400);
    req.body[0]['predictValue'] = allocatePoints(result.fixDate, date);
    User.findOneAndUpdate({'username': username,
                          'predictions.fixture': {"$ne": req.body.fixture}},
                          { $set: {'predictions.$': req.body}},
                          {upsert : true},
                          function(err, number) {
      if(err) return console.log(err);
      return res.jsonp(202);
    });
  });
};

function allocatePoints(fixDate, currDate) {
    //TODO If no current data is supplied, just default it in here
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
  User.update({}, {$pull: {'predictions': {}}}, function(err, number) {
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