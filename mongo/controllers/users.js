var mongoose = require('mongoose');
var User = mongoose.model('User');

exports.addUser = function(req, res) {
  User.create(req.body, function(err, user) {
    if(err) return console.log(err);
    res.jsonp(user);
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