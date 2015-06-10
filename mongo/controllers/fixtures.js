var mongoose = require('mongoose'),
    http = require('http'),
    https = require('https'),
    users = require('./users'),
    Agenda = require('agenda'),
    moment = require('moment'),
    Q = require('q'),
    underscore = require('underscore'),
    MiniSet = require('./miniset'),
    Fixture = mongoose.model('Fixture'),
    User = mongoose.model('User'),
    vsprintf = require("sprintf-js").vsprintf,
    IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1',
    mongoConnection = 'mongodb://' + IPADDRESS + '/nodejs',
    agenda = new Agenda({db: {address: mongoConnection}}), //instantiate agenda;
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

//fire up the scheduler
agenda.start();

//define any agenda jobs that are to be scheduled here

//define the job to be run for each fixture to go and get the result and send out push notifications
agenda.define('score fixture predictors', function (job, done) {
    //retrieve data from parameters
    var data = job.attrs.data;

    var fixture = data.fixture;

    //invoke the private function to retrieve users who made predictions on this fixture, and give them scores
    //fixture should be being passed in as JSON, no need to parse.
    _getFixtureResult(fixture, function (fixture, done){

        //invoke private function to send out notification to user
        //get all of the users who made a prediction for this fixture
        var message = vsprintf("They think it's all over, it is now! The match between %s and %s is finished! Open Yes! Get In! to see how well you did!",
            [data.fixture.homeTeam, data.fixture.awayTeam]);

        _sendPushNotification(data.fixture, message, done);
    });
});

agenda.define('kick-off notification', function (job, done) {
    //retrieve data from parameters
    var data = job.attrs.data;

    //invoke private function to send out notification to user
    //get all of the users who made a prediction for this fixture
    var message = vsprintf("The match between %s and %s is about to kick off! Get your predictions in now!",
        [data.fixture.homeTeam, data.fixture.awayTeam]);

    _sendPushNotification(data.fixture, message, done);
});

agenda.define('pre-match notification', function (job, done) {
    //retrieve data from parameters
    var data = job.attrs.data;

    //invoke private function to send out notification to user
    //get all of the users who made a prediction for this fixture
    var message = vsprintf("The match between %s and %s kicks off in an hour! Get your predictions in early for more points!",
        [data.fixture.homeTeam, data.fixture.awayTeam]);

    _sendPushNotification(data.fixture, message, done);
});

agenda.define('half-time notification', function (job, done) {
    //retrieve data from parameters
    var data = job.attrs.data;
    var fixture = data.fixture;

    //Get the current result of the match to be passed to the app, update the fixture
    _getHalfTimeFixtureResult(fixture, function (fixture, done){

        //invoke private function to send out notification to user
        //get all of the users who made a prediction for this fixture
        var message = vsprintf("%s vs $s half time cuppa! Feeling confident, or need to update your predictions?" +
            "Current results are %n so it's looking like it's gonna be a %s!",
            [fixture.homeTeam,
                fixture.awayTeam,
                fixture.fixHalfTimeResult.fixScore,
                predictionMap[fixture.fixHalfTimeResult.fixResult]
            ]
        );

        _sendPushNotification(data.fixture, message, done);
    });
});

//the scheduled job to check for new and updated fixtures every day
agenda.define('get new and update existing fixtures', function (job, done) {
    //retrieve data from parameters
    var data = job.attrs.data;

    //call function to check for any new fixtures and update the existing ones
    _getNewUpdateExistingFixtures();

    done();
});

//every day check the api for new fixtures and update any existing ones to check for updates.
agenda.every('day', 'get new and update existing fixtures');

exports.getFixtures = function (req, res) {
    Fixture.find({}, function (err, results) {
        return res.jsonp(results);
    });
};

exports.getRound = function (req, res) {
    var round = req.params.round;
    Fixture.find({'round': round}, function (err, result) {
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
        path: '/api/?Action=standings&APIKey=2760810b-be47-82d7-db48d00daa1c&comp_id=1204',
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

//API TESTING FUNCTIONS - todo: DELETE ON RELEASE
exports.testGetResultThenScore = function (req, res) {

    //now set the the mongo id of this fixture
    //to test whole thing make this a fixture which users have predicted - so they'll get a score
    var id = mongoose.Types.ObjectId("55785f4e38bd12511018145d");
    console.log("Fake document id is: " + id);

    var kickOff = moment();
    kickOff.add(1, 'minute');
    var halfTime = moment(kickOff);
    halfTime.add(45, 'minutes');
    var fullTime = moment(kickOff);
    fullTime.add(90, 'minutes');
    var fixDate = moment('02.05.2015', 'DD.MM.YYYY');

    var fixture = {
        _id: id,
        homeTeam: "Aston Villa",
        awayTeam: "Everton",
        round: 35,
        kickOff: kickOff.toDate(),
        halfTime: halfTime.toDate(),
        fullTime: fullTime.toDate(),
        fixDate: fixDate.toDate(),
        awayTeamForm: [

        ],
        homeTeamForm: [

        ],
        __v: 0
    };

    //console.log("The string value of the fixDate is: " + _formattedDate(fixture.fixDate));

    //now invoke the function and pass in this fixture object
    //pass object in as json
    //TODO: evaulate if the callback is necessary?
    //TODO: SCHEDULE THIS TO GET RUN FOR EACH FIXTURE, AT THE END OF THE MATCH...
    _getFixtureResult(fixture, function () {
        res.jsonp('THE USERS WHO PREDICTED FOR THIS FIXTURE WERE GIVEN SCORES BASED OFF OF LIVE RESULTS!!!')
    });
};

//this must come after examples, I think
exports.dummyData = function (req, res) {
    Fixture.create(examples,
        function (err) {
            if (err)
                return console.log(err);
            return res.jsonp(202);
        }
    );
};

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
function _getNewUpdateExistingFixtures() {

    //these are decided automatically, so not supplied as parameters
    var fromDate;
    var today = moment();
    var seasonEnd = moment([today.year(), 04, 24])

    //todo: dates here need work
    if (today.isAfter(seasonEnd)) {
        seasonEnd = moment([today.year() + 1, 04, 31]);
    }

    //set the seasonend

    //First check for any new fixtures which may have been scheduled

    //todo: implement this to allow for more leagues than just epl, e.g la liga
    //switch(competition){
    //    case "EPL":
    //        competitionCode = '1204';
    //        break;
    //    default:
    //        competitionCode = '1204'; //default to epl
    //        console.log("The supplied competition name does not map to any supported competition");
    //        break;
    //    //implement throwing exceptions here
    //    //add more cases as the app supports more competitions
    //}

    //just do this for the epl for now
    //todo: make this generic for other football leagues or even sports

    //if there are no existing fixtures, then get new fixtures from today or get from day after latest fixture
    Fixture.find({}).sort({'fixDate': 1}).exec(function (error, fixtures) {
        if (fixtures.length > 0) {
            console.log("Fixtures already existed, setting dates based on these.")
            //then get to and from dates for the api query from existing
            //we only want new fixtures if there are any, so fromDate is the latest date in fixtures
            //THE RESULTS MUST BE SORTED FOR THIS LOGIC TO BE VALID
            console.log("Number of fixtures already existed: " + fixtures.length);

            fromDate = moment(fixtures[fixtures.length - 1].fixDate);

            //season end only used to check if we are trying to get matches from beyond the end of the season.
            if (fromDate.isSame(seasonEnd) || fromDate.isAfter(seasonEnd)) {
                return console.log('No new fixtures to get, just checking existing ones are up to date!');
            } else {
                //increment from date by a day and get fixtures from this point onwards

                //FROM NEXT DAY IN SEASON - MID SEASON
                fromDate.add(1, 'day');
            }
        } else {
            //FROM TODAY

            //if no fixtures exist already, then  set default dates
            fromDate = moment(); //default getting fixtures from today
            //remember these all run async, need callbacks
        }

        //Check for season rollover
        if (today.isAfter(seasonEnd)) {
            seasonEnd = moment([today.year() + 1, 04, 31]);

            //set the from date to be the start of the new season
            fromDate = moment([today.year(), 07, 01]);
        }

        console.log("Now checking for new fixtures.");
        //want to check for new but ALWAYS  run update even if no new matches, regardless
        //to use promises to fix the callback hell that this has turned into

        var newFixtures = _checkForProcessNewFixtures(fromDate);

        //once the api request promise is fulfilled
        newFixtures.then(
            function () {
                //once any new fixtures have been added and found
                //todo: remove no new added into success reponse, to remove below promise reject function.

                console.log("TOP LEVEL: PROMISE FULFILLED - NEW FIXTURES ADDED - CHECKING FOR UPDATES TO EXISTING FIXTURES.")
                _compareAndUpdateFixtures();
            },
            function (error) {
                //handle the error, just print to console and return
                console.log("Checking for new fixtures returned an no new fixtures or an error")

                //now check for updates to existing fixtures
                console.log("TOP LEVEL: PROMISE REJECTED - NO NEW FIXTURES FOUND - CHECKING FOR UPDATES TO EXISTING FIXTURES.")
                _compareAndUpdateFixtures();
            });
    });

}

//todo: write a wrapper function for the football api
//dates are moment dates
//will only ever call up to the end of the season
function _getFootballApiFixtures(fromDate) {

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
        path: '/api/?Action=fixtures&APIKey=2760810b-be47-82d7-db48d00daa1c&comp_id=' + competitionCode +
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
function _checkForProcessNewFixtures(fromDate) {

    console.log("\nFUNCTION: CHECKING FOR NEW FIXTURES\n");

    var deferred = Q.defer();
    var fixturesToStore = [];
    var seasonEnd = moment('24.05.2015', 'DD.MM.YYYY'); //todo: maybe pass this is as a parameter

    //go and get any new fixtures from api
    var getAnyNewFixs = _getFootballApiFixtures(fromDate);

    //process any new fixtures into the database
    getAnyNewFixs.then(function (seasonFixtures) {
        //sort the results
        seasonFixtures = _sortByMomentDate(seasonFixtures, 'match_formatted_date');
        seasonFixtures.reverse(); //todo: replace this with sorting the properly (stop being lazy

        console.log("Fixtures from server have now been sorted by date");

        //loop over returned fixtures and parse into our format and store in db
        var currentFixture = null; //todo: check if better to initialize to null?
        var previousFixtureDate = seasonEnd;
        var previousFixtureRound = 38;
        var fixtureRound = 38;

        //get fixtures from today until end of season...
        for (var i = 0; i < seasonFixtures.length; i++) {

            //console.log("Iteration of fixtures: " + i);
            //for each fixture from the 3rd party api, extract relevant details, construct doc and save to db
            currentFixture = seasonFixtures[i];

            //make the returned fix date into a usable moment.js date
            var thisFixtureDate = moment(currentFixture.match_formatted_date, "DD.MM.YYYY");
            console.log("\nCurrent fixture date: " + thisFixtureDate.toString());

            //using moment.js, find the difference in weeks between the last game and this one
            //if there is a previous fixture (not the first fixture of season which goes in round 1)
            //then work out which round this fixture belongs in
            //assumes chain and order of fixtures. BE SURE TO SORT.
            if (previousFixtureDate) {
                //then work out this fixture's round based on the previous one

                //find the monday which follows the previous fixture

                //if the previous date is already a monday, this is the end of the previous fixtures' end
                var previousTuesdayFound = false;
                var previousTuesday;
                var tempNextDay = moment(previousFixtureDate); //clone date properly, new object, not new pointer

                //this loop should run until the monday after the previous fixture is found
                //console.log("Now looping to find the Tuesday which follows the previous fixture, which was: " +
                //previousFixtureDate.toString());

                while (!previousTuesdayFound) {
                    if (tempNextDay.day() == 2) { //if the date is a monday
                        //console.log("The previous Tuesday to the previous fixture has been found to be: " +
                        //tempNextDay.toString() + "\n Exiting while loop.");

                        //assign this date as following monday (end of previous round) - CLONE OBJECT
                        previousTuesday = moment(tempNextDay);

                        //close the loop
                        previousTuesdayFound = true;
                    } else {
                        //console.log("Day " + tempNextDay.day() + " was not a previous Tuesday, iterating")
                        tempNextDay.subtract(1, 'day');
                    }
                }

                //if current fixture is after this monday then place it in the next round else in same round
                if (thisFixtureDate < previousTuesday) {
                    //console.log("The previous (descending so in time, next) fixture round is: " + previousFixtureRound);
                    fixtureRound = previousFixtureRound - 1; //todo: check if ++ would mute original
                    //console.log("This fixture belongs in the previous round: " + fixtureRound);
                } else {
                    fixtureRound = previousFixtureRound;
                    //console.log("The previous (descending so in time, next) fixture round is: " + previousFixtureRound);
                    //console.log("This fixture belongs in the same round as the previous fixture: " + fixtureRound);
                }
            }

            //console.log("This fixture belongs to gameweek/round: " + fixtureRound);

            //todo: these are not being parsed properly
            //parse match times for storage
            var kickOffTime = moment(thisFixtureDate)

            //parse this differently
            console.log("Fixture match time: " + currentFixture.match_time);
            console.log("Fixture match hour: " + currentFixture.match_time.substr(0, 2));
            console.log("Fixture match minutes: " + currentFixture.match_time.substr(3, 4))
            kickOffTime.hours(currentFixture.match_time.substr(0, 2)); //todo: think misusing substr, fix
            kickOffTime.minutes(currentFixture.match_time.substr(3, 4));
            console.log("The proposed kick off time is: " + kickOffTime.toString());

            var halfTime = moment(kickOffTime);
            halfTime.add(45, 'minutes');
            console.log("This fixture have half time at: " + halfTime.toString());

            var fullTime = moment(kickOffTime);
            fullTime.add(90, 'minutes');
            console.log("The fixture should end at: " + fullTime.toString());

            //cast dates and times here first
            var convertedDate = thisFixtureDate.toDate();
            var kickOffSave = kickOffTime.toDate(); //check if mutable as others, if so delete variables
            var halfTimeSave = halfTime.toDate();
            var fullTimeSave = fullTime.toDate();

            //extract the result and put into usable form
            var tempAPIResult = currentFixture.match_ft_score;
            //console.log("The result of the relelvant fixture from the football-api.com API is: " + tempAPIResult);

            //todo: extract this out into a function as used in multiple places - Stay DRY!
            var homeTeamResult = tempAPIResult.charAt(1);
            var awayTeamResult = tempAPIResult.charAt(3);

            var localFixResult = {fixResult: 0, fixScore: 0};

            //Now process this result into a usable format for our server (1, 2 or 3)
            //1 = home win, 2 = away win, 3 = draw
            if (homeTeamResult > awayTeamResult) {
                //then this was a home win
                localFixResult.fixResult = 1;
                //console.log("The match was a home win.");
            } else if (homeTeamResult < awayTeamResult) {
                //then this was an away win
                localFixResult.fixResult = 2;
                //console.log("The match was an away win.");
            } else if (homeTeamResult == awayTeamResult) {
                //then this was a draw
                localFixResult.fixResult = 3;
                //console.log("The match was a draw.");
            }

            //now construct new object to add
            //todo: decalre new fixture above and then redeclare on each iteration for efficiency?
            var newFixture = {
                homeTeam: currentFixture.match_localteam_name,
                homeTeamForm: [],
                awayTeam: currentFixture.match_visitorteam_name,
                awayTeamForm: [],
                round: fixtureRound,
                fixStadium: currentFixture.match_venue_beta,
                fixDate: convertedDate,
                fixResult: localFixResult, //for no current result
                fixHalfTimeResult: {},
                kickOff: kickOffSave,
                halfTime: halfTimeSave,
                fullTime: fullTimeSave
            };

            //console.log("The fixture being added to the database is: \n" + JSON.stringify(newFixture));

            fixturesToStore.push(JSON.stringify(newFixture));

            //Now move on to the next fixture

            //Assign the previous fixture for the next iteration
            previousFixtureDate = thisFixtureDate;
            previousFixtureRound = fixtureRound;
        }

        //the new fixtures to get added to our database
        fixturesToStore = "[" + fixturesToStore + "]";
        //console.log("Fixtures about to be saved are: " + fixturesToStore);

        fixturesToStore = JSON.parse(fixturesToStore);

        //once the loop has run it's course and created the whole list of fixtures, save to db
        //need to access the MongoDB driver directly as large dataset crashes .create mongoose method
        Fixture.collection.insert(fixturesToStore, function (err, fixtures) {
            if (err) {
                console.log(err);
                //reject the promise, no data to return
                deferred.reject();
            }

            console.log("All of the new fixtures were saved to the database successfully!");

            console.log("Now scheduling these fixtures to have their scores calculated upon completion");
            //now iterate over each inserted fixture and for when finishing, to get results and tell users
            for (var i = 0; i < fixturesToStore.length; i++) {
                var fixture = fixturesToStore[i];

                console.log("Scheduling to check results and score users for fixture:" + fixture.fullTime);

                //todo: also schedule for before kick off and half time notifictions here
                agenda.schedule(fixture.fullTime, 'score fixture predictors', {fixture: fixture});
            }

            //fulfill the promise, no data to return
            deferred.resolve();
        });

        return deferred.promise;
    }, function (error) {

        console.log("\n\t FN: CHECKING FOR NEW FIXS: \n\tPROMISE WAS REJECTED ");

        //then reject the promise and return the error
        deferred.reject(error);
    });

    //always return a promise, regardless
    return deferred.promise;
}

//function to check existing fixtures and live schedule, to update any changes to fixtures
//SCHEDULE THIS TO BE RUN REGULARLY TO KEEP OUR FIXTURE DATA UP TO DATE.
//Given fixtures that have yet to be played, checks api for any changes to them.
//fixtures range from 45 prior to present moment up to end of season
function _compareAndUpdateFixtures() {

    console.log("\n FUNCTION: COMPARING AND UPDATING FIXTURES \n");

    //get all fixtures from our db FROM NOW, - 45 MINUTES AGO
    var fromDate = moment();
    fromDate.subtract(45, 'minutes'); //get games which may be altered whilst in play

    //get fixtures from the api
    var fetchFixtures = _getFootballApiFixtures(fromDate);

    fetchFixtures.then(function (APIFixtures) {

        //get local fixtures

        Fixture.find({}, function (error, localFixtures) {
            //check to see that this is date is later than from date

            //for each fixture down from the api
            //always better to have declarations at scope start, the reassign as necessary
            var localFixture;
            var APIFixture;
            for (var i = 0; i < APIFixtures.length; i++) {
                APIFixture = APIFixtures[i];
                console.log("\nThe current fixture under comparison from the API is: \n" +
                    "\tMatch date : " + (APIFixture.match_formatted_date) +
                    "\n\tMatch time : " + (APIFixture.match_time));

                //find corresponding locally stored match in db using home and away team
                localFixture = underscore.findWhere(localFixtures, {
                    homeTeam: APIFixture.match_localteam_name,
                    awayTeam: APIFixture.match_visitorteam_name
                });

                var localFixDate = moment(localFixture.fixDate);

                //if none is found, throw an error
                if (!localFixture) {
                    console.log("ERROR, MATCHING LOCALLY STORED FIXTURE COULD NOT BE FOUND")
                    return "error" //LOOK up if there is a better way of doing this
                } else if (localFixDate.isBefore(fromDate)) {
                    console.log("ERROR, MATCHING LOCALLY STORED FIXTURE WAS IN THE PAST, ALREADY FINISHED")
                    return "error" //LOOK up if there is a better way of doing this
                } else {
                    console.log("The matching locally stored fixture to the current API fixture being compared to is: \n" +
                        "\tMatch date: " + localFixture.fixDate +
                        "\n\tMatch time: " + localFixture.kickOff);
                }

                //now perform comparison and see if the fixture needs to be updated in our local database

                //parse date and time of the api fixture
                var APIFixDate = moment(APIFixture.match_formatted_date, 'DD.MM.YYYY');
                var APIFixTime = moment(APIFixDate); //clone date
                APIFixTime.hours(APIFixture.match_time.substr(0, 2));
                APIFixTime.minutes(APIFixture.match_time.substr(3, 4));

                //parse the date and time of the matching locally stored fixture
                var localFixTime = moment(localFixture.kickOff);

                //if this api fixture has different date or time to locally stored one
                //perform check for date and time separately/intelligently so that both get updated.
                //if dates are different
                //OR if dates are same but TIMES have changed, then update
                if (!APIFixDate.isSame(localFixDate)) { //then t

                    console.log("STORED FIXTURE DIFFERS FROM SAME MATCH ON API - ON DIFFERENT DAY")
                    //update the date and time of the locally stored fixture and save changes (Fixture.update)
                    localFixture.fixDate = APIFixDate.toDate();

                    //update kick off, half time and fulltime
                    localFixture.kickOff = APIFixTime.toDate();
                    APIFixTime.add(45, 'minutes');
                    localFixture.halfTime = APIFixTime.toDate();
                    APIFixTime.add(45, 'minutes');
                    localFixture.fullTime = APIFixTime.toDate();

                    //now save the changes that have been made to the fixture to the local database
                    Fixture.update({"_id": localFixture._id}, localFixture, function (err) {

                        //if there is an error, simply return straight back to the user
                        if (err) return console.log("An error occurred: " + err);

                        //fixture should now have been given the correct result
                        console.log("The fixture with id: " + fixture.id + " has now been updated to the new date and time");

                        //once the fixture has been updated, invoke the callback function
                        console.log("The fixture has successfully been given the correct result, invoking callback");

                        //Now cancel and reschedule
                        //find and cancel the scheduled job(s) for the old date and time
                        agenda.cancel({"nextRunAt": localFixture.fullTime}, function (error, numRemoved) {
                            if (numRemoved != 1) {
                                console.log("ERROR: " + numRemoved + " jobs were cancelled, only 1 was supposed to be cancelled.");
                            }
                            console.log("Cancelled the job scheduled to run at original end of fixture");
                        });

                        //reschedule the job(s) to score the fixture at it's new finishing time
                        var hourBeforeKickOff = moment(localFixture.kickOff);
                        hourBeforeKickOff.subtract(1, 'hour');
                        agenda.schedule(hourBeforeKickOff.toDate(), 'pre-match notification', {fixture: JSON.stringify(fixture)});
                        agenda.schedule(localFixture.kickOff, 'kick-off notification', {fixture: JSON.stringify(fixture)});
                        agenda.schedule(localFixture.halfTime, 'half-time notification', {fixture: JSON.stringify(fixture)});
                        agenda.schedule(localFixture.fullTime, 'score fixture predictors', {fixture: JSON.stringify(fixture)});

                        console.log("There was a scheduled change made to fixture, this change has been accounted for, fix updated.");

                    });

                } else if (APIFixDate.isSame(localFixDate) && !APIFixTime.isSame(localFixTime)) { //then t

                    console.log("STORED FIXTURE DIFFERS FROM SAME MATCH ON API - ON DIFFERENT TIME ON THE SAME DAY")

                    //update the date and time of the locally stored fixture and save changes (Fixture.update)
                    localFixture.fixDate = APIFixDate.toDate();

                    //update kick off, half time and fulltime
                    localFixture.kickOff = APIFixTime.toDate();
                    APIFixTime.add(45, 'minutes');
                    localFixture.halfTime = APIFixTime.toDate();
                    APIFixTime.add(45, 'minutes');
                    localFixture.fullTime = APIFixTime.toDate();

                    //now save the changes that have been made to the fixture to the local database
                    Fixture.update({"_id": localFixture._id}, localFixture, function (err) {

                        //if there is an error, simply return straight back to the user
                        if (err) return console.log("An error occurred: " + err);

                        //fixture should now have been given the correct result
                        console.log("The fixture with id: " + fixture.id + " has now been updated to the new date and time");

                        //once the fixture has been updated, invoke the callback function
                        console.log("The fixture has successfully been given the correct result, invoking callback");

                        //Now cancel and reschedule
                        //find and cancel the scheduled job(s) for the old date and time
                        agenda.cancel({"nextRunAt": localFixture.fullTime}, function (error, numRemoved) {
                            if (numRemoved != 1) {
                                console.log("ERROR: " + numRemoved + " jobs were cancelled, only 1 was supposed to be cancelled.");
                            }
                            console.log("Cancelled the job scheduled to run at original end of fixture");
                        });

                        //todo: schedule push notification for kick and half time
                        //reschedule the job(s) to score the fixture at it's new finishing time
                        agenda.schedule(hourBeforeKickOff.toDate(), 'pre-match notification', {fixture: JSON.stringify(fixture)});
                        agenda.schedule(localFixture.kickOff, 'kick-off notification', {fixture: JSON.stringify(fixture)});
                        agenda.schedule(localFixture.halfTime, 'half-time notification', {fixture: JSON.stringify(fixture)});
                        agenda.schedule(localFixture.fullTime, 'score fixture predictors', {fixture: JSON.stringify(fixture)});

                        console.log("There was a scheduled change made to fixture, this change has been accounted for, fix updated.");

                    });
                } else {
                    console.log("LOCALLY STORED MATCH IS SAME AS THE ONE FROM API, NO UPDATE NEEDED.")
                }
            }
        });
    }); //todo: add error function for promise rejection in here.
}

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
        path: '/api/?Action=fixtures&APIKey=2760810b-be47-82d7-db48d00daa1c&comp_id=1204&match_date=' + fixtureDate,
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
        path: '/api/?Action=fixtures&APIKey=2760810b-be47-82d7-db48d00daa1c&comp_id=1204&match_date=' + fixtureDate,
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
            console.log("The number of returned users is: " + users.length);
            console.log("The users returned are: " + JSON.stringify(users));

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
            console.log("The number of returned users is: " + users.length);
            console.log("The users returned are: " + JSON.stringify(users));

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
        console.log("The overall season score for this user is: %n", seasonScore);

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
                    var fixtureRoundScore = underscore.findWhere();
                    for (var l = 0; l < roundScores.length; l++) {
                        if (roundScores[l].roundNo == fixture.round) {
                            roundScores[l].roundScore += preds[k].predictValue.correctPoints;
                            roundscores[l].correctPredictions++;
                            //console.log("Now updated the round score with a correct prediction.");
                            preds[k].predictionResult = 'Correct';
                            break;
                        }
                    }
                } else {
                    //Otherwise if the prediction was incorrect deduct the necessary amount of points
                    seasonScore -= preds[k].predictValue.incorrectPoints;
                    //Manual search to always ensure the correct roundScore is getting updated
                    for (var l = 0; l < roundScores.length; l++) {
                        if (roundScores[l].roundNo == fixture.round) {
                            roundScores[l].roundScore -= preds[k].predictValue.incorrectPoints;
                            roundscores[l].incorrectPredictions++;
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
        var currentFixtureRound = fixture.round;

        //Deduct 6 points from the user for not making a prediction
        score -= 6;

        //Also update the score for the round to take away 6
        var currentUserRoundScore = underscore.findWhere(roundScores, {roundNo: currentFixtureRound});

        //Now alter the round score
        currentUserRoundScore -= 6;

        //if the score has been update save the change made to the user's score and recurse
        User.findByIdAndUpdate(users[i]._id, {$set: {'overallSeasonScore': score}}, function () {
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

//small function for conveniently reformatting a date
function _formattedDate(date) {
    var d = new Date(date || Date.now()),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [day, month, year].join('.');
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

                console.log("Attemping to send the post request");
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

examples = [
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Crystal Palace",
        "fixture":"Arsenal v Crystal Palace",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a HW, Arsenal have won 5 of the last 6 times the 2 sides have met",
        "round":1,
        "fixutreDate":"2014-08-18T15:00:00.000Z",
        "kickOff":"2014-08-18T15:00:00.000Z",
        "halfTime":"2014-08-18T15:45:00.000Z",
        "fullTime":"2014-08-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Chelsea",
        "fixture":"Bournemouth v Chelsea",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":1,
        "fixutreDate":"2014-08-18T15:00:00.000Z",
        "kickOff":"2014-08-18T15:00:00.000Z",
        "halfTime":"2014-08-18T15:45:00.000Z",
        "fullTime":"2014-08-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Everton",
        "fixture":"Liverpool v Everton",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a D, Pattern? Over the past 6 years, when there has been a draw in this fixture, the following season Liverpool have come out on top. It was a draw last year, so will this trend continue?...",
        "round":1,
        "fixutreDate":"2014-08-18T15:00:00.000Z",
        "kickOff":"2014-08-18T15:00:00.000Z",
        "halfTime":"2014-08-18T15:45:00.000Z",
        "fullTime":"2014-08-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Stoke City",
        "fixture":"Manchester City v Stoke City",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a AW, Before last seasons loss, Manchester City had won all games at home",
        "round":1,
        "fixutreDate":"2014-08-18T15:00:00.000Z",
        "kickOff":"2014-08-18T15:00:00.000Z",
        "halfTime":"2014-08-18T15:45:00.000Z",
        "fullTime":"2014-08-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Newcastle United v Tottenham Hotspur",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a AW, Spurs have won away to Newcastle for the last 2 seasons. Will they be able to continue this run?",
        "round":1,
        "fixutreDate":"2014-08-18T15:00:00.000Z",
        "kickOff":"2014-08-18T15:00:00.000Z",
        "halfTime":"2014-08-18T15:45:00.000Z",
        "fullTime":"2014-08-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Manchester United",
        "fixture":"Norwich City v Manchester United",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"While Manchester United have had the upper hand in this fixture, they've been tight games. United have won 2 of their past 3 premier league games at Carrow Road",
        "round":1,
        "fixutreDate":"2014-08-18T15:00:00.000Z",
        "kickOff":"2014-08-18T15:00:00.000Z",
        "halfTime":"2014-08-18T15:45:00.000Z",
        "fullTime":"2014-08-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Leicester City",
        "fixture":"Southampton v Leicester City",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a HW, It's been the Southampton's game or a draw over the years",
        "round":1,
        "fixutreDate":"2014-08-18T15:00:00.000Z",
        "kickOff":"2014-08-18T15:00:00.000Z",
        "halfTime":"2014-08-18T15:45:00.000Z",
        "fullTime":"2014-08-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Aston Villa",
        "fixture":"Sunderland v Aston Villa",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a AW, Villa have dominated in recent history at Stadium of light, winning 4 out of the last 6",
        "round":1,
        "fixutreDate":"2014-08-18T15:00:00.000Z",
        "kickOff":"2014-08-18T15:00:00.000Z",
        "halfTime":"2014-08-18T15:45:00.000Z",
        "fullTime":"2014-08-18T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Swansea City",
        "fixture":"West Bromwich Albion v Swansea City",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a HW, Taking it in turns? In the past 4 seasons, when one team wins this fixture at the Hawthorns, the following season the other team takes the victory. Last season WBA won, so will the pattern continue and Swansea claim the win?",
        "round":1,
        "fixutreDate":"2014-08-18T15:00:00.000Z",
        "kickOff":"2014-08-18T15:00:00.000Z",
        "halfTime":"2014-08-18T15:45:00.000Z",
        "fullTime":"2014-08-18T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Watford",
        "fixture":"West Ham United v Watford",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last time the 2 teams played at the home of the Hammers, Watford won. That was 8 years ago, so will they do it again?",
        "round":1,
        "fixutreDate":"2014-08-18T15:00:00.000Z",
        "kickOff":"2014-08-18T15:00:00.000Z",
        "halfTime":"2014-08-18T15:45:00.000Z",
        "fullTime":"2014-08-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Norwich City",
        "fixture":"Aston Villa v Norwich City",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"It was an AW last time the team met in the Premier League at Villa Park in 2013-14. ",
        "round":2,
        "fixutreDate":"2014-08-23T15:00:00.000Z",
        "kickOff":"2014-08-23T15:00:00.000Z",
        "halfTime":"2014-08-23T15:45:00.000Z",
        "fullTime":"2014-08-23T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Liverpool",
        "fixture":"Chelsea v Liverpool",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a D, A tough one to call. 2 home wins, 2 draws and 2 away wins between the 2 teams in the last 6 fixtures at Stamford Bridge.",
        "round":2,
        "fixutreDate":"2014-08-23T15:00:00.000Z",
        "kickOff":"2014-08-23T15:00:00.000Z",
        "halfTime":"2014-08-23T15:45:00.000Z",
        "fullTime":"2014-08-23T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"West Ham United",
        "fixture":"Crystal Palace v West Ham United",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a AW, Not much between the 2 sides, 1 home win and last years away win in the 2 seasons Crystal Palace have been back in England's top league",
        "round":2,
        "fixutreDate":"2014-08-23T15:00:00.000Z",
        "kickOff":"2014-08-23T15:00:00.000Z",
        "halfTime":"2014-08-23T15:45:00.000Z",
        "fullTime":"2014-08-23T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Arsenal",
        "fixture":"Everton v Arsenal",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a D, Don't be fooled. While Gunners have won 3 of the last 6 games at Goodison Park in the Premier League; they haven't won in the last 3 seasons there",
        "round":2,
        "fixutreDate":"2014-08-23T15:00:00.000Z",
        "kickOff":"2014-08-23T15:00:00.000Z",
        "halfTime":"2014-08-23T15:45:00.000Z",
        "fullTime":"2014-08-23T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Sunderland",
        "fixture":"Leicester City v Sunderland",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a D, Sunderland have never won when they have visited Leicester. Will this unwanted run continue",
        "round":2,
        "fixutreDate":"2014-08-23T15:00:00.000Z",
        "kickOff":"2014-08-23T15:00:00.000Z",
        "halfTime":"2014-08-23T15:45:00.000Z",
        "fullTime":"2014-08-23T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Manchester City",
        "fixture":"Manchester United v Manchester City",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, Last seasons victory was United's first over their noisy neighbours for 4 seasons",
        "round":2,
        "fixutreDate":"2014-08-23T15:00:00.000Z",
        "kickOff":"2014-08-23T15:00:00.000Z",
        "halfTime":"2014-08-23T15:45:00.000Z",
        "fullTime":"2014-08-23T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Stoke City v West Bromwich Albion",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a HW, Stalemate. It's been quite an even contest between the two teams over the years, with Stoke's HW last season following a couple of draws in the 2 seasons prior to that",
        "round":2,
        "fixutreDate":"2014-08-23T15:00:00.000Z",
        "kickOff":"2014-08-23T15:00:00.000Z",
        "halfTime":"2014-08-23T15:45:00.000Z",
        "fullTime":"2014-08-23T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Newcastle United",
        "fixture":"Swansea City v Newcastle United",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a D, Last year's Draw broke Swansea's winning run at home when the 2 sides have met. Can Newcastle go one better and get an away win? It'd be the Magpie first win over the Swans in Wales since April 2012",
        "round":2,
        "fixutreDate":"2014-08-23T15:00:00.000Z",
        "kickOff":"2014-08-23T15:00:00.000Z",
        "halfTime":"2014-08-23T15:45:00.000Z",
        "fullTime":"2014-08-23T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Bournemouth",
        "fixture":"Tottenham Hotspur v Bournemouth",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":2,
        "fixutreDate":"2014-08-23T15:00:00.000Z",
        "kickOff":"2014-08-23T15:00:00.000Z",
        "halfTime":"2014-08-23T15:45:00.000Z",
        "fullTime":"2014-08-23T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Southampton",
        "fixture":"Watford v Southampton",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"Teams have only played each other once at Carrow Road in Premier League history. Back in 1999 - Watford came out on top. A lot has changed since then though",
        "round":2,
        "fixutreDate":"2014-08-23T15:00:00.000Z",
        "kickOff":"2014-08-23T15:00:00.000Z",
        "halfTime":"2014-08-23T15:45:00.000Z",
        "fullTime":"2014-08-23T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Leicester City",
        "fixture":"Aston Villa v Leicester City",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a HW, It's been a Villa win against their Midlands rivals in recent time's, including last year. Can they claim bragging rights again?",
        "round":3,
        "fixutreDate":"2014-08-30T15:00:00.000Z",
        "kickOff":"2014-08-30T15:00:00.000Z",
        "halfTime":"2014-08-30T15:45:00.000Z",
        "fullTime":"2014-08-30T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Newcastle United",
        "fixture":"Bournemouth v Newcastle United",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":3,
        "fixutreDate":"2014-08-30T15:00:00.000Z",
        "kickOff":"2014-08-30T15:00:00.000Z",
        "halfTime":"2014-08-30T15:45:00.000Z",
        "fullTime":"2014-08-30T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Chelsea",
        "fixture":"Everton v Chelsea",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a AW, Bogey team? While Chelsea won on their last visit to Everton, the toffees have won 4 of the last 6 Premier League games against the Champions at Goodison",
        "round":3,
        "fixutreDate":"2014-08-30T15:00:00.000Z",
        "kickOff":"2014-08-30T15:00:00.000Z",
        "halfTime":"2014-08-30T15:45:00.000Z",
        "fullTime":"2014-08-30T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Arsenal",
        "fixture":"Liverpool v Arsenal",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a D, Prior to the humiliating 5-1 loss in February 2013, Arsenal had a decent run at Anfield. After playing out a draw last year, could it the Gunners start another run of results away to Liverpool?",
        "round":3,
        "fixutreDate":"2014-08-30T15:00:00.000Z",
        "kickOff":"2014-08-30T15:00:00.000Z",
        "halfTime":"2014-08-30T15:45:00.000Z",
        "fullTime":"2014-08-30T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Sunderland",
        "fixture":"Manchester United v Sunderland",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, Home banker? Manchester United have won 4 of the last 6 Premier League games against Sunderland at Old Trafford.  But, Sunderland did come away with a unlikely victory in May 2014 to help them survive that season. Could the do it again?",
        "round":3,
        "fixutreDate":"2014-08-30T15:00:00.000Z",
        "kickOff":"2014-08-30T15:00:00.000Z",
        "halfTime":"2014-08-30T15:45:00.000Z",
        "fullTime":"2014-08-30T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Crystal Palace",
        "fixture":"Norwich City v Crystal Palace",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"When the teams last played in the Premier League back in November 2013, home side Norwich came out on top",
        "round":3,
        "fixutreDate":"2014-08-30T15:00:00.000Z",
        "kickOff":"2014-08-30T15:00:00.000Z",
        "halfTime":"2014-08-30T15:45:00.000Z",
        "fullTime":"2014-08-30T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Swansea City",
        "fixture":"Southampton v Swansea City",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a AW, Teams have only played each other for 3 seasons. When played in Southampton, it's been 1 HW, 1 D and 1 AW",
        "round":3,
        "fixutreDate":"2014-08-30T15:00:00.000Z",
        "kickOff":"2014-08-30T15:00:00.000Z",
        "halfTime":"2014-08-30T15:45:00.000Z",
        "fullTime":"2014-08-30T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Tottenham Hotspur v West Bromwich Albion",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a AW, Happy hunting ground? Over the past 3 seasons West Brom have drawn 2 and last year won at White Hart Lane. Can they keep this good form going?",
        "round":3,
        "fixutreDate":"2014-08-30T15:00:00.000Z",
        "kickOff":"2014-08-30T15:00:00.000Z",
        "halfTime":"2014-08-30T15:45:00.000Z",
        "fullTime":"2014-08-30T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Manchester City",
        "fixture":"Watford v Manchester City",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"All even! The last and only time the 2 sides have met back in April 2007 it was a 1-1 draw. Things have changed since then. How will the home side fair against their well financed opposition?",
        "round":3,
        "fixutreDate":"2014-08-30T15:00:00.000Z",
        "kickOff":"2014-08-30T15:00:00.000Z",
        "halfTime":"2014-08-30T15:45:00.000Z",
        "fullTime":"2014-08-30T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Stoke City",
        "fixture":"West Ham United v Stoke City",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a D, Happy hunting ground? Over the past 3 seasons Stoke have drawn 2 and won away to West Ham. Can they keep this good form going?",
        "round":3,
        "fixutreDate":"2014-08-30T15:00:00.000Z",
        "kickOff":"2014-08-30T15:00:00.000Z",
        "halfTime":"2014-08-30T15:45:00.000Z",
        "fullTime":"2014-08-30T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Manchester United",
        "fixture":"Arsenal v Manchester United",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a AW, No home comforts! Arsenal have not beaten Manchester United when playing at home for 4 seasons. Can they get a home win this season?",
        "round":4,
        "fixutreDate":"2014-09-13T15:00:00.000Z",
        "kickOff":"2014-09-13T15:00:00.000Z",
        "halfTime":"2014-09-13T15:45:00.000Z",
        "fullTime":"2014-09-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Chelsea v Tottenham Hotspur",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, FORTRESS! Chelsea have never lost to Spurs at Stamford Bridge",
        "round":4,
        "fixutreDate":"2014-09-13T15:00:00.000Z",
        "kickOff":"2014-09-13T15:00:00.000Z",
        "halfTime":"2014-09-13T15:45:00.000Z",
        "fullTime":"2014-09-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Bournemouth",
        "fixture":"Crystal Palace v Bournemouth",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":4,
        "fixutreDate":"2014-09-13T15:00:00.000Z",
        "kickOff":"2014-09-13T15:00:00.000Z",
        "halfTime":"2014-09-13T15:45:00.000Z",
        "fullTime":"2014-09-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"West Ham United",
        "fixture":"Leicester City v West Ham United",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a HW, Last seasons game at King Power Stadium was the first for 13 years. It wasn't unlucky for the home side, who claimed victory",
        "round":4,
        "fixutreDate":"2014-09-13T15:00:00.000Z",
        "kickOff":"2014-09-13T15:00:00.000Z",
        "halfTime":"2014-09-13T15:45:00.000Z",
        "fullTime":"2014-09-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Aston Villa",
        "fixture":"Manchester City v Aston Villa",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, Home sweet home! Manchester City have won 8 straight home games against Villa. Can the midlands team cause an upset and claim an away win like they did back in 2007?",
        "round":4,
        "fixutreDate":"2014-09-13T15:00:00.000Z",
        "kickOff":"2014-09-13T15:00:00.000Z",
        "halfTime":"2014-09-13T15:45:00.000Z",
        "fullTime":"2014-09-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Southampton",
        "fixture":"Newcastle United v Southampton",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a AW, History favoured the home side; however, the Saints away win maybe changing that. What do you think?",
        "round":4,
        "fixutreDate":"2014-09-13T15:00:00.000Z",
        "kickOff":"2014-09-13T15:00:00.000Z",
        "halfTime":"2014-09-13T15:45:00.000Z",
        "fullTime":"2014-09-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Norwich City",
        "fixture":"Stoke City v Norwich City",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"The odd goal! The 3 times these 2 teams have played 1-0 has been the score. It was Norwich who came AWAY (pun pun pun) with victory the last time they played at the Britannia",
        "round":4,
        "fixutreDate":"2014-09-13T15:00:00.000Z",
        "kickOff":"2014-09-13T15:00:00.000Z",
        "halfTime":"2014-09-13T15:45:00.000Z",
        "fullTime":"2014-09-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Liverpool",
        "fixture":"Sunderland v Liverpool",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a AW, Recent history favours the Merseyside team. 1 draw and 2 wins in the last 3 seasons, including an away win last season",
        "round":4,
        "fixutreDate":"2014-09-13T15:00:00.000Z",
        "kickOff":"2014-09-13T15:00:00.000Z",
        "halfTime":"2014-09-13T15:45:00.000Z",
        "fullTime":"2014-09-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Watford",
        "fixture":"Swansea City v Watford",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"The two teams have never faced each other in the English top flight. Who will claim the first win? Or will it be honours even?",
        "round":4,
        "fixutreDate":"2014-09-13T15:00:00.000Z",
        "kickOff":"2014-09-13T15:00:00.000Z",
        "halfTime":"2014-09-13T15:45:00.000Z",
        "fullTime":"2014-09-13T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Everton",
        "fixture":"West Bromwich Albion v Everton",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a AW, For last three season there's been 1 HW, 1 D and 1 AW",
        "round":4,
        "fixutreDate":"2014-09-13T15:00:00.000Z",
        "kickOff":"2014-09-13T15:00:00.000Z",
        "halfTime":"2014-09-13T15:45:00.000Z",
        "fullTime":"2014-09-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Arsenal",
        "fixture":"Aston Villa v Arsenal",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a AW, Fun away days? Aston Villa haven't won at home when Arsenal come to visit for over 15 years! Talk about the Gunners making themselves at home!",
        "round":5,
        "fixutreDate":"2014-09-20T15:00:00.000Z",
        "kickOff":"2014-09-20T15:00:00.000Z",
        "halfTime":"2014-09-20T15:45:00.000Z",
        "fullTime":"2014-09-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Swansea City",
        "fixture":"Bournemouth v Swansea City",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":5,
        "fixutreDate":"2014-09-20T15:00:00.000Z",
        "kickOff":"2014-09-20T15:00:00.000Z",
        "halfTime":"2014-09-20T15:45:00.000Z",
        "fullTime":"2014-09-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Crystal Palace",
        "fixture":"Everton v Crystal Palace",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a AW, Crystal Palace have won 3-2 away to Everton for the past 2 season. Could they claim another away win and how's about 3-2?",
        "round":5,
        "fixutreDate":"2014-09-20T15:00:00.000Z",
        "kickOff":"2014-09-20T15:00:00.000Z",
        "halfTime":"2014-09-20T15:45:00.000Z",
        "fullTime":"2014-09-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Newcastle United",
        "fixture":"Liverpool v Newcastle United",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a HW, Banker home win? Liverpool have not lost at home to Newcastle since they were defeated when the teams first met in the Premier League back in April 1994",
        "round":5,
        "fixutreDate":"2014-09-20T15:00:00.000Z",
        "kickOff":"2014-09-20T15:00:00.000Z",
        "halfTime":"2014-09-20T15:45:00.000Z",
        "fullTime":"2014-09-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Chelsea",
        "fixture":"Manchester United v Chelsea",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a D, Clash of the titans? 2 draws and a Chelsea away win over the past 3 seasons when the South London team come travel to Old Trafford. Could it be 3 draws in a row?",
        "round":5,
        "fixutreDate":"2014-09-20T15:00:00.000Z",
        "kickOff":"2014-09-20T15:00:00.000Z",
        "halfTime":"2014-09-20T15:45:00.000Z",
        "fullTime":"2014-09-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Leicester City",
        "fixture":"Norwich City v Leicester City",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"Teams have only face each other once at Carrow Road in the Premier League - back in 1994, with the Home side winning that day",
        "round":5,
        "fixutreDate":"2014-09-20T15:00:00.000Z",
        "kickOff":"2014-09-20T15:00:00.000Z",
        "halfTime":"2014-09-20T15:45:00.000Z",
        "fullTime":"2014-09-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Sunderland",
        "fixture":"Southampton v Sunderland",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a HW, For last three season there's been 1 HW, 1 D and 1 AW. But last season Saints thumped the black cats 8-0! Will the away side have licked their wounds and bite back this season?",
        "round":5,
        "fixutreDate":"2014-09-20T15:00:00.000Z",
        "kickOff":"2014-09-20T15:00:00.000Z",
        "halfTime":"2014-09-20T15:45:00.000Z",
        "fullTime":"2014-09-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Stoke City",
        "fixture":"Tottenham Hotspur v Stoke City",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a AW, So last 6 season there's been 2 HW, 2 D and 2 AW. Can Stoke make it 2 away wins in row?",
        "round":5,
        "fixutreDate":"2014-09-20T15:00:00.000Z",
        "kickOff":"2014-09-20T15:00:00.000Z",
        "halfTime":"2014-09-20T15:45:00.000Z",
        "fullTime":"2014-09-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Watford v West Bromwich Albion",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The two teams have never faced each other in the English top flight. Who will claim the first win? Or will it be honours even?",
        "round":5,
        "fixutreDate":"2014-09-20T15:00:00.000Z",
        "kickOff":"2014-09-20T15:00:00.000Z",
        "halfTime":"2014-09-20T15:45:00.000Z",
        "fullTime":"2014-09-20T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Manchester City",
        "fixture":"West Ham United v Manchester City",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a HW, While Manchester City have found traveling to West Ham more enjoyable in recent time; last seasons home win for the Hammers brought back fonder remembers for the home fans. Will they be celebrating again this season?",
        "round":5,
        "fixutreDate":"2014-09-20T15:00:00.000Z",
        "kickOff":"2014-09-20T15:00:00.000Z",
        "halfTime":"2014-09-20T15:45:00.000Z",
        "fullTime":"2014-09-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Watford",
        "fixture":"Arsenal v Watford",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"100%! 2 home games against Watford in the Premier League, 2 home wins for the Gunners. 3 out of 3 this season?",
        "round":6,
        "fixutreDate":"2014-09-27T15:00:00.000Z",
        "kickOff":"2014-09-27T15:00:00.000Z",
        "halfTime":"2014-09-27T15:45:00.000Z",
        "fullTime":"2014-09-27T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Aston Villa",
        "fixture":"Chelsea v Aston Villa",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, Chelsea! Chelsea! - Last 3 seasons the home side have ruled, including a 8-0 hammering of their visitors back in December 2012",
        "round":6,
        "fixutreDate":"2014-09-27T15:00:00.000Z",
        "kickOff":"2014-09-27T15:00:00.000Z",
        "halfTime":"2014-09-27T15:45:00.000Z",
        "fullTime":"2014-09-27T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Liverpool",
        "fixture":"Crystal Palace v Liverpool",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a HW, Tough London! Liverpool have faltered in the past 2 visits to Crystal Palace! A loss last season and who can forget the 3-3, which shattered 'Pools title chances in 2014",
        "round":6,
        "fixutreDate":"2014-09-27T15:00:00.000Z",
        "kickOff":"2014-09-27T15:00:00.000Z",
        "halfTime":"2014-09-27T15:45:00.000Z",
        "fullTime":"2014-09-27T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Manchester United",
        "fixture":"Leicester City v Manchester United",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a HW, It was fun away days for United, but last season's shock 5-3 HW for Leicester put an end to the 5 game winning run the Red Devils when visiting the midlands team.",
        "round":6,
        "fixutreDate":"2014-09-27T15:00:00.000Z",
        "kickOff":"2014-09-27T15:00:00.000Z",
        "halfTime":"2014-09-27T15:45:00.000Z",
        "fullTime":"2014-09-27T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Everton",
        "fixture":"Manchester City v Everton",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, From 2008 to 2010, Everton won 4 Premier league away games in a row against City! But the Blue Moon has been out since the toffee's last victory, with the home side winning 3 of the last 4, including last seasons game",
        "round":6,
        "fixutreDate":"2014-09-27T15:00:00.000Z",
        "kickOff":"2014-09-27T15:00:00.000Z",
        "halfTime":"2014-09-27T15:45:00.000Z",
        "fullTime":"2014-09-27T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"West Ham United",
        "fixture":"Newcastle United v West Ham United",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a HW, So last three season there's been 1 HW, 1 D and 1 AW",
        "round":6,
        "fixutreDate":"2014-09-27T15:00:00.000Z",
        "kickOff":"2014-09-27T15:00:00.000Z",
        "halfTime":"2014-09-27T15:45:00.000Z",
        "fullTime":"2014-09-27T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Southampton",
        "fixture":"Stoke City v Southampton",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a HW, Stoke win last season was the first time a team tasted victory in the 3 Premier League games played between the 2 teams at the Britannia",
        "round":6,
        "fixutreDate":"2014-09-27T15:00:00.000Z",
        "kickOff":"2014-09-27T15:00:00.000Z",
        "halfTime":"2014-09-27T15:45:00.000Z",
        "fullTime":"2014-09-27T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Norwich City",
        "fixture":"Sunderland v Norwich City",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last time the 2 teams played in the North East, no team could claim the 3 points as it ended in a draw",
        "round":6,
        "fixutreDate":"2014-09-27T15:00:00.000Z",
        "kickOff":"2014-09-27T15:00:00.000Z",
        "halfTime":"2014-09-27T15:45:00.000Z",
        "fullTime":"2014-09-27T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Swansea City v Tottenham Hotspur",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a AW, Fun away days? Swansea haven't won at home when Arsenal come to visit. Can they correct that this season?",
        "round":6,
        "fixutreDate":"2014-09-27T15:00:00.000Z",
        "kickOff":"2014-09-27T15:00:00.000Z",
        "halfTime":"2014-09-27T15:45:00.000Z",
        "fullTime":"2014-09-27T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Bournemouth",
        "fixture":"West Bromwich Albion v Bournemouth",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":6,
        "fixutreDate":"2014-09-27T15:00:00.000Z",
        "kickOff":"2014-09-27T15:00:00.000Z",
        "halfTime":"2014-09-27T15:45:00.000Z",
        "fullTime":"2014-09-27T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Manchester United",
        "fixture":"Aston Villa v Manchester United",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a D, United had enjoyed 3 Premier League wins in a row at Villa Park before last seasons draw. Can the Red Devils rediscover the winning feeling or will Villa go one better this season?",
        "round":7,
        "fixutreDate":"2014-10-04T15:00:00.000Z",
        "kickOff":"2014-10-04T15:00:00.000Z",
        "halfTime":"2014-10-04T15:45:00.000Z",
        "fullTime":"2014-10-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Arsenal",
        "fixture":"Chelsea v Arsenal",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, Homer? It's been 3 home wins out of 3 PL games for champions Chelsea's against Arsenal. Can show they're ready to take this seasons crown with an AW?",
        "round":7,
        "fixutreDate":"2014-10-04T15:00:00.000Z",
        "kickOff":"2014-10-04T15:00:00.000Z",
        "halfTime":"2014-10-04T15:45:00.000Z",
        "fullTime":"2014-10-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Crystal Palace",
        "fixture":"Leicester City v Crystal Palace",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a AW, Favourite ground? Palace are undefeated on their visits to Leicester. Can the home side be able to change that this season?",
        "round":7,
        "fixutreDate":"2014-10-04T15:00:00.000Z",
        "kickOff":"2014-10-04T15:00:00.000Z",
        "halfTime":"2014-10-04T15:45:00.000Z",
        "fullTime":"2014-10-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Bournemouth",
        "fixture":"Liverpool v Bournemouth",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":7,
        "fixutreDate":"2014-10-04T15:00:00.000Z",
        "kickOff":"2014-10-04T15:00:00.000Z",
        "halfTime":"2014-10-04T15:45:00.000Z",
        "fullTime":"2014-10-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Manchester City v West Bromwich Albion",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, Home comforts! Last 6 seasons - 6 home wins for City against the Baggies. Surely, they'll bag another HW - right?",
        "round":7,
        "fixutreDate":"2014-10-04T15:00:00.000Z",
        "kickOff":"2014-10-04T15:00:00.000Z",
        "halfTime":"2014-10-04T15:45:00.000Z",
        "fullTime":"2014-10-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Everton",
        "fixture":"Newcastle United v Everton",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a HW, So last 6 season there's been 2 HW, 2 D and 2 AW. how will it look at the end of this game?",
        "round":7,
        "fixutreDate":"2014-10-04T15:00:00.000Z",
        "kickOff":"2014-10-04T15:00:00.000Z",
        "halfTime":"2014-10-04T15:45:00.000Z",
        "fullTime":"2014-10-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Sunderland",
        "fixture":"Swansea City v Sunderland",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a D, On the draw? 3 of the 4 games between the 2 teams at the Liberty stadium in the Premier League",
        "round":7,
        "fixutreDate":"2014-10-04T15:00:00.000Z",
        "kickOff":"2014-10-04T15:00:00.000Z",
        "halfTime":"2014-10-04T15:45:00.000Z",
        "fullTime":"2014-10-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Norwich City",
        "fixture":"Tottenham Hotspur v Norwich City",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"For last three season there's been 1 HW, 1 D and 1 AW. Tottenham won the last time the 2 teams met at White Hart Lane",
        "round":7,
        "fixutreDate":"2014-10-04T15:00:00.000Z",
        "kickOff":"2014-10-04T15:00:00.000Z",
        "halfTime":"2014-10-04T15:45:00.000Z",
        "fullTime":"2014-10-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Stoke City",
        "fixture":"Watford v Stoke City",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The two teams have never faced each other in the English top flight. Who will claim the first win? Or will it be honours even?",
        "round":7,
        "fixutreDate":"2014-10-04T15:00:00.000Z",
        "kickOff":"2014-10-04T15:00:00.000Z",
        "halfTime":"2014-10-04T15:45:00.000Z",
        "fullTime":"2014-10-04T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Southampton",
        "fixture":"West Ham United v Southampton",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a AW, West Ham have enjoyed plenty of victories on their home patch against the Saints. But the Southampton did bag an away win last year. Can they do the same again this year?",
        "round":7,
        "fixutreDate":"2014-10-04T15:00:00.000Z",
        "kickOff":"2014-10-04T15:00:00.000Z",
        "halfTime":"2014-10-04T15:45:00.000Z",
        "fullTime":"2014-10-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Leicester City",
        "fixture":"Arsenal v Leicester City",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a HW, Home sweet home! Arsenal have never loss at home to Leicester and won every game against the Foxes in the Premier League since 1997",
        "round":8,
        "fixutreDate":"2014-10-18T15:00:00.000Z",
        "kickOff":"2014-10-18T15:00:00.000Z",
        "halfTime":"2014-10-18T15:45:00.000Z",
        "fullTime":"2014-10-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"West Ham United",
        "fixture":"Bournemouth v West Ham United",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":8,
        "fixutreDate":"2014-10-18T15:00:00.000Z",
        "kickOff":"2014-10-18T15:00:00.000Z",
        "halfTime":"2014-10-18T15:45:00.000Z",
        "fullTime":"2014-10-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Chelsea",
        "fixture":"Crystal Palace v Chelsea",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a AW, Since the Eagles return to the Premier League, it's been one home win for Crystal Palace and one away win for Chelsea. How about a draw this season?",
        "round":8,
        "fixutreDate":"2014-10-18T15:00:00.000Z",
        "kickOff":"2014-10-18T15:00:00.000Z",
        "halfTime":"2014-10-18T15:45:00.000Z",
        "fullTime":"2014-10-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Aston Villa",
        "fixture":"Everton v Aston Villa",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a HW, 4 of the last 6 games at Goodison ended in draws, while Everton won have won for the last 2 seasons",
        "round":8,
        "fixutreDate":"2014-10-18T15:00:00.000Z",
        "kickOff":"2014-10-18T15:00:00.000Z",
        "halfTime":"2014-10-18T15:45:00.000Z",
        "fullTime":"2014-10-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Watford",
        "fixture":"Manchester United v Watford",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"100%! 2 home games against Watford in the Premier League, 2 home wins for the Red Devils. 3 out of 3 this season?",
        "round":8,
        "fixutreDate":"2014-10-18T15:00:00.000Z",
        "kickOff":"2014-10-18T15:00:00.000Z",
        "halfTime":"2014-10-18T15:45:00.000Z",
        "fullTime":"2014-10-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Liverpool",
        "fixture":"Norwich City v Liverpool",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"Fun away days? Liverpool have won on their last 5 visits to Carrow Road in the Premier League",
        "round":8,
        "fixutreDate":"2014-10-18T15:00:00.000Z",
        "kickOff":"2014-10-18T15:00:00.000Z",
        "halfTime":"2014-10-18T15:45:00.000Z",
        "fullTime":"2014-10-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Manchester City",
        "fixture":"Southampton v Manchester City",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a AW, For last three season there's been 1 HW, 1 D and 1 AW. Tottenham won the last time the 2 teams met at White Hart Lane",
        "round":8,
        "fixutreDate":"2014-10-18T15:00:00.000Z",
        "kickOff":"2014-10-18T15:00:00.000Z",
        "halfTime":"2014-10-18T15:45:00.000Z",
        "fullTime":"2014-10-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Swansea City",
        "fixture":"Stoke City v Swansea City",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a HW, Stoke have never been beaten at home when the Swans have visited. Can the keep that run going?",
        "round":8,
        "fixutreDate":"2014-10-18T15:00:00.000Z",
        "kickOff":"2014-10-18T15:00:00.000Z",
        "halfTime":"2014-10-18T15:45:00.000Z",
        "fullTime":"2014-10-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Sunderland v Tottenham Hotspur",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a D, Before last seasons draw, Tottenham had won for the two previous season at the Stadium of Light",
        "round":8,
        "fixutreDate":"2014-10-18T15:00:00.000Z",
        "kickOff":"2014-10-18T15:00:00.000Z",
        "halfTime":"2014-10-18T15:45:00.000Z",
        "fullTime":"2014-10-18T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Newcastle United",
        "fixture":"West Bromwich Albion v Newcastle United",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a AW, For last three season there's been 1 HW, 1 D and 1 AW. Newcastle won the last time the 2 teams met at the Hawthorns",
        "round":8,
        "fixutreDate":"2014-10-18T15:00:00.000Z",
        "kickOff":"2014-10-18T15:00:00.000Z",
        "halfTime":"2014-10-18T15:45:00.000Z",
        "fullTime":"2014-10-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Everton",
        "fixture":"Bournemouth v Everton",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":9,
        "fixutreDate":"2014-10-25T15:00:00.000Z",
        "kickOff":"2014-10-25T15:00:00.000Z",
        "halfTime":"2014-10-25T15:45:00.000Z",
        "fullTime":"2014-10-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Leicester City",
        "fixture":"Manchester City v Leicester City",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, Leicester had won all the games away to Man City in the Premier League prior to Man City's win last season. However, those wins did come in 2003 or earlier ",
        "round":9,
        "fixutreDate":"2014-10-25T15:00:00.000Z",
        "kickOff":"2014-10-25T15:00:00.000Z",
        "halfTime":"2014-10-25T15:45:00.000Z",
        "fullTime":"2014-10-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Chelsea",
        "fixture":"Newcastle United v Chelsea",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a HW, Newcastle have beaten Chelsea at St James' for the past 3 seasons. Can they make it 4 in a row against the Champions?",
        "round":9,
        "fixutreDate":"2014-10-25T15:00:00.000Z",
        "kickOff":"2014-10-25T15:00:00.000Z",
        "halfTime":"2014-10-25T15:45:00.000Z",
        "fullTime":"2014-10-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Aston Villa",
        "fixture":"Southampton v Aston Villa",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a HW, Taking it in turns? In the past 4 seasons, when one team wins this fixture at the Hawthorns, the following season the other team takes the victory. Last season WBA won, so will the pattern continue and Swansea claim the win?",
        "round":9,
        "fixutreDate":"2014-10-25T15:00:00.000Z",
        "kickOff":"2014-10-25T15:00:00.000Z",
        "halfTime":"2014-10-25T15:45:00.000Z",
        "fullTime":"2014-10-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Sunderland",
        "fixture":"Stoke City v Sunderland",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a D, Stoke have won 3 of the last 6 Premier League games at home against Sunderland; however, the Potters' last win was sandwiched between a couple of draws",
        "round":9,
        "fixutreDate":"2014-10-25T15:00:00.000Z",
        "kickOff":"2014-10-25T15:00:00.000Z",
        "halfTime":"2014-10-25T15:45:00.000Z",
        "fullTime":"2014-10-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Arsenal",
        "fixture":"Swansea City v Arsenal",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a HW, Even split! Since Swansea have been in the Premier League, they have 2 HWs and visitors Arsenal have 2 Aws. Who'll be able to take the lead or will it be a draw?",
        "round":9,
        "fixutreDate":"2014-10-25T15:00:00.000Z",
        "kickOff":"2014-10-25T15:00:00.000Z",
        "halfTime":"2014-10-25T15:45:00.000Z",
        "fullTime":"2014-10-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Liverpool",
        "fixture":"Tottenham Hotspur v Liverpool",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a AW, Spurs had been dominating in recent history at White Hart Lane, winning 4 out of the last 6. But the Past 2 season Liverpool have come away with victories.",
        "round":9,
        "fixutreDate":"2014-10-25T15:00:00.000Z",
        "kickOff":"2014-10-25T15:00:00.000Z",
        "halfTime":"2014-10-25T15:45:00.000Z",
        "fullTime":"2014-10-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Norwich City",
        "fixture":"Watford v Norwich City",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The two teams have never faced each other in the English top flight. Who will claim the first win? Or will it be honours even?",
        "round":9,
        "fixutreDate":"2014-10-25T15:00:00.000Z",
        "kickOff":"2014-10-25T15:00:00.000Z",
        "halfTime":"2014-10-25T15:45:00.000Z",
        "fullTime":"2014-10-25T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Crystal Palace",
        "fixture":"West Bromwich Albion v Crystal Palace",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a D, The 2 seasons Crystal Palace have been back in the PL they have not been able to win away to West Brom",
        "round":9,
        "fixutreDate":"2014-10-25T15:00:00.000Z",
        "kickOff":"2014-10-25T15:00:00.000Z",
        "halfTime":"2014-10-25T15:45:00.000Z",
        "fullTime":"2014-10-25T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Manchester United",
        "fixture":"West Ham United v Manchester United",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a D, Happy hunting ground?! United are undefeated in their last 6 visits to West Ham, winning 4 and drawing 2 (including last years draw). Can they make it 7 without lost?",
        "round":9,
        "fixutreDate":"2014-10-25T15:00:00.000Z",
        "kickOff":"2014-10-25T15:00:00.000Z",
        "halfTime":"2014-10-25T15:45:00.000Z",
        "fullTime":"2014-10-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Bournemouth",
        "fixture":"Arsenal v Bournemouth",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":10,
        "fixutreDate":"2014-11-01T15:00:00.000Z",
        "kickOff":"2014-11-01T15:00:00.000Z",
        "halfTime":"2014-11-01T15:45:00.000Z",
        "fullTime":"2014-11-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Watford",
        "fixture":"Aston Villa v Watford",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"The only 2 games between the 2 at Villa Park in the PL have finished in home wins to Villa. Can they keep up this stat?",
        "round":10,
        "fixutreDate":"2014-11-01T15:00:00.000Z",
        "kickOff":"2014-11-01T15:00:00.000Z",
        "halfTime":"2014-11-01T15:45:00.000Z",
        "fullTime":"2014-11-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Southampton",
        "fixture":"Chelsea v Southampton",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a D, It's been all Chelsea in recent times; however, the Saints are make it tough for the Champions, with draws in 2 of their last 3 PL visits to Stamford Bridge",
        "round":10,
        "fixutreDate":"2014-11-01T15:00:00.000Z",
        "kickOff":"2014-11-01T15:00:00.000Z",
        "halfTime":"2014-11-01T15:45:00.000Z",
        "fullTime":"2014-11-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Swansea City",
        "fixture":"Crystal Palace v Swansea City",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a HW, It's 1 a piece. 1 HW and 1 AW when the 2 teams have met at the home of the Eagles in the PL. Draw this season to complete the set of results?",
        "round":10,
        "fixutreDate":"2014-11-01T15:00:00.000Z",
        "kickOff":"2014-11-01T15:00:00.000Z",
        "halfTime":"2014-11-01T15:45:00.000Z",
        "fullTime":"2014-11-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Everton v Tottenham Hotspur",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a AW, Last year's Away win was Spurs' first for 8 seasons. Can they make it 2 in 2? ",
        "round":10,
        "fixutreDate":"2014-11-01T15:00:00.000Z",
        "kickOff":"2014-11-01T15:00:00.000Z",
        "halfTime":"2014-11-01T15:45:00.000Z",
        "fullTime":"2014-11-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Stoke City",
        "fixture":"Leicester City v Stoke City",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a AW, Last season was the only time the teams had met in the PL. Stoke grab the an away win. What will it be this season?",
        "round":10,
        "fixutreDate":"2014-11-01T15:00:00.000Z",
        "kickOff":"2014-11-01T15:00:00.000Z",
        "halfTime":"2014-11-01T15:45:00.000Z",
        "fullTime":"2014-11-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Liverpool v West Bromwich Albion",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a HW, Back on track? Liverpool have beaten WBA for past 2 seasons, but  WBA had won on their two previous visits to that",
        "round":10,
        "fixutreDate":"2014-11-01T15:00:00.000Z",
        "kickOff":"2014-11-01T15:00:00.000Z",
        "halfTime":"2014-11-01T15:45:00.000Z",
        "fullTime":"2014-11-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Newcastle United",
        "fixture":"Manchester United v Newcastle United",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, Winter fun! These 2 United's have played each other in Late Nov/ December for the past 4 seasons",
        "round":10,
        "fixutreDate":"2014-11-01T15:00:00.000Z",
        "kickOff":"2014-11-01T15:00:00.000Z",
        "halfTime":"2014-11-01T15:45:00.000Z",
        "fullTime":"2014-11-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Manchester City",
        "fixture":"Norwich City v Manchester City",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"It was a Draw the last time that Man City travelled to Carrow Road. The Sky Blues had won on their previous 2 visits to that draw",
        "round":10,
        "fixutreDate":"2014-11-01T15:00:00.000Z",
        "kickOff":"2014-11-01T15:00:00.000Z",
        "halfTime":"2014-11-01T15:45:00.000Z",
        "fullTime":"2014-11-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"West Ham United",
        "fixture":"Sunderland v West Ham United",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a D, For last three season there's been 1 HW, 1 D and 1 AW",
        "round":10,
        "fixutreDate":"2014-11-01T15:00:00.000Z",
        "kickOff":"2014-11-01T15:00:00.000Z",
        "halfTime":"2014-11-01T15:45:00.000Z",
        "fullTime":"2014-11-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Leicester City",
        "fixture":"Bournemouth v Leicester City",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":11,
        "fixutreDate":"2014-11-08T15:00:00.000Z",
        "kickOff":"2014-11-08T15:00:00.000Z",
        "halfTime":"2014-11-08T15:45:00.000Z",
        "fullTime":"2014-11-08T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Chelsea",
        "fixture":"Manchester City v Chelsea",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a D, City had been dominate, but since Jose's been back, Chelsea have an AW and last seasons draw. Special One got a Special touch when at the Etihad?",
        "round":11,
        "fixutreDate":"2014-11-08T15:00:00.000Z",
        "kickOff":"2014-11-08T15:00:00.000Z",
        "halfTime":"2014-11-08T15:45:00.000Z",
        "fullTime":"2014-11-08T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Crystal Palace",
        "fixture":"Newcastle United v Crystal Palace",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a D, 1 HW and last seasons draw is how it stands between the 2 teams when the Eagles have flown to take on the Magpies",
        "round":11,
        "fixutreDate":"2014-11-08T15:00:00.000Z",
        "kickOff":"2014-11-08T15:00:00.000Z",
        "halfTime":"2014-11-08T15:45:00.000Z",
        "fullTime":"2014-11-08T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Manchester United",
        "fixture":"Southampton v Manchester United",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a AW, United seem to like travelling to Southampton. They have a draw and 2 AWs (including last seasons) from their last 3 visits to the South coast",
        "round":11,
        "fixutreDate":"2014-11-08T15:00:00.000Z",
        "kickOff":"2014-11-08T15:00:00.000Z",
        "halfTime":"2014-11-08T15:45:00.000Z",
        "fullTime":"2014-11-08T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Liverpool",
        "fixture":"Stoke City v Liverpool",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a HW, Walloped! In Steve Gs last game Stoke hit Liverpool for 6 and enjoy a great record against the Merseyside team when playing at the Britannia. 4 HWs and a draw in the last 6 seasons",
        "round":11,
        "fixutreDate":"2014-11-08T15:00:00.000Z",
        "kickOff":"2014-11-08T15:00:00.000Z",
        "halfTime":"2014-11-08T15:45:00.000Z",
        "fullTime":"2014-11-08T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Everton",
        "fixture":"Swansea City v Everton",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a D, Everton had won on all there visits to Wales before last seasons Draw. Can they rekindle this form this season?",
        "round":11,
        "fixutreDate":"2014-11-08T15:00:00.000Z",
        "kickOff":"2014-11-08T15:00:00.000Z",
        "halfTime":"2014-11-08T15:45:00.000Z",
        "fullTime":"2014-11-08T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Arsenal",
        "fixture":"Tottenham Hotspur v Arsenal",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a HW, HOT-Spurs! Tottenham have won 4 of the 6 North London derbies at White Hart Lane. Can add another HW to last seasons triumph?",
        "round":11,
        "fixutreDate":"2014-11-08T15:00:00.000Z",
        "kickOff":"2014-11-08T15:00:00.000Z",
        "halfTime":"2014-11-08T15:45:00.000Z",
        "fullTime":"2014-11-08T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Sunderland",
        "fixture":"Watford v Sunderland",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"Party like it's 1999? That's when these 2 sides last met in the Premier League at Vicarage Road. The Black Cats would surely want to as they bagged an AW",
        "round":11,
        "fixutreDate":"2014-11-08T15:00:00.000Z",
        "kickOff":"2014-11-08T15:00:00.000Z",
        "halfTime":"2014-11-08T15:45:00.000Z",
        "fullTime":"2014-11-08T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Norwich City",
        "fixture":"West Bromwich Albion v Norwich City",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"The Canneries do like middle ground as they have who 2 of the last 3 PL games to be played at the Hawthorns; including the last time the 2 side faced off in the PL in the Midlands",
        "round":11,
        "fixutreDate":"2014-11-08T15:00:00.000Z",
        "kickOff":"2014-11-08T15:00:00.000Z",
        "halfTime":"2014-11-08T15:45:00.000Z",
        "fullTime":"2014-11-08T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Aston Villa",
        "fixture":"West Ham United v Aston Villa",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a D, Stalemate?! It's been 0-0 draws in the past 2 seasons between the 2 teams at the home of the Hammers. Can these 2 make it a bit more entertaining this season for the fans?",
        "round":11,
        "fixutreDate":"2014-11-08T15:00:00.000Z",
        "kickOff":"2014-11-08T15:00:00.000Z",
        "halfTime":"2014-11-08T15:45:00.000Z",
        "fullTime":"2014-11-08T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Newcastle United",
        "fixture":"Arsenal v Newcastle United",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a HW, Easy peasy? Arsenal have won 5 of the last 6 PL games when Newcastle come visit, including the last 4, with and agg. score of 16-5",
        "round":12,
        "fixutreDate":"2014-11-22T15:00:00.000Z",
        "kickOff":"2014-11-22T15:00:00.000Z",
        "halfTime":"2014-11-22T15:45:00.000Z",
        "fullTime":"2014-11-22T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Stoke City",
        "fixture":"Aston Villa v Stoke City",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a AW, Happy hunting round? The Potters have won on their last 2 visits to Villa park in the PL and are undefeated in 5 seasons",
        "round":12,
        "fixutreDate":"2014-11-22T15:00:00.000Z",
        "kickOff":"2014-11-22T15:00:00.000Z",
        "halfTime":"2014-11-22T15:45:00.000Z",
        "fullTime":"2014-11-22T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Chelsea v West Bromwich Albion",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, Home banker?! Chelsea remain undefeated and have won 8 of the 9 PL games played between the 2 sides at Stamford Bridge",
        "round":12,
        "fixutreDate":"2014-11-22T15:00:00.000Z",
        "kickOff":"2014-11-22T15:00:00.000Z",
        "halfTime":"2014-11-22T15:45:00.000Z",
        "fullTime":"2014-11-22T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Manchester City",
        "fixture":"Crystal Palace v Manchester City",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a HW, It's 1 a piece. 1 HW and 1 AW when the 2 teams have met at the home of the Eagles in the PL. Draw this season to complete the set of results?",
        "round":12,
        "fixutreDate":"2014-11-22T15:00:00.000Z",
        "kickOff":"2014-11-22T15:00:00.000Z",
        "halfTime":"2014-11-22T15:45:00.000Z",
        "fullTime":"2014-11-22T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"West Ham United",
        "fixture":"Everton v West Ham United",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a HW, The Toffees have won the last 3 PL games in a row at Goodison against the Hammers and undefeated in 8",
        "round":12,
        "fixutreDate":"2014-11-22T15:00:00.000Z",
        "kickOff":"2014-11-22T15:00:00.000Z",
        "halfTime":"2014-11-22T15:45:00.000Z",
        "fullTime":"2014-11-22T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Watford",
        "fixture":"Leicester City v Watford",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Party like it's 1999? That's when these 2 sides last met in the Premier League in Leicester. The Foxes would surely want to as they bagged a HW",
        "round":12,
        "fixutreDate":"2014-11-22T15:00:00.000Z",
        "kickOff":"2014-11-22T15:00:00.000Z",
        "halfTime":"2014-11-22T15:45:00.000Z",
        "fullTime":"2014-11-22T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Swansea City",
        "fixture":"Liverpool v Swansea City",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a HW, Liverpool are undefeated against Swansea at Anfield and have won the last 3 PL games when the Swans have visited",
        "round":12,
        "fixutreDate":"2014-11-22T15:00:00.000Z",
        "kickOff":"2014-11-22T15:00:00.000Z",
        "halfTime":"2014-11-22T15:45:00.000Z",
        "fullTime":"2014-11-22T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Manchester United v Tottenham Hotspur",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, Back on track? Manchester United beat Spurs last seasons, but  Tottenham had won on their two previous visits to that",
        "round":12,
        "fixutreDate":"2014-11-22T15:00:00.000Z",
        "kickOff":"2014-11-22T15:00:00.000Z",
        "halfTime":"2014-11-22T15:45:00.000Z",
        "fullTime":"2014-11-22T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Southampton",
        "fixture":"Norwich City v Southampton",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"Norwich won the last PL game the 2 played at Carrow Road and are undefeated in 4 when the Saints visit",
        "round":12,
        "fixutreDate":"2014-11-22T15:00:00.000Z",
        "kickOff":"2014-11-22T15:00:00.000Z",
        "halfTime":"2014-11-22T15:45:00.000Z",
        "fullTime":"2014-11-22T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Bournemouth",
        "fixture":"Sunderland v Bournemouth",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":12,
        "fixutreDate":"2014-11-22T15:00:00.000Z",
        "kickOff":"2014-11-22T15:00:00.000Z",
        "halfTime":"2014-11-22T15:45:00.000Z",
        "fullTime":"2014-11-22T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Aston Villa",
        "fixture":"Bournemouth v Aston Villa",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":13,
        "fixutreDate":"2014-11-29T15:00:00.000Z",
        "kickOff":"2014-11-29T15:00:00.000Z",
        "halfTime":"2014-11-29T15:45:00.000Z",
        "fullTime":"2014-11-29T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Sunderland",
        "fixture":"Manchester City v Sunderland",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, Pattern? Over the past 4 years, when there has been a draw in this fixture, the following season City have come out on top. It was a City Win last season, so will this trend continue?...",
        "round":13,
        "fixutreDate":"2014-11-29T15:00:00.000Z",
        "kickOff":"2014-11-29T15:00:00.000Z",
        "halfTime":"2014-11-29T15:45:00.000Z",
        "fullTime":"2014-11-29T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Leicester City",
        "fixture":"Newcastle United v Leicester City",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a HW, History favours the Home side and last season wasn't any different. Leicester haven't won away to the Magpies since the turn of the millennium",
        "round":13,
        "fixutreDate":"2014-11-29T15:00:00.000Z",
        "kickOff":"2014-11-29T15:00:00.000Z",
        "halfTime":"2014-11-29T15:45:00.000Z",
        "fullTime":"2014-11-29T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Liverpool",
        "fixture":"Southampton v Liverpool",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a AW, The past 2 seasons have been Liverpool's in the PL. Can they make it 3?",
        "round":13,
        "fixutreDate":"2014-11-29T15:00:00.000Z",
        "kickOff":"2014-11-29T15:00:00.000Z",
        "halfTime":"2014-11-29T15:45:00.000Z",
        "fullTime":"2014-11-29T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Manchester United",
        "fixture":"Stoke City v Manchester United",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a D, A fixture that United seemed to always win, is now a toughie. Away side last won in 2013, since when Stoke have bagged their first home win over the Red Devils",
        "round":13,
        "fixutreDate":"2014-11-29T15:00:00.000Z",
        "kickOff":"2014-11-29T15:00:00.000Z",
        "halfTime":"2014-11-29T15:45:00.000Z",
        "fullTime":"2014-11-29T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Chelsea",
        "fixture":"Swansea City v Chelsea",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a AW, Easy travelling! Chelsea have won on their last 2 visits to Swansea and are undefeated against the Swans in the PL",
        "round":13,
        "fixutreDate":"2014-11-29T15:00:00.000Z",
        "kickOff":"2014-11-29T15:00:00.000Z",
        "halfTime":"2014-11-29T15:45:00.000Z",
        "fullTime":"2014-11-29T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Crystal Palace",
        "fixture":"Tottenham Hotspur v Crystal Palace",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a D, In the 6 PL games between the 2 teams, there's been only 1 HW and 1 AW - the rest have been drawn, including last seasons game",
        "round":13,
        "fixutreDate":"2014-11-29T15:00:00.000Z",
        "kickOff":"2014-11-29T15:00:00.000Z",
        "halfTime":"2014-11-29T15:45:00.000Z",
        "fullTime":"2014-11-29T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Everton",
        "fixture":"Watford v Everton",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"Teams have only face each other twice at Vicarage Road in the Premier League - back in 1999 and 2007, with the Away side Everton winning on both occasions",
        "round":13,
        "fixutreDate":"2014-11-29T15:00:00.000Z",
        "kickOff":"2014-11-29T15:00:00.000Z",
        "halfTime":"2014-11-29T15:45:00.000Z",
        "fullTime":"2014-11-29T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Arsenal",
        "fixture":"West Bromwich Albion v Arsenal",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a AW, Arsenal are unbeaten in 6 against the Baggies at the Hawthorns, with 4 Aws in the process",
        "round":13,
        "fixutreDate":"2014-11-29T15:00:00.000Z",
        "kickOff":"2014-11-29T15:00:00.000Z",
        "halfTime":"2014-11-29T15:45:00.000Z",
        "fullTime":"2014-11-29T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Norwich City",
        "fixture":"West Ham United v Norwich City",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"West Ham are undefeated in the Premier League at home against the Canaries and have won the last 2 times Norwich have visited in the PL",
        "round":13,
        "fixutreDate":"2014-11-29T15:00:00.000Z",
        "kickOff":"2014-11-29T15:00:00.000Z",
        "halfTime":"2014-11-29T15:45:00.000Z",
        "fullTime":"2014-11-29T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Stoke City",
        "fixture":"Arsenal v Stoke City",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a HW, 100%! Stonewall home win you'd think as it's been 7 home games against the Potters and 7 home wins for Arsenal. Can Stoke cause an upset though?",
        "round":14,
        "fixutreDate":"2014-12-02T19:45:00.000Z",
        "kickOff":"2014-12-02T19:45:00.000Z",
        "halfTime":"2014-12-02T20:30:00.000Z",
        "fullTime":"2014-12-02T21:30:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Norwich City",
        "fixture":"Bournemouth v Norwich City",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":14,
        "fixutreDate":"2014-12-02T19:45:00.000Z",
        "kickOff":"2014-12-02T19:45:00.000Z",
        "halfTime":"2014-12-02T20:30:00.000Z",
        "fullTime":"2014-12-02T21:30:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Aston Villa",
        "fixture":"Crystal Palace v Aston Villa",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a AW, It's 1 a piece. 1 HW and 1 AW when the 2 teams have met at the home of the Eagles in the PL. Draw this season to complete the set of results?",
        "round":14,
        "fixutreDate":"2014-12-02T20:00:00.000Z",
        "kickOff":"2014-12-02T20:00:00.000Z",
        "halfTime":"2014-12-02T20:45:00.000Z",
        "fullTime":"2014-12-02T21:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Manchester City",
        "fixture":"Liverpool v Manchester City",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a HW, Man City have only ever won once at Anfield in the PL - back in 2003! A few draws in recent years; but Liverpool have won for the last two seasons when the teams have met at Anfield",
        "round":14,
        "fixutreDate":"2014-12-02T19:45:00.000Z",
        "kickOff":"2014-12-02T19:45:00.000Z",
        "halfTime":"2014-12-02T20:30:00.000Z",
        "fullTime":"2014-12-02T21:30:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Sunderland",
        "fixture":"Newcastle United v Sunderland",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a AW, Tyne-wear derby and it's not been a fond one for the Magpies. For the past 3 seasons the visitors have taken away all 3 pts. The Toon fans won't want it to be 4 season in a row!",
        "round":14,
        "fixutreDate":"2014-12-02T19:45:00.000Z",
        "kickOff":"2014-12-02T19:45:00.000Z",
        "halfTime":"2014-12-02T20:30:00.000Z",
        "fullTime":"2014-12-02T21:30:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Southampton",
        "fixture":"Tottenham Hotspur v Southampton",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a HW, Home sweet home! Spurs are unbeaten in past 6 seasons the 2 teams have met at White Hart Lane, winning 5, including the last 4",
        "round":14,
        "fixutreDate":"2014-12-02T19:45:00.000Z",
        "kickOff":"2014-12-02T19:45:00.000Z",
        "halfTime":"2014-12-02T20:30:00.000Z",
        "fullTime":"2014-12-02T21:30:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"West Ham United",
        "fixture":"West Bromwich Albion v West Ham United",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a AW, So last 6 season there's been 2 HW, 2 D and 2 AW. West Ham took the win last time, how will it look at the end of this game?",
        "round":14,
        "fixutreDate":"2014-12-02T20:00:00.000Z",
        "kickOff":"2014-12-02T20:00:00.000Z",
        "halfTime":"2014-12-02T20:45:00.000Z",
        "fullTime":"2014-12-02T21:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Watford",
        "fixture":"Chelsea v Watford",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Teams have only face each other twice at Stamford Bridge in the Premier League - back in 2000 and 2006, with the home side Chelsea winning on both occasions",
        "round":14,
        "fixutreDate":"2014-12-02T19:45:00.000Z",
        "kickOff":"2014-12-02T19:45:00.000Z",
        "halfTime":"2014-12-02T20:30:00.000Z",
        "fullTime":"2014-12-02T21:30:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Leicester City",
        "fixture":"Everton v Leicester City",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a D, Of the 9 games these 2 teams have played in the PL, on only 2 occasions has there been a victor. On both of these occasions it's been the home side, but the last time was back in 2003!",
        "round":14,
        "fixutreDate":"2014-12-02T19:45:00.000Z",
        "kickOff":"2014-12-02T19:45:00.000Z",
        "halfTime":"2014-12-02T20:30:00.000Z",
        "fullTime":"2014-12-02T21:30:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Manchester United",
        "fixture":"Swansea City v Manchester United",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a HW, Swansea did the double over United last season. Can they keep up this winning run?",
        "round":14,
        "fixutreDate":"2014-12-02T19:45:00.000Z",
        "kickOff":"2014-12-02T19:45:00.000Z",
        "halfTime":"2014-12-02T20:30:00.000Z",
        "fullTime":"2014-12-02T21:30:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Liverpool",
        "fixture":"Aston Villa v Liverpool",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a AW, Liverpool seem to like travelling to Villa Park. 4 wins in a row in the PL at the home of Aston Villa. Can the make it 5?",
        "round":15,
        "fixutreDate":"2014-12-06T15:00:00.000Z",
        "kickOff":"2014-12-06T15:00:00.000Z",
        "halfTime":"2014-12-06T15:45:00.000Z",
        "fullTime":"2014-12-06T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Leicester City v West Bromwich Albion",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a AW, Last season was the first time the 2 teams have played each other in Premier League - with WBA coming out on top",
        "round":15,
        "fixutreDate":"2014-12-06T15:00:00.000Z",
        "kickOff":"2014-12-06T15:00:00.000Z",
        "halfTime":"2014-12-06T15:45:00.000Z",
        "fullTime":"2014-12-06T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Swansea City",
        "fixture":"Manchester City v Swansea City",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, All City! Manchester City that is. 4 PL home games against the Swans, 4 wins!",
        "round":15,
        "fixutreDate":"2014-12-06T15:00:00.000Z",
        "kickOff":"2014-12-06T15:00:00.000Z",
        "halfTime":"2014-12-06T15:45:00.000Z",
        "fullTime":"2014-12-06T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Everton",
        "fixture":"Manchester United v Everton",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, United have won 4 of the last 6 PL home games against the Toffees",
        "round":15,
        "fixutreDate":"2014-12-06T15:00:00.000Z",
        "kickOff":"2014-12-06T15:00:00.000Z",
        "halfTime":"2014-12-06T15:45:00.000Z",
        "fullTime":"2014-12-06T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Chelsea",
        "fixture":"Norwich City v Chelsea",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"The Canaries find it tough going getting any home joy when Chelsea stop by. The South London team winning the last 2 PL visits to Carrow Road",
        "round":15,
        "fixutreDate":"2014-12-06T15:00:00.000Z",
        "kickOff":"2014-12-06T15:00:00.000Z",
        "halfTime":"2014-12-06T15:45:00.000Z",
        "fullTime":"2014-12-06T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Bournemouth",
        "fixture":"Southampton v Bournemouth",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":15,
        "fixutreDate":"2014-12-06T15:00:00.000Z",
        "kickOff":"2014-12-06T15:00:00.000Z",
        "halfTime":"2014-12-06T15:45:00.000Z",
        "fullTime":"2014-12-06T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Newcastle United",
        "fixture":"Stoke City v Newcastle United",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a HW, Oh Britannia! Stoke have won 4 out of 6, including the last 3, home games against the Magpies",
        "round":15,
        "fixutreDate":"2014-12-06T15:00:00.000Z",
        "kickOff":"2014-12-06T15:00:00.000Z",
        "halfTime":"2014-12-06T15:45:00.000Z",
        "fullTime":"2014-12-06T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Arsenal",
        "fixture":"Sunderland v Arsenal",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a AW, No stopping the Gunners? Arsenal have won 4 in a row at the Stadium of Light in the PL",
        "round":15,
        "fixutreDate":"2014-12-06T15:00:00.000Z",
        "kickOff":"2014-12-06T15:00:00.000Z",
        "halfTime":"2014-12-06T15:45:00.000Z",
        "fullTime":"2014-12-06T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Crystal Palace",
        "fixture":"Watford v Crystal Palace",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The two teams have never faced each other in the English top flight. Who will claim the first win? Or will it be honours even?",
        "round":15,
        "fixutreDate":"2014-12-06T15:00:00.000Z",
        "kickOff":"2014-12-06T15:00:00.000Z",
        "halfTime":"2014-12-06T15:45:00.000Z",
        "fullTime":"2014-12-06T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"West Ham United v Tottenham Hotspur",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a AW, Taking it in turns? Whenever one team wins this fixture at the home of the Hammers, the following season the other team takes the victory. Last season Spurs won, so will the pattern continue and West Ham claim the win?",
        "round":15,
        "fixutreDate":"2014-12-06T15:00:00.000Z",
        "kickOff":"2014-12-06T15:00:00.000Z",
        "halfTime":"2014-12-06T15:45:00.000Z",
        "fullTime":"2014-12-06T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Norwich City",
        "fixture":"Arsenal v Norwich City",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Norwich have one against the Gunners once before - but that was back when the PL started in 1992. Since then it's been all Arsenal, including winning the last 2 games in the PL when the Canneries have visited",
        "round":16,
        "fixutreDate":"2014-12-13T15:00:00.000Z",
        "kickOff":"2014-12-13T15:00:00.000Z",
        "halfTime":"2014-12-13T15:45:00.000Z",
        "fullTime":"2014-12-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Stoke City",
        "fixture":"Bournemouth v Stoke City",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":16,
        "fixutreDate":"2014-12-13T15:00:00.000Z",
        "kickOff":"2014-12-13T15:00:00.000Z",
        "halfTime":"2014-12-13T15:45:00.000Z",
        "fullTime":"2014-12-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Leicester City",
        "fixture":"Chelsea v Leicester City",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, Leicester have a solitary victory on their travels to Chelsea - back in 2000. But since then, on the 3 occasions the 2 teams have met in the PL at Stamford Bridge it's been HWs for Chelsea",
        "round":16,
        "fixutreDate":"2014-12-13T15:00:00.000Z",
        "kickOff":"2014-12-13T15:00:00.000Z",
        "halfTime":"2014-12-13T15:45:00.000Z",
        "fullTime":"2014-12-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Sunderland",
        "fixture":"Crystal Palace v Sunderland",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a AW, It's 1 a piece. 1 HW and 1 AW when the 2 teams have met at the home of the Eagles in the PL. Draw this season to complete the set of results?",
        "round":16,
        "fixutreDate":"2014-12-13T15:00:00.000Z",
        "kickOff":"2014-12-13T15:00:00.000Z",
        "halfTime":"2014-12-13T15:45:00.000Z",
        "fullTime":"2014-12-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Southampton",
        "fixture":"Everton v Southampton",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a HW, Everton are unbeaten in 10 games and have beaten the Saints for the past 4 seasons in a row at the Goodison",
        "round":16,
        "fixutreDate":"2014-12-13T15:00:00.000Z",
        "kickOff":"2014-12-13T15:00:00.000Z",
        "halfTime":"2014-12-13T15:45:00.000Z",
        "fullTime":"2014-12-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Manchester United",
        "fixture":"Liverpool v Manchester United",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a AW, United have enjoyed some good form in the PL at Anfield 2 away wins on their last 3 visits to the red side of Merseyside",
        "round":16,
        "fixutreDate":"2014-12-13T15:00:00.000Z",
        "kickOff":"2014-12-13T15:00:00.000Z",
        "halfTime":"2014-12-13T15:45:00.000Z",
        "fullTime":"2014-12-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Manchester City",
        "fixture":"Newcastle United v Manchester City",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a AW, Fun away day! Man City have won 7 out of the last 8 PL games in Newcastle, including last year",
        "round":16,
        "fixutreDate":"2014-12-13T15:00:00.000Z",
        "kickOff":"2014-12-13T15:00:00.000Z",
        "halfTime":"2014-12-13T15:45:00.000Z",
        "fullTime":"2014-12-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"West Ham United",
        "fixture":"Swansea City v West Ham United",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a D, Evens! It's been a draw between the 2 teams in the last 2 seasons at the Liberty Stadium. In the only other game Swansea came out on top",
        "round":16,
        "fixutreDate":"2014-12-13T15:00:00.000Z",
        "kickOff":"2014-12-13T15:00:00.000Z",
        "halfTime":"2014-12-13T15:45:00.000Z",
        "fullTime":"2014-12-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Watford",
        "fixture":"Tottenham Hotspur v Watford",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"The 2 times the these 2 teams have met at White Hart Lane have ended in convincing HWs for Spurs",
        "round":16,
        "fixutreDate":"2014-12-13T15:00:00.000Z",
        "kickOff":"2014-12-13T15:00:00.000Z",
        "halfTime":"2014-12-13T15:45:00.000Z",
        "fullTime":"2014-12-13T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Aston Villa",
        "fixture":"West Bromwich Albion v Aston Villa",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a HW, In the past 5 seasons, there's been 3 draws between the 2 teams, with home team WBA winning 2, including last season",
        "round":16,
        "fixutreDate":"2014-12-13T15:00:00.000Z",
        "kickOff":"2014-12-13T15:00:00.000Z",
        "halfTime":"2014-12-13T15:45:00.000Z",
        "fullTime":"2014-12-13T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Newcastle United",
        "fixture":"Aston Villa v Newcastle United",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a D, Newcastle are undefeated in 4 seasons on their travels to Villa park, winning 2",
        "round":17,
        "fixutreDate":"2014-12-20T15:00:00.000Z",
        "kickOff":"2014-12-20T15:00:00.000Z",
        "halfTime":"2014-12-20T15:45:00.000Z",
        "fullTime":"2014-12-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Leicester City v Tottenham Hotspur",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a AW, Leicester did use to have a decent home record against Spurs, but have lost the last 2 PL home games when Tottenham have visited",
        "round":17,
        "fixutreDate":"2014-12-20T15:00:00.000Z",
        "kickOff":"2014-12-20T15:00:00.000Z",
        "halfTime":"2014-12-20T15:45:00.000Z",
        "fullTime":"2014-12-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Arsenal",
        "fixture":"Manchester City v Arsenal",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a AW, In the last 6 seasons, City have won 3 and the Gunners have come away with all 3 points on 2 occasions, including last year",
        "round":17,
        "fixutreDate":"2014-12-20T15:00:00.000Z",
        "kickOff":"2014-12-20T15:00:00.000Z",
        "halfTime":"2014-12-20T15:45:00.000Z",
        "fullTime":"2014-12-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Crystal Palace",
        "fixture":"Manchester United v Crystal Palace",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, 100%! United have won all 6 PL games against the Eagles at Old Trafford",
        "round":17,
        "fixutreDate":"2014-12-20T15:00:00.000Z",
        "kickOff":"2014-12-20T15:00:00.000Z",
        "halfTime":"2014-12-20T15:45:00.000Z",
        "fullTime":"2014-12-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Swansea City",
        "fixture":"Norwich City v Swansea City",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"Evens! It's been a draw between the 2 teams in the last 2 seasons at Carrow Road. In the only other game home side Swansea came out on top",
        "round":17,
        "fixutreDate":"2014-12-20T15:00:00.000Z",
        "kickOff":"2014-12-20T15:00:00.000Z",
        "halfTime":"2014-12-20T15:45:00.000Z",
        "fullTime":"2014-12-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Southampton v West Bromwich Albion",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a D, For last three season there's been 1 HW, 1 D and 1 AW. It was a draw the last time the 2 teams met at St Mary's",
        "round":17,
        "fixutreDate":"2014-12-20T15:00:00.000Z",
        "kickOff":"2014-12-20T15:00:00.000Z",
        "halfTime":"2014-12-20T15:45:00.000Z",
        "fullTime":"2014-12-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Everton",
        "fixture":"Stoke City v Everton",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a HW, It's a even contest with 4 draws in 7 games between the 2 in the Premier League and Stoke are undefeated in 6",
        "round":17,
        "fixutreDate":"2014-12-20T15:00:00.000Z",
        "kickOff":"2014-12-20T15:00:00.000Z",
        "halfTime":"2014-12-20T15:45:00.000Z",
        "fullTime":"2014-12-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Chelsea",
        "fixture":"Sunderland v Chelsea",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a D, Dominant! Chelsea have won 9 or their last 10 games at Stadium of Lights. But Last season Sunderland did manage a hold onto a point!",
        "round":17,
        "fixutreDate":"2014-12-20T15:00:00.000Z",
        "kickOff":"2014-12-20T15:00:00.000Z",
        "halfTime":"2014-12-20T15:45:00.000Z",
        "fullTime":"2014-12-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Bournemouth",
        "fixture":"Watford v Bournemouth",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":17,
        "fixutreDate":"2014-12-20T15:00:00.000Z",
        "kickOff":"2014-12-20T15:00:00.000Z",
        "halfTime":"2014-12-20T15:45:00.000Z",
        "fullTime":"2014-12-20T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Liverpool",
        "fixture":"West Ham United v Liverpool",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a HW, Here's a pattern - over the past 7 seasons, when West Ham have beaten Liverpool when playing at home the following 2 season Liverpool have won. West Ham won last season, so will the trend continue…?",
        "round":17,
        "fixutreDate":"2014-12-20T15:00:00.000Z",
        "kickOff":"2014-12-20T15:00:00.000Z",
        "halfTime":"2014-12-20T15:45:00.000Z",
        "fullTime":"2014-12-20T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Southampton",
        "fixture":"Arsenal v Southampton",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a HW, No place like home! Arsenal are undefeated at home against Southampton in the PL. The Gunners have also won the last 3 PL games against the Saints at the Emirates",
        "round":18,
        "fixutreDate":"2014-12-26T15:00:00.000Z",
        "kickOff":"2014-12-26T15:00:00.000Z",
        "halfTime":"2014-12-26T15:45:00.000Z",
        "fullTime":"2014-12-26T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Manchester City",
        "fixture":"Bournemouth v Manchester City",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":18,
        "fixutreDate":"2014-12-26T15:00:00.000Z",
        "kickOff":"2014-12-26T15:00:00.000Z",
        "halfTime":"2014-12-26T15:45:00.000Z",
        "fullTime":"2014-12-26T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"West Ham United",
        "fixture":"Chelsea v West Ham United",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, Chelsea are undefeated in 9 games at home against the Hammers in the PL, winning 7 in the process - including last years HW",
        "round":18,
        "fixutreDate":"2014-12-26T15:00:00.000Z",
        "kickOff":"2014-12-26T15:00:00.000Z",
        "halfTime":"2014-12-26T15:45:00.000Z",
        "fullTime":"2014-12-26T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Stoke City",
        "fixture":"Crystal Palace v Stoke City",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a D, The 2 times the these 2 teams have met at Selhurst Park Crystal Palace have grab a win and the draw last season. Can Stoke get an AW to make it a full set of results for this fixture?",
        "round":18,
        "fixutreDate":"2014-12-26T15:00:00.000Z",
        "kickOff":"2014-12-26T15:00:00.000Z",
        "halfTime":"2014-12-26T15:45:00.000Z",
        "fullTime":"2014-12-26T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Sunderland",
        "fixture":"Everton v Sunderland",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a AW, Don't be fooled. While Everton have won 4 of the last 6 games at Goodison Park in the Premier League; the Black Cats have for the last 2 seasons",
        "round":18,
        "fixutreDate":"2014-12-26T15:00:00.000Z",
        "kickOff":"2014-12-26T15:00:00.000Z",
        "halfTime":"2014-12-26T15:45:00.000Z",
        "fullTime":"2014-12-26T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Watford",
        "fixture":"Liverpool v Watford",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Back in 1999 Watford scored a famous AW. But the only other time the 2 teams faced off in the PL at Anfield finished in a comfortable HW for Liverpool back in 2006",
        "round":18,
        "fixutreDate":"2014-12-26T15:00:00.000Z",
        "kickOff":"2014-12-26T15:00:00.000Z",
        "halfTime":"2014-12-26T15:45:00.000Z",
        "fullTime":"2014-12-26T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Norwich City",
        "fixture":"Newcastle United v Norwich City",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Home comforts! The Magpies have never been beaten by the Canneries at St James' Park; with Newcastle winning this game for the last 3 seasons",
        "round":18,
        "fixutreDate":"2014-12-26T15:00:00.000Z",
        "kickOff":"2014-12-26T15:00:00.000Z",
        "halfTime":"2014-12-26T15:45:00.000Z",
        "fullTime":"2014-12-26T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Leicester City",
        "fixture":"Swansea City v Leicester City",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a HW, Last season was the first time the 2 teams have played each other in Premier League - with the Swans coming out on top at Home",
        "round":18,
        "fixutreDate":"2014-12-26T15:00:00.000Z",
        "kickOff":"2014-12-26T15:00:00.000Z",
        "halfTime":"2014-12-26T15:45:00.000Z",
        "fullTime":"2014-12-26T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Aston Villa",
        "fixture":"Tottenham Hotspur v Aston Villa",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a AW, Tottenham had won 5 in a row against Villa at White Hart Lane, before Aston Villa won away last season. Can Spurs set the record straight this season?",
        "round":18,
        "fixutreDate":"2014-12-26T15:00:00.000Z",
        "kickOff":"2014-12-26T15:00:00.000Z",
        "halfTime":"2014-12-26T15:45:00.000Z",
        "fullTime":"2014-12-26T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Manchester United",
        "fixture":"West Bromwich Albion v Manchester United",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a D, United remain unbeaten at the Hawthorns - JUST! Draw last season and who remembers the 5-5 in Sir Alex Ferguson's last game as United manager?",
        "round":18,
        "fixutreDate":"2014-12-26T15:00:00.000Z",
        "kickOff":"2014-12-26T15:00:00.000Z",
        "halfTime":"2014-12-26T15:45:00.000Z",
        "fullTime":"2014-12-26T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Swansea City",
        "fixture":"Aston Villa v Swansea City",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a AW, Swansea have won 2 of the 4 PL games they have played at Villa Park, including last seasons AW",
        "round":19,
        "fixutreDate":"2014-12-28T15:00:00.000Z",
        "kickOff":"2014-12-28T15:00:00.000Z",
        "halfTime":"2014-12-28T15:45:00.000Z",
        "fullTime":"2014-12-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Liverpool",
        "fixture":"Leicester City v Liverpool",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a AW, The last 6 PL games these 2 teams have played at the home of the Foxes there's been 2 HW, 2 D and 2 AW. Liverpool took the win last time, how will it look at the end of this game?",
        "round":19,
        "fixutreDate":"2014-12-28T15:00:00.000Z",
        "kickOff":"2014-12-28T15:00:00.000Z",
        "halfTime":"2014-12-28T15:45:00.000Z",
        "fullTime":"2014-12-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Manchester City v Tottenham Hotspur",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, Blue Moon! City have won the last 5 PL games against Spurs at the Etihad - convincingly too!",
        "round":19,
        "fixutreDate":"2014-12-28T15:00:00.000Z",
        "kickOff":"2014-12-28T15:00:00.000Z",
        "halfTime":"2014-12-28T15:45:00.000Z",
        "fullTime":"2014-12-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Bournemouth",
        "fixture":"Manchester United v Bournemouth",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":19,
        "fixutreDate":"2014-12-28T15:00:00.000Z",
        "kickOff":"2014-12-28T15:00:00.000Z",
        "halfTime":"2014-12-28T15:45:00.000Z",
        "fullTime":"2014-12-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Everton",
        "fixture":"Norwich City v Everton",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"Trend? When there has been a draw between the teams at Carrow Road, the following season one team has bagged a win. It was a draw the last time the 2 met, so will there be a winner this season?",
        "round":19,
        "fixutreDate":"2014-12-28T15:00:00.000Z",
        "kickOff":"2014-12-28T15:00:00.000Z",
        "halfTime":"2014-12-28T15:45:00.000Z",
        "fullTime":"2014-12-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Crystal Palace",
        "fixture":"Southampton v Crystal Palace",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a HW, The Saints are undefeated in 6 games at home against Palace in the PL, winning 5 in the process - including last years HW",
        "round":19,
        "fixutreDate":"2014-12-28T15:00:00.000Z",
        "kickOff":"2014-12-28T15:00:00.000Z",
        "halfTime":"2014-12-28T15:45:00.000Z",
        "fullTime":"2014-12-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Chelsea",
        "fixture":"Stoke City v Chelsea",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a AW, A Stoke HW is snadwiched between Chelsea AWs in the PL at the Britannia, with the South London claiming victory last season",
        "round":19,
        "fixutreDate":"2014-12-28T15:00:00.000Z",
        "kickOff":"2014-12-28T15:00:00.000Z",
        "halfTime":"2014-12-28T15:45:00.000Z",
        "fullTime":"2014-12-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Sunderland v West Bromwich Albion",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a D, The last 6 PL games these 2 teams have played at the home of the Black Cats there's been 2 HW, 2 D and 2 AW. It was a draw last season, how will it look at the end of this game?",
        "round":19,
        "fixutreDate":"2014-12-28T15:00:00.000Z",
        "kickOff":"2014-12-28T15:00:00.000Z",
        "halfTime":"2014-12-28T15:45:00.000Z",
        "fullTime":"2014-12-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Newcastle United",
        "fixture":"Watford v Newcastle United",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"Nothing between the 2! The 2 times these 2 teams have met in the PL at Vicarage road have ended in deadlock. Will this season be when a team claims victory?",
        "round":19,
        "fixutreDate":"2014-12-28T15:00:00.000Z",
        "kickOff":"2014-12-28T15:00:00.000Z",
        "halfTime":"2014-12-28T15:45:00.000Z",
        "fullTime":"2014-12-28T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Arsenal",
        "fixture":"West Ham United v Arsenal",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a AW, Arsenal are undefeated in 7 against the hammers and have won 4 in a row away to West Ham",
        "round":19,
        "fixutreDate":"2014-12-28T15:00:00.000Z",
        "kickOff":"2014-12-28T15:00:00.000Z",
        "halfTime":"2014-12-28T15:45:00.000Z",
        "fullTime":"2014-12-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Crystal Palace",
        "fixture":"Aston Villa v Crystal Palace",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a D, Since Palace have been back in the PL, they have 1AW and last seasons draw away to Villa. Can they keep up this form?",
        "round":20,
        "fixutreDate":"2015-01-01T15:00:00.000Z",
        "kickOff":"2015-01-01T15:00:00.000Z",
        "halfTime":"2015-01-01T15:45:00.000Z",
        "fullTime":"2015-01-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Everton",
        "fixture":"Leicester City v Everton",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a D, The last 5 PL games at the home of the Foxes have ended in draws; including last years game",
        "round":20,
        "fixutreDate":"2015-01-01T15:00:00.000Z",
        "kickOff":"2015-01-01T15:00:00.000Z",
        "halfTime":"2015-01-01T15:45:00.000Z",
        "fullTime":"2015-01-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Liverpool",
        "fixture":"Manchester City v Liverpool",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, Blue Moon Rising! Man City have won 4 of their last 6 home PL games against Liverpool, including the last 2",
        "round":20,
        "fixutreDate":"2015-01-01T15:00:00.000Z",
        "kickOff":"2015-01-01T15:00:00.000Z",
        "halfTime":"2015-01-01T15:45:00.000Z",
        "fullTime":"2015-01-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Swansea City",
        "fixture":"Manchester United v Swansea City",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a AW, Swansea did the double over United last season. Can they keep up this winning run?",
        "round":20,
        "fixutreDate":"2015-01-01T15:00:00.000Z",
        "kickOff":"2015-01-01T15:00:00.000Z",
        "halfTime":"2015-01-01T15:45:00.000Z",
        "fullTime":"2015-01-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Bournemouth",
        "fixture":"Norwich City v Bournemouth",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":20,
        "fixutreDate":"2015-01-01T15:00:00.000Z",
        "kickOff":"2015-01-01T15:00:00.000Z",
        "halfTime":"2015-01-01T15:45:00.000Z",
        "fullTime":"2015-01-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Southampton v Tottenham Hotspur",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a D, Tottenham are unbeaten in 3 visits to St Mary's in the PL, winning 2",
        "round":20,
        "fixutreDate":"2015-01-01T15:00:00.000Z",
        "kickOff":"2015-01-01T15:00:00.000Z",
        "halfTime":"2015-01-01T15:45:00.000Z",
        "fullTime":"2015-01-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Arsenal",
        "fixture":"Stoke City v Arsenal",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a HW, Stoke are unbeaten in last 5 season at home against Arsenal; winning 3 in the process, including the last 2",
        "round":20,
        "fixutreDate":"2015-01-01T15:00:00.000Z",
        "kickOff":"2015-01-01T15:00:00.000Z",
        "halfTime":"2015-01-01T15:45:00.000Z",
        "fullTime":"2015-01-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Newcastle United",
        "fixture":"Sunderland v Newcastle United",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a HW, Tyne-wear derby and it's not been a fond one for the Magpies. For the past 2 seasons the home side have taken all 3 pts and done the double over Newcastle",
        "round":20,
        "fixutreDate":"2015-01-01T15:00:00.000Z",
        "kickOff":"2015-01-01T15:00:00.000Z",
        "halfTime":"2015-01-01T15:45:00.000Z",
        "fullTime":"2015-01-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Chelsea",
        "fixture":"Watford v Chelsea",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"It's 1 a piece. 1 HW and 1 AW when the 2 teams have met at Vicarage Road in the PL. Draw this season to complete the set of results? Be tough for the Home side",
        "round":20,
        "fixutreDate":"2015-01-01T15:00:00.000Z",
        "kickOff":"2015-01-01T15:00:00.000Z",
        "halfTime":"2015-01-01T15:45:00.000Z",
        "fullTime":"2015-01-01T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"West Bromwich Albion",
        "fixture":"West Ham United v West Bromwich Albion",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a D, There's been 4 draws in the last 6 games between the 2 teams at the home of the Hammers, including last season",
        "round":20,
        "fixutreDate":"2015-01-01T15:00:00.000Z",
        "kickOff":"2015-01-01T15:00:00.000Z",
        "halfTime":"2015-01-01T15:45:00.000Z",
        "fullTime":"2015-01-01T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Sunderland",
        "fixture":"Arsenal v Sunderland",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a D, Pattern? Over the past 8 years, when Arsenal have won at home, the following season it's been a draw. I was a draw last year, a Gunners win to continue this trend or will Black Cats finally claim an away win against Arsenal?",
        "round":21,
        "fixutreDate":"2015-01-10T15:00:00.000Z",
        "kickOff":"2015-01-10T15:00:00.000Z",
        "halfTime":"2015-01-10T15:45:00.000Z",
        "fullTime":"2015-01-10T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Southampton",
        "fixture":"Bournemouth v Southampton",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":21,
        "fixutreDate":"2015-01-10T15:00:00.000Z",
        "kickOff":"2015-01-10T15:00:00.000Z",
        "halfTime":"2015-01-10T15:45:00.000Z",
        "fullTime":"2015-01-10T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Norwich City",
        "fixture":"Chelsea v Norwich City",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Norwich managed a draw on the last PL visit to Stamford bridge, but Chelsea had beaten the Canneris in the 4 seasons prior to that",
        "round":21,
        "fixutreDate":"2015-01-10T15:00:00.000Z",
        "kickOff":"2015-01-10T15:00:00.000Z",
        "halfTime":"2015-01-10T15:45:00.000Z",
        "fullTime":"2015-01-10T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Watford",
        "fixture":"Crystal Palace v Watford",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"The two teams have never faced each other in the English top flight. Who will claim the first win? Or will it be honours even?",
        "round":21,
        "fixutreDate":"2015-01-10T15:00:00.000Z",
        "kickOff":"2015-01-10T15:00:00.000Z",
        "halfTime":"2015-01-10T15:45:00.000Z",
        "fullTime":"2015-01-10T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Manchester United",
        "fixture":"Everton v Manchester United",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a HW, Everton have won their last 3 home games against United in the PL; with score lines 1-0, 2-0 and last seasons 3-0. Could the Toffees make it 4-0 our will United be able to rediscover their winning form at Goodison?",
        "round":21,
        "fixutreDate":"2015-01-10T15:00:00.000Z",
        "kickOff":"2015-01-10T15:00:00.000Z",
        "halfTime":"2015-01-10T15:45:00.000Z",
        "fullTime":"2015-01-10T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Aston Villa",
        "fixture":"Liverpool v Aston Villa",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a AW, Aston Villia are undefeated in their last 4 visits to Anfield; with 2 AWs and 2 draws",
        "round":21,
        "fixutreDate":"2015-01-10T15:00:00.000Z",
        "kickOff":"2015-01-10T15:00:00.000Z",
        "halfTime":"2015-01-10T15:45:00.000Z",
        "fullTime":"2015-01-10T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Stoke City",
        "fixture":"Newcastle United v Stoke City",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a D, Last seasons draw put a stop to Newcastle run of 3 PL HWs in a row against Stoke",
        "round":21,
        "fixutreDate":"2015-01-10T15:00:00.000Z",
        "kickOff":"2015-01-10T15:00:00.000Z",
        "halfTime":"2015-01-10T15:45:00.000Z",
        "fullTime":"2015-01-10T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Manchester City",
        "fixture":"Swansea City v Manchester City",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a AW, Manchester City have won the last 2 PL games away to Swansea. Can the make it 3?",
        "round":21,
        "fixutreDate":"2015-01-10T15:00:00.000Z",
        "kickOff":"2015-01-10T15:00:00.000Z",
        "halfTime":"2015-01-10T15:45:00.000Z",
        "fullTime":"2015-01-10T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"West Ham United",
        "fixture":"Tottenham Hotspur v West Ham United",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a D, For last three season there's been 1 HW, 1 D and 1 AW. It was a draw last time the 2 teams met at the White Hart Lane",
        "round":21,
        "fixutreDate":"2015-01-10T15:00:00.000Z",
        "kickOff":"2015-01-10T15:00:00.000Z",
        "halfTime":"2015-01-10T15:45:00.000Z",
        "fullTime":"2015-01-10T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Leicester City",
        "fixture":"West Bromwich Albion v Leicester City",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a AW, The only time these 2 team have met in the PL at the Hawthorns, Leicester came out on top",
        "round":21,
        "fixutreDate":"2015-01-10T15:00:00.000Z",
        "kickOff":"2015-01-10T15:00:00.000Z",
        "halfTime":"2015-01-10T15:45:00.000Z",
        "fullTime":"2015-01-10T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Manchester City",
        "fixture":"Aston Villa v Manchester City",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a AW, Mcity have won on 3 of their last 4 visits to Villa Park, including last season",
        "round":22,
        "fixutreDate":"2015-01-17T15:00:00.000Z",
        "kickOff":"2015-01-17T15:00:00.000Z",
        "halfTime":"2015-01-17T15:45:00.000Z",
        "fullTime":"2015-01-17T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Crystal Palace",
        "fixture":"Bournemouth v Crystal Palace",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":22,
        "fixutreDate":"2015-01-17T15:00:00.000Z",
        "kickOff":"2015-01-17T15:00:00.000Z",
        "halfTime":"2015-01-17T15:45:00.000Z",
        "fullTime":"2015-01-17T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Everton v West Bromwich Albion",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a D, Everton are unbeaten on 4 games at the Hawthorns, with 2 AWs and 2 draws on their last to visits to the midlands",
        "round":22,
        "fixutreDate":"2015-01-17T15:00:00.000Z",
        "kickOff":"2015-01-17T15:00:00.000Z",
        "halfTime":"2015-01-17T15:45:00.000Z",
        "fullTime":"2015-01-17T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Sunderland",
        "fixture":"Liverpool v Sunderland",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a D, Liverpool have never loss at home to Sunderland. However, they have drawn 3 of their last 5 PL home games against the Black Cats",
        "round":22,
        "fixutreDate":"2015-01-17T15:00:00.000Z",
        "kickOff":"2015-01-17T15:00:00.000Z",
        "halfTime":"2015-01-17T15:45:00.000Z",
        "fullTime":"2015-01-17T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Arsenal",
        "fixture":"Manchester United v Arsenal",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a D, Last seasons draw put a stop to United 5 game winning run against Arsenal at Old Trafford",
        "round":22,
        "fixutreDate":"2015-01-17T15:00:00.000Z",
        "kickOff":"2015-01-17T15:00:00.000Z",
        "halfTime":"2015-01-17T15:45:00.000Z",
        "fullTime":"2015-01-17T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Stoke City",
        "fixture":"Norwich City v Stoke City",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"In the 3 home games Norwich have faced Stoke, they have never loss, but they have only won once. It was a draw last time the 2 sides met",
        "round":22,
        "fixutreDate":"2015-01-17T15:00:00.000Z",
        "kickOff":"2015-01-17T15:00:00.000Z",
        "halfTime":"2015-01-17T15:45:00.000Z",
        "fullTime":"2015-01-17T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Newcastle United",
        "fixture":"Southampton v Newcastle United",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a HW, The Saints have beaten Newcastle at home for the past 3 seasons",
        "round":22,
        "fixutreDate":"2015-01-17T15:00:00.000Z",
        "kickOff":"2015-01-17T15:00:00.000Z",
        "halfTime":"2015-01-17T15:45:00.000Z",
        "fullTime":"2015-01-17T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Chelsea",
        "fixture":"Tottenham Hotspur v Chelsea",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a HW, A sticky fixture for the Champions. Chelsea have only managed 1 AW from their last 6 PL games at White Hart Lane. There's also been 3 draws and 2 Spurs HWs, including claiming victory last season",
        "round":22,
        "fixutreDate":"2015-01-17T15:00:00.000Z",
        "kickOff":"2015-01-17T15:00:00.000Z",
        "halfTime":"2015-01-17T15:45:00.000Z",
        "fullTime":"2015-01-17T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Swansea City",
        "fixture":"Watford v Swansea City",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The two teams have never faced each other in the English top flight. Who will claim the first win? Or will it be honours even?",
        "round":22,
        "fixutreDate":"2015-01-17T15:00:00.000Z",
        "kickOff":"2015-01-17T15:00:00.000Z",
        "halfTime":"2015-01-17T15:45:00.000Z",
        "fullTime":"2015-01-17T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Leicester City",
        "fixture":"West Ham United v Leicester City",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a HW, The record favours the home side, with 7 wins out of 8 PL games against Leicester, including the HW last season",
        "round":22,
        "fixutreDate":"2015-01-17T15:00:00.000Z",
        "kickOff":"2015-01-17T15:00:00.000Z",
        "halfTime":"2015-01-17T15:45:00.000Z",
        "fullTime":"2015-01-17T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Norwich City",
        "fixture":"Leicester City v Norwich City",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Norwich have only faced Leicester away once in the Premier League - back in 1994 and the Foxes came out on top",
        "round":23,
        "fixutreDate":"2015-01-31T15:00:00.000Z",
        "kickOff":"2015-01-31T15:00:00.000Z",
        "halfTime":"2015-01-31T15:45:00.000Z",
        "fullTime":"2015-01-31T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Everton",
        "fixture":"Crystal Palace v Everton",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a AW, Everton have won on 3 of their last 4 visits to Palace in the PL, including last seasons AW",
        "round":23,
        "fixutreDate":"2015-01-31T15:00:00.000Z",
        "kickOff":"2015-01-31T15:00:00.000Z",
        "halfTime":"2015-01-31T15:45:00.000Z",
        "fullTime":"2015-01-31T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"West Ham United",
        "fixture":"Manchester City v West Ham United",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, The sky's Blue! City are unbeaten in 9 PL games against West Ham and have won in 6 in a row",
        "round":23,
        "fixutreDate":"2015-01-31T15:00:00.000Z",
        "kickOff":"2015-01-31T15:00:00.000Z",
        "halfTime":"2015-01-31T15:45:00.000Z",
        "fullTime":"2015-01-31T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Liverpool",
        "fixture":"Newcastle United v Liverpool",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a HW, Newcastle have won 3 of their last 5 home games against Liverpool in the Premier League, including last years HW",
        "round":23,
        "fixutreDate":"2015-01-31T15:00:00.000Z",
        "kickOff":"2015-01-31T15:00:00.000Z",
        "halfTime":"2015-01-31T15:45:00.000Z",
        "fullTime":"2015-01-31T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Southampton",
        "fixture":"Sunderland v Southampton",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a HW, It's pretty even between the 2 teams in the PL. 1 HW, 1 AW and 2 draws",
        "round":23,
        "fixutreDate":"2015-01-31T15:00:00.000Z",
        "kickOff":"2015-01-31T15:00:00.000Z",
        "halfTime":"2015-01-31T15:45:00.000Z",
        "fullTime":"2015-01-31T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Bournemouth",
        "fixture":"Swansea City v Bournemouth",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":23,
        "fixutreDate":"2015-01-31T15:00:00.000Z",
        "kickOff":"2015-01-31T15:00:00.000Z",
        "halfTime":"2015-01-31T15:45:00.000Z",
        "fullTime":"2015-01-31T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Watford",
        "fixture":"West Bromwich Albion v Watford",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"The two teams have never faced each other in the English top flight. Who will claim the first win? Or will it be honours even?",
        "round":23,
        "fixutreDate":"2015-01-31T15:00:00.000Z",
        "kickOff":"2015-01-31T15:00:00.000Z",
        "halfTime":"2015-01-31T15:45:00.000Z",
        "fullTime":"2015-01-31T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Manchester United",
        "fixture":"Chelsea v Manchester United",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, Capital comfort! Chelsea have won 4 of their last 6 home PL games against United, including the last 2",
        "round":23,
        "fixutreDate":"2015-01-31T15:00:00.000Z",
        "kickOff":"2015-01-31T15:00:00.000Z",
        "halfTime":"2015-01-31T15:45:00.000Z",
        "fullTime":"2015-01-31T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Aston Villa",
        "fixture":"Arsenal v Aston Villa",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a HW, Arsenal have enjoyed 4 home wins in 6 PL games at home against Aston Villa. But Villa have also managed a couple of AWs - in 2011 and 2013",
        "round":23,
        "fixutreDate":"2015-01-31T15:00:00.000Z",
        "kickOff":"2015-01-31T15:00:00.000Z",
        "halfTime":"2015-01-31T15:45:00.000Z",
        "fullTime":"2015-01-31T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Stoke City v Tottenham Hotspur",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a HW, Here's a pattern - over the past 7 seasons, when Stoke have beaten Spurs when playing at home the following 2 season Spurs have won. Stoke won last season, so will the trend continue…?",
        "round":23,
        "fixutreDate":"2015-01-31T15:00:00.000Z",
        "kickOff":"2015-01-31T15:00:00.000Z",
        "halfTime":"2015-01-31T15:45:00.000Z",
        "fullTime":"2015-01-31T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Arsenal",
        "fixture":"Watford v Arsenal",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The 2 teams have only faced each other twice at Vicarage Road in the PL and on both occasion Arsenal bagged AWs ",
        "round":24,
        "fixutreDate":"2015-02-07T15:00:00.000Z",
        "kickOff":"2015-02-07T15:00:00.000Z",
        "halfTime":"2015-02-07T15:45:00.000Z",
        "fullTime":"2015-02-07T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Chelsea",
        "fixture":"Aston Villa v Chelsea",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a AW, Chelsea enjoy their travels to Aston Villa, with 3 PL AWs in the last 4 PL games between the to at Villa Park",
        "round":24,
        "fixutreDate":"2015-02-07T15:00:00.000Z",
        "kickOff":"2015-02-07T15:00:00.000Z",
        "halfTime":"2015-02-07T15:45:00.000Z",
        "fullTime":"2015-02-07T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Crystal Palace",
        "fixture":"Liverpool v Crystal Palace",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a AW, Crystal Palace's AW last season was their first ever in the PL. It had been all Liverpool before that",
        "round":24,
        "fixutreDate":"2015-02-07T15:00:00.000Z",
        "kickOff":"2015-02-07T15:00:00.000Z",
        "halfTime":"2015-02-07T15:45:00.000Z",
        "fullTime":"2015-02-07T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Leicester City",
        "fixture":"Manchester United v Leicester City",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, United are undefeated in 6 PL games against Leicester at Old Trafford, winning the last 5 in a row",
        "round":24,
        "fixutreDate":"2015-02-07T15:00:00.000Z",
        "kickOff":"2015-02-07T15:00:00.000Z",
        "halfTime":"2015-02-07T15:45:00.000Z",
        "fullTime":"2015-02-07T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Stoke City",
        "fixture":"Southampton v Stoke City",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a HW, Last seasons HW for the Saints was the first time a team has won this fixture at St Mary's in the PL. It was 2 draws before that",
        "round":24,
        "fixutreDate":"2015-02-07T15:00:00.000Z",
        "kickOff":"2015-02-07T15:00:00.000Z",
        "halfTime":"2015-02-07T15:45:00.000Z",
        "fullTime":"2015-02-07T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Swansea City",
        "fixture":"Tottenham Hotspur v Swansea City",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a HW, 4 home games against Swansea in the PL, 4 home wins fo Tottenham",
        "round":24,
        "fixutreDate":"2015-02-07T15:00:00.000Z",
        "kickOff":"2015-02-07T15:00:00.000Z",
        "halfTime":"2015-02-07T15:45:00.000Z",
        "fullTime":"2015-02-07T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Manchester City",
        "fixture":"Everton v Manchester City",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a D, Everton have won 4 of the last 6 home PL games against City; but have not won for the past 2 seasons now",
        "round":24,
        "fixutreDate":"2015-02-07T15:00:00.000Z",
        "kickOff":"2015-02-07T15:00:00.000Z",
        "halfTime":"2015-02-07T15:45:00.000Z",
        "fullTime":"2015-02-07T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Bournemouth v West Bromwich Albion",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":24,
        "fixutreDate":"2015-02-07T15:00:00.000Z",
        "kickOff":"2015-02-07T15:00:00.000Z",
        "halfTime":"2015-02-07T15:45:00.000Z",
        "fullTime":"2015-02-07T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Sunderland",
        "fixture":"Norwich City v Sunderland",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"3 previous PL games between the 2 teams at Vicarage Road, with all 3 ending in home wins for Norwich",
        "round":24,
        "fixutreDate":"2015-02-07T15:00:00.000Z",
        "kickOff":"2015-02-07T15:00:00.000Z",
        "halfTime":"2015-02-07T15:45:00.000Z",
        "fullTime":"2015-02-07T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Newcastle United",
        "fixture":"West Ham United v Newcastle United",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a HW, The last 6 PL games these 2 teams have played at the home of the Hammers there's been 2 HW, 2 D and 2 AW. West Ham took the win last time, how will it look at the end of this game?",
        "round":24,
        "fixutreDate":"2015-02-07T15:00:00.000Z",
        "kickOff":"2015-02-07T15:00:00.000Z",
        "halfTime":"2015-02-07T15:45:00.000Z",
        "fullTime":"2015-02-07T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Liverpool",
        "fixture":"Arsenal v Liverpool",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a HW, Arsenal haven't lost to Liverpool at home for the past 3 season, winning comfortably for the last 2 seasons",
        "round":25,
        "fixutreDate":"2015-02-10T19:45:00.000Z",
        "kickOff":"2015-02-10T19:45:00.000Z",
        "halfTime":"2015-02-10T20:30:00.000Z",
        "fullTime":"2015-02-10T21:30:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Aston Villa",
        "fixture":"Leicester City v Aston Villa",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a HW, The first midlands derby for over ten years in the PL was won by the Home side Leicester last. Villa have only ever won once in 9 PL visits to their local rivals",
        "round":25,
        "fixutreDate":"2015-02-10T20:00:00.000Z",
        "kickOff":"2015-02-10T20:00:00.000Z",
        "halfTime":"2015-02-10T20:45:00.000Z",
        "fullTime":"2015-02-10T21:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Southampton",
        "fixture":"Swansea City v Southampton",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a AW, Southampton have never lost on their travels to Swansea in the PL, winning at the Liberty Stadium for the last 2 seasons",
        "round":25,
        "fixutreDate":"2015-02-10T19:45:00.000Z",
        "kickOff":"2015-02-10T19:45:00.000Z",
        "halfTime":"2015-02-10T20:30:00.000Z",
        "fullTime":"2015-02-10T21:30:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Watford",
        "fixture":"Manchester City v Watford",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"2006 was the last and only time Watford have visited Manchester City. They did well and came away with a draw. A lot has changed since then though",
        "round":25,
        "fixutreDate":"2015-02-10T20:00:00.000Z",
        "kickOff":"2015-02-10T20:00:00.000Z",
        "halfTime":"2015-02-10T20:45:00.000Z",
        "fullTime":"2015-02-10T21:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Bournemouth",
        "fixture":"Newcastle United v Bournemouth",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":25,
        "fixutreDate":"2015-02-10T19:45:00.000Z",
        "kickOff":"2015-02-10T19:45:00.000Z",
        "halfTime":"2015-02-10T20:30:00.000Z",
        "fullTime":"2015-02-10T21:30:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"West Ham United",
        "fixture":"Stoke City v West Ham United",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a D, Here's a pattern - when these 2 teams have played at the Britannia for the past 6 season it's been AW, HW,D,HW,AW,D. So after last seasons draw will this season follow the trend and finish in an AW for West Ham?",
        "round":25,
        "fixutreDate":"2015-02-10T19:45:00.000Z",
        "kickOff":"2015-02-10T19:45:00.000Z",
        "halfTime":"2015-02-10T20:30:00.000Z",
        "fullTime":"2015-02-10T21:30:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Everton",
        "fixture":"Chelsea v Everton",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, In the past 4 home games against Everton in the PL, Chelsea have claimed 4 home wins",
        "round":25,
        "fixutreDate":"2015-02-10T20:00:00.000Z",
        "kickOff":"2015-02-10T20:00:00.000Z",
        "halfTime":"2015-02-10T20:45:00.000Z",
        "fullTime":"2015-02-10T21:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Manchester United",
        "fixture":"Sunderland v Manchester United",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a D, United are undefeated in 13 PL games against Sunderland at the Stadium of lights, winning 4 of the last 6",
        "round":25,
        "fixutreDate":"2015-02-10T19:45:00.000Z",
        "kickOff":"2015-02-10T19:45:00.000Z",
        "halfTime":"2015-02-10T20:30:00.000Z",
        "fullTime":"2015-02-10T21:30:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Norwich City",
        "fixture":"Crystal Palace v Norwich City",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Home side Palace have never beaten visitors Norwich in the PL. Last 2 PL games between the 2 at Selhurst Park have been draws",
        "round":25,
        "fixutreDate":"2015-02-10T19:45:00.000Z",
        "kickOff":"2015-02-10T19:45:00.000Z",
        "halfTime":"2015-02-10T20:30:00.000Z",
        "fullTime":"2015-02-10T21:30:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"West Bromwich Albion v Tottenham Hotspur",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a AW, Tottenham haven't lost in 5 visits to the Hawthorns; winning 3, including last season",
        "round":25,
        "fixutreDate":"2015-02-10T19:45:00.000Z",
        "kickOff":"2015-02-10T19:45:00.000Z",
        "halfTime":"2015-02-10T20:30:00.000Z",
        "fullTime":"2015-02-10T21:30:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Sunderland",
        "fixture":"Aston Villa v Sunderland",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a D, Pretty even. In the last 6 PL games between the 2 teams at Villa Park, they've been 4 draws",
        "round":26,
        "fixutreDate":"2015-02-21T15:00:00.000Z",
        "kickOff":"2015-02-21T15:00:00.000Z",
        "halfTime":"2015-02-21T15:45:00.000Z",
        "fullTime":"2015-02-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Bournemouth",
        "fixture":"Chelsea v Bournemouth",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":26,
        "fixutreDate":"2015-02-21T15:00:00.000Z",
        "kickOff":"2015-02-21T15:00:00.000Z",
        "halfTime":"2015-02-21T15:45:00.000Z",
        "fullTime":"2015-02-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Arsenal",
        "fixture":"Crystal Palace v Arsenal",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a AW, Arsenal have never lost on their short trip away to Palace. For their 6 PL games at Selhurst Park, the Gunners have won 4, including the last 2",
        "round":26,
        "fixutreDate":"2015-02-21T15:00:00.000Z",
        "kickOff":"2015-02-21T15:00:00.000Z",
        "halfTime":"2015-02-21T15:45:00.000Z",
        "fullTime":"2015-02-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Southampton",
        "fixture":"Leicester City v Southampton",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a HW, Leicester have a soild PL home record against the Saints, winning 6 of the 9 time Southampton have visited, including last season",
        "round":26,
        "fixutreDate":"2015-02-21T15:00:00.000Z",
        "kickOff":"2015-02-21T15:00:00.000Z",
        "halfTime":"2015-02-21T15:45:00.000Z",
        "fullTime":"2015-02-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Swansea City v West Bromwich Albion",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a HW, Swansea have won 3 of the 4 home PL games they have played against WBA, including last seasons HW",
        "round":26,
        "fixutreDate":"2015-02-21T15:00:00.000Z",
        "kickOff":"2015-02-21T15:00:00.000Z",
        "halfTime":"2015-02-21T15:45:00.000Z",
        "fullTime":"2015-02-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Newcastle United",
        "fixture":"Tottenham Hotspur v Newcastle United",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a AW, Tottenham have won 4 of the last 6 home PL games against Newcastle; but the Magpies have won ontheir past 2 visits",
        "round":26,
        "fixutreDate":"2015-02-21T15:00:00.000Z",
        "kickOff":"2015-02-21T15:00:00.000Z",
        "halfTime":"2015-02-21T15:45:00.000Z",
        "fullTime":"2015-02-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Norwich City",
        "fixture":"Manchester United v Norwich City",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"United are unbeaten at home against Norwich in the PL; winning 6 of the 7 games, including claiming HWs in the last 5 seasons",
        "round":26,
        "fixutreDate":"2015-02-21T15:00:00.000Z",
        "kickOff":"2015-02-21T15:00:00.000Z",
        "halfTime":"2015-02-21T15:45:00.000Z",
        "fullTime":"2015-02-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"West Ham United",
        "fixture":"Watford v West Ham United",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The 2 teams have only faced each other twice at Vicarage Road in the PL.  The home side haven't tasted victory against their visitors",
        "round":26,
        "fixutreDate":"2015-02-21T15:00:00.000Z",
        "kickOff":"2015-02-21T15:00:00.000Z",
        "halfTime":"2015-02-21T15:45:00.000Z",
        "fullTime":"2015-02-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Liverpool",
        "fixture":"Everton v Liverpool",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a D, Tough one to call! It's been draws in the last 3 seasons between the 2 teams in the PL at Goodison Park. ",
        "round":26,
        "fixutreDate":"2015-02-21T15:00:00.000Z",
        "kickOff":"2015-02-21T15:00:00.000Z",
        "halfTime":"2015-02-21T15:45:00.000Z",
        "fullTime":"2015-02-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Manchester City",
        "fixture":"Stoke City v Manchester City",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a AW, Prior to last seasons AW, there had been 5 straight draws between the 2 teams at the Britannia",
        "round":26,
        "fixutreDate":"2015-02-21T15:00:00.000Z",
        "kickOff":"2015-02-21T15:00:00.000Z",
        "halfTime":"2015-02-21T15:45:00.000Z",
        "fullTime":"2015-02-21T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Crystal Palace",
        "fixture":"West Ham United v Crystal Palace",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a AW, Since Palace have been back in the PL, they have won on the 2 occasion they have travelled to West Ham, including last season. Can they keep up this form?",
        "round":27,
        "fixutreDate":"2015-02-28T15:00:00.000Z",
        "kickOff":"2015-02-28T15:00:00.000Z",
        "halfTime":"2015-02-28T15:45:00.000Z",
        "fullTime":"2015-02-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Bournemouth v Tottenham Hotspur",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":27,
        "fixutreDate":"2015-02-28T15:00:00.000Z",
        "kickOff":"2015-02-28T15:00:00.000Z",
        "halfTime":"2015-02-28T15:45:00.000Z",
        "fullTime":"2015-02-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Swansea City",
        "fixture":"Newcastle United v Swansea City",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a AW, Swansea have never lost away to Newcastle, winning on 3 of the 4 visits they have made to St James Park",
        "round":27,
        "fixutreDate":"2015-02-28T15:00:00.000Z",
        "kickOff":"2015-02-28T15:00:00.000Z",
        "halfTime":"2015-02-28T15:45:00.000Z",
        "fullTime":"2015-02-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Aston Villa",
        "fixture":"Norwich City v Aston Villa",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"For last three season there's been 1 HW, 1 D and 1 AW. Villa scored an AW the last time the 2 teams met at the Carrow Road",
        "round":27,
        "fixutreDate":"2015-02-28T15:00:00.000Z",
        "kickOff":"2015-02-28T15:00:00.000Z",
        "halfTime":"2015-02-28T15:45:00.000Z",
        "fullTime":"2015-02-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Leicester City",
        "fixture":"Sunderland v Leicester City",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a D, Trend? When there has been a draw between the teams at the Stadium of Lights, the following season Sunderland have bagged a win. It was a draw the last time the 2 met",
        "round":27,
        "fixutreDate":"2015-02-28T15:00:00.000Z",
        "kickOff":"2015-02-28T15:00:00.000Z",
        "halfTime":"2015-02-28T15:45:00.000Z",
        "fullTime":"2015-02-28T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Stoke City",
        "fixture":"West Bromwich Albion v Stoke City",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a HW, West Brom's home win was the first time they beat Stoke at home in the PL. Before that Stoke had a 100% AW record at the Hawthorns. Can the Baggies bag another win?",
        "round":27,
        "fixutreDate":"2015-02-28T15:00:00.000Z",
        "kickOff":"2015-02-28T15:00:00.000Z",
        "halfTime":"2015-02-28T15:45:00.000Z",
        "fullTime":"2015-02-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Chelsea",
        "fixture":"Liverpool v Chelsea",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a AW, Chelsea have won at Anfield for the last 2 seasons and are unbeaten in 3. Can Liverpool stop this run continuing?",
        "round":27,
        "fixutreDate":"2015-02-28T15:00:00.000Z",
        "kickOff":"2015-02-28T15:00:00.000Z",
        "halfTime":"2015-02-28T15:45:00.000Z",
        "fullTime":"2015-02-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Manchester United",
        "fixture":"Manchester City v Manchester United",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, City have won 3 of the last 5 home games against neighbours United, including last season HW",
        "round":27,
        "fixutreDate":"2015-02-28T15:00:00.000Z",
        "kickOff":"2015-02-28T15:00:00.000Z",
        "halfTime":"2015-02-28T15:45:00.000Z",
        "fullTime":"2015-02-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Everton",
        "fixture":"Arsenal v Everton",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a HW, Arsenal are undefeated against Everton at home for almost 20 years, but there's been plenty of draws recently. Prior to last seasons Arsenal HW, their were 2 draws at the Emirates",
        "round":27,
        "fixutreDate":"2015-02-28T15:00:00.000Z",
        "kickOff":"2015-02-28T15:00:00.000Z",
        "halfTime":"2015-02-28T15:45:00.000Z",
        "fullTime":"2015-02-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Watford",
        "fixture":"Southampton v Watford",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Teams have only played each other once on the South Coast in Premier League history. Back in 2000 - the Saints came out on top",
        "round":27,
        "fixutreDate":"2015-02-28T15:00:00.000Z",
        "kickOff":"2015-02-28T15:00:00.000Z",
        "halfTime":"2015-02-28T15:45:00.000Z",
        "fullTime":"2015-02-28T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Aston Villa v West Bromwich Albion",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a HW, Villa have won 4 of their last 6 home PL games against midland rivals WBA, including the last 2 in a row",
        "round":28,
        "fixutreDate":"2015-03-03T19:45:00.000Z",
        "kickOff":"2015-03-03T19:45:00.000Z",
        "halfTime":"2015-03-03T20:30:00.000Z",
        "fullTime":"2015-03-03T21:30:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Swansea City",
        "fixture":"Leicester City v Swansea City",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a HW, Last season was the first time the 2 teams have played each other in Premier League - with the Foxes coming out on top at Home",
        "round":28,
        "fixutreDate":"2015-03-03T19:45:00.000Z",
        "kickOff":"2015-03-03T19:45:00.000Z",
        "halfTime":"2015-03-03T20:30:00.000Z",
        "fullTime":"2015-03-03T21:30:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Crystal Palace",
        "fixture":"Stoke City v Crystal Palace",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a AW, It's 1 a piece. 1 HW and 1 AW when the 2 teams have at the Britannia in the PL. Draw this season to complete the set of results?",
        "round":28,
        "fixutreDate":"2015-03-03T19:45:00.000Z",
        "kickOff":"2015-03-03T19:45:00.000Z",
        "halfTime":"2015-03-03T20:30:00.000Z",
        "fullTime":"2015-03-03T21:30:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Chelsea",
        "fixture":"West Ham United v Chelsea",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a AW, Chelsea have won 4 out of the last 6 away games, including the last 2 in a row",
        "round":28,
        "fixutreDate":"2015-03-03T19:45:00.000Z",
        "kickOff":"2015-03-03T19:45:00.000Z",
        "halfTime":"2015-03-03T20:30:00.000Z",
        "fullTime":"2015-03-03T21:30:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Arsenal",
        "fixture":"Southampton v Arsenal",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a HW, Southampton have not lost in 4 PL home games against the Gunners, drawing 3 and last seasons HW",
        "round":28,
        "fixutreDate":"2015-03-03T19:45:00.000Z",
        "kickOff":"2015-03-03T19:45:00.000Z",
        "halfTime":"2015-03-03T20:30:00.000Z",
        "fullTime":"2015-03-03T21:30:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Liverpool",
        "fixture":"Manchester United v Liverpool",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, United have won 5 of their last 6 home games against fierce rivals Liverpool, including last seasons HW",
        "round":28,
        "fixutreDate":"2015-03-03T19:45:00.000Z",
        "kickOff":"2015-03-03T19:45:00.000Z",
        "halfTime":"2015-03-03T20:30:00.000Z",
        "fullTime":"2015-03-03T21:30:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Newcastle United",
        "fixture":"Norwich City v Newcastle United",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"The last 2 PL games at Carrow Road have ended in 0-0 draws",
        "round":28,
        "fixutreDate":"2015-03-03T19:45:00.000Z",
        "kickOff":"2015-03-03T19:45:00.000Z",
        "halfTime":"2015-03-03T20:30:00.000Z",
        "fullTime":"2015-03-03T21:30:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Everton",
        "fixture":"Sunderland v Everton",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a D, Even contest. There have been 4 draws at the Stadium of Lights between the 2 teams in the past 6 seasons, including last years 1-1 draw",
        "round":28,
        "fixutreDate":"2015-03-03T19:45:00.000Z",
        "kickOff":"2015-03-03T19:45:00.000Z",
        "halfTime":"2015-03-03T20:30:00.000Z",
        "fullTime":"2015-03-03T21:30:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Watford v Tottenham Hotspur",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"Nothing between the 2! The 2 times these 2 teams have met in the PL at Vicarage road have ended in deadlock. Will this season be when a team claims victory?",
        "round":28,
        "fixutreDate":"2015-03-03T19:45:00.000Z",
        "kickOff":"2015-03-03T19:45:00.000Z",
        "halfTime":"2015-03-03T20:30:00.000Z",
        "fullTime":"2015-03-03T21:30:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Bournemouth",
        "fixture":"Manchester City v Bournemouth",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":28,
        "fixutreDate":"2015-03-03T19:45:00.000Z",
        "kickOff":"2015-03-03T19:45:00.000Z",
        "halfTime":"2015-03-03T20:30:00.000Z",
        "fullTime":"2015-03-03T21:30:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Southampton",
        "fixture":"Crystal Palace v Southampton",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a AW, Southampton have never lost on their travels to Palace in the PL, winning at the Liberty Stadium for the last 2 seasons",
        "round":29,
        "fixutreDate":"2015-03-14T15:00:00.000Z",
        "kickOff":"2015-03-14T15:00:00.000Z",
        "halfTime":"2015-03-14T15:45:00.000Z",
        "fullTime":"2015-03-14T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"West Ham United",
        "fixture":"Arsenal v West Ham United",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a HW, Arsenal have won 6 out of their last 7 home PL games against West Ham, winning the last 5 in a row",
        "round":29,
        "fixutreDate":"2015-03-14T15:00:00.000Z",
        "kickOff":"2015-03-14T15:00:00.000Z",
        "halfTime":"2015-03-14T15:45:00.000Z",
        "fullTime":"2015-03-14T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Norwich City",
        "fixture":"Everton v Norwich City",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Everton have won 3 out of their last 5 home PL games against Norwich, winning the last time the 2 teams played at Goodison",
        "round":29,
        "fixutreDate":"2015-03-14T15:00:00.000Z",
        "kickOff":"2015-03-14T15:00:00.000Z",
        "halfTime":"2015-03-14T15:45:00.000Z",
        "fullTime":"2015-03-14T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Leicester City",
        "fixture":"Liverpool v Leicester City",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a D, Leicester visit to Anfield was the first for 12 years",
        "round":29,
        "fixutreDate":"2015-03-14T15:00:00.000Z",
        "kickOff":"2015-03-14T15:00:00.000Z",
        "halfTime":"2015-03-14T15:45:00.000Z",
        "fullTime":"2015-03-14T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Aston Villa",
        "fixture":"Swansea City v Aston Villa",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a HW, Swansea remain unbeaten at home against Aston Villa and have HWs for the last 2 seasons against Villa",
        "round":29,
        "fixutreDate":"2015-03-14T15:00:00.000Z",
        "kickOff":"2015-03-14T15:00:00.000Z",
        "halfTime":"2015-03-14T15:45:00.000Z",
        "fullTime":"2015-03-14T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Sunderland",
        "fixture":"West Bromwich Albion v Sunderland",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a D, Prior to last seasons draw, West Brom had 5 straight HWs against Sunderland in the PL",
        "round":29,
        "fixutreDate":"2015-03-14T15:00:00.000Z",
        "kickOff":"2015-03-14T15:00:00.000Z",
        "halfTime":"2015-03-14T15:45:00.000Z",
        "fullTime":"2015-03-14T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Manchester United",
        "fixture":"Bournemouth v Manchester United",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":29,
        "fixutreDate":"2015-03-14T15:00:00.000Z",
        "kickOff":"2015-03-14T15:00:00.000Z",
        "halfTime":"2015-03-14T15:45:00.000Z",
        "fullTime":"2015-03-14T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Stoke City",
        "fixture":"Chelsea v Stoke City",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, Chelsea have a 100% home record against Stoke in the PL, winning 7 out of 7, including a 7-0 win back in 2010",
        "round":29,
        "fixutreDate":"2015-03-14T15:00:00.000Z",
        "kickOff":"2015-03-14T15:00:00.000Z",
        "halfTime":"2015-03-14T15:45:00.000Z",
        "fullTime":"2015-03-14T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Watford",
        "fixture":"Newcastle United v Watford",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"The 2 times the these 2 teams have met at St James' Park have ended in HWs for Newcastle",
        "round":29,
        "fixutreDate":"2015-03-14T15:00:00.000Z",
        "kickOff":"2015-03-14T15:00:00.000Z",
        "halfTime":"2015-03-14T15:45:00.000Z",
        "fullTime":"2015-03-14T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Manchester City",
        "fixture":"Tottenham Hotspur v Manchester City",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a AW, Man City seem to like their travels to White Hart Lane of late, winning on 3 of the last 4 visits, including 2 in a row",
        "round":29,
        "fixutreDate":"2015-03-14T15:00:00.000Z",
        "kickOff":"2015-03-14T15:00:00.000Z",
        "halfTime":"2015-03-14T15:45:00.000Z",
        "fullTime":"2015-03-14T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Manchester United v West Bromwich Albion",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a AW, Stutter? United have lost their last 2 home PL games against West Brom. Can they correct the record this season?",
        "round":30,
        "fixutreDate":"2015-03-21T15:00:00.000Z",
        "kickOff":"2015-03-21T15:00:00.000Z",
        "halfTime":"2015-03-21T15:45:00.000Z",
        "fullTime":"2015-03-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Aston Villa v Tottenham Hotspur",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a AW, Happy travelling! Spurs have not lost in 7 away PL games at Aston Villa, including winning the last 3 in a row",
        "round":30,
        "fixutreDate":"2015-03-21T15:00:00.000Z",
        "kickOff":"2015-03-21T15:00:00.000Z",
        "halfTime":"2015-03-21T15:45:00.000Z",
        "fullTime":"2015-03-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Arsenal",
        "fixture":"Norwich City v Arsenal",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"Last time the 2 teams met at Carrow Road in the PL, Arsenal came away with the victory and have only lost once in 7 PL visits to Norwich - back in 2012",
        "round":30,
        "fixutreDate":"2015-03-21T15:00:00.000Z",
        "kickOff":"2015-03-21T15:00:00.000Z",
        "halfTime":"2015-03-21T15:45:00.000Z",
        "fullTime":"2015-03-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Everton",
        "fixture":"Southampton v Everton",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a HW, The Saints are undefeated in 6 games at home against Everton in the PL, winning the last 2 in a row",
        "round":30,
        "fixutreDate":"2015-03-21T15:00:00.000Z",
        "kickOff":"2015-03-21T15:00:00.000Z",
        "halfTime":"2015-03-21T15:45:00.000Z",
        "fullTime":"2015-03-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Bournemouth",
        "fixture":"Stoke City v Bournemouth",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":30,
        "fixutreDate":"2015-03-21T15:00:00.000Z",
        "kickOff":"2015-03-21T15:00:00.000Z",
        "halfTime":"2015-03-21T15:45:00.000Z",
        "fullTime":"2015-03-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Crystal Palace",
        "fixture":"Sunderland v Crystal Palace",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a AW, The 2 teams have only met twice before in the PL at the Stadium of Lights. Palace haven't lost there in the PL and won on the last visit",
        "round":30,
        "fixutreDate":"2015-03-21T15:00:00.000Z",
        "kickOff":"2015-03-21T15:00:00.000Z",
        "halfTime":"2015-03-21T15:45:00.000Z",
        "fullTime":"2015-03-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Liverpool",
        "fixture":"Watford v Liverpool",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The 2 teams have only faced each other twice at Vicarage Road in the PL and on both occasion Liverpool bagged AWs ",
        "round":30,
        "fixutreDate":"2015-03-21T15:00:00.000Z",
        "kickOff":"2015-03-21T15:00:00.000Z",
        "halfTime":"2015-03-21T15:45:00.000Z",
        "fullTime":"2015-03-21T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Swansea City",
        "fixture":"West Ham United v Swansea City",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a HW, West Ham have won all 3 home PL games against the visitors",
        "round":30,
        "fixutreDate":"2015-03-21T15:00:00.000Z",
        "kickOff":"2015-03-21T15:00:00.000Z",
        "halfTime":"2015-03-21T15:45:00.000Z",
        "fullTime":"2015-03-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Newcastle United",
        "fixture":"Manchester City v Newcastle United",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, City are unbeaten in 12 PL homes games against the Magpies and have won the 7 in a row convincingly",
        "round":30,
        "fixutreDate":"2015-03-21T15:00:00.000Z",
        "kickOff":"2015-03-21T15:00:00.000Z",
        "halfTime":"2015-03-21T15:45:00.000Z",
        "fullTime":"2015-03-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Chelsea",
        "fixture":"Leicester City v Chelsea",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a AW, Of the 9 games these 2 teams have played in the PL,  Chelsea have won on 5 occasions, including the last 3",
        "round":30,
        "fixutreDate":"2015-03-21T15:00:00.000Z",
        "kickOff":"2015-03-21T15:00:00.000Z",
        "halfTime":"2015-03-21T15:45:00.000Z",
        "fullTime":"2015-03-21T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Manchester City",
        "fixture":"Arsenal v Manchester City",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a D, Tough one to call! In the last 6 seasons there have been 4 draws (including the last 2)  ",
        "round":31,
        "fixutreDate":"2015-04-04T15:00:00.000Z",
        "kickOff":"2015-04-04T15:00:00.000Z",
        "halfTime":"2015-04-04T15:45:00.000Z",
        "fullTime":"2015-04-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Watford",
        "fixture":"Bournemouth v Watford",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":31,
        "fixutreDate":"2015-04-04T15:00:00.000Z",
        "kickOff":"2015-04-04T15:00:00.000Z",
        "halfTime":"2015-04-04T15:45:00.000Z",
        "fullTime":"2015-04-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Sunderland",
        "fixture":"Chelsea v Sunderland",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, Chelsea have won the 4 of their last 4 home PL games against the Black Cats (including last seasons HW). However, Sunderland have managed a couple of AW wins too - with the most recent one only in April 2014",
        "round":31,
        "fixutreDate":"2015-04-04T15:00:00.000Z",
        "kickOff":"2015-04-04T15:00:00.000Z",
        "halfTime":"2015-04-04T15:45:00.000Z",
        "fullTime":"2015-04-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Manchester United",
        "fixture":"Crystal Palace v Manchester United",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a AW, 6 out of 6! United have won all 6 of the home games the have played Crystal Palace in the PL",
        "round":31,
        "fixutreDate":"2015-04-04T15:00:00.000Z",
        "kickOff":"2015-04-04T15:00:00.000Z",
        "halfTime":"2015-04-04T15:45:00.000Z",
        "fullTime":"2015-04-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Stoke City",
        "fixture":"Everton v Stoke City",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a AW, Pretty even. In the last 4 PL games between the 2 teams at Goodison, they've been 2 HWs and 2 AWs. Stoke came out on top last time, so could a draw be in the offing?",
        "round":31,
        "fixutreDate":"2015-04-04T15:00:00.000Z",
        "kickOff":"2015-04-04T15:00:00.000Z",
        "halfTime":"2015-04-04T15:45:00.000Z",
        "fullTime":"2015-04-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"West Ham United",
        "fixture":"Liverpool v West Ham United",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a HW, Liverpool remain unbeaten at home against the Hammers in the PL, winning 14 of the 19 games played, including the last 2 ",
        "round":31,
        "fixutreDate":"2015-04-04T15:00:00.000Z",
        "kickOff":"2015-04-04T15:00:00.000Z",
        "halfTime":"2015-04-04T15:45:00.000Z",
        "fullTime":"2015-04-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Aston Villa",
        "fixture":"Newcastle United v Aston Villa",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a HW, Newcastle enjoy it when Aston Villa come to visit. The Magpies are unbeaten in 9 home PL games against Villa, winning 7 (including the last 2)",
        "round":31,
        "fixutreDate":"2015-04-04T15:00:00.000Z",
        "kickOff":"2015-04-04T15:00:00.000Z",
        "halfTime":"2015-04-04T15:45:00.000Z",
        "fullTime":"2015-04-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Norwich City",
        "fixture":"Swansea City v Norwich City",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Norwich had won on their first 2 visits to the Liberty Stadium, but the Swans gave their home fans something to celebrate the last time the Canneries flew by; with a HW in March 2013",
        "round":31,
        "fixutreDate":"2015-04-04T15:00:00.000Z",
        "kickOff":"2015-04-04T15:00:00.000Z",
        "halfTime":"2015-04-04T15:45:00.000Z",
        "fullTime":"2015-04-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Leicester City",
        "fixture":"Tottenham Hotspur v Leicester City",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a HW, Spurs have won 3 of the 4 home PL games they have played against Leicester, including last seasons HW",
        "round":31,
        "fixutreDate":"2015-04-04T15:00:00.000Z",
        "kickOff":"2015-04-04T15:00:00.000Z",
        "halfTime":"2015-04-04T15:45:00.000Z",
        "fullTime":"2015-04-04T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Southampton",
        "fixture":"West Bromwich Albion v Southampton",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a HW, WBA have won 2 of their last 3 home PL games against the Saints, including last seasons. However, Southampton did manage an AW in between the Baggies' victories",
        "round":31,
        "fixutreDate":"2015-04-04T15:00:00.000Z",
        "kickOff":"2015-04-04T15:00:00.000Z",
        "halfTime":"2015-04-04T15:45:00.000Z",
        "fullTime":"2015-04-04T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Arsenal",
        "fixture":"Bournemouth v Arsenal",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":32,
        "fixutreDate":"2015-04-11T15:00:00.000Z",
        "kickOff":"2015-04-11T15:00:00.000Z",
        "halfTime":"2015-04-11T15:45:00.000Z",
        "fullTime":"2015-04-11T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Norwich City",
        "fixture":"Manchester City v Norwich City",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"City have won 2 of their last 3 home PL games against the Saints, including last seasons. However, Norwich did manage an AW in between the City's victories",
        "round":32,
        "fixutreDate":"2015-04-11T15:00:00.000Z",
        "kickOff":"2015-04-11T15:00:00.000Z",
        "halfTime":"2015-04-11T15:45:00.000Z",
        "fullTime":"2015-04-11T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Manchester United",
        "fixture":"Newcastle United v Manchester United",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a AW, Man Utd have won on their last 3 visits to St James' Park in the PL",
        "round":32,
        "fixutreDate":"2015-04-11T15:00:00.000Z",
        "kickOff":"2015-04-11T15:00:00.000Z",
        "halfTime":"2015-04-11T15:45:00.000Z",
        "fullTime":"2015-04-11T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Chelsea",
        "fixture":"Southampton v Chelsea",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a D, Chelsea have won on 3 of their last 5 visits to the South Coast; however, haven't won in the last 2",
        "round":32,
        "fixutreDate":"2015-04-11T15:00:00.000Z",
        "kickOff":"2015-04-11T15:00:00.000Z",
        "halfTime":"2015-04-11T15:45:00.000Z",
        "fullTime":"2015-04-11T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Leicester City",
        "fixture":"Stoke City v Leicester City",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a AW, Last season was the first time the 2 teams have played each other in Premier League - with the Potters coming out on top at Home",
        "round":32,
        "fixutreDate":"2015-04-11T15:00:00.000Z",
        "kickOff":"2015-04-11T15:00:00.000Z",
        "halfTime":"2015-04-11T15:45:00.000Z",
        "fullTime":"2015-04-11T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Crystal Palace",
        "fixture":"Swansea City v Crystal Palace",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a D, Nothing between the 2! The 2 times these 2 teams have met in the PL at the Liberty Stadium have ended in 1-1 draws. Will this season be when a team claims victory?",
        "round":32,
        "fixutreDate":"2015-04-11T15:00:00.000Z",
        "kickOff":"2015-04-11T15:00:00.000Z",
        "halfTime":"2015-04-11T15:45:00.000Z",
        "fullTime":"2015-04-11T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Everton",
        "fixture":"Tottenham Hotspur v Everton",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a HW, Home sweet home! Spurs are unbeaten in past 6 seasons the 2 teams have met at White Hart Lane, winning 4, including the last 2",
        "round":32,
        "fixutreDate":"2015-04-11T15:00:00.000Z",
        "kickOff":"2015-04-11T15:00:00.000Z",
        "halfTime":"2015-04-11T15:45:00.000Z",
        "fullTime":"2015-04-11T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Aston Villa",
        "fixture":"Watford v Aston Villa",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The 2 sides have only met twice before in the PL at Vicarage Road. The fist game Villa bagged an AW, but more recently it was a draw in 2006",
        "round":32,
        "fixutreDate":"2015-04-11T15:00:00.000Z",
        "kickOff":"2015-04-11T15:00:00.000Z",
        "halfTime":"2015-04-11T15:45:00.000Z",
        "fullTime":"2015-04-11T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Liverpool",
        "fixture":"West Bromwich Albion v Liverpool",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a D, West Brom have enjoyed some decent home form against Liverpool in the PL. 1 HW and 2 draws in the past 3 seasons",
        "round":32,
        "fixutreDate":"2015-04-11T15:00:00.000Z",
        "kickOff":"2015-04-11T15:00:00.000Z",
        "halfTime":"2015-04-11T15:45:00.000Z",
        "fullTime":"2015-04-11T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Sunderland",
        "fixture":"West Ham United v Sunderland",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a HW, Sunderland have only ever won twice on the travels to West Ham, the last AW coming back in 2011",
        "round":32,
        "fixutreDate":"2015-04-11T15:00:00.000Z",
        "kickOff":"2015-04-11T15:00:00.000Z",
        "halfTime":"2015-04-11T15:45:00.000Z",
        "fullTime":"2015-04-11T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Swansea City",
        "fixture":"Arsenal v Swansea City",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a AW, Swansea have out gunned the Gunners since being in the PL, winning 2 of the 4 PL games at the Emirates, and are unbeaten in 3",
        "round":33,
        "fixutreDate":"2015-04-18T15:00:00.000Z",
        "kickOff":"2015-04-18T15:00:00.000Z",
        "halfTime":"2015-04-18T15:45:00.000Z",
        "fullTime":"2015-04-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Southampton",
        "fixture":"Aston Villa v Southampton",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a D, Southampton haven't lost at Villa Park for 3 seasons, winning 1 and drawing the last 2",
        "round":33,
        "fixutreDate":"2015-04-18T15:00:00.000Z",
        "kickOff":"2015-04-18T15:00:00.000Z",
        "halfTime":"2015-04-18T15:45:00.000Z",
        "fullTime":"2015-04-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Newcastle United",
        "fixture":"Chelsea v Newcastle United",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, Chelsea have won their last 3 home PL games against Newcastle, with the Magpies last and only PL AW back in May 2012",
        "round":33,
        "fixutreDate":"2015-04-18T15:00:00.000Z",
        "kickOff":"2015-04-18T15:00:00.000Z",
        "halfTime":"2015-04-18T15:45:00.000Z",
        "fullTime":"2015-04-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Crystal Palace v West Bromwich Albion",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a AW, It's 1 a piece. Since Palace have returned to the PL, there's been 1 HW and 1 AW when the 2 teams have at Selhurt Park. Draw this season to complete the set of results?",
        "round":33,
        "fixutreDate":"2015-04-18T15:00:00.000Z",
        "kickOff":"2015-04-18T15:00:00.000Z",
        "halfTime":"2015-04-18T15:45:00.000Z",
        "fullTime":"2015-04-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Bournemouth",
        "fixture":"Everton v Bournemouth",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":33,
        "fixutreDate":"2015-04-18T15:00:00.000Z",
        "kickOff":"2015-04-18T15:00:00.000Z",
        "halfTime":"2015-04-18T15:45:00.000Z",
        "fullTime":"2015-04-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Manchester City",
        "fixture":"Leicester City v Manchester City",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a AW, Man City have never lost when they have visited Leicester in the PL, winning 3 out of 4",
        "round":33,
        "fixutreDate":"2015-04-18T15:00:00.000Z",
        "kickOff":"2015-04-18T15:00:00.000Z",
        "halfTime":"2015-04-18T15:45:00.000Z",
        "fullTime":"2015-04-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Liverpool v Tottenham Hotspur",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a HW, Spurs have only ever won twice at Anfield in the PL. Their last AW came back in 2011. Since then there's been a draw and Liverpool have won the last 3",
        "round":33,
        "fixutreDate":"2015-04-18T15:00:00.000Z",
        "kickOff":"2015-04-18T15:00:00.000Z",
        "halfTime":"2015-04-18T15:45:00.000Z",
        "fullTime":"2015-04-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"West Ham United",
        "fixture":"Manchester United v West Ham United",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, 7 out of 7! Man United have won the last 7 home PL games in a row against West Ham. While, the Hammers have only ever won twice at Old Trafford in 19 attempt, with last PL AW back in 2007",
        "round":33,
        "fixutreDate":"2015-04-18T15:00:00.000Z",
        "kickOff":"2015-04-18T15:00:00.000Z",
        "halfTime":"2015-04-18T15:45:00.000Z",
        "fullTime":"2015-04-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Watford",
        "fixture":"Norwich City v Watford",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"The two teams have never faced each other in the English top flight. Who will claim the first win? Or will it be honours even?",
        "round":33,
        "fixutreDate":"2015-04-18T15:00:00.000Z",
        "kickOff":"2015-04-18T15:00:00.000Z",
        "halfTime":"2015-04-18T15:45:00.000Z",
        "fullTime":"2015-04-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Stoke City",
        "fixture":"Sunderland v Stoke City",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a HW, Sunderland have never be beaten at home in the PL when Stoke have come to visit, winning 5 out of 7 (including the last 2 in a row)",
        "round":33,
        "fixutreDate":"2015-04-18T15:00:00.000Z",
        "kickOff":"2015-04-18T15:00:00.000Z",
        "halfTime":"2015-04-18T15:45:00.000Z",
        "fullTime":"2015-04-18T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Chelsea",
        "fixture":"Arsenal v Chelsea",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a D, Arsenal haven't beaten Chelsea for 4 seasons when playing at home; however, there have been 3 draws between the sides (including last season)",
        "round":34,
        "fixutreDate":"2015-04-25T15:00:00.000Z",
        "kickOff":"2015-04-25T15:00:00.000Z",
        "halfTime":"2015-04-25T15:45:00.000Z",
        "fullTime":"2015-04-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Liverpool",
        "fixture":"Bournemouth v Liverpool",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":34,
        "fixutreDate":"2015-04-25T15:00:00.000Z",
        "kickOff":"2015-04-25T15:00:00.000Z",
        "halfTime":"2015-04-25T15:45:00.000Z",
        "fullTime":"2015-04-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Leicester City",
        "fixture":"Crystal Palace v Leicester City",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a HW, Of the 3 times the teams have faced of at Selhurst Park in the PL it's been HW, AW, HW. AW this season?",
        "round":34,
        "fixutreDate":"2015-04-25T15:00:00.000Z",
        "kickOff":"2015-04-25T15:00:00.000Z",
        "halfTime":"2015-04-25T15:45:00.000Z",
        "fullTime":"2015-04-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Newcastle United",
        "fixture":"Everton v Newcastle United",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a HW, Everton have won 3 out of their last 4 home PL games against Newcastle",
        "round":34,
        "fixutreDate":"2015-04-25T15:00:00.000Z",
        "kickOff":"2015-04-25T15:00:00.000Z",
        "halfTime":"2015-04-25T15:45:00.000Z",
        "fullTime":"2015-04-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Aston Villa",
        "fixture":"Manchester United v Aston Villa",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, United have one their last 5 home PL games in a row against Villa",
        "round":34,
        "fixutreDate":"2015-04-25T15:00:00.000Z",
        "kickOff":"2015-04-25T15:00:00.000Z",
        "halfTime":"2015-04-25T15:45:00.000Z",
        "fullTime":"2015-04-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Norwich City v Tottenham Hotspur",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"For last three season there's been 1 HW, 1 D and 1 AW. Norwich scored a HW the last time the 2 teams met at the Carrow Road",
        "round":34,
        "fixutreDate":"2015-04-25T15:00:00.000Z",
        "kickOff":"2015-04-25T15:00:00.000Z",
        "halfTime":"2015-04-25T15:45:00.000Z",
        "fullTime":"2015-04-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"West Ham United",
        "fixture":"Southampton v West Ham United",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Last seasons result was a D, ",
        "round":34,
        "fixutreDate":"2015-04-25T15:00:00.000Z",
        "kickOff":"2015-04-25T15:00:00.000Z",
        "halfTime":"2015-04-25T15:45:00.000Z",
        "fullTime":"2015-04-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Watford",
        "fixture":"Stoke City v Watford",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"The two teams have never faced each other in the English top flight. Who will claim the first win? Or will it be honours even?",
        "round":34,
        "fixutreDate":"2015-04-25T15:00:00.000Z",
        "kickOff":"2015-04-25T15:00:00.000Z",
        "halfTime":"2015-04-25T15:45:00.000Z",
        "fullTime":"2015-04-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Swansea City",
        "fixture":"Sunderland v Swansea City",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a D, The 4 times these 2 teams have met at the Stadium of Lights, it's been 1 HW, 1 AW and 2 draes (including last seasons) ",
        "round":34,
        "fixutreDate":"2015-04-25T15:00:00.000Z",
        "kickOff":"2015-04-25T15:00:00.000Z",
        "halfTime":"2015-04-25T15:45:00.000Z",
        "fullTime":"2015-04-25T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Manchester City",
        "fixture":"West Bromwich Albion v Manchester City",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a AW, Man City have won on 4 of their last 5 PL visits to the Hawthorns, including the last 3",
        "round":34,
        "fixutreDate":"2015-04-25T15:00:00.000Z",
        "kickOff":"2015-04-25T15:00:00.000Z",
        "halfTime":"2015-04-25T15:45:00.000Z",
        "fullTime":"2015-04-25T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Everton",
        "fixture":"Aston Villa v Everton",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a HW, Prior to last seasons loss, Everton had won on their 2 previous visits to Villa Park",
        "round":35,
        "fixutreDate":"2015-05-02T15:00:00.000Z",
        "kickOff":"2015-05-02T15:00:00.000Z",
        "halfTime":"2015-05-02T15:45:00.000Z",
        "fullTime":"2015-05-02T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Crystal Palace",
        "fixture":"Chelsea v Crystal Palace",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, Chelsea have won 4 straight and never been beaten at home when Palace have visited in the PL",
        "round":35,
        "fixutreDate":"2015-05-02T15:00:00.000Z",
        "kickOff":"2015-05-02T15:00:00.000Z",
        "halfTime":"2015-05-02T15:45:00.000Z",
        "fullTime":"2015-05-02T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Arsenal",
        "fixture":"Leicester City v Arsenal",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a D, In 9 PL between the 2 teams in Leicester there have been 5 draws, including the last 2",
        "round":35,
        "fixutreDate":"2015-05-02T15:00:00.000Z",
        "kickOff":"2015-05-02T15:00:00.000Z",
        "halfTime":"2015-05-02T15:45:00.000Z",
        "fullTime":"2015-05-02T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Norwich City",
        "fixture":"Liverpool v Norwich City",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Liverpool have won their last 2 home PL games against Norwich",
        "round":35,
        "fixutreDate":"2015-05-02T15:00:00.000Z",
        "kickOff":"2015-05-02T15:00:00.000Z",
        "halfTime":"2015-05-02T15:45:00.000Z",
        "fullTime":"2015-05-02T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Southampton",
        "fixture":"Manchester City v Southampton",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, Man City have won all 3 home games against the Saints in the PL since Southampton returned to England's top league",
        "round":35,
        "fixutreDate":"2015-05-02T15:00:00.000Z",
        "kickOff":"2015-05-02T15:00:00.000Z",
        "halfTime":"2015-05-02T15:45:00.000Z",
        "fullTime":"2015-05-02T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Newcastle United v West Bromwich Albion",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a D, Newcastle have won 2 of their last 3 home PL games against WBA. However, last season it was a draw",
        "round":35,
        "fixutreDate":"2015-05-02T15:00:00.000Z",
        "kickOff":"2015-05-02T15:00:00.000Z",
        "halfTime":"2015-05-02T15:45:00.000Z",
        "fullTime":"2015-05-02T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Stoke City",
        "fixture":"Swansea City v Stoke City",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a HW, Stoke have never been beaten at home when the Swans have visited. Can the keep that run going?",
        "round":35,
        "fixutreDate":"2015-05-02T15:00:00.000Z",
        "kickOff":"2015-05-02T15:00:00.000Z",
        "halfTime":"2015-05-02T15:45:00.000Z",
        "fullTime":"2015-05-02T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Sunderland",
        "fixture":"Tottenham Hotspur v Sunderland",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a HW, Sunderland have only ever won once on the travels to Tottenham, the last AW coming back on the opening day 0f the 2008-09 season. While Spurs have won the last 4 at White Hart Lane",
        "round":35,
        "fixutreDate":"2015-05-02T15:00:00.000Z",
        "kickOff":"2015-05-02T15:00:00.000Z",
        "halfTime":"2015-05-02T15:45:00.000Z",
        "fullTime":"2015-05-02T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Manchester United",
        "fixture":"Watford v Manchester United",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The 2 teams have only faced each other twice at Vicarage Road in the PL and on both occasion United bagged AWs ",
        "round":35,
        "fixutreDate":"2015-05-02T15:00:00.000Z",
        "kickOff":"2015-05-02T15:00:00.000Z",
        "halfTime":"2015-05-02T15:45:00.000Z",
        "fullTime":"2015-05-02T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Bournemouth",
        "fixture":"West Ham United v Bournemouth",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":35,
        "fixutreDate":"2015-05-02T15:00:00.000Z",
        "kickOff":"2015-05-02T15:00:00.000Z",
        "halfTime":"2015-05-02T15:45:00.000Z",
        "fullTime":"2015-05-02T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Arsenal v Tottenham Hotspur",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a D, Tottenham have only ever one twice away to their North London rivals, the last back in 2010. Since then Arsenal won 4 in a row at home in this fixture. Was last seasons draw just a blip?",
        "round":36,
        "fixutreDate":"2015-05-09T15:00:00.000Z",
        "kickOff":"2015-05-09T15:00:00.000Z",
        "halfTime":"2015-05-09T15:45:00.000Z",
        "fullTime":"2015-05-09T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"West Ham United",
        "fixture":"Aston Villa v West Ham United",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"Last seasons result was a HW, Aston Villia have won 3 out the last 4 at home to the Hammers in the PL, including last year",
        "round":36,
        "fixutreDate":"2015-05-09T15:00:00.000Z",
        "kickOff":"2015-05-09T15:00:00.000Z",
        "halfTime":"2015-05-09T15:45:00.000Z",
        "fullTime":"2015-05-09T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Manchester City",
        "fixture":"Chelsea v Manchester City",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a D, City have only ever one twice away at Stamford Bridge, the last back in 2010. Since then Chelsea have won 3 of 5 at home. But there have been 2 draws in the last 3",
        "round":36,
        "fixutreDate":"2015-05-09T15:00:00.000Z",
        "kickOff":"2015-05-09T15:00:00.000Z",
        "halfTime":"2015-05-09T15:45:00.000Z",
        "fullTime":"2015-05-09T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Newcastle United",
        "fixture":"Crystal Palace v Newcastle United",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a D, Newcastle had won all 4 home games in the PL against Palace before last seasons draw",
        "round":36,
        "fixutreDate":"2015-05-09T15:00:00.000Z",
        "kickOff":"2015-05-09T15:00:00.000Z",
        "halfTime":"2015-05-09T15:45:00.000Z",
        "fullTime":"2015-05-09T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Swansea City",
        "fixture":"Everton v Swansea City",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"Last seasons result was a D, Pattern? In the four PL games the 2 teams have played at the Goodison, an Everton HW has been followed by a draw. It was draw last season, so can Everton score a HW to keep this the trend going?",
        "round":36,
        "fixutreDate":"2015-05-09T15:00:00.000Z",
        "kickOff":"2015-05-09T15:00:00.000Z",
        "halfTime":"2015-05-09T15:45:00.000Z",
        "fullTime":"2015-05-09T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Bournemouth",
        "fixture":"Leicester City v Bournemouth",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":36,
        "fixutreDate":"2015-05-09T15:00:00.000Z",
        "kickOff":"2015-05-09T15:00:00.000Z",
        "halfTime":"2015-05-09T15:45:00.000Z",
        "fullTime":"2015-05-09T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Stoke City",
        "fixture":"Liverpool v Stoke City",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a HW, Liverpool are undefeated against Stoke at Anfield and have won the last 2 PL games when the Potters have visited",
        "round":36,
        "fixutreDate":"2015-05-09T15:00:00.000Z",
        "kickOff":"2015-05-09T15:00:00.000Z",
        "halfTime":"2015-05-09T15:45:00.000Z",
        "fullTime":"2015-05-09T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Southampton",
        "fixture":"Manchester United v Southampton",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a AW, Prior to last season defeat, United had woin 13 home games from 15 in the PL",
        "round":36,
        "fixutreDate":"2015-05-09T15:00:00.000Z",
        "kickOff":"2015-05-09T15:00:00.000Z",
        "halfTime":"2015-05-09T15:45:00.000Z",
        "fullTime":"2015-05-09T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Norwich City v West Bromwich Albion",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"Taking it in turns? In the past 4 seasons, when one team wins this fixture at the Carrow Road, the following season the other team takes the victory. Last season WBA won, so will the pattern continue and Norwich claim the win?",
        "round":36,
        "fixutreDate":"2015-05-09T15:00:00.000Z",
        "kickOff":"2015-05-09T15:00:00.000Z",
        "halfTime":"2015-05-09T15:45:00.000Z",
        "fullTime":"2015-05-09T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Watford",
        "fixture":"Sunderland v Watford",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Teams have only played each other once at the Stadium of Lights in Premier League history. Back in 1999 - Sunderland came out on top",
        "round":36,
        "fixutreDate":"2015-05-09T15:00:00.000Z",
        "kickOff":"2015-05-09T15:00:00.000Z",
        "halfTime":"2015-05-09T15:45:00.000Z",
        "fullTime":"2015-05-09T16:45:00.000Z"
    },
    {
        "homeTeam":"Bournemouth",
        "awayTeam":"Sunderland",
        "fixture":"Bournemouth v Sunderland",
        "fixutreStadium":"Deane Road",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":37,
        "fixutreDate":"2015-05-16T15:00:00.000Z",
        "kickOff":"2015-05-16T15:00:00.000Z",
        "halfTime":"2015-05-16T15:45:00.000Z",
        "fullTime":"2015-05-16T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester City",
        "awayTeam":"Crystal Palace",
        "fixture":"Manchester City v Crystal Palace",
        "fixutreStadium":"Eithad Stadium",
        "fixtureFacts":"Last seasons result was a HW, City are unbeaten at home in the PL against Palace, winning the last 3",
        "round":37,
        "fixutreDate":"2015-05-16T15:00:00.000Z",
        "kickOff":"2015-05-16T15:00:00.000Z",
        "halfTime":"2015-05-16T15:45:00.000Z",
        "fullTime":"2015-05-16T16:45:00.000Z"
    },
    {
        "homeTeam":"Newcastle United",
        "awayTeam":"Arsenal",
        "fixture":"Newcastle United v Arsenal",
        "fixutreStadium":"St James' Park",
        "fixtureFacts":"Last seasons result was a AW, Arsenal haven't been beaten at St James' Park for 8 seasons and have won 3 straight on their travels to Newcastle",
        "round":37,
        "fixutreDate":"2015-05-16T15:00:00.000Z",
        "kickOff":"2015-05-16T15:00:00.000Z",
        "halfTime":"2015-05-16T15:45:00.000Z",
        "fullTime":"2015-05-16T16:45:00.000Z"
    },
    {
        "homeTeam":"Southampton",
        "awayTeam":"Norwich City",
        "fixture":"Southampton v Norwich City",
        "fixutreStadium":"St Mary's Stadium",
        "fixtureFacts":"Southampton have not been able to win 2 home PL games in a row when Norwich visit. The Saints won the last time the 2 teams played at St Mary's, so can they win again this season?",
        "round":37,
        "fixutreDate":"2015-05-16T15:00:00.000Z",
        "kickOff":"2015-05-16T15:00:00.000Z",
        "halfTime":"2015-05-16T15:45:00.000Z",
        "fullTime":"2015-05-16T16:45:00.000Z"
    },
    {
        "homeTeam":"Stoke City",
        "awayTeam":"Aston Villa",
        "fixture":"Stoke City v Aston Villa",
        "fixutreStadium":"Britannia Stadium",
        "fixtureFacts":"Last seasons result was a AW, Villa have won the last 2 of 3 away games at the Britannia, including last season",
        "round":37,
        "fixutreDate":"2015-05-16T15:00:00.000Z",
        "kickOff":"2015-05-16T15:00:00.000Z",
        "halfTime":"2015-05-16T15:45:00.000Z",
        "fullTime":"2015-05-16T16:45:00.000Z"
    },
    {
        "homeTeam":"Swansea City",
        "awayTeam":"Liverpool",
        "fixture":"Swansea City v Liverpool",
        "fixutreStadium":"Liberty Stadium",
        "fixtureFacts":"Last seasons result was a AW, Of the 4 games the 2 teams have played at the Liberty Stadium in the PL, 2 have ended in draws",
        "round":37,
        "fixutreDate":"2015-05-16T15:00:00.000Z",
        "kickOff":"2015-05-16T15:00:00.000Z",
        "halfTime":"2015-05-16T15:45:00.000Z",
        "fullTime":"2015-05-16T16:45:00.000Z"
    },
    {
        "homeTeam":"Tottenham Hotspur",
        "awayTeam":"Manchester United",
        "fixture":"Tottenham Hotspur v Manchester United",
        "fixutreStadium":"White Hart Lane",
        "fixtureFacts":"Last seasons result was a D, What use to be a happy hunting ground for United has dried up recently. There's been 6 draws in the last 8 games between the 2 at White Hart Lane, including the last 3 in a row",
        "round":37,
        "fixutreDate":"2015-05-16T15:00:00.000Z",
        "kickOff":"2015-05-16T15:00:00.000Z",
        "halfTime":"2015-05-16T15:45:00.000Z",
        "fullTime":"2015-05-16T16:45:00.000Z"
    },
    {
        "homeTeam":"Watford",
        "awayTeam":"Leicester City",
        "fixture":"Watford v Leicester City",
        "fixutreStadium":"Vicarage Road",
        "fixtureFacts":"The only time the teams have met in the PL was back in 2000, when it was a draw. What will it be 15 years on?",
        "round":37,
        "fixutreDate":"2015-05-16T15:00:00.000Z",
        "kickOff":"2015-05-16T15:00:00.000Z",
        "halfTime":"2015-05-16T15:45:00.000Z",
        "fullTime":"2015-05-16T16:45:00.000Z"
    },
    {
        "homeTeam":"West Bromwich Albion",
        "awayTeam":"Chelsea",
        "fixture":"West Bromwich Albion v Chelsea",
        "fixutreStadium":"The Hawthorns",
        "fixtureFacts":"Last seasons result was a HW, Bogey team? Chelsea have lost 3 of their last 4 PL away games to WBA",
        "round":37,
        "fixutreDate":"2015-05-16T15:00:00.000Z",
        "kickOff":"2015-05-16T15:00:00.000Z",
        "halfTime":"2015-05-16T15:45:00.000Z",
        "fullTime":"2015-05-16T16:45:00.000Z"
    },
    {
        "homeTeam":"West Ham United",
        "awayTeam":"Everton",
        "fixture":"West Ham United v Everton",
        "fixutreStadium":"Boleyn Ground",
        "fixtureFacts":"Last seasons result was a AW, Everton are unbeaten in 7 away PL games against West Ham, winning 6 and the last 3 in a row",
        "round":37,
        "fixutreDate":"2015-05-16T15:00:00.000Z",
        "kickOff":"2015-05-16T15:00:00.000Z",
        "halfTime":"2015-05-16T15:45:00.000Z",
        "fullTime":"2015-05-16T16:45:00.000Z"
    },
    {
        "homeTeam":"Arsenal",
        "awayTeam":"West Bromwich Albion",
        "fixture":"Arsenal v West Bromwich Albion",
        "fixutreStadium":"Emirates Stadium",
        "fixtureFacts":"Last seasons result was a HW, Arsenal won the last 4 home PL games in row against WBA",
        "round":38,
        "fixutreDate":"2015-05-24T15:00:00.000Z",
        "kickOff":"2015-05-24T15:00:00.000Z",
        "halfTime":"2015-05-24T15:45:00.000Z",
        "fullTime":"2015-05-24T16:45:00.000Z"
    },
    {
        "homeTeam":"Aston Villa",
        "awayTeam":"Bournemouth",
        "fixture":"Aston Villa v Bournemouth",
        "fixutreStadium":"Villa Park",
        "fixtureFacts":"This Bournemouth's first season in the Premier League",
        "round":38,
        "fixutreDate":"2015-05-24T15:00:00.000Z",
        "kickOff":"2015-05-24T15:00:00.000Z",
        "halfTime":"2015-05-24T15:45:00.000Z",
        "fullTime":"2015-05-24T16:45:00.000Z"
    },
    {
        "homeTeam":"Chelsea",
        "awayTeam":"Swansea City",
        "fixture":"Chelsea v Swansea City",
        "fixutreStadium":"Stamford Bridge",
        "fixtureFacts":"Last seasons result was a HW, 4 out of 4! Chelsea have won all 4 PL home games against Swansea",
        "round":38,
        "fixutreDate":"2015-05-24T15:00:00.000Z",
        "kickOff":"2015-05-24T15:00:00.000Z",
        "halfTime":"2015-05-24T15:45:00.000Z",
        "fullTime":"2015-05-24T16:45:00.000Z"
    },
    {
        "homeTeam":"Crystal Palace",
        "awayTeam":"Tottenham Hotspur",
        "fixture":"Crystal Palace v Tottenham Hotspur",
        "fixutreStadium":"Selhurst Park",
        "fixtureFacts":"Last seasons result was a HW, Taking it in turns? In the past 4 seasons, when one team wins this fixture at Selhurst Park, the following season the other team takes the victory. Last season Palace won, so will the pattern continue and Spurs claim the win?",
        "round":38,
        "fixutreDate":"2015-05-24T15:00:00.000Z",
        "kickOff":"2015-05-24T15:00:00.000Z",
        "halfTime":"2015-05-24T15:45:00.000Z",
        "fullTime":"2015-05-24T16:45:00.000Z"
    },
    {
        "homeTeam":"Everton",
        "awayTeam":"Watford",
        "fixture":"Everton v Watford",
        "fixutreStadium":"Goodison Park",
        "fixtureFacts":"The 2 teams have only faced each other twice at in the PL at Goodison Park and on both occasion Everton bagged HWs",
        "round":38,
        "fixutreDate":"2015-05-24T15:00:00.000Z",
        "kickOff":"2015-05-24T15:00:00.000Z",
        "halfTime":"2015-05-24T15:45:00.000Z",
        "fullTime":"2015-05-24T16:45:00.000Z"
    },
    {
        "homeTeam":"Leicester City",
        "awayTeam":"Newcastle United",
        "fixture":"Leicester City v Newcastle United",
        "fixutreStadium":"King Power Stadium",
        "fixtureFacts":"Last seasons result was a HW, There had been 3 draws in a row between the 2 teams at the home of the Foxes before Leicester's HW last season",
        "round":38,
        "fixutreDate":"2015-05-24T15:00:00.000Z",
        "kickOff":"2015-05-24T15:00:00.000Z",
        "halfTime":"2015-05-24T15:45:00.000Z",
        "fullTime":"2015-05-24T16:45:00.000Z"
    },
    {
        "homeTeam":"Liverpool",
        "awayTeam":"Southampton",
        "fixture":"Liverpool v Southampton",
        "fixutreStadium":"Anfield",
        "fixtureFacts":"Last seasons result was a HW, Liverpool have won the last 2 of 3 home games at the Anfield, including last season",
        "round":38,
        "fixutreDate":"2015-05-24T15:00:00.000Z",
        "kickOff":"2015-05-24T15:00:00.000Z",
        "halfTime":"2015-05-24T15:45:00.000Z",
        "fullTime":"2015-05-24T16:45:00.000Z"
    },
    {
        "homeTeam":"Manchester United",
        "awayTeam":"Stoke City",
        "fixture":"Manchester United v Stoke City",
        "fixutreStadium":"Old Trafford",
        "fixtureFacts":"Last seasons result was a HW, 100%! United have won all 7 PL games against the Stoke at Old Trafford",
        "round":38,
        "fixutreDate":"2015-05-24T15:00:00.000Z",
        "kickOff":"2015-05-24T15:00:00.000Z",
        "halfTime":"2015-05-24T15:45:00.000Z",
        "fullTime":"2015-05-24T16:45:00.000Z"
    },
    {
        "homeTeam":"Norwich City",
        "awayTeam":"West Ham United",
        "fixture":"Norwich City v West Ham United",
        "fixutreStadium":"Carrow Road",
        "fixtureFacts":"Of the 4 games the 2 teams have played at Carrow Road, it's been 2 draws and 2 HW for Norwich (including the last time the 2 teams met in the PL)",
        "round":38,
        "fixutreDate":"2015-05-24T15:00:00.000Z",
        "kickOff":"2015-05-24T15:00:00.000Z",
        "halfTime":"2015-05-24T15:45:00.000Z",
        "fullTime":"2015-05-24T16:45:00.000Z"
    },
    {
        "homeTeam":"Sunderland",
        "awayTeam":"Manchester City",
        "fixture":"Sunderland v Manchester City",
        "fixutreStadium":"Stadium of Lights",
        "fixtureFacts":"Last seasons result was a AW, Tricky! Man City have travelling to Sunderland tricky, losing the last 4 out of 5 PL games at the Stadium of Lights. However, they did manage an AW last season",
        "round":38,
        "fixutreDate":"2015-05-24T15:00:00.000Z",
        "kickOff":"2015-05-24T15:00:00.000Z",
        "halfTime":"2015-05-24T15:45:00.000Z",
        "fullTime":"2015-05-24T16:45:00.000Z"
    }
];


