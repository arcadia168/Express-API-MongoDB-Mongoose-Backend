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
        if (result == null){

            console.log("The user did not exist, creating the user now");

            //construct an object to represent the new user and insert into database
            var newUser = {
                user_id     :   req.body.user_id,
                username    :   req.body.nickname,
                name        :   req.body.name,
                predictions :   [],
                score       :   0
            };

            //Now insert this new user object into the database
            User.create(newUser, function(err, user){
                if (err) return console.log(error);
                res.jsonp(202); //return this if everything went ok - 'accepted'
            });
        } else {

            console.log('User already existed, doing nothing.');

            res.jsonp(result);
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
                    var predVal = _allocatePoints(result.fixDate, date);
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

//get called one prediction at a time.
exports.updatePrediction = function(req, res) {
    var user_id = req.params.user_id; //get username from request
    Fixture.findOne({'_id':req.body.fixture}, 'fixDate', function(err, result) { //find specific fixure from params
        var date = new Date(); //get today's date
        if(result == null || typeof result == 'undefined' || typeof result.fixDate == 'undefined') // Not functional for dummy data: || result.fixDate.getTime() <= (date.getTime() + (1000*60*45)))
            return res.jsonp(400); //check to see if we have fixture in db (has it finished yet)?
        req.body["predictValue"] = _allocatePoints(result.fixDate, date); //allocate points for the fixture based on date
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

exports.clearNotification = function (req, res) {
    //take the user_id from which we will be clearing the notification
    var user_id = req.params.user_id;

    //get the notification id of the notification to clear
    var notification_id = req.params.notification_id;

    //find the user, delete the notification and save any changes that have been made
    User.findOne({"user_id": user_id}, function (error, foundUser) {

        //confirm that a user has been found
        if (foundUser == null) {
            console.log("No user with the user_id: " + user_id + " was found.");
            return res.jsonp("A user with that id was not found")
        } else {
            //TODO: go elsewhere and put run code in if statements like this
            console.log("The user that was returned is: " + JSON.stringify(foundUser));
        }

        //now find the notification and remove it
        //Find the member with the corresponding user_id
        for (var i = 0; i < foundUser.notifications.length; i++) {
            //if the user_id is the same as the one we want to remove, remove it

            console.log('Iterating over notifications, looking for notification with id: ' + notification_id);

            if (foundUser.notifications[i].notificationId == notification_id) {

                console.log('Notification ' + foundUser.notifications[i].notificationId + ' found');

                //get the id of this member
                console.log('Getting the object id of the notification to remove: ' + foundUser.notifications[i]._id);

                //TODO: Replace other removals with this methodology
                removeNotificationWithObjectId = privateLeague.members[i]._id;

                //Now remove the object_id
                foundUser.notifications.id(removeNotificationWithObjectId).remove();

                //Now save the removal
                foundUser.save(function (err) {

                    if (err) return res.jsonp(err);

                    console.log('The notification was removed.');

                    //return accepted status code
                    return res.jsonp(202);
                });
            }
        } //TODO: If not found, what to do?

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
    //this will assign a result to every game in a round, then give users a score based on how well they predicted
    Fixture.find({'round': round}, function(err, results) {
        //assign results to all fixtures in the given round.
        resultAssigner(0, results, function() {

            //todo: only need this bit, to be called after the singular fixture has been given a result.
            //this function is run after all fixtures get given a random result.
            _scoreUsers(round, function (err, status) {
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

//when a prediction is made, this decides how many points a user will get if the prediction is correct!
function _allocatePoints(fixDate, currDate) {
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

//function used to assign scores to users.
function _scoreUsers(round, callback) {
    //gets all of the fixtures in a given round
    Fixture.find({'round': round}, function (err, fixs) { //todo: for scheduler only pass a signle fixture at a time
        //for all of the fixtures in a given round, gets all users
        User.find({}, function (err, users) { //todo: for scheduler filter the users here to only return those who predicted on the fixture
            //invokes the score adder function passing in all users who are to be scored, and all fixtures
            _scoreAdder(0, users, fixs, function () {
                //feeds the callback method into the scoreadder method
                callback(null, 202); //this is fed in from the highest level
            });
        });
    });
}

//FOR ASSIGNING POINTS TO USER PREDICTIONS, GIVEN A LIST OF USERS TO SCORE AND FIXTURES WITH RESULTS

//recursively iterate over all of the users, assigning them points.
//save changes if any are made.
function _scoreAdder(i, users, fixs, callback) {
    if (i < users.length) {
        //place the current user's predictions into an array
        var preds = users[i].predictions;

        //get the current value of the user's score
        var score = users[i].score;

        //nested loops make for n^2 complexity - slow to run

        //todo: to use in scheduler, only pass in a single fixture, could just reuse this code...
        //for each user, loop over all of the given fixtures
        for (var j = 0; j < fixs.length; j++) {

            var currFix = fixs[j];

            //inner loop to loop over all of the user's predictions and compare to current fixture
            for (var k = 0; k < preds.length; k++) {

                //if the user made a prediction for this fixture.
                //if the prediction was made for the current fixture
                if (preds[k].fixture == currFix._id) {

                    //is this method of scoring correct? yes, if correct get a varying score, if wrong, get nothing
                    //if the prediction was correct, update the user's score!
                    if (preds[k].prediction == currFix.fixResult) {
                        score += preds[k].predictValue;
                    }
                }
            }
        }

        //if the score has been updated
        if (score != users[i].score) {
            //then save the change made to the user's score and recurse, scoring the next user
            User.findByIdAndUpdate(users[i]._id, {$set: {'score': score}}, function () {
                //recurse, scoring the next user
                _scoreAdder(i + 1, users, fixs, callback);
            });
        } else {
            //recurse without saving, scoring the next user
            _scoreAdder(i + 1, users, fixs, callback);
        }

    } else {
        //if the recursion should have ended as all user's given scores, run the callback.
        callback();
    }
}

//FOR ASSIGNING DUMMY RESULTS TO MATCHES

//this function assigns a random result to ALL FIXTURES, recursively, then runs a callback.
//above this callback is one which assigns users scores based upon these results.
function resultAssigner(i, results, callback) {
    if (i < results.length) {
        var fixRes = Math.floor((Math.random() * 3) + 1); //this is generating a random result atm
        Fixture.findByIdAndUpdate(results[i]._id, {$set: {'fixResult': fixRes}}, function (err, res) {
            resultAssigner(i + 1, results, callback);
        });
    } else {
        callback();
    }
}