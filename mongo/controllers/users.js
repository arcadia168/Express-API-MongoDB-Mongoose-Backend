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
  User.update({'username': username}, { $pushAll: {'predictions': req.body}},
    {safe: true, upsert: false},
    function(err, number) {
      if(err) return console.log(err);
      return res.jsonp(202);
    }
  );
};

exports.getPredictions = function(req, res) {
  var username = req.params.username;
  User.find({'username': username}, 'predictions', function(err, results) {
    res.jsonp(results);
  });
};

exports.updatePrediction = function(req, res) {
  var username = req.params.username;
  User.findOneAndUpdate({'username': username,
                        'predictions.fixture': {"$ne": req.body.fixture}},
                        { $set: {'predictions.$': req.body}},
                        {upsert : true},
                        function(err, number) {
    if(err) return console.log(err);
    return res.jsonp(202);
  });
};

exports.clearPredictions = function(req, res) {
  User.update({}, {$pull: {'predictions': {}}}, function(err, number) {
    if(err) return console.log(err);
    return res.jsonp(202);
  });
};

exports.resetPredictions = function(req, res) {
  var username = req.params.username;
  User.update({'username': username}, {$pull: {'predictions': {}}}, function(err, number) {
    if(err) return console.log(err);
    User.update({'username': username}, { $pushAll: {'predictions': req.body}},
      {safe: true, upsert: false},
      function(err, number) {
        if(err) return console.log(err);
        return res.jsonp(202);
      }
    );
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