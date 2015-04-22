var mongoose = require('mongoose');
var User = mongoose.model('User');
var Fixture = mongoose.model('Fixture');

//so that mongoose now queries by object id
String.prototype.toObjectId = function() {
    var ObjectId = (require('mongoose').Types.ObjectId);
    return new ObjectId(this.toString());
};

exports.addUser = function(req, res) {
    User.create(req.body, function(err, user) {
        if(err) return console.log(err);
        res.jsonp(user);
    });
};

exports.updateUser = function(req, res) {
    var user_id = req.params.user_id;
    User.update({'user_id': user_id}, req.body, function(err, number) {
        if(err) return console.log(err);
        return res.jsonp(202);
    });
};

exports.userSync = function(req, res) {
    var user_id = req.body.user_id;

    User.findOne({'user_id': user_id}, function(err, result) {
        //if no user with this user_id exists, create one

        //Debugging code
        //console.log(req.body);
        //console.log('The result of looking for user ' + req.body.name + ' was ' + result);
        //console.log('User ID: '   + user_id);
        //console.log('Username: '  + req.body.nickname);
        //console.log('Name: '      + req.body.name);

        if (result == null){

            console.log("The user did not exist, creating the user now");

            //construct an object to represent the new user and insert into database
            var newUser = {
                user_id     :   req.body.user_id,
                username    :   req.body.nickname,
                name        :   req.body.name,
                predictions :   [],
                score       :   0
            }

            //Now insert this new user object into the database
            User.create(newUser, function(err, user){
                if (err) return console.log(error);
                res.jsonp(202); //return this if everything went ok - 'accepted'
            });
        } else {

            console.log('User already existed, doing nothing.');

            res.jsonp(404);
        }
    });
};

exports.getScoreboard = function(req, res) {
    User.find({}, 'username score', function(err, results) {
        res.jsonp(results);
    });
};

exports.getUserData = function(req, res) {
    var user_id = req.params.user_id;
    User.find({'user_id': user_id}, function(err, results) {
        res.jsonp(results);
    });
};

exports.addPredictions = function(req, res) {
    var user_id = req.params.user_id;
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
        User.update({'user_id': user_id}, { $push: {'predictions': { $each: predictions}}},
            {safe: true, upsert: false},
            function(err, number) {
                if(err) return console.log(err);
                return res.jsonp(202);
            }
        );
    });
};

exports.getPredictions = function(req, res) {
    var user_id = req.params.user_id;
    User.find({'user_id': user_id}, 'predictions', function(err, results) {
        res.jsonp(results);
    });
};

exports.updatePrediction = function(req, res) {
    var user_id = req.params.user_id; //get username from request
    Fixture.findOne({'_id':req.body.fixture}, 'fixDate', function(err, result) { //find specific fixure from params
        var date = new Date(); //get today's date
        if(result == null || typeof result == 'undefined' || typeof result.fixDate == 'undefined') // Not functional for dummy data: || result.fixDate.getTime() <= (date.getTime() + (1000*60*45)))
            return res.jsonp(400); //check to see if we have fixture in db (has it finished yet)?
        req.body["predictValue"] = allocatePoints(result.fixDate, date); //allocate points for the fixture based on date
        req.body["predictDate"] = date; //set the date of the prediction to be today
        User.findOneAndUpdate({'user_id': user_id, //update the prediction for the user
                'predictions.fixture': req.body.fixture}, //where username is same and predictions.fixture is same
            { $set: {'predictions.$': req.body}}, //add new prediction
            {upsert : false, setDefaultsOnInsert: true, runValidators: true},
            function(err, number) {
                if(err) return console.log(err);
                return res.jsonp(202);
            });
    });
};

exports.findRoundPredictions = function(req, res) {
    var user_id = req.params.user_id;
    User.findOne({'user_id': user_id}, function(err, uRes) { //find the user
        Fixture.find({'round':req.params.round}, function(err, fRes) { //find all fixtures for the round
            res.header('Content-type','application/json');
            res.header('Charset','utf8');
            var predictions = uRes.predictions; //all of the predictions for the user
            var roundsToReturn = [];
            for(var i = 0; i < predictions.length; i++) {
                for(var j = 0; j < fRes.length; j++) {
                    var fix = fRes[j];
                    if(fix._id == predictions[i].fixture) {

                        roundsToReturn.push(predictions[i]);
                        //res.write(JSON.stringify([predictions[i]));
                        break; //break to the outer loop
                    }
                }
            }
            //now return all of the predictions
            res.write(JSON.stringify(roundsToReturn)); //append the result
            res.end();
        });
    });
};

exports.clearRoundPredictions = function(req, res) {
    var user_id = req.params.user_id;
    User.findOne({'user_id': user_id}, function(err, uRes) { //get all predictions for the user
        Fixture.find({'round':req.params.round}, function(err, fRes) { //get all fixtures for the round
            var uPred = [];
            for(var i = uRes.predictions.length-1; i >= 0; i--) { //iterate over all users predictions
                for(var j = 0; j < fRes.length; j++) { //iterate over all fixtures for round
                    if(fRes[j]._id == uRes.predictions[i].fixture) { //if matching fixture
                        uRes.predictions.id(uRes.predictions[i]._id).remove(); //delete the fixture
                        break;
                    }
                }
            }

            //Deduct 20 points from the user
            uRes.score = uRes.score - 20;

            uRes.save(function (err) {
                if (err) return console.log(err);
                return res.jsonp(202);
            });

            console.log('User round predictions deleted for user: ' + uRes.username + ' for round: ' + req.params.round);

        });
    });
};

exports.clearPredictions = function(req, res) {
    User.update({}, {$pull: {'predictions': {}}}, {multi:true}, function(err, number) {
        if(err) return console.log(err);
        return res.jsonp(202);
    });
};

exports.dummyData = function(req, res) {
    User.create(examples,
        function(err) {
            if(err)
                return console.log(err);
            return res.jsonp(202);
        }
    );
};

exports.dummyResults = function(req, res) {
    var round = req.params.round;
    Fixture.find({'round': round}, function(err, results) {
        resultAssigner(0, results, function() {
            scoreUsers(round, function(err, status) {
                return res.jsonp(status);
            });
        });
    });
};

exports.wipe = function(req, res) {
    Fixture.remove({}, function(result) {
        User.remove({}, function(result) {
            return res.jsonp(result);
        });
    });
};

//Private functions.

function allocatePoints(fixDate, currDate) {
    if (typeof fixDate === 'undefined' || typeof currDate === 'undefined')
        return 0;
    var diffMins = ((fixDate.getTime() + (1000 * 60 * 60)) - currDate.getTime()) / 1000 / 60;
    var minsFromMid = new Date(currDate.getTime());
    minsFromMid.setHours(0);
    minsFromMid.setMinutes(0);
    minsFromMid.setSeconds(0);
    if (diffMins <= 60) {
        return 5;
    } else if (diffMins <= 1440) {
        return 6;
    } else if (diffMins <= ((currDate.getTime() - minsFromMid.getTime()) / 1000 / 60)) {
        return 9;
    } else {
        return 12;
    }
    // preSeason needs to be implemented
}


function scoreUsers(round, callback) {
  Fixture.find({'round': round}, function(err, fixs) {
    User.find({}, function(err, users) {
      scoreAdder(0, users, fixs, function() {
        callback(null, 202);
      });
    });
  });
};

function scoreAdder(i, users, fixs, callback) {
  if(i < users.length) { 
    var preds = users[i].predictions;
    var score = users[i].score;
    for(var j = 0; j < fixs.length; j++) {
      var currFix = fixs[j];
      for(var k = 0; k < preds.length; k++) {
        if(preds[k].fixture == currFix._id) {
          if(preds[k].prediction == currFix.fixResult) {
            score += preds[k].predictValue;
          }
        }
      }
    }
    if(score != users[i].score) {
      User.findByIdAndUpdate(users[i]._id, {$set:{'score':score}}, function(err, res) {
        scoreAdder(i+1, users, fixs, callback);
      });
    } else {
      scoreAdder(i+1, users, fixs, callback);
    }
  } else {
    callback();
  }
};

function resultAssigner(i, results, callback) {
  if(i < results.length) {
    var fixRes = Math.floor((Math.random() * 3) + 1);
    Fixture.findByIdAndUpdate(results[i]._id, {$set:{'fixResult':fixRes}}, function(err, res) {
      resultAssigner(i+1, results, callback);   
    });
  } else {
    callback();
  }
};