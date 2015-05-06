var mongoose = require('mongoose');
var http = require('http');
var https = require('https');
var users = require('./users');
//var Agenda = require('agenda');
var moment = require('moment');
var MiniSet = require('./miniset');
var Fixture = mongoose.model('Fixture');
var User = mongoose.model('User');


exports.getFixtures = function(req, res) {
    Fixture.find({}, function(err, results) {
        return res.jsonp(results);
    });

    //console.log('Getting rounds');
    //Fixture.find({}, function(err, results) {
    //    var data = JSON.parse(JSON.stringify(results));
    //
    //    console.log('Parsing fixture data ' + data + ' into rounds');
    //
    //    var newData = {rounds:[]};
    //
    //    var set = new MiniSet();
    //
    //    for(var i = 0; i < data.length; i++) {
    //
    //        var obj = data[i];
    //
    //        // if this round already exists in the list add it else make a new JSON object
    //
    //        var roundNum = Number(obj.round.toString());
    //        console.log('Now working on round number: ' + roundNum);
    //
    //        if(set.has(roundNum)) {
    //            console.log('The set already has the round ' + roundNum + ' just adding in ' + obj);
    //            // there is a fatal flaw in which we assume the rounds[number] exists in order, fix later lol
    //            newData.rounds[roundNum-1].data.push(obj);
    //        } else {
    //            var stringData = JSON.stringify(obj);
    //            console.log('Round ' + roundNum + ' did not exist, creating it now and adding in object ' + stringData);
    //            var nextData = JSON.parse("{\"round\":\""+roundNum+"\",\"data\":["+stringData+"]}");
    //            newData.rounds.push(nextData);
    //            set.add(roundNum);
    //        }
    //    }
    //
    //    console.log('Now returning to the user: ' + newData);
    //    return res.jsonp(newData);
    //});
};

exports.getRound = function(req, res) {
    var round = req.params.round;
    Fixture.find({'round': round}, function(err, result) {
        return res.jsonp(result);
    });
};

exports.getGroupedFixtures = function(req, res) {

    console.log('Getting rounds');

    Fixture.find({}).sort({ 'round' : 1}).exec(function(err, results) {

        var data = JSON.parse(JSON.stringify(results));

        console.log('Parsing sorted fixture data ' + results + ' into rounds');

        var newData = {
            rounds: []
        };
        console.log('The new data variable is: ' + JSON.stringify(newData));

        var newSet = new MiniSet();
        //console.log(newSet);

        //loop over each fixture, assign to a round
        for(var i = 0; i < data.length; i++) {

            var fixtures = data[i];

            console.log('The data should now have been sorted, and the resulting sorted fixtures are:' + JSON.stringify(fixtures));
            // if this round already exists in the list add it else make a new JSON object

            var roundNum = Number(fixtures.round.toString());
            console.log('Now working on round number: ' + roundNum);

            if(newSet.has(roundNum)) {

                console.log('The set already has the round ' + roundNum + ' just adding in ' + JSON.stringify(fixtures));

                // there is a fatal flaw in which we assume the rounds[number] exists in order, fix later lol

                console.log('Now pushing the fixture into the round ' + roundNum);
                newData.rounds[roundNum-1].data.push(fixtures);

            } else {

                var stringData = JSON.stringify(fixtures);

                console.log('Round ' + roundNum + ' did not exist, creating it now and adding in object ' + stringData);

                var nextData = JSON.parse("{\"round\":\""+roundNum+"\",\"data\":["+stringData+"]}");

                newData.rounds.push(nextData);

                newSet.add(roundNum);
            }
        }

        console.log('Now returning to the user: ' + JSON.stringify(newData));
        return res.jsonp(newData);
    });
};

//function to call to the football-api and retrieve the league table
exports.getStandings = function(req, res) {
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

        res2.on('end', function() {
            obj = JSON.parse(output);
            console.log(obj);
            return res.jsonp(obj);
        });
    });
};

exports.addFixtures = function(req, res) {
    Fixture.create(req.body, function(err, fixture) {
        if(err) return console.log(err);
        return res.jsonp(fixture);
    });
};

exports.clearFixtures = function(req, res) {
    Fixture.remove({}, function(result) {
        return res.jsonp(result);
    });
};

exports.clearRound = function() {
    var round = req.params.round;
    Fixture.remove({'round': round}, function(result){
        return res.jsonp(result);
    });
};

//TODO: ALTERNATIVELY, write method to pull these down from football-api and store all relevant details!
var examples = [
    {"homeTeam":"Arsenal", "awayTeam":"Crystal Palace","round":"1"},
    {"homeTeam":"Burnley", "awayTeam":"Chelsea", "round":"1"},
    {"homeTeam":"Leicester City", "awayTeam":"Everton", "round":"1"},
    {"homeTeam":"Liverpool", "awayTeam":"Southampton", "round":"1"},
    {"homeTeam":"Manchester United", "awayTeam":"Swansea City", "round":"1"},
    {"homeTeam":"Newcastle United", "awayTeam":"Manchester City", "round":"1"},
    {"homeTeam":"Queens Park Rangers", "awayTeam":"Everton", "round":"1"},
    {"homeTeam":"Stoke City", "awayTeam":"Aston Villa", "round":"1"},
    {"homeTeam":"West Bromwich Albion", "awayTeam":"Sunderland", "round":"1"},
    {"homeTeam":"West Ham United", "awayTeam":"Tottenham Hotspur", "round":"1"},
    {"homeTeam":"Aston Villa", "awayTeam":"Newcastle United", "round":"2"},
    {"homeTeam":"Chelsea", "awayTeam":"Leicester City", "round":"2"},
    {"homeTeam":"Crystal Palace", "awayTeam":"West Ham United", "round":"2"},
    {"homeTeam":"Everton", "awayTeam":"Arsenal", "round":"2"},
    {"homeTeam":"Hull City", "awayTeam":"Stoke City", "round":"2"},
    {"homeTeam":"Manchester City", "awayTeam":"Liverpool", "round":"2"},
    {"homeTeam":"Southampton", "awayTeam":"West Bromwich Album", "round":"2"},
    {"homeTeam":"Sunderland", "awayTeam":"Manchester United", "round":"2"},
    {"homeTeam":"Swansea City", "awayTeam":"Burnley", "round":"2"},
    {"homeTeam":"Tottenham Hotspur", "awayTeam":"Swansea City", "round":"2"},
    {"homeTeam":"Aston Villa", "awayTeam":"Hull City", "round":"3"},
    {"homeTeam":"Burnley", "awayTeam":"Manchester United", "round":"3"},
    {"homeTeam":"Everton", "awayTeam":"Chelsea", "round":"3"},
    {"homeTeam":"Leicester City", "awayTeam":"Arsenal", "round":"3"},
    {"homeTeam":"Manchester City", "awayTeam":"Stoke City", "round":"3"},
    {"homeTeam":"Newcastle United", "awayTeam":"Crystal Palace", "round":"3"},
    {"homeTeam":"Queens Park Rangers", "awayTeam":"Sunderland", "round":"3"},
    {"homeTeam":"Swansea City", "awayTeam":"West Bromwich Albion", "round":"3"},
    {"homeTeam":"Tottenham Hotspur", "awayTeam":"Liverpool", "round":"3"},
    {"homeTeam":"West Ham United", "awayTeam":"Southampton", "round":"3"},
    {"homeTeam":"Arsenal", "awayTeam":"Manchester City", "round":"4"},
    {"homeTeam":"Chelsea", "awayTeam":"Swansea City", "round":"4"},
    {"homeTeam":"Crystal Palace", "awayTeam":"Burnley", "round":"4"},
    {"homeTeam":"Hull City", "awayTeam":"West Ham United", "round":"4"},
    {"homeTeam":"Liverpool", "awayTeam":"Aston Villa", "round":"4"},
    {"homeTeam":"Manchester United", "awayTeam":"Queens Park Rangers", "round":"4"},
    {"homeTeam":"Southampton", "awayTeam":"Newcastle United", "round":"4"},
    {"homeTeam":"Stoke City", "awayTeam":"Leicester City", "round":"4"},
    {"homeTeam":"Sunderland", "awayTeam":"Tottenham Hotspur", "round":"4"},
    {"homeTeam":"West Bromwich Albion", "awayTeam":"Everton", "round":"4"},
    {"homeTeam":"Aston Villa", "awayTeam":"Arsenal", "round":"5"},
    {"homeTeam":"Burnley", "awayTeam":"Sunderland", "round":"5"},
    {"homeTeam":"Everton", "awayTeam":"Crystal Palace", "round":"5"},
    {"homeTeam":"Leicester City", "awayTeam":"Manchester United", "round":"5"},
    {"homeTeam":"Manchester City", "awayTeam":"Chelsea", "round":"5"},
    {"homeTeam":"Newcastle United", "awayTeam":"Hull City", "round":"5"},
    {"homeTeam":"Queens Park Rangers", "awayTeam":"Stoke City", "round":"5"},
    {"homeTeam":"Swansea City", "awayTeam":"Southampton", "round":"5"},
    {"homeTeam":"Tottenham Hotspur", "awayTeam":"West Bromwich Albion", "round":"5"},
    {"homeTeam":"West Ham United", "awayTeam":"Liverpool", "round":"5"},
    {"homeTeam":"Arsenal", "awayTeam":"Tottenham Hotspur", "round":"6"},
    {"homeTeam":"Chelsea", "awayTeam":"Aston Villa", "round":"6"},
    {"homeTeam":"Crystal Palace", "awayTeam":"Leicester City", "round":"6"},
    {"homeTeam":"Hull City", "awayTeam":"Manchester City", "round":"6"},
    {"homeTeam":"Liverpool", "awayTeam":"Everton", "round":"6"}
];

//this must come after examples, I think
exports.dummyData = function(req, res) {
    Fixture.create(examples,
        function(err) {
            if(err)
                return console.log(err);
            return res.jsonp(202);
        }
    );
};

//delte this function once testing is complete
exports.testGetResultThenScore = function (req, res) {

    //now set the the mongo id of this fixture
    //to test whole thing make this a fixture which users have predicted - so they'll get a score
    var id = mongoose.Types.ObjectId("5530f4edde6582f3038bb73b");
    console.log("Fake document id is: " + id);

    var fixture = {
        _id: id,
        fixDate: new Date(2015, 3, 26), //the month is 0 indexed
        fixResult: 0,
        homeTeam: "Everton",
        awayTeam: "Manchester United"
    };

    console.log("The string value of the fixDate is: " + _formattedDate(fixture.fixDate));

    //now invoke the function and pass in this fixture object
    //pass object in as json
    //TODO: evaulate if the callback is necessary?
    //TODO: SCHEDULE THIS TO GET RUN FOR EACH FIXTURE, AT THE END OF THE MATCH...
    _getFixtureResult(JSON.stringify(fixture), function () {
        res.jsonp('THE USERS WHO PREDICTED FOR THIS FIXTURE WERE GIVEN SCORES BASED OFF OF LIVE RESULTS!!!')
    });

    //return res.jsonp(202);
};

//delte this function once testing is complete
//USE THIS TO TEST GETTING REAL FIXTURES
exports.testGetRealFixtures = function (req, res) {

    //DROP DUMMY FIXTURES FIRST
    console.log("Removing old fixtures");
    Fixture.remove({}, function(error){
        if (error) return console.log(error);

        console.log("Getting new fixtures");
        //GET NEW REAL FIXTURES
        _getNextRealSeasonFixtures("EPL", function(result, data) { //todo: rearrange parameters to make arguments neater
            res.jsonp({
                "status" : result,
                "data"  : data
            }); //todo maybe remove this later on
        }); //give the name of the competition for which to get next fixtures
    });
};

//PRIVATE FUNCTIONS

//function to run through all of the fixtures and schedule for thier live results to be fetched
//then users to be scored on thier predictions of these live results
function _scheduleGetResultsAndScore() {
    //instantiate agenda


    //define the job to be run for each fixture

    //loop through all fixtures, schedule job to run for each

    //start the scheduler TODO: INVOKE THIS ELSEWHERE?
}

//function to fetch all the scheduled fixtures for an entire season and parse into our db
//USER MAY PASS IN START AND END DATES OF THE CHOSEN SEASON (NOT AVAILABLE VIA ANY API)
//TODO: Evaulate the way in which rounds are assigned to fixtures, rounds are purely ours, not THAT important.
function _getNextRealSeasonFixtures(competition, callback, fromDate, toDate, seasonStart, seasonEnd) {
    //map competition to comp code for football api

    //todo: Do we want dates that are in the past? For what purpose? NO PAST DATES.
    var competitionCode;

    //below differentiating between from/to dates and season dates for flexibility
    //if unspecified, may well be the same dates
    //THESE ARE THE ACTUAL START AND END DATES FOR THE EPL THIS YEAR

    //if no dates provided, use some specific ones.
    if (!fromDate) {
        //then set a default one
        //default to today!!!!

        fromDate = moment('01.01.2015', 'DD.MM.YYYY' );

        //use moment dates for ease of manipulation
        console.log("Will be retrieving fixtures from as early as: " + fromDate.toString());
    }

    if (!toDate) {
        //then set a default one as end of season

        //if no date is provided, use next year
        var today = new Date ();
        var thisYear = today.getFullYear();
        //toDate = moment([lastYear, 08, 13]); //this league ends 24 may this year
        toDate = moment([thisYear, 04, 24]); //this league ends 24 may this year
        console.log("Will be retrieving fixtures up to: " + toDate.toString());
    }

    //HERE, TAKE INTO ACCOUNT ANY BREAKS THAT HAVE OCCURED DURING SEASON, CHECK PARAM
    //if (!seasonStart) {
    //    //then set a default one
    //
    //    //if no date is provided, use last year
    //    seasonStart = moment([lastYear, 07, 16]);//this league start 16 aug last year
    //
    //    console.log("Setting the start of the season to be: " + seasonStart.toString());
    //}
    //
    //if (!seasonEnd) {
    //    //then set a default one
    //
    //    //if no date is provided, use next year
    //    seasonEnd = moment([thisYear, 04, 24]); //this league ends 24 may this year
    //    console.log("Setting the end of the season to be: " + seasonEnd.toString());
    //}

    //if no season dates, given set to default

    //use this conditional statement to take a generic competition name and map to an api specific code
    //this should allow us to prevent over dependence on any one particular api, allowing us to change
    switch(competition){
        case "EPL":
            competitionCode = '1204';
            break;
        default:
            console.log("The supplied competition name does not map to any supported competition");
            break;
        //implement throwing exceptions here
        //add more cases as the app supports more competitions
    }

    //now make a call to the api to get all of the scheduled fixtures for the given competitions upcoming season
    if (!competitionCode) {
    } else {
        //make a call to the api

        console.log("Now attempting to get the fixtures for the next season of the competition: " + competition);
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
                    var seasonFixtures = obj.matches;
                    var fixturesToStore = [];
                    console.log("The number of matches retrieved is: " + seasonFixtures.length);

                    //sort the results
                    seasonFixtures = _sortByMomentDate(seasonFixtures, 'match_formatted_date');
                    seasonFixtures.reverse(); //todo: replace this with sorting the properly (stop being lazy

                    console.log("Fixtures from server have now been sorted by date");

                    //BELOW CODE ATTEMPTS TO WORK OUT SEASON DATES FROM DATA... START WORKS FINE... NOUT ELSE


                    //
                    ////take first fix date as start of season
                    //var seasonStartDateRaw = seasonFixtures[0].match_formatted_date;
                    //console.log("The raw earliest date is: " + seasonStartDateRaw)
                    //seasonStart = moment(seasonStartDateRaw, "DD.MM.YYYY");
                    //
                    ////take end date as end of season
                    //var seasonEndDateRaw = seasonFixtures[seasonFixtures.length - 1].match_formatted_date;
                    //console.log("The raw latest date is: " + seasonEndDateRaw)
                    //seasonEnd = moment(seasonEndDateRaw, "DD.MM.YYYY");
                    //
                    //console.log("The new season start and end dates are:  \n Season Starts: " + seasonStart.toString() +
                    //        "\n Season Ends: " + seasonEnd.toString());

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

                        //for the first fixture
                        //if (i == 0) {

                        //check to see if equal with the start of the season

                        //console.log("Comparing season end: " + seasonEnd.toString() + " to last fixture: " +
                        //    thisFixtureDate.toString() + "\n The result is: " + (thisFixtureDate.isSame(seasonStart, "day")));
                        //
                        //if (thisFixtureDate.isSame(seasonEnd, "day")) {
                        //    console.log("The las fixture took place on the day of the season starting.");
                        //    fixtureRound = 1;
                        //} else {
                        //    console.log("NOT getting fixtures from start of season, getting a mid-season leg from: " +
                        //        fromDate.toString() + " and first fixture returned from API for this from_date is: " +
                        //        thisFixtureDate.toString());
                        //
                        //    console.log("In this case, finding the preceeding fixture from our database (by date)");
                        //
                        //    //then we have found a fixture not at the start of the season, get a previous fixture
                        //    Fixture.find({'fixDate' : { "$lte" : thisFixtureDate.toDate}}).sort({ 'fixDate' : -1}).exec(function(error, previousFixtures)
                        //    {
                        //
                        //        if (previousFixtures) {
                        //
                        //            console.log("The previously stored fixtures that precede the current one are: \n" +
                        //                JSON.stringify(previousFixtures));
                        //
                        //
                        //            //assign the found round and date of the fixture to the variables
                        //            previousFixtureDate = moment(previousFixtures[0].fixDate);
                        //            previousFixtureRound = previousFixtures[0].round;
                        //
                        //            console.log("The preceeding fixture was played on: " + previousFixtureDate +
                        //                " in round/gameweek: " + previousFixtureRound);
                        //        } else {
                        //            console.log("There were no previously stored fixtures, for our app, make this fixture be in the first round");
                        //
                        //            //leave previous fixture date null for now.
                        //            previousFixtureRound = 1;
                        //        }
                        //    });
                        //}
                        //}

                        //console.log("The current fixture date (in moment format) is: " + thisFixtureDate.toString());
                        //console.log("The previous fixture date is: " + previousFixtureDate.toString());


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

                            while(!previousTuesdayFound) {
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
                            if (thisFixtureDate < previousTuesday ) {
                                console.log("The previous (descending so in time, next) fixture round is: " + previousFixtureRound);
                                fixtureRound = previousFixtureRound - 1; //todo: check if ++ would mute original
                                console.log("This fixture belongs in the previous round: " + fixtureRound);
                            } else {
                                fixtureRound = previousFixtureRound;
                                console.log("The previous (descending so in time, next) fixture round is: " + previousFixtureRound);
                                console.log("This fixture belongs in the same round as the previous fixture: " + fixtureRound);
                            }
                        }

                        console.log("This fixture belongs to gameweek/round: " + fixtureRound);

                        //todo: these are not being parsed properly
                        //parse match times for storage
                        var kickOffTime = moment(thisFixtureDate)

                        //parse this differently
                        kickOffTime.hour(currentFixture.match_time.substr(0,1));
                        kickOffTime.minutes(currentFixture.match_time.substr(3,4));
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

                        //todo: extract this out into a function
                        var homeTeamResult = tempAPIResult.charAt(1);
                        var awayTeamResult = tempAPIResult.charAt(3);

                        var localFixResult = 0;

                        //Now process this result into a usable format for our server (1, 2 or 3)
                        //1 = home win, 2 = away win, 3 = draw
                        if (homeTeamResult > awayTeamResult) {
                            //then this was a home win
                            localFixResult = 1;
                            //console.log("The match was a home win.");
                        } else if (homeTeamResult < awayTeamResult) {
                            //then this was an away win
                            localFixResult = 2;
                            //console.log("The match was an away win.");
                        } else if (homeTeamResult == awayTeamResult) {
                            //then this was a draw
                            localFixResult = 3;
                            //console.log("The match was a draw.");
                        }

                        //now construct new object to add
                        //todo: decalre new fixture above and then redeclare on each iteration for efficiency?
                        var newFixture = {
                            homeTeam: currentFixture.match_localteam_name,
                            awayTeam: currentFixture.match_visitorteam_name,
                            round: fixtureRound,
                            fixDate: convertedDate,
                            fixResult: localFixResult, //for no current result
                            kickOff: kickOffSave,
                            halfTime: halfTimeSave,
                            fullTime: fullTimeSave
                        };

                        //console.log("The fixture being added to the database is: \n" + JSON.stringify(newFixture));

                        fixturesToStore.push(JSON.stringify(newFixture));

                        //TODO: Implement break if something fucks up
                        //Now move on to the next fixture

                        //Assign the previous fixture for the next iteration
                        previousFixtureDate = thisFixtureDate;
                        previousFixtureRound = fixtureRound; //todo: need to clear this variable before iterating?
                    }

                    fixturesToStore = "[" + fixturesToStore + "]";
                    //console.log("Fixtures about to be saved are: " + fixturesToStore);

                    fixturesToStore = JSON.parse(fixturesToStore);

                    //once the loop has run it's course and created the whole list of fixtures, save to db
                    //need to access the MongoDB driver directly as large dataset crashes .create mongoose method
                    Fixture.collection.insert(fixturesToStore, function (err, fixtures) {
                        if (err)
                            return console.log(err);
                        console.log("All of the new fixtures were saved to the database successfully!");
                        callback(202, fixtures); //function's all done!
                    });

                } else {
                    //something went wrong, return
                    console.log("Something went wrong: " + obj.ERROR);
                    callback(503, obj.ERROR); //something broke
                }
            });
        });
    }
}


//function to check existing fixtures and live schedule, to update any changes to fixtures
//SCHEDULE THIS TO BE RUN REGULARLY TO KEEP OUR FIXTURE DATA UP TO DATE.
function _fixtureSync(competition) {
    //get all fixtures from our db

    //get all fixtures from api - set fromDate as today - or start of season
    //if season started , today else, start of season in future
    //to date is end of season

    //compare stored fixtures to returned, if different, update

}

//this function will be sheduled to run for each fixture.
//function to take a local fixture and retrieve the live result from 3rd party football-api
//once this has been tested, pass in a callback and test it upon success.
function _getFixtureResult(fixtureData, callback) {

    //TODO: implement date validation here that the fixture occurred in the past

    console.log("Now attempting to get the live result for the fixture: " + fixtureData);

    //1. Query the API to get matches on the given fixture date

    //parse the date into an object
    console.log("Now parsing the fixture into an object.");
    var fixture = JSON.parse(fixture);

    console.log("Now contacting 3rd party API football-api to get real-world fixture data.");

    var fixtureDate = _formattedDate(fixture.fixDate); //TODO: Need to parse this date into dd.mm.yyyy from js date
    console.log("The formatted date being sent in the API query is: " + fixtureDate);

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

                if ((currentAPIFixture.match_localteam_name == fixture.homeTeam) && (currentAPIFixture.match_visitorteam_name == fixture.awayTeam)) {
                    //then this is the fixture of which we want to process the result.

                    //3. Now assign the result of the match to our fixture and put in appropriate format.

                    //set the found flag to active
                    fixFound = true;

                    //extract the result and put into usable form
                    var tempAPIResult = currentAPIFixture.match_ft_score;
                    console.log("The result of the relelvant fixture from the football-api.com API is: " + tempAPIResult);

                    //todo: extract this out into a function
                    var homeTeamResult = tempAPIResult.charAt(1);
                    var awayTeamResult = tempAPIResult.charAt(3);
                    console.log("The home team " + currentAPIFixture.match_localteam_name + " result is: " + homeTeamResult);
                    console.log("The away team " + currentAPIFixture.match_visitorteam_name + " result is: " + awayTeamResult);

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
                    }

                    //4. Now save the result to our fixture.
                    fixture.fixResult = localFixResult;

                    console.log("Now attempting to update the fixture with the obtained result");
                    //Now run a mongoose update
                    //TODO: Test this using simply {"_id" : fixture._id} also - more elegant
                    Fixture.update({"_id": fixture._id}, {fixResult: localFixResult}, function (err) {

                        //if there is an error, simply return straight back to the user
                        if (err) return console.log("An error occurred: " + err);

                        //fixture should now have been given the correct result
                        console.log("The fixture with id: " + fixture.id + " has now been given the live result");

                        /*TODO: MOVE ALL return statements out of server logic so that they immediately return to frontend and leave the server running
                         the only times this shouldn't happen is when returning an error message, use a condition to achieve this!*/

                        //once the fixture has been updated, invoke the callback function
                        console.log("The fixture has successfully been given the correct result, invoking callback");
                        //comment this out whilst testing main function, implement afterwards.
                        _scheduleScoreFilteredUsers(fixture, callback);

                    });
                }
            }

            if (!fixFound) {
                return "No live results found for this fixture.";
            }
        });
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

//handy array to quickly sort results
function _sortByMomentDate(array, key) {
    return array.sort(function(a, b) {

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

//find all users who made a prediction on a given fixture
//similar to the above function but only takes in a single fixture
function _scheduleScoreFilteredUsers(fixture, callback) {

    //This should only return users who have made a prediction for the given fixture
    User.find({'predictions.fixture': fixture._id}, function (error, users) {

        //for testing
        console.log("The number of returned users is: " + users.length);
        console.log("The users returned are: " + JSON.stringify(users));

        //invokes the score adder function passing in all users who are to be scored, and all fixtures
        _scoreAdder(0, users, fixture, function () {
            //feeds the callback method into the scoreadder method
            callback(null, 202); //this is fed in from the highest level
        });

    });
}

//used to recursively give all users who predicted an a given fixture a score when the result is determined
function _scoreAdder(i, users, fixture, callback) {
    if (i < users.length) {
        //place the current user's predictions into an array
        var preds = users[i].predictions;

        //get the current value of the user's score
        var score = users[i].score;

        //for each user, loop over all of the user's predictions and compare to current fixture
        for (var j = 0; j < preds.length; j++) {

            //if the user made a prediction for this fixture.
            //if the prediction was made for the current fixture
            if (preds[j].fixture == fixture._id) {

                //is this method of scoring correct? yes, if correct get a varying score, if wrong, get nothing
                //if the prediction was correct, update the user's score!
                if (preds[j].prediction == fixture.fixResult) {
                    score += preds[j].predictValue;
                }
            }
        }


        //if the score has been updated
        if (score != users[i].score) {
            //then save the change made to the user's score and recurse, scoring the next user
            User.findByIdAndUpdate(users[i]._id, {$set: {'score': score}}, function () {
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
