var mongoose = require('mongoose');
var User = mongoose.model('User');
var Fixture = mongoose.model('Fixture');
var moment = require('moment');
var momentrange = require('moment-range');
var roundsList = [{"roundNo": 1, "startDate": "18/08/2014", "endDate": "18/08/2014"},
    {"roundNo": 2, "startDate": "23/08/2014"},
    {"roundNo": 3, "startDate": "30/08/2014"},
    {"roundNo": 4, "startDate": "13/09/2014"},
    {"roundNo": 5, "startDate": "20/09/2014"},
    {"roundNo": 6, "startDate": "27/09/2014"},
    {"roundNo": 7, "startDate": "04/10/2014"},
    {"roundNo": 8, "startDate": "18/10/2014"},
    {"roundNo": 9, "startDate": "25/10/2014"},
    {"roundNo": 10, "startDate": "01/11/2014"},
    {"roundNo": 11, "startDate": "08/11/2014"},
    {"roundNo": 12, "startDate": "22/11/2014"},
    {"roundNo": 13, "startDate": "29/11/2014"},
    {"roundNo": 14, "startDate": "02/12/2014"},
    {"roundNo": 15, "startDate": "06/12/2014"},
    {"roundNo": 16, "startDate": "13/12/2014"},
    {"roundNo": 17, "startDate": "20/12/2014"},
    {"roundNo": 18, "startDate": "26/12/2014"},
    {"roundNo": 19, "startDate": "28/12/2014"},
    {"roundNo": 20, "startDate": "01/01/2015"},
    {"roundNo": 21, "startDate": "10/01/2015"},
    {"roundNo": 22, "startDate": "17/01/2015"},
    {"roundNo": 23, "startDate": "31/01/2015"},
    {"roundNo": 24, "startDate": "07/02/2015"},
    {"roundNo": 25, "startDate": "10/02/2015"},
    {"roundNo": 26, "startDate": "21/02/2015"},
    {"roundNo": 27, "startDate": "28/02/2015"},
    {"roundNo": 28, "startDate": "03/03/2015"},
    {"roundNo": 29, "startDate": "14/03/2015"},
    {"roundNo": 30, "startDate": "21/03/2015"},
    {"roundNo": 31, "startDate": "04/04/2015"},
    {"roundNo": 32, "startDate": "11/04/2015"},
    {"roundNo": 33, "startDate": "18/04/2015"},
    {"roundNo": 34, "startDate": "25/04/2015"},
    {"roundNo": 35, "startDate": "02/05/2015"},
    {"roundNo": 36, "startDate": "09/05/2015"},
    {"roundNo": 37, "startDate": "16/05/2015"},
    {"roundNo": 38, "startDate": "24/05/2015"}];
//todo: see if there is a better way to store this information
function _getCurrentRoundNo (today) {

    if (today == null) {
        today = moment();
    }

    for (var l = 0; l < roundsList.length; l++) {
        var roundStartDate = moment(roundsList[l].startDate, 'DD/MM/YYYY');
        var roundEndDate;
        //console.log('LIST INDEX: ' + l);
        if ((l + 1) == roundsList.length) {
            //console.log('\n' + 'LIST LENGTH :' + roundsList.length + '\n INDEX: ' + l);
            //console.log('\nROUND IN LIST\n');
            roundEndDate = moment(roundStartDate);
            roundEndDate.add(1, 'week');
        } else {
            roundEndDate = moment(roundsList[l + 1].startDate, 'DD/MM/YYYY');
        }
        var roundRange = moment().range(roundStartDate, roundEndDate);

        if (today.within(roundRange)) {
            //then we have found which round for the season corresponds to today

            //find the score for this round
            return roundsList[l].roundNo;
        }
    }
}

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

    User.findOne({'user_id': user_id}, function(err, foundUser) {

        //if no user with this user_id exists, create one
        if (foundUser == null){

            console.log("The user did not exist, creating the user now");

            //construct an object to represent the new user and insert into database
            var newUser = {
                user_id     :   req.body.user_id,
                username    :   req.body.nickname,
                name        :   req.body.name,
                pic         :   req.body.picture,
                predictions :   [],
                overallSeasonScore       :   0,
                roundScores : []
            };

            //Now insert this new user object into the database
            User.create(newUser, function(err, user){
                if (err) return console.log(error);
                res.jsonp(201); //201 denotes that a new resource has been created
            });
        } else {

            console.log('User already existed, updating.');

            //update that user's information here
            foundUser.username =  req.body.nickname;
            foundUser.name =  req.body.name;
            foundUser.pic = req.body.picture;

            foundUser.save(function(err) {
                if (err) {
                    console.log('Error updating user: ' + err);
                    return res.jsonp(err);
                } else {
                    console.log('Attempting to save updated the latest user details');
                    return res.jsonp(202);
                }
            });
        }
    });
};

exports.getLeaderboard = function(req, res) {
    User.find({}).sort({'score' : -1}).exec(
        function(err, results) {
            var today = moment();
            var currentRound = _getCurrentRoundNo(today);
            results.push({currentRound: currentRound});
            results.push({roundsList: roundsList});
            res.jsonp(results);
        }
    );
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
                    var predictValue;

                    console.log("Now working out how many points prediction should get.")
                    if (!predictions[i].prediction == 0) {
                        predictValue = _allocatePoints(result.fixDate, date);
                    }

                    predictions[i]["predictValue"] = predictValue;
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
//todo: make this function take a list of all predictions and intelligently update if required
exports.updatePrediction = function(req, res) {

    var user_id = req.params.user_id; //get username from request
    var functionDone = false;

    Fixture.findOne({'_id':req.body.fixture}, function(err, foundFixture) { //find specific fixure from params
        var date = new Date(); //get today's date

        //Error check the fixture, exit if error
        if(foundFixture == null || typeof foundFixture == 'undefined' || typeof foundFixture.fixDate == 'undefined') {
            // Not functional for dummy data: || foundFixture.fixDate.getTime() <= (date.getTime() + (1000*60*45)))
            return res.jsonp(400); //check to see if we have fixture in db (has it finished yet)?
        } else {
            User.findOne({'user_id' : user_id}, function(error, foundUser) {

                if (error || foundUser == null) {
                    console.log(error);
                    functionDone = true;
                    return res.jsonp(404);
                } else {
                    //find the fixture which is having it's prediction altered
                    for (var i = 0; i < foundUser.predictions.length; i++) {

                        var predictionToUpdate = foundUser.predictions[i];

                        if (foundUser.predictions[i].fixture == req.body.fixture) {
                            console.log("The prediction being updated is: " + JSON.stringify(foundUser.predictions[i]));

                            //Determine whether or not the user is deleting an existing prediction
                            if ((foundUser.predictions[i].fixture.prediction != 0) && (req.body["prediction"] == 0)) {
                                //Remove 2 points from the user
                                console.log("The user is deleting a prediction, reducing user's score by 2");
                                foundUser.score = foundUser.score - 2;

                                console.log("Deleting prediction");

                                //Delete the prediction
                                foundUser.predictions.pull({ _id: foundUser.predictions[i]._id});

                                //Now save the changes and exit the function
                                foundUser.save(function(err) {
                                    if (err) {
                                        console.log(err);
                                        console.log("\n END CALL");
                                        functionDone = true;
                                        return res.jsonp(503);
                                    } else {
                                        console.log("User prediction deleted successfully, exiting function");
                                        console.log("\n END CALL");
                                        return res.jsonp(202);
                                    }
                                });
                            } else {
                                //If not deleting, but updating, update values and save.

                                //todo: test the point trading system

                                //Check to see if the user needs to trade any points to make the update
                                //Cast dates to moment objects
                                var pointsTraded = false;
                                var fixKickOff = moment(foundFixture.kickOff);
                                var predictionDate = moment(); //prediction made when function called

                                //Work out a date range for kick off to the end of half time for this fixture
                                var endOfHT = moment(fixKickOff); //clone fixture state moment object
                                endOfHT.add(1, 'hour');
                                var kickOffToEOHT = moment().range(fixtureDate, endOfHT); //define range for 1st half

                                //If making the update within an hour before the fixture trade 1
                                if ((fixKickOff.diff(predictionDate, 'hours') <= 1) && (predictionDate.isBefore(fixtureDate))) {
                                    //Deduct 1 point from user
                                    foundUser.score -= 1;
                                    pointsTraded = true;
                                } else if (predictionDate.within(kickOffToEOHT)) {
                                    //If making the update within the first half (up to end of half time) trade 2
                                    foundUser.score -= 2;
                                    pointsTraded = true;
                                }

                                if (pointsTraded) {
                                    //Save user's score
                                    //Now save the changes and exit the function
                                    foundUser.save(function(err) {
                                        if (err) {
                                            console.log(err);
                                            console.log("\n END CALL");
                                            functionDone = true;
                                            return
                                        } else {
                                            console.log("User traded points successfully, exiting function");
                                            console.log("\n END CALL");
                                            return
                                        }
                                    });
                                }

                                //Work out how many points this prediction is worth
                                console.log("An actual prediction is being made, so work out how many point it will score.");
                                req.body["predictValue"] = _allocatePoints(foundFixture.kickOff, date); //allocate points for the fixture based on date

                                //Set the date of the prediction to be today
                                console.log("A prediction value has now been calculated for this update and is: " + req.body["predictValue"]);
                                req.body["predictDate"] = date; //set the date of the prediction to be today

                                foundUser.predictions[i].prediction = req.body["prediction"];
                                foundUser.predictions[i].predictValue = req.body["predictValue"];

                                foundUser.predictions[i].predictDate = req.body["predictDate"];

                                console.log("Saving new prediction: " + JSON.stringify(foundUser.predictions[i]));

                                User.findOneAndUpdate({'user_id': user_id, //update the prediction for the user
                                        'predictions.fixture': req.body.fixture}, //where username is same and predictions.fixture is same
                                    { $set: {'predictions.$': req.body}}, //add new prediction
                                    {upsert : false, setDefaultsOnInsert: true, runValidators: true},
                                    function(err, number) {
                                        if(err) return console.log(err);
                                        console.log("\n END CALL \n.");
                                        return res.jsonp(202);
                                    }
                                );
                            }
                        }
                    }
                }
            });
        }
    });
}

exports.findRoundPredictions = function(req, res) {
    var user_id = req.params.user_id;
    User.findOne({'user_id': user_id}, function(err, uRes) { //find the user

        //console.log("The user found is: " + JSON.stringify(uRes));

        Fixture.find({'round':req.params.round}, function(err, fRes) { //find all fixtures for the round
            res.header('Content-type','application/json');
            res.header('Charset','utf8');

            //console.log("The fixtures in this round are: " + JSON.stringify(fRes));

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

//todo: rewrite this to encorporate no prediction and updated rules as stated below. Use moment.js
//when a prediction is made, this decides how many points a user will get if the prediction is correct!
function _allocatePoints(fixtureDate, predictionDate) {
    if (!(typeof fixtureDate === 'undefined' || typeof predictionDate === 'undefined')) {
        //Cast the given dates into moment dates
        fixtureDate = moment(fixtureDate);
        predictionDate = moment(predictionDate);

        //Initialize an empty score object to be returned
        var score = {
            correctPoints: "",
            incorrectPoints: ""
        };

        //Now allocate points depending on the time difference

        //If the prediction has been made during pre-season date range
        //todo: make this reusable when considering other seasons
        var preSeasonStart = moment([predictionDate.year(), 05, 16]); //16th June
        var preSeasonEnd = moment([predictionDate.year(), 07, 7]); //7th August
        var preSeason = moment().range(preSeasonStart, preSeasonEnd);

        //Work out a date range for kick off to the end of half time for this fixture
        //HALF TIME LASTS FOR 15 MINUTES
        var endOfHT = moment(fixtureDate); //REMEMBER THAT DATES ARE REFERENCES TO MUTABLE OBJECTS
        endOfHT.add(1, 'hour');
        console.log(endOfHT);
        var kickOffToEOHT = moment().range(fixtureDate, endOfHT);

        //If the prediction was made in the pre-season date range, can get 15 points
        if (fixtureDate.within(preSeason)) {
            console.log("pre-season: The prediction was made during pre-season, award 15 points.");
            score.correctPoints = 15;
            score.incorrectPoints = -5;
        } else if (fixtureDate.diff(predictionDate, 'days') > 3) { //if the prediction was made "during season" i.e >72 before kick off
            console.log("during-season: The prediction was made after pre-season but more than 3 days before game.");
            score.correctPoints = 12;
            score.incorrectPoints = -4;
        } else if ((fixtureDate.diff(predictionDate, 'days') <= 3) && (fixtureDate.diff(predictionDate, 'days') > 1)) {
            console.log("round-prediction: The prediction was made within 3 days of the game.");
            score.correctPoints = 12;
            score.incorrectPoints = -3;
        } else if ((fixtureDate.diff(predictionDate, 'hours') <= 1) && (predictionDate.isBefore(fixtureDate))) {
            console.log("pre-match: The prediction was made within an hour of the game.");
            score.correctPoints = 6;
            score.incorrectPoints = -2;
        } else if (predictionDate.within(kickOffToEOHT)) {
            console.log("first-half: The prediction has been made between kick off and the end of half time.");
            score.correctPoints = 5;
            score.incorrectPoints = -1;
        }

        //Now return the score object
        return score;
    } else {
        return -1;
    }
}

//function used to assign scores to users.
function _scoreUsers(round, callback) {
    //gets all of the fixtures in a given round
    Fixture.find({'round': round}, function (err, fixs) { //todo: for scheduler only pass a single fixture at a time
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
//FOR ALL FIXTURES / MULTIPLE
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
                        score += preds[k].predictValue.correctPoints;
                    } else {
                        //Otherwise if the prediction was incorrect deduct the necessary amount of points
                        score -= preds[k].predictValue.incorrectPoints;
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