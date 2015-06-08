var mongoose = require('mongoose');
var User = mongoose.model('User');
var Fixture = mongoose.model('Fixture');
var moment = require('moment');
var momentrange = require('moment-range');
var underscore = require('underscore');
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
var MiniSet = require('./miniset');

String.prototype.toObjectId = function() {
    var ObjectId = (require('mongoose').Types.ObjectId);
    return new ObjectId(this.toString());
};

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

//exports.addUser = function(req, res) {
//    User.create(req.body, function(err, user) {
//        if(err) return console.log(err);
//        res.jsonp(user);
//    });
//};

exports.userDeviceTokenManager = function(req, res) {
    //Get the POST body
    console.log('JSON Post body received from the webhook Ionic Push API is: ' + JSON.stringify(req.body));

    var userDeviceDetails = req.body;

    //if the data recieved if registering a new user
    if (userDeviceDetails.user_id) {
        //Now find the user which corresponds to the stated devices
        User.findOne({'user_id' : userDeviceDetails.user_id}, function(error, foundUser){
            if (error) {
                console.log('Error updating user device tokens, when attempting to retrieve user: ' + error);
                return res.jsonp(503);
            } else if (foundUser == null) {
                console.log('Error retrieving user, could not find user with specified user_id');
                return res.jsonp(404);
            } else {

                var changesMade = false;

                //If user does not have device token, register it (push into array)

                //todo: compile a single list of tokens (concat arrays) and run code once

                //Add any android device tokens
                var androidTokens = userDeviceDetails._push.android_tokens;
                console.log('Android tokens are: ' + androidTokens.toString());
                console.log('Device tokens already stored against user are: ' + JSON.stringify(foundUser.userDeviceTokens));

                if (androidTokens) {
                    underscore.each(androidTokens, function(androidToken, index, tokens) {
                        console.log('Now using underscore underscore.each to iterate over ' + index);
                        console.log('Android token is: ' + androidToken);

                        //if this token is not in the list of stored tokens, add it
                        var tokenExists = underscore.contains(foundUser.userDeviceTokens, androidToken);

                        if (!tokenExists) {
                            //add the new token to the array
                            foundUser.userDeviceTokens.push(androidToken);
                            //denote that changes need to be saved
                            changesMade = true;
                            console.log("A new android device token was added for the user.");
                        } else {
                            console.log('Device token already existed for the user');
                        }
                    });
                }

                //Add any ios device tokens
                var iosTokens = userDeviceDetails._push.ios_tokens;
                console.log('Android tokens are: ' + iosTokens.toString());
                console.log('Device tokens already stored against user are: ' + JSON.stringify(foundUser.userDeviceTokens));

                if (iosTokens) {
                    underscore.each(iosTokens, function(iosToken, index, tokens) {
                        console.log('Now using underscore underscore.each to iterate over ' + index);
                        console.log('Android token is: ' + iosToken);

                        //if this token is not in the list of stored tokens, add it
                        var tokenExists = underscore.contains(foundUser.userDeviceTokens, iosToken);

                        if (!tokenExists) {
                            //add the new token to the array
                            foundUser.userDeviceTokens.push(iosToken);
                            changesMade = true;
                            console.log("A new ios device token was added for the user.");
                        } else {
                            console.log('Device token already existed for the user');
                        }
                    });
                }

                //Now save any changes that have been made to the user
                if (changesMade) {
                    console.log("Changes were made to the user and need to be saved.");

                    foundUser.save(function(error) {
                        if (error) {
                            console.log("Error when saving changes to the user: " + error);
                            return res.jsonp(503);
                        } else {
                            console.log("Changes made to the user were saved successfully.");
                            return res.jsonp(200);
                        }
                    });
                } else {
                    console.log('No changes were made to the user'); //todo: remove once tested
                }
            }
        });
    } else if (userDeviceDetails.token_invalid == 'true' ) { //If a device token becomes invalid

        if (userDeviceDetails.ios_token) {
            console.log('Token is for ios device: ' + userDeviceDetails.ios_token);
            tokenToRemove = userDeviceDetails.ios_token
        } else {
            console.log('Token is for android device: ' + userDeviceDetails.android_token);
            tokenToRemove = userDeviceDetails.android_token;
        }

        //Query to find any users which have the invalid device tokens
        Users.find({'userDeviceTokens' : tokenToRemove}, function(error, foundUsers) {
            if (error) {
                console.log('Error updating user device tokens, when attempting to retrieve user: ' + error);
                return res.jsonp(503);
            } else if (foundUsers == null) {
                console.log('Error retrieving user, could not find user with specified user_id');
                return res.jsonp(404);
            } else {
                var changesMade = false; //variable to track whether or not changes will require saving
                console.log('The users found to have the device token are: ' + JSON.stringify(foundUsers));

                //iterate over all of the users and remove the invalid token then save
                //async recursion loop
                _removeInvalidDeviceToken(1, foundUsers, tokenToRemove, function() {
                    console.log("All invalid device ids have successfully been removed from users.");
                    return res.jsonp(200);
                });
            }
        });

        //remove invalid tokens from users and save

    } else if (userDeviceDetails.unregister == 'true') { //If a user unregisters a device

        //Compile single list of device tokens
        var tokensToUnregister = [];
        var androidTokens = userDeviceDetails._push.android_tokens;
        var iosTokens = userDeviceDetails._push.ios_tokens;

        if (androidTokens) {
            tokensToUnregister.concat(androidTokens);
        }

        if (iosTokens) {
            tokensToUnregister.concat(iosTokens);
        }

        console.log('the list of tokens to dergister is: ' + JSON.stringify(tokensToUnregister));

        //Now loop over all users and remove any tokens
        //do recursively
        Users.find({}, function(error, foundUsers) {
            if (error) {
                console.log('Error updating user device tokens, when attempting to retrieve user: ' + error);
                return res.jsonp(503);
            } else if (foundUsers == null) {
                console.log('Error retrieving user, could not find user with specified user_id');
                return res.jsonp(404);
            } else {
                //call recursive async method passing in all users and all tokens
                _removeUnregisteredDeviceToken(i + 1, foundUsers, tokensToUnregister, function() {
                    console.log("Device tokens successfully unregistered");
                    return res.jsonp(200);
                });
            }
        });
    }
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
                roundScores : [],
                currentRoundScore : 0,
                userTeam: 'Arsenal',
                userDeviceTokens: []
            };

            //Assign default values for round scores
            Fixture.find({}).sort({ 'round' : -1 }).exec(function(err, results) {

                var data = JSON.parse(JSON.stringify(results));
                //console.log(data);

                //console.log('Parsing sorted fixture data ' + results + ' into rounds');

                var newData = {
                    rounds: []
                };

                //console.log('The new data variable is: ' + JSON.stringify(newData));

                var newSet = new MiniSet();
                //console.log(newSet);

                //console.log('The data should now have been sorted, and the resulting sorted fixtures are:' + JSON.stringify(fixture));
                // if this round already exists in the list add it else make a new JSON object

                //loop over each fixture, assign to a round
                for(var i = 0; i < data.length; i++) {

                    //console.log("ITERATION " + (i + 1) + " OF " + (data.length - 1));
                    //console.log("FOR THIS ITERATION THE NEW SET BEGINS AS: \t" + JSON.stringify(newSet));

                    var fixture = data[i];
                    //console.log("The value of the data[i] variable is: " + JSON.stringify(fixture));

                    var roundNum = Number(fixture.round.toString());

                    //console.log('Now working on round number: ' + roundNum);
                    //console.log("Does the newSet variable already contain the round number?:\t " + newSet.has(roundNum));

                    if (!newSet.has(roundNum)) {

                        //console.log('Round ' + roundNum + ' did not exist, creating it now and adding in object ' + JSON.stringify(fixture));

                        var nextData = {
                            round: roundNum,
                        };

                        //console.log("Adding a round object to array of rounds: " + JSON.stringify(nextData));
                        newData.rounds.push(nextData);

                        //console.log("Now added this round to the newdata rounds object array");

                        //adding this round to the set used to keep track of rounds
                        newSet.add(roundNum);
                    }
                }

                //console.log('Now returning to the user: ' + JSON.stringify(newData));
                var rounds = newData;
                //console.log(rounds);

                //Create new objects for all rounds that exist
                underscore.each(rounds.rounds, function(round) {
                    //Create the new round score object to add
                    var newRoundScore = {
                        roundNo: round.round,
                        roundScore: 0
                    };

                    //Push this object on to the list of the user's round scores
                    newUser.roundScores.push(newRoundScore);
                });

                newUser.roundScores.reverse();

                //console.log("The default values for the users round scores are: " + JSON.stringify(newUser.roundScores));

                //Now insert this new user object into the database
                User.create(newUser, function(err, user){
                    if (err) return console.log(error);
                    res.jsonp(201); //201 denotes that a new resource has been created
                });
            });

        } else {

            console.log('User already existed, updating.');

            //update that user's information here
            foundUser.username =  req.body.nickname;
            foundUser.name =  req.body.name;
            foundUser.pic = req.body.picture;

            //Trying to save here may be the issue
            //todo: find other instances of this and fix
            //User.update({'user_id' : user_id}, foundUser.toObject(), function(err){
            //    if (err) {
            //        console.log('Error updating user: ' + err);
            //        return res.jsonp(err);
            //    } else {
            //        console.log('Saved updated the latest user details');
            //        return res.jsonp(202);
            //    }
            //});
            foundUser.save(function(err) {
                if (err) {
                    console.log('Error updating user: ' + err);
                    return res.jsonp(err);
                } else {
                    console.log('Saved updated the latest user details');
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

exports.updateUserTeam = function(req, res) {
    var user_id = req.params.user_id;
    var new_team = req.params.team;

    User.findOne({'user_id' : user_id}, function(error, foundUser){
        if (error) {
            console.log("ERROR Retrieving User: " + error);
            return res.jsonp(error);
        } else if (foundUser == null) {
            console.log("Specified user was not found.");
            return res.jsonp(404);
        } else {
            //update the team name if is different
            if (foundUser.userTeam != new_team) {
                foundUser.userTeam = new_team;

                foundUser.save(function(error) {
                    if (error) {
                        console.log('Error saving the updates tot he user: ' + error);
                        return res.jsonp(error);
                    } else {
                        res.jsonp(202);
                    }
                })
            } else {
                console.log('The new team is no different to the old team');
                return res.jsonp('503')
            }
        }
    });

}

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
                console.log('New predictions was created successfully.');
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

exports.updatePredictions = function(req, res) {

    var user_id = req.params.user_id; //get username from request
    var predictionsToUpdate = req.body;
    console.log("The predictions to be updated as received by the server: " + JSON.stringify(predictionsToUpdate));

    //find the user for which predictions are being updated
    User.findOne({'user_id' : user_id}, function(error, foundUser) {
        if (error) {
            console.log("Error: " + error);
            return res.jsonp(503);
        } else if (foundUser == null) {
            console.log("Could not find user to update predictions for.");
            return res.jsonp(404);
        } else {
            console.log("Updating " + predictionsToUpdate.length + ' predictions!');
            console.log("Being recursive update");

            //Call the recursive loop passing in predictions to update and user info
            _updateUserPredictions(0, foundUser, predictionsToUpdate, function() {
                //console.log("All user predictions were successfully updated.");
                return res.jsonp(200);
            });
        }
    });
};

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
            //uRes.score = uRes.score - 20;

            uRes.save(function (err) {
                if (err) return console.log(err);
                return res.jsonp(202);
            });

            console.log('User round predictions deleted for user: ' + uRes.username + ' for round: ' + req.params.round);

        });
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

exports.wipe = function(req, res) {
    Fixture.remove({}, function(result) {
        User.remove({}, function(result) {
            return res.jsonp(result);
        });
    });
};

exports.clearUsers = function(req, res) {
    User.remove({}, function(result) {
        return res.jsonp(result);
    });
};

//Private functions.

//when a prediction is made, this decides how many points a user will get if the prediction is correct!
function _allocatePoints(fixtureDate, predictionDate) {
    if (!(typeof fixtureDate === 'undefined' || typeof predictionDate === 'undefined')) {
        //Cast the given dates into moment dates

        console.log('Running the allocate points function.');

        fixtureDate = moment(fixtureDate);
        predictionDate = moment(predictionDate);

        //Initialize an empty score object to be returned
        var score = {
            correctPoints: "",
            incorrectPoints: "",
            predictWindow: ""
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
        var kickOffToEOHT = moment().range(fixtureDate, endOfHT);

        //If the prediction was made in the pre-season date range, can get 15 points
        if (fixtureDate.within(preSeason)) {
            console.log("pre-season: The prediction was made during pre-season, award 15 points.");
            score.correctPoints = 15;
            score.incorrectPoints = -5;
            score.predictWindow = "Pre-season"
        } else if (fixtureDate.diff(predictionDate, 'days') > 3) { //if the prediction was made "during season" i.e >72 before kick off
            console.log("during-season: The prediction was made after pre-season but more than 3 days before game.");
            score.correctPoints = 12;
            score.incorrectPoints = -4;
            score.predictWindow = "During-season"
        } else if ((fixtureDate.diff(predictionDate, 'days') <= 3) && (fixtureDate.diff(predictionDate, 'days') > 1)) {
            console.log("round-prediction: The prediction was made within 3 days of the game.");
            score.correctPoints = 12;
            score.incorrectPoints = -3;
            score.predictWindow = "Round-prediction"
        } else if ((fixtureDate.diff(predictionDate, 'hours') <= 1) && (predictionDate.isBefore(fixtureDate))) {
            console.log("pre-match: The prediction was made within an hour of the game.");
            score.correctPoints = 6;
            score.incorrectPoints = -2;
            score.predictWindow = "Pre-match"
        } else if (predictionDate.within(kickOffToEOHT)) {
            console.log("first-half: The prediction has been made between kick off and the end of half time.");
            score.correctPoints = 5;
            score.incorrectPoints = -1;
            score.predictWindow = "First-half"
        } else {
            console.log("Fixture was in the past: scoring 0");
            score.correctPoints = 0;
            score.incorrectPoints = 0;
            score.predictWindow = "Fixture finished"
        }

        //Now return the score object
        return score;
    } else {
        return -1;
    }
}

function _removeInvalidDeviceToken(i, foundUsers, tokenToRemove, callback) {
    if (i < foundUsers.length) {
        //place the current user's predictions into an array
        var foundUser = foundUsers[i];
        var newDeviceTokens = foundUser.userDeviceTokens;

        //Remove all invalid device tokens from this users devices
        newDeviceTokens = underscore.without(foundUser.userDeviceTokens, tokenToRemove);


        //if the list of device tokens has been updated
        if (newDeviceTokens != foundUser.userDeviceTokens) {
            //then save the change made to the user's score and recurse, scoring the next user
            User.findByIdAndUpdate(foundUser._id, {$set: {'userDeviceTokens': newDeviceTokens}}, function () {
                //recurse, scoring the next user
                _removeInvalidDeviceToken(i + 1, foundUsers, tokenToRemove, callback);
            });
        } else {
            //recurse without saving, scoring the next user
            _removeInvalidDeviceToken(i + 1, foundUsers, tokenToRemove, callback);
        }

    } else {
        //if at the end of the recursion, invoke the callback
        callback();
    }
}

function _removeUnregisteredDeviceToken(i, foundUsers, tokensToRemove, callback) {
    if (i < foundUsers.length) {
        //place the current token into an array
        var foundUser = foundUsers[i];
        var newDeviceTokens = foundUser.userDeviceTokens;

        console.log("Existing device tokens: " + newDeviceTokens);
        newDeviceTokens = underscore.without(foundUser.userDeviceTokens, tokensToRemove);

        //if the list of device tokens has been updated
        if (newDeviceTokens != foundUser.userDeviceTokens) {
            console.log("DEVICE TOKENS CHAGNED: New device tokens: " + newDeviceTokens);
            //then save the change made to the user's score and recurse, scoring the next user
            User.findByIdAndUpdate(foundUser._id, {$set: {'userDeviceTokens': newDeviceTokens}}, function () {
                //recurse, scoring the next user
                _removeUnregisteredDeviceToken(i + 1, foundsUsers, tokenToRemove, callback);
            });
        } else {
            //recurse without saving, scoring the next user
            _removeUnregisteredDeviceToken(i + 1, foundUsers, tokensToRemove, callback);
        }

    } else {
        //if at the end of the recursion, invoke the callback
        callback();
    }
}

function _updateUserPredictions(index, foundUser, predictionsToUpdate, callback) {
    //console.log('RECURSIVE ITERATION: ' + (index + 1));
    if (index < predictionsToUpdate.length) {

        //Get the prediction we are currently trying to update
        var currentPrediction = predictionsToUpdate[index];
        var predictionsUpdated = false;

        //Iterate through the users predictions until we find one to match the current prediction above

        //For each prediction, ensure the validity of the fixture upon which predictions are made
        Fixture.findOne({'_id': currentPrediction.fixture}, function(err, foundFixture) { //find specific fixure from params
            var date = new Date(); //get today's date

            //Error check the fixture, exit if error
            if(foundFixture == null || typeof foundFixture == 'undefined' || typeof foundFixture.fixDate == 'undefined') {
                // Not functional for dummy data: || foundFixture.fixDate.getTime() <= (date.getTime() + (1000*60*45)))
                return res.jsonp(400); //check to see if we have fixture in db (has it finished yet)?
            } else {

                var currentFixtureRound = foundFixture.round;
                console.log("The fixture of the current round is: " + currentFixtureRound);

                //find the fixture which is having it's prediction altered
                for (var i = 0; i < foundUser.predictions.length; i++) {
                    //console.log("ITERATING TO LOOK FOR FIXTURE PREDICTION ON USER.");
                    //var predictionToUpdate = foundUser.predictions[i];

                    if (foundUser.predictions[i].fixture == currentPrediction.fixture) {
                        //console.log("Found user is: " + JSON.stringify(foundUser));
                        console.log("The prediction being updated is: " + JSON.stringify(foundUser.predictions[i]));

                        //take 2 of the score for the fixture round
                        var userCurrentRoundScore = underscore.findWhere(foundUser.roundScores, {roundNo : currentFixtureRound});
                        console.log('The current score for this round is: ' + JSON.toString(userCurrentRoundScore));

                        //Determine whether or not the user is deleting an existing prediction
                        if ((foundUser.predictions[i].fixture.prediction != 0) && (currentPrediction["prediction"] == 0)) {
                            //Remove 2 points from the user
                            console.log("The user is deleting a prediction, reducing user's score by 2");
                            foundUser.overallSeasonScore = foundUser.overallSeasonScore - 2;

                            //update the user's score - underscore returns a reference so alters original object
                            userCurrentRoundScore.roundScore -= 2;

                            console.log("Deleting prediction");

                            //Delete the prediction
                            foundUser.predictions.pull({ _id: foundUser.predictions[i]._id});
                            predictionsUpdated = true;
                        }
                        else {
                            //If not deleting, but updating, update values and save.
                            console.log("Updating prediction.");

                            //todo: test the point trading system

                            //Check to see if the user needs to trade any points to make the update
                            //Cast dates to moment objects
                            var fixKickOff = moment(foundFixture.kickOff);
                            var predictionDate = moment(); //prediction made when function called

                            //Work out a date range for kick off to the end of half time for this fixture
                            var endOfHT = moment(fixKickOff); //clone fixture state moment object
                            endOfHT.add(1, 'hour');
                            var kickOffToEOHT = moment().range(fixKickOff, endOfHT); //define range for 1st half

                            //If making the update within an hour before the fixture trade 1
                            if ((fixKickOff.diff(predictionDate, 'hours') <= 1) && (predictionDate.isBefore(fixKickOff))) {
                                console.log('POINTS TRADING IS OCCURING.');

                                //Deduct 1 point from user
                                foundUser.overallSeasonScore -= 1;

                                console.log('The current score for this round is: ' + JSON.toString(userCurrentRoundScore));

                                //update the user's score - underscore returns a reference so alters original object
                                userCurrentRoundScore.roundScore -= 1;

                            } else if (predictionDate.within(kickOffToEOHT)) {
                                console.log('POINTS TRADING IS OCCURING.');

                                //If making the update within the first half (up to end of half time) trade 2
                                foundUser.overallSeasonScore -= 2;

                                //take 2 of the score for the fixture round
                                userCurrentRoundScore.roundScore -= 2;
                            }

                            //Work out how many points this prediction is worth
                            //console.log("An actual prediction is being made, so work out how many point it will score.");
                            currentPrediction["predictValue"] = _allocatePoints(foundFixture.kickOff, date); //allocate points for the fixture based on date

                            //Set the date of the prediction to be today
                            //console.log("A prediction value has now been calculated for this update and is: " + JSON.stringify(currentPrediction["predictValue"]));
                            currentPrediction["predictDate"] = date; //set the date of the prediction to be today

                            foundUser.predictions[i].prediction = currentPrediction["prediction"];
                            foundUser.predictions[i].predictValue = currentPrediction["predictValue"];
                            foundUser.predictions[i].predictDate = currentPrediction["predictDate"];
                            predictionsUpdated = true;

                            console.log("Saving updated predictions: " + JSON.stringify(foundUser.predictions));
                        }

                        //Don't iterate if found fixture!
                        //console.log("STOPPING ITERATION AS FOUND USER PREDICTIONS FOR FIXTURE.");
                        break;
                    }
                }

                _updateUserPredictions(index + 1, foundUser, predictionsToUpdate, callback);
            }
        });
    } else {
        foundUser.save(function(error) {
            if (error) {
                console.log("There was an error when updating the user predictions: " + error);
            } else {
                console.log("User predictions updated successfully.");
            }
        });

        callback();
    }
}