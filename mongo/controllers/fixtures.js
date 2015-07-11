////BHAV'S KEY FOOTBALL API KEY: 6c5ccef5-3d91-ab94-5c9dcd7bb1b6
//DEV FOOTBALL API KEY: - change to bhav's key once approved 2760810b-be47-82d7-db48d00daa1c

var mongoose = require('mongoose'),
    http = require('http'),
    https = require('https'),
    users = require('./users'),
    //Agenda = require('agenda'),
    moment = require('moment'),
    async = require('async'),
    fs = require('fs'),
    Q = require('q'),
    underscore = require('underscore'),
    MiniSet = require('./miniset'),
    Fixture = mongoose.model('Fixture'),
    User = mongoose.model('User'),
    vsprintf = require("sprintf-js").vsprintf,
    IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1',
    mongoConnection = 'mongodb://' + IPADDRESS + '/nodejs',
    predictionMap = {
        0: 'no prediction',
        1: 'home win',
        2: 'away win',
        3: 'draw'
    };


if (!process.env.OPENSHIFT_MONGODB_DB_PASSWORD) {
    console.log("RUNNING SERVER LOCALLY, MONGO CONNECTION STRING IS: " + mongoConnection);
} else {
    mongoConnection = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
        process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
        process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
        process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
        process.env.OPENSHIFT_APP_NAME;

    console.log("RUNNING SERVER ON OPENSHIFT, MONGO CONNECTION STRING IS: " + mongoConnection);
}

//agenda = new Agenda({db: {address: mongoConnection}}), //instantiate agenda;

//fire up the scheduler
//    agenda.start();

//define any agenda jobs that are to be scheduled here

//define the job to be run for each fixture to go and get the result and send out push notifications
//agenda.define('score fixture predictors', function (job, done) {
//    //retrieve data from parameters
//    var data = job.attrs.data;
//
//    var fixture = data.fixture;
//
//    //invoke the private function to retrieve users who made predictions on this fixture, and give them scores
//    //fixture should be being passed in as JSON, no need to parse.
//        _getFixtureResult(fixture, function (fixture, done){
//
//        //invoke private function to send out notification to user
//        //get all of the users who made a prediction for this fixture
//        var message = vsprintf("They think it's all over, it is now! The match between %s and %s is finished! Open Yes! Get In! to see how well you did!",
//            [data.fixture.homeTeam, data.fixture.awayTeam]);
//
//        _sendPushNotification(data.fixture, message, done);
//    });
//});
//
//agenda.define('kick-off notification', function (job, done) {
//    //retrieve data from parameters
//    var data = job.attrs.data;
//
//    //invoke private function to send out notification to user
//    //get all of the users who made a prediction for this fixture
//    var message = vsprintf("The match between %s and %s is about to kick off! Get your predictions in now!",
//        [data.fixture.homeTeam, data.fixture.awayTeam]);
//
//    _sendPushNotification(data.fixture, message, done);
//});
//
//agenda.define('pre-match notification', function (job, done) {
//    //retrieve data from parameters
//    var data = job.attrs.data;
//
//    //invoke private function to send out notification to user
//    //get all of the users who made a prediction for this fixture
//    var message = vsprintf("The match between %s and %s kicks off in an hour! Get your predictions in early for more points!",
//        [data.fixture.homeTeam, data.fixture.awayTeam]);
//
//    _sendPushNotification(data.fixture, message, done);
//});
//
//agenda.define('half-time notification', function (job, done) {
//    //retrieve data from parameters
//    var data = job.attrs.data;
//    var fixture = data.fixture;
//
//    //Get the current result of the match to be passed to the app, update the fixture
//    _getHalfTimeFixtureResult(fixture, function (fixture, done){
//
//        //invoke private function to send out notification to user
//        //get all of the users who made a prediction for this fixture
//        var message = vsprintf("%s vs $s half time cuppa! Feeling confident, or need to update your predictions?" +
//            "Current results are %n so it's looking like it's gonna be a %s!",
//            [fixture.homeTeam,
//                fixture.awayTeam,
//                fixture.fixHalfTimeResult.fixScore,
//                predictionMap[fixture.fixHalfTimeResult.fixResult]
//            ]
//        );
//
//        _sendPushNotification(data.fixture, message, done);
//    });
//});
//
////the scheduled job to check for new and updated fixtures every day
//agenda.define('check for updates to existing fixtures', function (job, done) {
//    //retrieve data from parameters
//    var data = job.attrs.data;
//
//    //call function to check for any new fixtures and update the existing ones
//    //_compareAndUpdateFixtures();
//    _schduleTasksForUpdatedFixtures();
//    _clearUnneededJobs();
//
//    done();
//});
//
////every day check the api for new fixtures and update any existing ones to check for updates.
//agenda.every('day', 'check for updates to existing fixtures');

exports.getFixtures = function (req, res) {
    Fixture.find({}, function (err, results) {
        return res.jsonp(results);
    });
};

exports.getRound = function (req, res) {
    var round = req.params.round;

    //Return rounds in date order
    Fixture.find({'round': round}).sort({'fixDate': -1}).exec(function (err, result){
        return res.jsonp(result);
    });
};

exports.getGroupedFixtures = function (req, res) {

    //console.log('Getting rounds');

    Fixture.find({}).sort({'round': -1}).exec(function (err, results) {

        var data = JSON.parse(JSON.stringify(results));

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
        for (var i = 0; i < data.length; i++) {

            //console.log("ITERATION " + (i + 1) + " OF " + (data.length - 1));
            //console.log("FOR THIS ITERATION THE NEW SET BEGINS AS: \t" + JSON.stringify(newSet));

            var fixture = data[i];
            //console.log("The value of the data[i] variable is: " + JSON.stringify(fixture));

            var roundNum = Number(fixture.round.toString());

            //console.log('Now working on round number: ' + roundNum);
            //console.log("Does the newSet variable already contain the round number?:\t " + newSet.has(roundNum));

            if (newSet.has(roundNum)) {

                //console.log('The set already has the round ' + roundNum + ' just adding in ' + JSON.stringify(fixture));

                // there is a fatal flaw in which we assume the rounds[number] exists in order, fix later lol

                //console.log('Now pushing the fixture into the round ' + roundNum);
                //console.log(JSON.stringify(newData));

                //trying to find round using array index instead of key/value pair!!!
                //use underscore to do this?
                //where the round = roundNum, add in this fixture.
                //do with utility function or look for it with a for loop.
                for (var j = 0; j < newData.rounds.length; j++) {
                    if (newData.rounds[j].round == roundNum) {
                        newData.rounds[j].data.push(fixture);
                    }
                }

            } else {

                //console.log('Round ' + roundNum + ' did not exist, creating it now and adding in object ' + JSON.stringify(fixture));

                var nextData = {
                    round: roundNum,
                    data: []
                };
                //console.log("Adding a round object to array of rounds: " + JSON.stringify(nextData));

                nextData.data.push(fixture);
                //console.log("Added the first fixture to this round: " + JSON.stringify(nextData.data));

                newData.rounds.push(nextData);
                //console.log("Now added this round to the newdata rounds object array");

                //adding this round to the set used to keep track of rounds
                newSet.add(roundNum);
            }
        }

        //console.log('Now returning to the user: ' + JSON.stringify(newData));
        return res.jsonp(newData);
    });
};

//function to call to the football-api and retrieve the league table
exports.getStandings = function (req, res) {
    debugger;

    console.log("rest::getStandings");

    //set the option settings which will always be the same here
    var options = {
        host: 'football-api.com',
        path: '/api/?Action=standings&APIKey=6c5ccef5-3d91-ab94-5c9dcd7bb1b6&comp_id=1204',
        //path: '/api/?Action=standings&APIKey=2760810b-be47-82d7-db48d00daa1c&comp_id=1204',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    var obj = {}; //variable to hold the returned json

    http.get(options, function (res2) {
        var output = '';
        console.log(options.host + ':' + res2.statusCode);
        res2.setEncoding('utf8');

        res2.on('data', function (chunk) {
            output += chunk;
        });

        res2.on('end', function () {
            obj = JSON.parse(output);
            console.log(obj);
            return res.jsonp(obj);
        });
    });
};

exports.addFixtures = function (req, res) {
    Fixture.create(req.body, function (err, fixture) {
        if (err) return console.log(err);
        return res.jsonp(fixture);
    });
};

exports.uploadFixturesFromFile = function(req, res) {

    console.log("Loading fixtures from fixtures.json into database.");

    var fixtures = JSON.parse(fs.readFileSync('fixtures.json', 'utf8'));

    Fixture.create(fixtures,
        function (err, fixtures) {
            //For all fixtures schedule jobs
            if (err) {
                console.log('There were errors finding fixtures: ' + error);
                return res.jsonp(503);
            } else if (fixtures == undefined) {
                console.log('No fixtures were found');
                return res.jsonp(404);
            } else {
                //console.log('Scheduling jobs');

                //var q = async.queue(function (fixture, callback) {
                //console.log("no of fixtures " + fixtures.length);

                //for (var i = 0; i < fixtures.length; i++) {
                //    var fixture = fixtures[i];
                //
                //    _scheduleFixtureActions(fixture);
                //    //var hourBeforeKickOff = moment(fixture.kickOff);
                //    //hourBeforeKickOff.subtract(1, 'hour');
                //
                //    //reschedule the job(s) to score the fixture at it's new finishing time
                //    //agenda.schedule(hourBeforeKickOff.toDate(), 'pre-match notification', {fixture: fixture});
                //    //agenda.schedule(fixture.kickOff, 'kick-off notification', {fixture: fixture});
                //    //agenda.schedule(fixture.halfTime, 'half-time notification', {fixture: fixture});
                //    //agenda.schedule(fixture.fullTime, 'score fixture predictors', {fixture: fixture});
                //
                //    //if (i == (fixtures.length -1)) {
                //    //    return res.jsonp(200);
                //    //}
                //}
                return res.jsonp(200);
            }
        });
}

exports.clearFixtures = function (req, res) {
    Fixture.remove({}, function (result) {
        return res.jsonp(result);
    });
};

exports.clearRound = function () {
    var round = req.params.round;
    Fixture.remove({'round': round}, function (result) {
        return res.jsonp(result);
    });
};

exports.scorePredictingUsersForFixture = function(req,res){
    //get password, if wrong exit
    var password = req.params.admin_password;

    //get fixture id
    var fixture_id = mongoose.Types.ObjectId(req.params.fixture_id);

    //get game result
    var result = req.params.fixture_result;

    if (password != 'roC5arv1Av3oK3eAng0Aj9Teaw6J'){
        console.log("Incorrect password supplied, please use proper admin password.");
        res.jsonp(402);
    } else if ((result < 1) || (result > 3)){
        console.log("Not a valid result for games.");
        res.jsonp(503);
    } else {

        //find the fixture
        Fixture.findOne({"_id" : fixture_id}, function(error, foundFixture){
            if(error){
                console.log("Error when admin update tried to find fixture");
                res.jsonp(503);
            } else if (foundFixture == null) {
                console.log("Error when admin update: Could not find fixture with specified id");
                res.jsonp(404);
            } else {
                console.log("Now assigning the result to the fixture.");

                foundFixture.fixResult.fixResult = result;

                //Now save the changes that have been made to the user
                foundFixture.save(function(error){
                    console.log("Result successfully assigned to the fixture");
                    console.log("Now scoring any users who made predictions");

                    //Now invoke the user scoring
                    _scheduleScorePredictingUsers(foundFixture);

                    //IN PARALLEL send out push notification to tell users HOW MUCH they will be scoring!
                    _sendFixtureFinishedPushNotification(foundFixture);
                });

                res.jsonp(200);
            }
        });
    }
};

//after game scored sends pushed to predicting users
function _sendFixtureFinishedPushNotification(fixture) {
    User.find({'predictions.fixture': fixture._id}, function (error, users) {
        //for each of these user's and each of their devices, send out a push notification
        if (error) {
            console.log("Error trying to send push notifications, when retrieving users: " + error);
        } else if (users == null) {
            console.log("No users were found to have made predictions for the given fixture.");
        } else {
            //console.log("Now attempting to send a push notification.");
            //console.log("Iterating over each user.");

            underscore.each(users, function (user) {
                //make the http post request setting all of the appropriate settings

                //find the prediction that was made for this fixture DOESN'T WORK
                //var thisFixturePrediction = underscore.findWhere(user.predictions, {fixture: fixture._id});

                var thisFixturePrediction = null;
                console.log("Now finding the corresponding prediction in current user with fixture id of fixture just finished");
                for (var i = 0; i < user.predictions.length; i++){

                    console.log("Inspecting prediction: " + JSON.stringify(user.predictions[i]));

                    if (user.predictions[i].fixture = fixture._id){
                        console.log("User prediction for just finished fixture found!");
                        thisFixturePrediction = user.predictions[i];

                        var userPrediction = predictionMap[thisFixturePrediction.prediction];
                        console.log("User prediction for latest scored fixture is: " + userPrediction);

                        //prepend correct article to user prediction
                        //prepend the right article ('a' or 'an')
                        if (userPrediction == 'home win' || userPrediction == 'draw') {
                            userPrediction = 'a ' + userPrediction;
                        } else if (userPrediction == 'away win'){
                            userPrediction = 'an ' + userPrediction;
                        }

                        //Variable to check if the user is correct or incorrect
                        var userOutcome;

                        console.log("Result of fixture is: " + fixture.fixResult.fixResult);

                        //get actual result in text
                        var actualResult = predictionMap[fixture.fixResult.fixResult];
                        console.log("The actual result of the fixture has been translated from: " + fixture.fixResult.fixResult + " to: " + actualResult);

                        //prepend the right article ('a' or 'an')
                        if (actualResult == 'home win' || actualResult == 'draw') {
                            actualResult = 'a ' + actualResult;
                        } else if (actualResult == 'away win'){
                            actualResult = 'an ' + actualResult;
                        }

                        //Append user prediction to the message.
                        var predictionMessage = vsprintf('They think it\'s all over, it is now! The whistle\'s blown on the %s vs. %s match! You predicted %s. It was %s!',
                            [fixture.homeTeam, fixture.awayTeam, userPrediction, actualResult]);


                        //Now work out and tell users if they were correct or not
                        //figure out if the user was correct or not!
                        if (thisFixturePrediction == fixture.fixResult.fixResult){
                            userOutcome = 'correct';
                        } else {
                            userOutcome = 'incorrect';
                        }

                        var outcomeMessage = '';

                        //set push notificaion message saying how many points user won lost and if they were correct!
                        if (userOutcome == 'correct'){
                            outcomeMessage = 'Yes! Get In! You were correct! Enjoy your ' + thisFixturePrediction.predictValue.correctPoints + ' points!';
                        } else if (userOutcome == 'incorrect'){
                            outcomeMessage = 'Oh no! You were wrong! You lost ' + thisFixturePrediction.predictValue.incorrectPoints + ' points. Get back in the game to win them back!';
                        }

                        console.log("Second half of push notification message is: ");
                        console.log(outcomeMessage);

                        predictionMessage = predictionMessage + outcomeMessage;

                        console.log("The message being sent in the push notification to the user is: ");
                        console.log(predictionMessage);

                        // Build the post string from an object
                        var post_data = JSON.stringify({
                            tokens: user.userDeviceTokens,
                            notification: {
                                alert: predictionMessage,
                                ios: {
                                    badge: 1,
                                    sound: "ping.aiff",
                                    payload: {$state: 'tab.round-detail', $stateParams: {"roundId": fixture.round}}
                                },
                                android: {
                                    payload: {$state: 'tab.round-detail', $stateParams: {"roundId": fixture.round}}
                                }
                            }
                        });
                        console.log('Seding post body: ' + post_data);

                        // An object of options to indicate where to post to
                        var post_options = {
                            host: 'push.ionic.io',
                            //port: '80',
                            path: '/api/v1/push',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Ionic-Application-Id': '17ad87a3',
                                'Authorization': 'Basic ' + new Buffer('d0a862e5f4f2633898602f8be332e55557a1d62f83b8d591' + ':' + '').toString('base64')
                            }
                        };

                        console.log("Attempting to send the post request");
                        // Set up the request
                        var post_req = https.request(post_options, function (res) {
                            res.setEncoding('utf8');
                            res.on('data', function (chunk) {
                                console.log('Response: ' + chunk);
                            });
                        });

                        // post the data
                        post_req.write(post_data);
                        post_req.end();

                        //exit this loop and look at next user as users can only have one prediction per fixture!
                        break;
                    }
                }
            });

            //done(); //fire event to tell agenda job that this job has finished running
        }
    });
}


function _sendPushNotification(fixture, message) {
    User.find({'predictions.fixture': fixture._id}, function (error, users) {
        //for each of these user's and each of their devices, send out a push notification
        if (error) {
            console.log("Error trying to send push notifications, when retrieving users: " + error);
        } else if (users == null) {
            console.log("No users were found to have made predictions for the given fixture.");
        } else {
            //console.log("Now attempting to send a push notification.");
            //console.log("Iterating over each user.");

            underscore.each(users, function (user) {
                //make the http post request setting all of the appropriate settings

                //find the prediction that was made for this fixture
                var thisFixturePrediction = underscore.findWhere(user.predictions, {fixture: fixture._id});
                var userPrediction = predictionMap[thisFixturePrediction.prediction];

                //Append user prediction to the message.
                var predictionMessage = vsprintf(' You predicted a %s during %s and stand to win %n points if you\'re right, or lose %n points if you\'re wrong!',
                    [userPrediction, thisFixturePrediction.predictValue.correctPoints, thisFixturePrediction.predictValue.incorrectPoints]);

                message.concat(predictionMessage);


                // Build the post string from an object
                var post_data = JSON.stringify({
                    tokens: user.userDeviceTokens,
                    notification: {
                        alert: message,
                        ios: {
                            badge: 1,
                            sound: "ping.aiff",
                            payload: {$state: 'tab.round-detail', $stateParams: {"roundId": fixture.round}}
                        },
                        android: {
                            payload: {$state: 'tab.round-detail', $stateParams: {"roundId": fixture.round}}
                        }
                    }
                });
                console.log('Seding post body: ' + post_data);

                // An object of options to indicate where to post to
                var post_options = {
                    host: 'push.ionic.io',
                    //port: '80',
                    path: '/api/v1/push',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Ionic-Application-Id': '17ad87a3',
                        'Authorization': 'Basic ' + new Buffer('d0a862e5f4f2633898602f8be332e55557a1d62f83b8d591' + ':' + '').toString('base64')
                    }
                };

                console.log("Attempting to send the post request");
                // Set up the request
                var post_req = https.request(post_options, function (res) {
                    res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                        console.log('Response: ' + chunk);
                    });
                });

                // post the data
                post_req.write(post_data);
                post_req.end();
            });

            done(); //fire event to tell agenda job that this job has finished running
        }
    });
}


//API TESTING FUNCTIONS
//exports.testGetResultThenScore = function (req, res) {
//
//    //now set the the mongo id of this fixture
//    //to test whole thing make this a fixture which users have predicted - so they'll get a score
//    var id = mongoose.Types.ObjectId("55785f4e38bd12511018145d");
//    console.log("Fake document id is: " + id);
//
//    var kickOff = moment();
//    kickOff.add(1, 'minute');
//    var halfTime = moment(kickOff);
//    halfTime.add(45, 'minutes');
//    var fullTime = moment(kickOff);
//    fullTime.add(90, 'minutes');
//    var fixDate = moment('02.05.2015', 'DD.MM.YYYY');
//
//    var fixture = {
//        _id: id,
//        homeTeam: "Aston Villa",
//        awayTeam: "Everton",
//        round: 35,
//        kickOff: kickOff.toDate(),
//        halfTime: halfTime.toDate(),
//        fullTime: fullTime.toDate(),
//        fixDate: fixDate.toDate(),
//        awayTeamForm: [
//
//        ],
//        homeTeamForm: [
//
//        ],
//        __v: 0
//    };
//
//    //console.log("The string value of the fixDate is: " + _formattedDate(fixture.fixDate));
//
//    //now invoke the function and pass in this fixture object
//    //pass object in as json
//    //TODO: evaulate if the callback is necessary?
//    //TODO: SCHEDULE THIS TO GET RUN FOR EACH FIXTURE, AT THE END OF THE MATCH...
//    _getFixtureResult(fixture, function () {
//        res.jsonp('THE USERS WHO PREDICTED FOR THIS FIXTURE WERE GIVEN SCORES BASED OFF OF LIVE RESULTS!!!')
//    });
//};

//exports.testScoringUsers = function(req, res) {
//
//    var id = mongoose.Types.ObjectId("55785f4e38bd12511018145d");
//
//    var kickOff = moment();
//    kickOff.add(1, 'minute');
//    var halfTime = moment(kickOff);
//    halfTime.add(45, 'minutes');
//    var fullTime = moment(kickOff);
//    fullTime.add(90, 'minutes');
//    var fixDate = moment('02.05.2015', 'DD.MM.YYYY');
//
//    //make fake fixture and set results
//    var fixture = {
//        _id: id,
//        homeTeam: "Aston Villa",
//        awayTeam: "Everton",
//        round: 35,
//        kickOff: kickOff.toDate(),
//        halfTime: halfTime.toDate(),
//        fullTime: fullTime.toDate(),
//        fixDate: fixDate.toDate(),
//        fixResult: {
//            fixResult: 1,
//            fixScore: "[3-0]"
//        },
//        awayTeamForm: [
//
//        ],
//        homeTeamForm: [
//
//        ],
//        __v: 0
//    };
//
//    _scheduleScorePredictingUsers(fixture, function(){
//        return res.jsonp(200);
//    });
//};

//this must come after examples, I think
//exports.dummyData = function (req, res) {
//    Fixture.create(examples,
//        function (err) {
//            if (err)
//                return console.log(err);
//            return res.jsonp(202);
//        }
//    );
//};

//exports.callScheduler = function(req, res) {
//    _schduleTasksForUpdatedFixtures();
//    //_clearUnneededJobs()
//    return res.jsonp(200);
//};

//PRIVATE FUNCTIONS

//todo: schedule function to clear out all old predictions and fixtures after the end of a season
//function _CheckEndOfSeasonClearOut() {
//
//    var today = moment();
//    var seasonStart
//    var seasonEndFromToday = moment([today.year(), 04, 24]); //assume the 24th, change this
//
//    if (today.isAfter(seasonEndFromToday)) {
//
//        //then the season has ended, clear out all old data
//        seasonStart = moment([today.year(), 07, 01]);
//
//        Fixture.remove({}, function () {
//            console.log("Removed all old fixtures");
//        });
//
//        Predictions.remove({}, function () {
//            console.log("Removed all old predictions");
//        });
//    }
//
//}

//gets run everyday, to check for any new fixtures and ensure old fixtures are up to date with 3rd party game API
//function _getNewUpdateExistingFixtures() {
//
//    //these are decided automatically, so not supplied as parameters
//    var fromDate;
//    var today = moment();
//    var seasonEnd = moment([today.year(), 04, 24]);
//
//    //todo: dates here need work
//    if (today.isAfter(seasonEnd)) {
//        seasonEnd = moment([today.year() + 1, 04, 31]);
//    }
//
//    //set the seasonend
//
//    //First check for any new fixtures which may have been scheduled
//
//    //todo: implement this to allow for more leagues than just epl, e.g la liga
//    //switch(competition){
//    //    case "EPL":
//    //        competitionCode = '1204';
//    //        break;
//    //    default:
//    //        competitionCode = '1204'; //default to epl
//    //        console.log("The supplied competition name does not map to any supported competition");
//    //        break;
//    //    //implement throwing exceptions here
//    //    //add more cases as the app supports more competitions
//    //}
//
//    //just do this for the epl for now
//    //todo: make this generic for other football leagues or even sports
//
//    //if there are no existing fixtures, then get new fixtures from today or get from day after latest fixture
//    Fixture.find({}).sort({'fixDate': 1}).exec(function (error, fixtures) {
//        if (fixtures.length > 0) {
//            console.log("Fixtures already existed, setting dates based on these.")
//            //then get to and from dates for the api query from existing
//            //we only want new fixtures if there are any, so fromDate is the latest date in fixtures
//            //THE RESULTS MUST BE SORTED FOR THIS LOGIC TO BE VALID
//            console.log("Number of fixtures already existed: " + fixtures.length);
//
//            fromDate = moment(fixtures[fixtures.length - 1].fixDate);
//
//            //season end only used to check if we are trying to get matches from beyond the end of the season.
//            if (fromDate.isSame(seasonEnd) || fromDate.isAfter(seasonEnd)) {
//                return console.log('No new fixtures to get, just checking existing ones are up to date!');
//            } else {
//                //increment from date by a day and get fixtures from this point onwards
//
//                //FROM NEXT DAY IN SEASON - MID SEASON
//                fromDate.add(1, 'day');
//            }
//        } else {
//            //FROM TODAY
//
//            //if no fixtures exist already, then  set default dates
//            fromDate = moment(); //default getting fixtures from today
//            //remember these all run async, need callbacks
//        }
//
//        //Check for season rollover
//        if (today.isAfter(seasonEnd)) {
//            seasonEnd = moment([today.year() + 1, 04, 31]);
//
//            //set the from date to be the start of the new season
//            fromDate = moment([today.year(), 07, 01]);
//        }
//
//        console.log("Now checking for new fixtures.");
//        //want to check for new but ALWAYS  run update even if no new matches, regardless
//        //to use promises to fix the callback hell that this has turned into
//
//        var newFixtures = _checkForProcessNewFixtures(fromDate);
//
//        //once the api request promise is fulfilled
//        newFixtures.then(
//            function () {
//                //once any new fixtures have been added and found
//                //todo: remove no new added into success reponse, to remove below promise reject function.
//
//                console.log("TOP LEVEL: PROMISE FULFILLED - NEW FIXTURES ADDED - CHECKING FOR UPDATES TO EXISTING FIXTURES.")
//                _compareAndUpdateFixtures();
//            },
//            function (error) {
//                //handle the error, just print to console and return
//                console.log("Checking for new fixtures returned an no new fixtures or an error")
//
//                //now check for updates to existing fixtures
//                console.log("TOP LEVEL: PROMISE REJECTED - NO NEW FIXTURES FOUND - CHECKING FOR UPDATES TO EXISTING FIXTURES.")
//                _compareAndUpdateFixtures();
//            });
//    });
//
//}

//todo: write a wrapper function for the football api
//will only ever call up to the end of the season
function _getFootballApiFixtures(fromDate, toDate, specificDate) {

    var competitionCode = '1204';
    var deferred = Q.defer();

    //Sort out the date up to which we will retrieve fixtures, always to the end of the season
    //todo: make this generic for different leagues
    var today = new Date();
    var thisYear = today.getFullYear();
    //toDate = moment([lastYear, 08, 13]); //this league ends 24 may this year
    var toDate = moment([thisYear, 04, 31]); //this league ends 24 may this year

    today = moment(); //cast today into moment date type
    //check that current season has not ended
    if (today.isAfter(toDate)) {
        //then the season has finished, use the end of next season
        console.log("This season has finished, moving the end range for dates to get fixtures between to next year, end of next season");
        toDate = moment([thisYear + 1, 04, 31]);

        //from date should now be the start of the next season
        console.log("Also moving the fromDate to be the start of the next season.");
        fromDate = moment([thisYear, 07, 01]);
    }

    console.log("Will be retrieving fixtures up to: " + toDate.toString());

    console.log("Now contacting 3rd party API football-api to get real-world fixture data.");

    //parse to and from dates to proper format
    var callFromDate = fromDate.format("DD.MM.YYYY");
    var callToDate = toDate.format("DD.MM.YYYY");
    console.log("The dates being sent in the API query are: " + callFromDate + " and " + callToDate);

    var options = {
        host: 'football-api.com',
        path: '/api/?Action=fixtures&APIKey=6c5ccef5-3d91-ab94-5c9dcd7bb1b6&comp_id=' + competitionCode +
        '&from_date=' + callFromDate + '&to_date=' + callToDate,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    var obj = {}; //variable to hold the returned json

    console.log("Now attempting to make API call to endpoint: " + options.path);

    //make the call to the football-api API
    http.get(options, function (response) {

        var output = '';
        var seasonFixtures = [];

        console.log(options.host + ':' + response.statusCode);
        response.setEncoding('utf8');

        response.on('data', function (chunk) {
            output += chunk;
        });

        response.on('end', function () {
            //process results from football-api
            obj = JSON.parse(output);
            //console.log("Results returned from server: " + JSON.stringify(obj));

            //if nothing went wrong, process returned fixtures
            //this is api specific
            if (obj.ERROR == 'OK') { //nothing went wrong
                seasonFixtures = obj.matches;

                //if user has also supplied a list of local fixtures to compare to,
                console.log("The callback is to UPDATE EXISTING FIXTURES");

                //if some new fixtures were found, return them
                deferred.resolve(seasonFixtures);
                //} else if(obj.ERROR == 'no matches found in that day') {
                //    console.log("No new matches were found, so just checking for updates to existing ones.");
                //    deferred.resolve();
            } else {
                console.log("API - ERROR OR NO NEW FIXTURES: \n\t " + obj.ERROR + " REJECTING PROMISE");
                //if no new fixtures, or there is an error, reject the promise
                deferred.reject(obj.ERROR);
            }
        });
    });

    //Always return the promise
    return deferred.promise;
}

//takes a list of fixtures from the api, parses them and adds them to the local database
//function _checkForProcessNewFixtures(fromDate) {
//
//    console.log("\nFUNCTION: CHECKING FOR NEW FIXTURES\n");
//
//    var deferred = Q.defer();
//    var fixturesToStore = [];
//    var seasonEnd = moment('24.05.2015', 'DD.MM.YYYY'); //todo: maybe pass this is as a parameter
//
//    //go and get any new fixtures from api
//    var getAnyNewFixs = _getFootballApiFixtures(fromDate);
//
//    //process any new fixtures into the database
//    getAnyNewFixs.then(function (seasonFixtures) {
//        //sort the results
//        seasonFixtures = _sortByMomentDate(seasonFixtures, 'match_formatted_date');
//        seasonFixtures.reverse(); //todo: replace this with sorting the properly (stop being lazy
//
//        console.log("Fixtures from server have now been sorted by date");
//
//        //loop over returned fixtures and parse into our format and store in db
//        var currentFixture = null; //todo: check if better to initialize to null?
//        var previousFixtureDate = seasonEnd;
//        var previousFixtureRound = 38;
//        var fixtureRound = 38;
//
//        //get fixtures from today until end of season...
//        for (var i = 0; i < seasonFixtures.length; i++) {
//
//            //console.log("Iteration of fixtures: " + i);
//            //for each fixture from the 3rd party api, extract relevant details, construct doc and save to db
//            currentFixture = seasonFixtures[i];
//
//            //make the returned fix date into a usable moment.js date
//            var thisFixtureDate = moment(currentFixture.match_formatted_date, "DD.MM.YYYY");
//            console.log("\nCurrent fixture date: " + thisFixtureDate.toString());
//
//            //using moment.js, find the difference in weeks between the last game and this one
//            //if there is a previous fixture (not the first fixture of season which goes in round 1)
//            //then work out which round this fixture belongs in
//            //assumes chain and order of fixtures. BE SURE TO SORT.
//            if (previousFixtureDate) {
//                //then work out this fixture's round based on the previous one
//
//                //find the monday which follows the previous fixture
//
//                //if the previous date is already a monday, this is the end of the previous fixtures' end
//                var previousTuesdayFound = false;
//                var previousTuesday;
//                var tempNextDay = moment(previousFixtureDate); //clone date properly, new object, not new pointer
//
//                //this loop should run until the monday after the previous fixture is found
//                //console.log("Now looping to find the Tuesday which follows the previous fixture, which was: " +
//                //previousFixtureDate.toString());
//
//                while (!previousTuesdayFound) {
//                    if (tempNextDay.day() == 2) { //if the date is a monday
//                        //console.log("The previous Tuesday to the previous fixture has been found to be: " +
//                        //tempNextDay.toString() + "\n Exiting while loop.");
//
//                        //assign this date as following monday (end of previous round) - CLONE OBJECT
//                        previousTuesday = moment(tempNextDay);
//
//                        //close the loop
//                        previousTuesdayFound = true;
//                    } else {
//                        //console.log("Day " + tempNextDay.day() + " was not a previous Tuesday, iterating")
//                        tempNextDay.subtract(1, 'day');
//                    }
//                }
//
//                //if current fixture is after this monday then place it in the next round else in same round
//                if (thisFixtureDate < previousTuesday) {
//                    //console.log("The previous (descending so in time, next) fixture round is: " + previousFixtureRound);
//                    fixtureRound = previousFixtureRound - 1; //todo: check if ++ would mute original
//                    //console.log("This fixture belongs in the previous round: " + fixtureRound);
//                } else {
//                    fixtureRound = previousFixtureRound;
//                    //console.log("The previous (descending so in time, next) fixture round is: " + previousFixtureRound);
//                    //console.log("This fixture belongs in the same round as the previous fixture: " + fixtureRound);
//                }
//            }
//
//            //console.log("This fixture belongs to gameweek/round: " + fixtureRound);
//
//            //todo: these are not being parsed properly
//            //parse match times for storage
//            var kickOffTime = moment(thisFixtureDate)
//
//            //parse this differently
//            console.log("Fixture match time: " + currentFixture.match_time);
//            console.log("Fixture match hour: " + currentFixture.match_time.substr(0, 2));
//            console.log("Fixture match minutes: " + currentFixture.match_time.substr(3, 4))
//            kickOffTime.hours(currentFixture.match_time.substr(0, 2)); //todo: think misusing substr, fix
//            kickOffTime.minutes(currentFixture.match_time.substr(3, 4));
//            console.log("The proposed kick off time is: " + kickOffTime.toString());
//
//            var halfTime = moment(kickOffTime);
//            halfTime.add(45, 'minutes');
//            console.log("This fixture have half time at: " + halfTime.toString());
//
//            var fullTime = moment(kickOffTime);
//            fullTime.add(90, 'minutes');
//            console.log("The fixture should end at: " + fullTime.toString());
//
//            //cast dates and times here first
//            var convertedDate = thisFixtureDate.toDate();
//            var kickOffSave = kickOffTime.toDate(); //check if mutable as others, if so delete variables
//            var halfTimeSave = halfTime.toDate();
//            var fullTimeSave = fullTime.toDate();
//
//            //extract the result and put into usable form
//            var tempAPIResult = currentFixture.match_ft_score;
//            //console.log("The result of the relelvant fixture from the football-api.com API is: " + tempAPIResult);
//
//            //todo: extract this out into a function as used in multiple places - Stay DRY!
//            var homeTeamResult = tempAPIResult.charAt(1);
//            var awayTeamResult = tempAPIResult.charAt(3);
//
//            var localFixResult = {fixResult: 0, fixScore: 0};
//
//            //Now process this result into a usable format for our server (1, 2 or 3)
//            //1 = home win, 2 = away win, 3 = draw
//            if (homeTeamResult > awayTeamResult) {
//                //then this was a home win
//                localFixResult.fixResult = 1;
//                //console.log("The match was a home win.");
//            } else if (homeTeamResult < awayTeamResult) {
//                //then this was an away win
//                localFixResult.fixResult = 2;
//                //console.log("The match was an away win.");
//            } else if (homeTeamResult == awayTeamResult) {
//                //then this was a draw
//                localFixResult.fixResult = 3;
//                //console.log("The match was a draw.");
//            }
//
//            //now construct new object to add
//            //todo: decalre new fixture above and then redeclare on each iteration for efficiency?
//            var newFixture = {
//                homeTeam: currentFixture.match_localteam_name,
//                homeTeamForm: [],
//                awayTeam: currentFixture.match_visitorteam_name,
//                awayTeamForm: [],
//                round: fixtureRound,
//                fixStadium: currentFixture.match_venue_beta,
//                fixDate: convertedDate,
//                fixResult: localFixResult, //for no current result
//                fixHalfTimeResult: {},
//                kickOff: kickOffSave,
//                halfTime: halfTimeSave,
//                fullTime: fullTimeSave
//            };
//
//            //console.log("The fixture being added to the database is: \n" + JSON.stringify(newFixture));
//
//            fixturesToStore.push(JSON.stringify(newFixture));
//
//            //Now move on to the next fixture
//
//            //Assign the previous fixture for the next iteration
//            previousFixtureDate = thisFixtureDate;
//            previousFixtureRound = fixtureRound;
//        }
//
//        //the new fixtures to get added to our database
//        fixturesToStore = "[" + fixturesToStore + "]";
//        //console.log("Fixtures about to be saved are: " + fixturesToStore);
//
//        fixturesToStore = JSON.parse(fixturesToStore);
//
//        //once the loop has run it's course and created the whole list of fixtures, save to db
//        //need to access the MongoDB driver directly as large dataset crashes .create mongoose method
//        Fixture.collection.insert(fixturesToStore, function (err, fixtures) {
//            if (err) {
//                console.log(err);
//                //reject the promise, no data to return
//                deferred.reject();
//            }
//
//            console.log("All of the new fixtures were saved to the database successfully!");
//
//            console.log("Now scheduling these fixtures to have their scores calculated upon completion");
//            //now iterate over each inserted fixture and for when finishing, to get results and tell users
//            for (var i = 0; i < fixturesToStore.length; i++) {
//                var fixture = fixturesToStore[i];
//
//                console.log("Scheduling to check results and score users for fixture:" + fixture.fullTime);
//
//                //todo: also schedule for before kick off and half time notifictions here
//                agenda.schedule(fixture.fullTime, 'score fixture predictors', {fixture: fixture});
//            }
//
//            //fulfill the promise, no data to return
//            deferred.resolve();
//        });
//
//        return deferred.promise;
//    }, function (error) {
//
//        console.log("\n\t FN: CHECKING FOR NEW FIXS: \n\tPROMISE WAS REJECTED ");
//
//        //then reject the promise and return the error
//        deferred.reject(error);
//    });
//
//    //always return a promise, regardless
//    return deferred.promise;
//}

//function to check existing fixtures and live schedule, to update any changes to fixtures
//todo: test this once new fixtures have been released!
//function _compareAndUpdateFixtures() {
//
//    console.log("\n FUNCTION: COMPARING AND UPDATING FIXTURES \n");
//
//    //get all fixtures from our db FROM NOW, - 45 MINUTES AGO
//    var fromDate = moment();
//    fromDate.subtract(45, 'minutes'); //get games which may be altered whilst in play
//
//    //get fixtures from the api
//    var fetchFixtures = _getFootballApiFixtures(fromDate);
//
//    fetchFixtures.then(
//        function (APIFixtures) {
//
//            //get local fixtures
//            Fixture.find({}, function (error, localFixtures) {
//                //check to see that this is date is later than from date
//
//                //for each fixture down from the api
//                //always better to have declarations at scope start, the reassign as necessary
//                var localFixture;
//                var APIFixture;
//                for (var i = 0; i < APIFixtures.length; i++) {
//                    APIFixture = APIFixtures[i];
//                    console.log("\nThe current fixture under comparison from the API is: \n" +
//                        "\tMatch date : " + (APIFixture.match_formatted_date) +
//                        "\n\tMatch time : " + (APIFixture.match_time));
//
//                    //find corresponding locally stored match in db using home and away team
//                    localFixture = underscore.findWhere(localFixtures, {
//                        homeTeam: APIFixture.match_localteam_name,
//                        awayTeam: APIFixture.match_visitorteam_name
//                    });
//
//                    var localFixDate = moment(localFixture.fixDate);
//
//                    //if none is found, throw an error
//                    if (!localFixture) {
//                        console.log("ERROR, MATCHING LOCALLY STORED FIXTURE COULD NOT BE FOUND")
//                        return "error" //LOOK up if there is a better way of doing this
//                    } else if (localFixDate.isBefore(fromDate)) {
//                        console.log("ERROR, MATCHING LOCALLY STORED FIXTURE WAS IN THE PAST, ALREADY FINISHED")
//                        return "error" //LOOK up if there is a better way of doing this
//                    } else {
//                        console.log("The matching locally stored fixture to the current API fixture being compared to is: \n" +
//                            "\tMatch date: " + localFixture.fixDate +
//                            "\n\tMatch time: " + localFixture.kickOff);
//                    }
//
//                    //now perform comparison and see if the fixture needs to be updated in our local database
//
//                    //parse date and time of the api fixture
//                    var APIFixDate = moment(APIFixture.match_formatted_date, 'DD.MM.YYYY');
//                    var APIFixTime = moment(APIFixDate); //clone date
//                    APIFixTime.hours(APIFixture.match_time.substr(0, 2));
//                    APIFixTime.minutes(APIFixture.match_time.substr(3, 4));
//
//                    //parse the date and time of the matching locally stored fixture
//                    var localFixTime = moment(localFixture.kickOff);
//
//                    //if this api fixture has different date or time to locally stored one
//                    //perform check for date and time separately/intelligently so that both get updated.
//                    //if dates are different
//                    //OR if dates are same but TIMES have changed, then update
//                    if (!APIFixDate.isSame(localFixDate)) { //then t
//
//                        console.log("STORED FIXTURE DIFFERS FROM SAME MATCH ON API - ON DIFFERENT DAY")
//                        //update the date and time of the locally stored fixture and save changes (Fixture.update)
//                        localFixture.fixDate = APIFixDate.toDate();
//
//                        //update kick off, half time and fulltime
//                        localFixture.kickOff = APIFixTime.toDate();
//                        APIFixTime.add(45, 'minutes');
//                        localFixture.halfTime = APIFixTime.toDate();
//                        APIFixTime.add(45, 'minutes');
//                        localFixture.fullTime = APIFixTime.toDate();
//
//                        //now save the changes that have been made to the fixture to the local database
//                        Fixture.update({"_id": localFixture._id}, localFixture, function (err) {
//
//                            //if there is an error, simply return straight back to the user
//                            if (err) return console.log("An error occurred: " + err);
//
//                            //fixture should now have been given the correct result
//                            console.log("The fixture with id: " + fixture.id + " has now been updated to the new date and time");
//
//                            //once the fixture has been updated, invoke the callback function
//                            console.log("The fixture has successfully been given the correct result, invoking callback");
//
//                            //Now cancel and reschedule
//
//                            var hourBeforeKickOff = moment(localFixture.kickOff);
//                            hourBeforeKickOff.subtract(1, 'hour');
//
//                            //find and cancel the scheduled job(s) for the old date and time
//                            {fixture: fixture}({"name" : "pre-match notification", "nextRunAt": hourBeforeKickOff.toDate()}, function (error, numRemoved) {
//                                if (numRemoved != 1) {
//                                    console.log("ERROR: " + numRemoved + " jobs were cancelled, only 1 was supposed to be cancelled.");
//                                }
//                                console.log("Cancelled the job scheduled to run at original pre-match for fixture");
//                            });
//
//                            agenda.cancel({"name" : "kick-off notification","nextRunAt": localFixture.kickOff}, function (error, numRemoved) {if (numRemoved != 1) {
//                                console.log("ERROR: " + numRemoved + " jobs were cancelled, only 1 was supposed to be cancelled.");
//                            }
//                                console.log("Cancelled the job scheduled to run at original start of fixture");
//                            });
//
//                            agenda.cancel({"name" : "half-time notification", "nextRunAt": localFixture.halfTime}, function (error, numRemoved) {if (numRemoved != 1) {
//                                console.log("ERROR: " + numRemoved + " jobs were cancelled, only 1 was supposed to be cancelled.");
//                            }
//                                console.log("Cancelled the job scheduled to run at original half time of fixture");
//                            });
//
//                            agenda.cancel({"name" : "score fixture predictors", "nextRunAt": localFixture.fullTime}, function (error, numRemoved) {
//                                if (numRemoved != 1) {
//                                    console.log("ERROR: " + numRemoved + " jobs were cancelled, only 1 was supposed to be cancelled.");
//                                }
//                                console.log("Cancelled the job scheduled to run at original end of fixture");
//                            });
//
//                            //reschedule the job(s) to score the fixture at it's new finishing time
//
//                            agenda.schedule(hourBeforeKickOff.toDate(), 'pre-match notification', {fixture: fixture});
//                            agenda.schedule(localFixture.kickOff, 'kick-off notification', {fixture: fixture});
//                            agenda.schedule(localFixture.halfTime, 'half-time notification', {fixture: fixture});
//                            agenda.schedule(localFixture.fullTime, 'score fixture predictors', {fixture: fixture});
//
//                            console.log("There was a scheduled change made to fixture, this change has been accounted for, fix updated.");
//
//                        });
//
//                    } else if (APIFixDate.isSame(localFixDate) && !APIFixTime.isSame(localFixTime)) { //then t
//
//                        console.log("STORED FIXTURE DIFFERS FROM SAME MATCH ON API - ON DIFFERENT TIME ON THE SAME DAY")
//
//                        //update the date and time of the locally stored fixture and save changes (Fixture.update)
//                        localFixture.fixDate = APIFixDate.toDate();
//
//                        //update kick off, half time and fulltime
//                        localFixture.kickOff = APIFixTime.toDate();
//                        APIFixTime.add(45, 'minutes');
//                        localFixture.halfTime = APIFixTime.toDate();
//                        APIFixTime.add(45, 'minutes');
//                        localFixture.fullTime = APIFixTime.toDate();
//
//                        //now save the changes that have been made to the fixture to the local database
//                        Fixture.update({"_id": localFixture._id}, localFixture, function (err) {
//
//                            //if there is an error, simply return straight back to the user
//                            if (err) return console.log("An error occurred: " + err);
//
//                            //fixture should now have been given the correct result
//                            console.log("The fixture with id: " + fixture.id + " has now been updated to the new date and time");
//
//                            //once the fixture has been updated, invoke the callback function
//                            console.log("The fixture has successfully been given the correct result, invoking callback");
//
//                            //Now cancel and reschedule
//                            //find and cancel the scheduled job(s) for the old date and time
//                            agenda.cancel({"nextRunAt": localFixture.fullTime}, function (error, numRemoved) {
//                                if (numRemoved != 1) {
//                                    console.log("ERROR: " + numRemoved + " jobs were cancelled, only 1 was supposed to be cancelled.");
//                                }
//                                console.log("Cancelled the job scheduled to run at original end of fixture");
//                            });
//
//                            //todo: schedule push notification for kick and half time
//
//                            var hourBeforeKickOff = moment(localFixture.kickOff);
//                            hourBeforeKickOff.subtract(1, 'hour');
//
//                            //reschedule the job(s) to score the fixture at it's new finishing time
//                            agenda.schedule(hourBeforeKickOff.toDate(), 'pre-match notification', {fixture: localFixture});
//                            agenda.schedule(localFixture.kickOff, 'kick-off notification', {fixture: localFixture});
//                            agenda.schedule(localFixture.halfTime, 'half-time notification', {fixture: localFixture});
//                            agenda.schedule(localFixture.fullTime, 'score fixture predictors', {fixture: localFixture});
//
//                            console.log("There was a scheduled change made to fixture, this change has been accounted for, fix updated.");
//
//                        });
//                    } else {
//                        console.log("LOCALLY STORED MATCH IS SAME AS THE ONE FROM API, NO UPDATE NEEDED.")
//                    }
//                }
//            });
//
//        },
//        function() {
//            console.log("An error occured when retrieving fixtures.");
//        }
//    ); //todo: add error function for promise rejection in here.
//}

//this function will be sheduled to run for each fixture.
//function to take a local fixture and retrieve the live result from 3rd party football-api
//once this has been tested, pass in a callback and test it upon success.
function _getFixtureResult(fixture, callback) {

    console.log("Now attempting to get the live result for the fixture: " + fixture);
    console.log("Fixture home team is: " + fixture.homeTeam);
    console.log("Fixture away team is: " + fixture.awayTeam);
    console.log("Fixture date is : " + fixture.fixDate);
    //1. Query the API to get matches on the given fixture date

    var fixtureDate = moment(fixture.fixDate);
    fixtureDate = fixtureDate.format('DD.MM.YYYY');
    console.log("Formatted date is: " + fixtureDate);

    console.log("Now contacting 3rd party API football-api to get real-world fixture data.");

    //check that the fixture occured in past, if not, exit
    var today = new Date();
    if (!fixtureDate <= fixture.fullTime) {
        //then the fixture has not finished, return an error
        return "The fixture has not yet taken place and can not have a result set for it"
    }

    var options = {
        host: 'football-api.com',
        path: '/api/?Action=fixtures&APIKey=6c5ccef5-3d91-ab94-5c9dcd7bb1b6&comp_id=1204&match_date=' + fixtureDate,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    var obj = {}; //variable to hold the returned json

    //make the call to the football-api API
    http.get(options, function (response) {

        var output = '';

        console.log(options.host + ':' + response.statusCode);
        response.setEncoding('utf8');

        response.on('data', function (chunk) {
            output += chunk;
        });

        response.on('end', function () {

            obj = JSON.parse(output);
            console.log("Results returned from server: " + JSON.stringify(obj));

            var fixDateFixtures = obj.matches;

            //this can only happen once the call to the api has finished

            console.log("The fixtures taking place on the given date: " + fixtureDate + " are: \n" + fixDateFixtures);

            //2. Now filter out the relevant fixture using the date and the teams of our local fixture

            //loop through the array of objects, inspecting the properties match_localteam_name, match_visitorteam_name
            var fixFound = false;

            var localFixResult = null;

            var currentAPIFixture = underscore.findWhere(fixDateFixtures,
                {
                    match_localteam_name: fixture.homeTeam,
                    match_visitorteam_name: fixture.awayTeam
                }
            );

            if (currentAPIFixture != undefined) {
                fixFound = true;
                //extract the result and put into usable form
                var tempAPIResult = currentAPIFixture.match_ft_score;
                console.log("The result of the relevant fixture from the football-api.com API is: " + tempAPIResult);

                var homeTeamResult = tempAPIResult.charAt(1);
                var awayTeamResult = tempAPIResult.charAt(3);
                console.log("The home team " + currentAPIFixture.match_localteam_name + " result is: "
                    + homeTeamResult);
                console.log("The away team " + currentAPIFixture.match_visitorteam_name + " result is: "
                    + awayTeamResult);

                //Now process this result into a usable format for our server (1, 2 or 3)
                //1 = home win, 2 = away win, 3 = draw
                if (homeTeamResult > awayTeamResult) {
                    //then this was a home win
                    localFixResult = 1;
                    console.log("The match " + fixture._id + " was a home win. Won by " + fixture.homeTeam);
                } else if (homeTeamResult < awayTeamResult) {
                    //then this was an away win
                    localFixResult = 2;
                    console.log("The match " + fixture._id + " was an away win. Won by " + fixture.awayTeam);
                } else if (homeTeamResult == awayTeamResult) {
                    //then this was a draw
                    console.log("The match " + fixture._id + " was a draw.");
                    localFixResult = 3;
                }

                //4. Now save the result to our fixture.
                fixture.fixResult = {
                    fixResult : localFixResult,
                    fixScore: tempAPIResult
                };

                console.log("Now attempting to update the fixture with the obtained result");

                //Now run a mongoose update
                Fixture.update({"_id": fixture._id}, {fixResult: fixture.fixResult}, function (err) {

                    //if there is an error, simply return straight back to the user
                    if (err) return console.log("An error occurred: " + err);

                    //fixture should now have been given the correct result
                    console.log("The fixture with id: " + fixture.id + " has now been given the live result");

                    //once the fixture has been updated, invoke the callback function
                    console.log("The fixture has successfully been given the correct result, invoking callback");
                    //comment this out whilst testing main function, implement afterwards.
                    _scheduleScorePredictingUsers(fixture, callback);
                });
            }

            if (!fixFound) {
                return "No live results found for this fixture.";
            }
        });
    });
}

function _getHalfTimeFixtureResult(fixtureData, callback) {

    console.log("Now attempting to get the live half time result for the fixture: " + fixtureData);

    //1. Query the API to get matches on the given fixture date

    //parse the date into an object
    console.log("Now parsing the fixture into an object.");
    var fixture = JSON.parse(fixture);

    console.log("Now contacting 3rd party API football-api to get real-world fixture data.");

    var fixtureDate = _formattedDate(fixture.fixDate);
    console.log("The formatted date being sent in the API query is: " + fixtureDate);

    //check that the fixture occured in past, if not, exit
    var today = new Date();
    if (!fixtureDate <= fixture.halfTime) {
        //then the fixture has not finished, return an error
        return "The fixture is not yet at half time place and can not have a result set for it"
    }

    var options = {
        host: 'football-api.com',
        path: '/api/?Action=fixtures&APIKey=6c5ccef5-3d91-ab94-5c9dcd7bb1b6&comp_id=1204&match_date=' + fixtureDate,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    var obj = {}; //variable to hold the returned json

    //make the call to the football-api API
    http.get(options, function (response) {

        var output = '';

        console.log(options.host + ':' + response.statusCode);
        response.setEncoding('utf8');

        response.on('data', function (chunk) {
            output += chunk;
        });

        response.on('end', function () {

            obj = JSON.parse(output);
            console.log("Results returned from server: " + JSON.stringify(obj));

            var fixDateFixtures = obj.matches;

            //this can only happen once the call to the api has finished

            console.log("The fixtures taking place on the given date: " + fixtureDate + " are: \n" + fixDateFixtures);

            //2. Now filter out the relevant fixture using the date and the teams of our local fixture

            //loop through the array of objects, inspecting the properties match_localteam_name, match_visitorteam_name
            var fixFound = false;

            var localFixResult = null;

            console.log("Now attempting to loop over the matches on the given day and select relevant one.");
            for (var i = 0; i < fixDateFixtures.length; i++) {

                //compare api fixture properties to our own

                //place current fixture into variable to reduce number of reads
                var currentAPIFixture = fixDateFixtures[i];

                console.log("Now attempting to compare the fixture from the api: \n API home team name: " +
                    currentAPIFixture.match_localteam_name + " to local home team name: " + fixture.homeTeam
                    + "\n API away team name: " + currentAPIFixture.match_visitorteam_name + " to local away team name "
                    + fixture.awayTeam);

                if ((currentAPIFixture.match_localteam_name == fixture.homeTeam) &&
                    (currentAPIFixture.match_visitorteam_name == fixture.awayTeam)) {
                    //then this is the fixture of which we want to process the result.

                    //3. Now assign the result of the match to our fixture and put in appropriate format.

                    //set the found flag to active
                    fixFound = true;

                    //extract the result and put into usable form
                    var tempAPIResult = currentAPIFixture.match_ht_score;
                    console.log("The result of the relevant fixture from the football-api.com API is: " + tempAPIResult);



                    var homeTeamResult = tempAPIResult.charAt(1);
                    var awayTeamResult = tempAPIResult.charAt(3);
                    console.log("The home team " + currentAPIFixture.match_localteam_name + " result is: "
                        + homeTeamResult);
                    console.log("The away team " + currentAPIFixture.match_visitorteam_name + " result is: "
                        + awayTeamResult);

                    //Now process this result into a usable format for our server (1, 2 or 3)
                    //1 = home win, 2 = away win, 3 = draw
                    if (homeTeamResult > awayTeamResult) {
                        //then this was a home win
                        localFixResult = 1;
                        console.log("The match " + fixture._id + " was a home win. Won by " + fixture.homeTeam);
                    } else if (homeTeamResult < awayTeamResult) {
                        //then this was an away win
                        localFixResult = 2;
                        console.log("The match " + fixture._id + " was an away win. Won by " + fixture.awayTeam);
                    } else if (homeTeamResult == awayTeamResult) {
                        //then this was a draw
                        console.log("The match " + fixture._id + " was a draw.");
                        localFixResult = 3;
                    }

                    //4. Now save the result to our fixture.
                    fixture.fixHalfTimeResult = {
                        fixResult : localFixResult,
                        fixScore: tempAPIResult
                    };

                    console.log("Now attempting to update the fixture with the obtained result");

                    //Now run a mongoose update
                    Fixture.update({"_id": fixture._id}, {fixHalfTimeResult: fixture.fixHalfTimeResult}, function (err) {

                        //if there is an error, simply return straight back to the user
                        if (err) return console.log("An error occurred: " + err);

                        //fixture should now have been given the correct result
                        console.log("The fixture with id: " + fixture.id + " has now been given the live result");

                        //once the fixture has been updated, invoke the callback function
                        console.log("The fixture has successfully been given the correct result, invoking callback");
                        //comment this out whilst testing main function, implement afterwards.
                        callback();
                    });
                }
            }

            if (!fixFound) {
                return "No live results found for this fixture.";
            }
        });
    });
}

//find all users who made a prediction on a given fixture
function _scheduleScorePredictingUsers(fixture, callback) {

    //This should only return users who have made a prediction for the given fixture
    User.find({'predictions.fixture': fixture._id}, function (error, users) {
        if (error || users == null) {
            console.log("Error finding users who made predicitons: " + error);
        } else {
            //for testing
            console.log("The number of predicting returned users is: " + users.length);
            //console.log("The users returned are: " + JSON.stringify(users));

            //invokes the score adder function passing in all users who are to be scored, the fixture
            _scoreAdder(0, users, fixture, function () {
                //feeds the callback method into the scoreadder method
                //callback(null, 202); //this is fed in from the highest level
                console.log("All predictions have been scored according to the fixture result.");
            });
        }
    });

    //At same time as above, asynchronously find all users who did not make a prediction for this fixture
    User.find({'predictions.fixture': {$ne: fixture._id}}, function (error, users) {
        if (error || users == null) {
            console.log("Error finding users who made no predicitons: " + error);
            return
        } else {
            //for testing
            console.log("The number of non-predicting returned users is: " + users.length);
            //console.log("The users returned are: " + JSON.stringify(users));

            //invokes the score adder function passing in all users who are to be scored, and all fixtures
            _scoreReducer(0, users, fixture, function () {
                //feeds the callback method into the scoreadder method
                console.log("All non-predicting users docked 6 points.");
            });
        }
    });
}

//FOR SINGLE FIXTURE
//used to recursively give all users who predicted an a given fixture a score when the result is determined
function _scoreAdder(i, users, fixture, callback) {
    if (i < users.length) {
        //place the current user's predictions into an array
        var preds = users[i].predictions;

        //get the current value of the user's score for season and round
        var seasonScore = users[i].overallSeasonScore;
        var scoreChanged = false;
        console.log("The overall season score for this user is: ", seasonScore);

        var roundScores = users[i].roundScores;
        console.log("The round of the fixture is: " + fixture.round);
        console.log("The round scores for this user are: " + JSON.stringify(roundScores));

        //for each user, loop over all of the user's predictions and compare to current fixture
        for (var k = 0; k < preds.length; k++) {

            //if the user made a prediction for this fixture.
            //if the prediction was correct, update the user's score!
            if (preds[k].fixture == fixture._id) {
                if (preds[k].prediction == fixture.fixResult.fixResult) {
                    seasonScore += preds[k].predictValue.correctPoints;
                    //Manual search to always ensure the correct roundScore is getting updated
                    for (var l = 0; l < roundScores.length; l++) {
                        if (roundScores[l].roundNo == fixture.round) {
                            roundScores[l].roundScore += preds[k].predictValue.correctPoints;
                            roundScores[l].correctPredictions++;
                            //console.log("Now updated the round score with a correct prediction.");
                            preds[k].predictionResult = 'Correct';
                            break;
                        }
                    }
                } else {
                    //Otherwise if the prediction was incorrect deduct the necessary amount of points
                    seasonScore += preds[k].predictValue.incorrectPoints;
                    //Manual search to always ensure the correct roundScore is getting updated
                    for (var l = 0; l < roundScores.length; l++) {
                        if (roundScores[l].roundNo == fixture.round) {
                            roundScores[l].roundScore += preds[k].predictValue.incorrectPoints;
                            roundScores[l].incorrectPredictions++;
                            //console.log("Now updated the round score with a correct prediction.");
                            preds[k].predictionResult = 'Incorrect';
                            break;
                        }
                    }
                }
            }
        }

        //if the score has been updated
        if (seasonScore != users[i].overallSeasonScore) {
            //then save the change made to the user's score and recurse, scoring the next user
            User.findByIdAndUpdate(users[i]._id, {
                $set: {
                    'overallSeasonScore': seasonScore,
                    'roundScores': roundScores,
                    'predictions': preds
                }
            }, function () {
                //recurse, scoring the next user
                _scoreAdder(i + 1, users, fixture, callback);
            });
        } else {
            //recurse without saving, scoring the next user
            _scoreAdder(i + 1, users, fixture, callback);
        }
    } else {
        //if the recursion should have ended as all user's given scores, run the callback.
        callback();
    }
}

//Recursive function to take 6 points from all users who don't make predictions
function _scoreReducer(i, users, fixture, callback) {
    if (i >= users.length) {
        //if the recursion should have ended as all user's given scores, run the callback.
        callback();
    } else {
        //get the current value of the user's score
        var score = users[i].overallSeasonScore;
        var roundScores = users[i].roundScores;

        //Deduct 6 points from the user for not making a prediction
        score -= 6;

        for (var l = 0; l < roundScores.length; l++) {
            if (roundScores[l].roundNo == fixture.round) {
                roundScores[l].roundScore -= 6;
                //console.log("Now updated the round score with a correct prediction.");
                break;
            }
        }

        //if the score has been update save the change made to the user's score and recurse
        User.findByIdAndUpdate(users[i]._id, {$set: {'overallSeasonScore': score, 'roundScores' : roundScores}}, function () {
            //recurse, scoring the next user
            _scoreReducer(i + 1, users, fixture, callback);
        });
    }
}

//todo: allow for an asecending/descneding param, or just make descending if possible.
//handy array to quickly sort results
function _sortByMomentDate(array, key) {
    return array.sort(function (a, b) {

        var x = a[key];

        x = moment(x);

        var y = b[key];

        y = moment(y);

        //sort by ascending, swap comparisons to make desc

        //-1 for smaller, 1 for greater, 0 for equal.
        //return moment.utc(x.timeStamp).diff(moment.utc(y.timeStamp))
        return moment.utc(x.timeStamp).diff(moment.utc(y.timeStamp))
    });
}

function _getMatchResult(homeTeamResult, awayTeamResult) {
    var localFixResult = 0;

    //Now process this result into a usable format for our server (1, 2 or 3)
    //1 = home win, 2 = away win, 3 = draw
    if (homeTeamResult > awayTeamResult) {
        //then this was a home win
        localFixResult = 1;
    } else if (homeTeamResult < awayTeamResult) {
        //then this was an away win
        localFixResult = 2;
    } else if (homeTeamResult == awayTeamResult) {
        //then this was a draw
        localFixResult = 3;
    }

    return localFixResult;
}

//function _scheduleFixtureActions(i, fixtures, callback) {
//    if (i < fixtures.length) {
//        var fixture = fixtures[i];
//        console.log("Scheduling actions for fixture: " + fixture._id);
//        console.log("i = " + i);
//
//        var hourBeforeKickOff = moment(fixture.kickOff);
//        hourBeforeKickOff.subtract(1, 'hour');
//
//        //try and find a corresponding agenda job based on kick off time of fixture.
//        console.log("Now checking to see if there are jobs scheduled for this fixture.");
//        agenda.jobs({"name" : "kick-off notification", "nextRunAt": fixture.kickOff}, function (error, jobs) {
//
//            console.log("Agenda jobs are: " + JSON.stringify(jobs));
//
//            if (jobs.length == 0){
//                //then need to schedule jobs for this fixture
//
//                console.log("there were no jobs scheduled for this fixture, scheduling now");
//
//                var hourBeforeKickOff = moment(fixture.kickOff);
//                hourBeforeKickOff.subtract(1, 'hour');
//
//                //reschedule the job(s) to score the fixture at it's new finishing time
//                agenda.schedule(hourBeforeKickOff.toDate(), 'pre-match notification', {fixture: fixture});
//                agenda.schedule(fixture.kickOff, 'kick-off notification', {fixture: fixture});
//                agenda.schedule(fixture.halfTime, 'half-time notification', {fixture: fixture});
//                agenda.schedule(fixture.fullTime, 'score fixture predictors', {fixture: fixture});
//
//                console.log("All jobs scheduled for fixture");
//
//                var stack = new Error().stack;
//                console.log("STACK: " + stack);
//            }
//        });
//
//        //process.nextTick(_scheduleFixtureActions(i + 1, fixtures));
//        //if( i % 1000 === 0 ) {
//            setTimeout(
//            function() {
//
//                var stack = new Error().stack;
//                console.log("\n \nTIMEOUT STACK: " + stack);
//
//                _scheduleFixtureActions(i + 1, fixtures, callback);
//            }, 1000
//            );
//        //} else {
//        //    _scheduleFixtureActions(i + 1, fixtures, callback);
//        //}
//
//    } else {
//        console.log('Finished adding fixtures');
//        callback();
//    }
//}

//function _scheduleFixtureActions(fixture) {
//
//    var deferred = Q.defer();
//
//    //console.log("Scheduling actions for fixture: " + fixture._id);
//
//    var hourBeforeKickOff = moment(fixture.kickOff);
//    hourBeforeKickOff.subtract(1, 'hour');
//
//    //reschedule the job(s) to score the fixture at it's new finishing time
//    agenda.schedule(hourBeforeKickOff.toDate(), 'pre-match notification', {fixture: fixture});
//    agenda.schedule(fixture.kickOff, 'kick-off notification', {fixture: fixture});
//    agenda.schedule(fixture.halfTime, 'half-time notification', {fixture: fixture});
//    agenda.schedule(fixture.fullTime, 'score fixture predictors', {fixture: fixture});
//
//    return deferred.promise;
//}

//function _scheduleActionsIfNotAlready(fixture) {
//    console.log('\n \n SINGULAR SCHEDULER');
//
//    var fixtureKickOff = moment(fixture.kickOff);
//    console.log("The moment.js fixture kick off of current fixture is: " + fixtureKickOff);
//
//    //try and find a corresponding agenda job based on kick off time of fixture.
//    console.log("Now checking to see if there are jobs scheduled for this fixture.");
//    agenda.jobs({"name" : "kick-off notification", "nextRunAt": fixture.kickOff}, function (error, jobs) {
//
//        console.log("Agenda jobs are: " + JSON.stringify(jobs));
//
//        if (jobs.length == 0){
//            //then need to schedule jobs for this fixture
//
//            console.log("there were no jobs scheduled for this fixture, scheduling now");
//
//            var hourBeforeKickOff = moment(fixture.kickOff);
//            hourBeforeKickOff.subtract(1, 'hour');
//
//            //reschedule the job(s) to score the fixture at it's new finishing time
//            agenda.schedule(hourBeforeKickOff.toDate(), 'pre-match notification', {fixture: fixture});
//
//            //agenda.schedule(fixture.kickOff, 'kick-off notification', {fixture: fixture});
//            //agenda.schedule(fixture.halfTime, 'half-time notification', {fixture: fixture});
//            //agenda.schedule(fixture.fullTime, 'score fixture predictors', {fixture: fixture});
//
//            //console.log("All jobs scheduled for fixture");
//        }
//    });
//
//    return;
//}

function _schduleTasksForUpdatedFixtures() {
    //retrieve all fixtures from datavase
    Fixture.find({}, function(error, existingFixtures){
        if (error){
            console.log("ERROR WHEN RETRIEVING FIXTURES");
            return
        } else if (existingFixtures == null) {
            console.log("NO FIXTURES FOUND");
            return
        } else {

            //console.log("The existing fixtures retrieved are: " + JSON.stringify(existingFixtures));

            //for each fixture, check that there exist for them agenda jobs

            //recursively loop over fixtures
            console.log("\n\nNOW BEGINNING RECURSION \n");

            var stack = new Error().stack;
            console.log("STACK: " + stack);

            _scheduleActionsIfNotAlready(existingFixtures[0]);

            //_scheduleFixtureActions(0, existingFixtures, function(){
            //    console.log("All fixtures updated and new agenda jobs created.");
            //
            //    return
            //});
        }
    });
};

//function _clearUnneededJobs() {
//    agenda.jobs({}, function(err, jobs) {
//        // Work with jobs (see below)
//        console.log(JSON.stringify(jobs));
//
//        for (var i = 0; i < jobs.length; i++) {
//
//            console.log("\n\nNow deciding wheter or not to cancel job:");
//
//            console.log("\n" + JSON.stringify(jobs[i]));
//
//            console.log("\n\nJOB NAME IS: " + jobs[i][1]);
//
//            if (jobs[i].name == 'score fixture predictors' || jobs[i].name == 'kick-off notification' || jobs[i].name == 'kick-off notification' || jobs[i].name == 'pre-match notification' || jobs[i].name == 'half-time notification' ){
//
//                //try and find the corresponding fixture, if none exists, delete the job
//                //todo: query the fixture id
//
//                console.log("Attempting to cast job fixture data id to id object: " + jobs[i].data.fixture._id);
//                var fixtureId = mongoose.Types.ObjectId(jobs[i].data.fixture._id);
//                Fixture.findOne({'_id' : fixtureId}, function(error, foundFixture){
//                    if (error) {
//                        console.log("error finding fixture associated with job");
//                    }
//                    else if (foundFixture == null) {
//                        console.log("No fixture found associated with this job, cancelling job");
//
//                        //todo: cancel the job here
//                        console.log("Attempting to cancel the job with id : " + jobs[i]._id);
//
//                        agenda.cancel({"_id" : mongoskin.helper.toObjectId(jobs[i]._id)}, function (error, numRemoved) {if (numRemoved != 1) {
//                            console.log("ERROR: " + numRemoved + " jobs were cancelled, only 1 was supposed to be cancelled.");
//                        }
//                            console.log("Cancelled the job ");
//                        });
//                    }
//                });
//
//            } else {
//                console.log("Not interested in this job");
//            }
//        }
//    });
//};

//todo: function to take password and fixture id and manually score it and give scores to users.