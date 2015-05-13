angular.module('starter.controllers', [])

    .controller('LoginCtrl', function ($scope, auth, $state, $ionicPopup, User) {

        auth.signin({

            //THIS IS WHERE TO CONFIGURE THE AUTH0 OPTIONS SUCH AS CLOSABLE ETC...

            // This is a must for mobile projects
            popup: true,
            // Make the widget non closeable
            standalone: true,
            closable: false,
            // This asks for the refresh token
            // So that the user never has to log in again
            offline_mode: true,
            device: 'Phone'
        }, function () {
            // Login was successful

            //TODO: TEST THIS BY CREATING A NEW USER AND SEEING IF USER DATA GETS LOGGED
            //check to see if this user exists on the server already, if not, create this user using auth0 details
            User.sync(auth.profile).then(function () {
                //Once the user data has been synced, get the user data object from our server also
                //Have to do in this callback otherwise we attempt to get the user data before the sync has finished
                User.getUserData(auth.profile.user_id);

                //Testing the user global service
                var currentUser = User.currentUser();
                console.log("The current user data stored on our server is: " + JSON.stringify(currentUser));

                $state.go('tab.rounds');

                //show an alert for testing purposes
                $ionicPopup.alert({
                    title: 'Login successful!',
                    template: 'Welcome ' + auth.profile.nickname + '! <br> This version of the app is mainly used for testing the backend <br> (So be nice)'
                }).then(function (res) {
                    console.log(auth.profile);
                });
            });

        }, function (error) {
            // Oops something went wrong during login:
            console.log("There was an error logging in", JSON.stringify(error));
        });

    })

    .controller('LeagueTableCtrl', function ($scope, LeagueTable) {

        //First retrieve all of the league table data and add it to the scope
        LeagueTable.all().then(function (data) {
            debugger;
            $scope.standings = data.teams; //we only want the actual standings data
            console.log($scope.standings); //TODO: This is purely for debugging purposes, remove where necessary.
        });

    })

    .controller('RoundsCtrl', function ($scope, $ionicLoading, Rounds) {

        //only publicly accessible elements get added to the scope

        Rounds.all().then(function (data) {
            //debugger;
            $scope.rounds = data.rounds;
        });

        //debugger
        $scope.remove = function (round) {
            Rounds.remove(round);
        };

    })

    .controller('SaveCtrl', function ($scope, $ionicPopup, $ionicHistory, SaveChanges) {
        //function to check that user is ready to leave without saving changes
        $scope.makeUnsavedChanges = function () {

            //ask if they are sure they want to go back if there are unsaved changes that would be lost
            debugger;

            if (SaveChanges.check()) {
                var confirmPopup = $ionicPopup.confirm({
                    title: 'Unsaved Changes',
                    template: 'Any unsaved changes to predictions will be lost'
                });
                confirmPopup.then(function (res) {
                    if (res) {
                        console.log('You are sure');
                        //then go on back!
                        //set save changes to false
                        SaveChanges.saveChangesNotNeeded();
                        $ionicHistory.goBack();
                    } else {
                        console.log('You are not sure');
                        //stay in this view
                    }
                });
            } else {
                //just go back
                $ionicHistory.goBack();
            }
        };
    })

    .controller('RoundDetailCtrl', function ($scope, $ionicPopup, $stateParams, $ionicActionSheet, Rounds, SaveChanges,
                                             auth, TDCardDelegate) {
        debugger;

        var cardTypes = [
            { image: '../img/***REMOVED***.png', title: 'So much grass #hippster'},
            { image: '../img/max.jpg', title: 'Way too much Sand, right?'},
            { image: '../img/perry.jpg', title: 'Beautiful sky from wherever'},
        ];

        $scope.cards = [];

        $scope.addCard = function(i) {
            var newCard = cardTypes[Math.floor(Math.random() * cardTypes.length)];
            newCard.id = Math.random();
            $scope.cards.push(angular.extend({}, newCard));
        }

        for(var i = 0; i < 3; i++) $scope.addCard();

        $scope.cardSwipedLeft = function(index) {
            console.log('Left swipe');
        }

        $scope.cardSwipedRight = function(index) {
            console.log('Right swipe');
        }

        $scope.cardDestroyed = function(index) {
            $scope.cards.splice(index, 1);
            console.log('Card removed');
        }

        var _predictions = [];
        var updatePredictions = false; //flag to update predictions if some already exist.
        var user = auth.profile.user_id; //get the universally unique user_id

        //create variables to tell the delete and clear buttons whether or not they should be enabled
        $scope.deleteDisabled = false;
        $scope.clearDisable = false;

        //set the need for changes to be saved to be false by default
        SaveChanges.saveChangesNotNeeded();

        //Get the data for this particular round from the server
        Rounds.get($stateParams.roundId).then(function (data) {

            //when first loading the page, clear out any local existing predictions.
            _predictions = [];

            //$ionicLoading.hide();
            $scope.fixtures = data;

            //every time a new set of fixtures is loaded, clear predictions
            debugger;
            _getExistingPredictions();

        });

        var predictionMap = {
            1: "Home Win!",
            2: "Away Win!",
            3: "Draw!"
        };

        function _getExistingPredictions() {

            //go and get all of the predictions for the user
            Rounds.getExistingPredictions(user, $stateParams.roundId).then(function (data) {
                //clear existing predictions
                _predictions = [];

                debugger;

                $scope.existingPredictions = data;
                $scope.predictionsOnServer = data;

                var currentFixturePrediction = null;

                if ($scope.existingPredictions.length) {

                    //as there are some predictions, enable the delete and clear buttons
                    $scope.deleteDisabled = false;
                    $scope.clearDisabled = false;

                    //now loop over fixtures and add in these predictions!
                    for (var i = 0; i < $scope.fixtures.length; i++) {

                        currentFixturePrediction = predictionMap[$scope.existingPredictions[i].prediction];

                        $scope.fixtures[i].prediction = currentFixturePrediction;
                    }

                    updatePredictions = true; //only set this if there are existing predictions!
                } else {
                    //if there are no existing predictions on the server for this round for this user
                    $scope.deleteDisabled = true;
                    $scope.clearDisabled = true;
                }

                for (var j = 0; j < $scope.existingPredictions.length; j++) {
                    _predictions.push({
                        fixture: $scope.existingPredictions[j].fixture,
                        prediction: $scope.existingPredictions[j].prediction
                    });
                }

            });
        }

        function _predictionExists(fixture) {

            var found = -1;

            for (var i = 0; i < _predictions.length; i++) {
                if (fixture == _predictions[i].fixture) {
                    //then the fixture has had a prediction made for it
                    found = i;
                    break; //breaks out of the inner loop
                }
            }

            return found;
        }

        function _addFixturePrediction(fixture, prediction) {

            //mark changes as requiring saving
            SaveChanges.saveChangesNeeded();

            //enable the clear button now that a prediction has been made
            if ($scope.clearDisabled) {
                $scope.clearDisabled = false;
            }

            //find out if the current fixture has a prediction and if so, the position in the list
            var existingPredictionPosition = _predictionExists(fixture);

            if (existingPredictionPosition != -1) {

                //then update this current fixture using the position in the predictions array
                _predictions[existingPredictionPosition] = {fixture: fixture, prediction: prediction};

            } else { //else if a prediction for this fixture does not already exist...

                _predictions.push({fixture: fixture, prediction: prediction});
            }

            //Now update the prediction within the fixtures array
            //Will have to find the correct prediction first, for loop
            for (var i = 0; i < $scope.fixtures.length; i++) {
                //if matching fixture update the prediction
                if ($scope.fixtures[i]._id == fixture) {

                    debugger;

                    //then appropriately update the prediction
                    $scope.fixtures[i].prediction = predictionMap[prediction];
                }
            }

            //Now check to see if

        }

        $scope.predictHomeWin = function (fixture) {
            console.log("Predict home win");
            _addFixturePrediction(fixture, 1);
        };

        $scope.predictAwayWin = function (fixture) {
            console.log("Predict away win");
            _addFixturePrediction(fixtre, 2);

        };

        $scope.predictDraw = function (fixture, index) {
            console.log("Predict draw")
            _addFixturePrediction(fixture);
            $scope.cardDestroyed(index) //give this the indexre, 3);
        };

        //uncomment this section to re-instate background colour functionality
        var colourMap = {
            1: "home-win-predicted",
            2: "away-win-predicted",
            3: "draw-predicted"
        };

        $scope.getBackgroundColour = function (fixture) { //should be passing in the entire fixture object

            var predictionClass;

            //find prediction for this fixture
            for (var i = 0; i < _predictions.length; i++) {
                if (fixture._id == _predictions[i].fixture) {
                    //then return the prediction for this fixture else leave undefined
                    predictionClass = _predictions[i].prediction;
                }
            }

            return colourMap[predictionClass];
        };

        //clear out all predictions at once
        $scope.clearAllPredictions = function () {

            debugger;

            //disable the clear button now that there are no predictions to be cleared
            $scope.clearDisabled = true;

            //set predictions array to be empty
            _predictions = [];

            //clear all fixtures.predictions
            for (var i = 0; i < $scope.fixtures.length; i++) {
                //clear out all predictions in the models to update the view.
                $scope.fixtures[i].prediction = null;
            }

            //if no existing no save needed, otherwise, would need to save changes (by selecting more and saving)
            if ($scope.existingPredictions.length == 0) {
                //then there were no predictions made to begin with, so no need to save
                SaveChanges.saveChangesNotNeeded();
            } else {
                //else there were predictions beforehand, and these changes may want to be saved
                SaveChanges.saveChangesNeeded();
            }
        };

        //clear out a single prediction at a time
        //will only not prompt if there were no predictions to begin with - dealing with this use case

        $scope.clearSinglePrediction = function (fixture) {

            debugger;

            //clear prediction for given fixture
            for (var i = 0; i < $scope.fixtures.length; i++) {
                if ($scope.fixtures[i]._id == fixture._id) {
                    $scope.fixtures[i].prediction = null;
                }
            }

            //delete the prediction from the private array
            //find prediction for this fixture
            for (var i = 0; i < _predictions.length; i++) {
                if (fixture._id == _predictions[i].fixture) {
                    //then return the prediction for this fixture else leave undefined
                    _predictions.splice(i, 1); //delete this object from the predictions array.
                }
            }

            //assume that a save will be needed and negate this if necessary
            SaveChanges.saveChangesNeeded();

            var saveNeeded = false; //flag to denote if the user needs to save any changes or not

            //only loop if there were no predictions made to begin with
            if ($scope.existingPredictions.length == 0) {
                //loop over all fixtures, if any now have predictions, then warn user to save changes
                for (var i = 0; i < $scope.fixtures.length; i++) {
                    //if a prediction exists for this fixture, warn to save
                    if ($scope.fixtures[i].prediction) {
                        //change flag
                        saveNeeded = true;
                    }
                } //for

                //if after loop the flag is true, mark changes as being in need of saving
                if (saveNeeded) {
                    SaveChanges.saveChangesNeeded();
                } else {
                    SaveChanges.saveChangesNotNeeded();
                }
            }

            //check whether or not to disable the clear all button
            debugger;
            if (_predictions.length == 0) {
                $scope.clearDisabled = true;
            }
        };

        //once predictions are all validated, and predict button send, send all predictions
        $scope.sendPredictions = function () { //TODO: Add username to the state params

            //mock out the username for now.

            var user = auth.profile.user_id;

            //TODO: Try to replace the below for loops with angular.forEach
            //Validate that predictions have been made for every fixture in this round

            //if predictions array contains every fixture id from the round

            //outer loop
            //iterate over each of the fixtures and ensure it exists within the list of predictions
            var found;
            var validPredictions = false;
            var indexOfTheFuckingLoop = 0; //TODO: Change the name, here because of a weird error I was getting;
            var predictionsToUpdate = [];
            for (; indexOfTheFuckingLoop < $scope.fixtures.length; indexOfTheFuckingLoop++) {

                found = false;

                //access the value of the current fixture here once per iteration
                var currentFixture = $scope.fixtures[indexOfTheFuckingLoop]._id;

                //now iterate over each item in the predictions array
                //inner loop
                for (var j = 0; j < _predictions.length; j++) {
                    if (currentFixture == _predictions[j].fixture) {
                        //then the fixture has had a prediction made for it
                        found = true;
                        break; //breaks out of the inner loop
                    }
                }

                if (!found) {
                    //throw an error because a prediction was not made for all fixtures

                    //alert the user, use the ionicPopUp service
                    $ionicPopup.alert({
                        title: 'Woah there!',
                        template: 'Please make a prediction for every fixture in the round!'
                    });

                    //now clear out the predictions to start again
                    //_predictions = [];

                    break;
                }

                //if we are looking at the last fixture in the round, and all of them have been found.
                if ((indexOfTheFuckingLoop == ($scope.fixtures.length - 1)) && (found)) {

                    debugger;
                    validPredictions = true;
                    found = false;
                }

            }

            //after validating the predictions, see if the predictions are the same as those on server
            //if no changes have been made, don't bother and exit out and shout at the user

            //if the predictions are valid, send them off to the server
            if (validPredictions) {

                debugger;

                var diffFlag = false;

                for (var i = 0; i < _predictions.length; i++) {
                    //loop over and compare to

                    //if there are existing predictions, compare
                    if ($scope.existingPredictions.length) {
                        for (var j = 0; j < $scope.existingPredictions.length; j++) {
                            //if the prediction for matching fixtures is different...
                            if ((_predictions[i].fixture == $scope.existingPredictions[j].fixture) && !(_predictions[i].prediction == $scope.existingPredictions[j].prediction)) {
                                //trigger the diffFlag
                                diffFlag = true; //there is a difference between the predictions on the server and new ones.
                                break; //break out of the inner loop
                            }
                        }
                    } else {
                        //there are no existing predictions, so new values will always be different
                        diffFlag = true;
                    }

                    //check the diffFlag before iterating
                    if (diffFlag) {
                        //exit the outer loop
                        break;
                    }
                }

                //Now check to see if new and old predictions are the same via the flag
                if (diffFlag == false) {
                    $ionicPopup.alert({
                        title: 'Predictions Unchanged!',
                        template: 'The predictions you are submitting are the same as those on the server, change some and try again.'
                    });

                    //exit the function
                    return;
                }

                debugger;
                //Send the validatied predictions

                //check to see if we are making new predictions or updating old ones
                if (updatePredictions) {
                    //update existing predictions!
                    debugger;

                    //warn user that updating will mean points get lost
                    $ionicPopup.confirm({
                        title: 'Updating means less points!',
                        template: 'Are you sure you want to update? Doing so will mean you earn less points.'
                    }).then(function (res) {
                        if (res) {
                            console.log('You are sure');
                            //then continue as normal


                            //compare differences of new predictions to old ones, add to array of predictions to update
                            //loop over old predictions and compare to new
                            for (var i = 0; i < $scope.predictionsOnServer.length; i++) { //arrays are indexed by 0

                                var currentExistingPrediction = $scope.predictionsOnServer[i];

                                for (var j = 0; j < _predictions.length; j++) {

                                    var currentUpdatedPrediction = _predictions[j];

                                    //if fixture id is the same, but the prediction is different
                                    if ((currentExistingPrediction.fixture == currentUpdatedPrediction.fixture) &&
                                        (currentExistingPrediction.prediction != currentUpdatedPrediction.prediction)) {

                                        //TODO: Here assign the fixture ID back into the prediction to be updated!!!
                                        debugger;
                                        currentUpdatedPrediction._id = currentExistingPrediction._id;

                                        //add this prediction to the list of predictions to be updated
                                        predictionsToUpdate.push(currentUpdatedPrediction);
                                    }
                                }
                            }

                            //once you have a list of predictions to update, async for loop and update
                            for (var i = 0, c = predictionsToUpdate.length; i < c; i++) {
                                // creating an Immiedately Invoked Function Expression
                                (function (prediction) {

                                    //call the async function
                                    Rounds.updatePrediction(user, prediction);

                                })(predictionsToUpdate[i]); //use dogballs (a closure)
                                // passing predictions[i] in as "path" in the closure
                            }

                            //mark changes as not being required.
                            SaveChanges.saveChangesNotNeeded();

                            //now enable the delete and clear buttons also
                            $scope.deleteDisabled = false;
                            $scope.clearDisabled = false;


                            //tell the user things have been updated
                            $ionicPopup.alert(
                                {
                                    title: 'Your predictions have been updated!',
                                    template: 'Let\'s hope you do better than you previously would have!'
                                });

                        } else {
                            console.log('You are not sure');
                            //leave the function

                        }
                    });

                } else { //make a set of new predictions
                    Rounds.makePredictions(user, $stateParams.roundId, _predictions);

                    $ionicPopup.alert({
                        title: 'Your predictions have been made!',
                        template: 'Let\'s hope you do well!'
                    });

                    //changes have just been saved so no longer need this
                    SaveChanges.saveChangesNotNeeded();

                    //_getExistingPredictions();

                    //enable the delete button
                    $scope.deleteDisabled = false;
                }
            }
        };

        $scope.deleteRoundPredictions = function () {


            var confirmPopup = $ionicPopup.confirm({
                title: 'Confirm Delete',
                template: 'Are you sure you want to delete the predictions for this round? \n You\'ll lose 20 points!'
            });

            confirmPopup.then(function (res) {

                if (res) {

                    console.log('You are sure');

                    Rounds.deleteRoundPredictions(user, $stateParams.roundId).then(function () {

                            $ionicPopup.alert(
                                {
                                    title: 'Your predictions for this round have been deleted!',
                                    template: 'Have another go!'
                                }
                            );

                            //need to delete all predictions from $scope.fixtures
                            for (var i = 0; i < $scope.fixtures.length; i++) {
                                //for each, remove the prediction
                                $scope.fixtures[i].prediction = null;
                            }

                            //$scope.$apply(); //try to get ui to refresh!

                            //changes have been saved
                            SaveChanges.saveChangesNotNeeded();

                            _getExistingPredictions();

                            //disable delete button
                            $scope.deleteDisabled = true;

                            //disbale clear button
                            $scope.clearDisabled = true;
                        }
                    );
                } else {
                    console.log('You are not sure');
                }
            });
        };

        //here parse the round's fixture data into the cards to be rendered
        $scope.cards = [
            { test: "test1" },
            { test: "test2" }
        ];

        $scope.cardDestroyed = function(index) {
            $scope.cards.splice(index, 1);
        };

        $scope.cardSwiped = function(index) {
            var newCard = // new card data
                $scope.cards.push(newCard);
        };
    })

    .controller('ScoreboardCtrl', function ($scope, Scoreboard) {
        $scope.test = function () {
            $ionicPopup.alert({
                title: 'Sup dawg!',
                template: 'Sub bitchtits'
            });
        };
    })

    .controller('PrivateLeaguesCtrl', function ($scope, $state, PrivateLeagues, auth, $ionicPopup) {

        //get all of the private leagues for the user from the private league service
        //call this  whenever the user's leagues need to be updated within the app
        function _getUserLeagues () {
            PrivateLeagues.all(auth.profile.user_id).then(function (data) {
                //debugger;
                $scope.privateLeagues = data;

                console.log(data);

                //work out which of the private leagues were made by user and which part of
                $scope.createdLeagues = [];

                //the private league's of which the user is only a member
                $scope.inLeagues = [];

                for (var i = 0; i < data.length; i++) {
                    if (data[i].creator = auth.profile.user_id) {
                        //then is a league created by the currently logged in user, so add to list
                        console.log('Now pushing private league ' + data[i] + ' on to user\'s created league\'s array');
                        $scope.createdLeagues.push(data[i]);
                    } else {
                        //the user is simply a participating member of this league
                        console.log('Now pushing private league ' + data[i] + ' on to user\'s member array');
                        $scope.inLeagues.push(data[i]);
                    }
                }

                console.log('User\'s created leagues are: ' + $scope.createdLeagues);

            });
        }

        //when page first loads
        _getUserLeagues();

        $scope.data = {};
        var cancelled = true;

        $scope.createNewLeague = function () {

            //show the user a prompt to type in a username and
            var myPopup = $ionicPopup.show({
                template: '<input type="text" ng-model="data.leagueName">',
                title: 'New Private League',
                subTitle: 'Enter the name for the new league',
                scope: $scope,
                buttons: [
                    {text: 'Cancel'},
                    {
                        text: '<b>Create</b>',
                        type: 'button-positive',
                        onTap: function (e) {
                            if (!$scope.data.leagueName) {
                                //don't allow the user to close unless he enters a username
                                e.preventDefault();
                            } else {
                                cancelled = false;
                                return $scope.data.leagueName;
                            }
                        }
                    }
                ]
            });
            myPopup.then(function (res) {
                if (!cancelled) {
                    //use the data to call through to the user and pass through the provided username
                    PrivateLeagues.createNewLeague(auth.profile.user_id, $scope.data.leagueName).then(
                        function (res) {

                            //check the message that was returned...
                            console.log(res);

                            //Confirm that the invitation has been sent
                            $ionicPopup.alert({
                                title: 'New Private League',
                                template: res //TODO: Alter the multiple uses of this
                            });

                            //reset flag
                            cancelled = true;
                        }
                    );
                }
            });
        };

        //function to join a private league using its code
        $scope.joinLeagueWithCode = function () {
            //show the user a prompt to type in a username and
            var myPopup = $ionicPopup.show({
                template: '<input type="text" ng-model="data.leagueToJoin">',
                title: 'Join league with code',
                subTitle: 'Enter the code of the private league to join.',
                scope: $scope,
                buttons: [
                    {text: 'Cancel'},
                    {
                        text: '<b>Join</b>',
                        type: 'button-positive',
                        onTap: function (e) {
                            if (!$scope.data.leagueToJoin) {
                                //don't allow the user to close unless he enters a code
                                e.preventDefault();
                            } else {
                                cancelled = false;
                                return $scope.data.leagueToJoin;
                            }
                        }
                    }
                ]
            });
            myPopup.then(function (res) {

                if (!cancelled) {
                    //validate the code, check 8 characters and all numbers

                    console.log("Now attempting validation before sending code");

                    //check that the code is 7 characters long
                    var isnum = /^\d+$/.test($scope.data.leagueToJoin);

                    //check that the code contains only numbers
                    if (!isnum || $scope.data.leagueToJoin.length != 7) {
                        //then invalid code was entered
                        $ionicPopup.alert({
                            title: 'Error! Invalid League Code',
                            template: 'Please ensure you are entering a valid 7 digit numerical league code.'
                        });

                        return;
                    }

                    //use the data to call through to the user and pass through the provided username
                    PrivateLeagues.joinLeagueWithCode(auth.profile.user_id, $scope.data.leagueToJoin).then(
                        function (res) {

                            //check the message that was returned...
                            console.log(res);

                            //Confirm that the invitation has been sent
                            $ionicPopup.alert({
                                title: 'Private League Joined',
                                template: 'Yes! Get In! You\'ve joined the private league ' + $scope.data.leagueToJoin
                            });

                            //reset flag
                            cancelled = true;

                            //TODO: look up how to take that user directly to that league now
                            //TODO: REFRESH  the page to display that new league
                            //Would have to go and get leagues again

                            console.log("Now attempting to refresh the page")
                            _getUserLeagues();
                        }
                    );
                }
            });
        };

    })

    .controller('PrivateLeaguesDetailCtrl', function ($scope, PrivateLeagues, auth, $stateParams, $ionicPopup, $state,
                                                      $cordovaSocialSharing, User) {

        $scope.shouldShowDelete = false;

        //enable delete buttons
        $scope.toggleDelete = function () {
            $scope.shouldShowDelete = !$scope.shouldShowDelete;
        };

        console.log('Now getting the private league with id: ' + $stateParams.privateLeagueId);//Get the data for this particular league from the server
        //Get the data for this particular round from the server

        //call this functino whenever the private leage data needs to be refreshed
        function _getPrivateLeagueData () {
            PrivateLeagues.get(auth.profile.user_id, $stateParams.privateLeagueId).then(function (data) {

                //$ionicLoading.hide();
                $scope.privateLeague = data[0];
                console.log('Retrieved private leauge:' + JSON.stringify(data));
            });
        }

        //when first loading in the tab, get league data
        _getPrivateLeagueData();

        //TODO: GO BACK AND ONLY EXPOSE DATA TO THE SCOPE VIA A DATA OBJECT IN THE SAME MANNER AS THIS
        //create scope variable to store provided usernames
        $scope.data = {};
        $scope.user_id = auth.profile.user_id;

        var cancelled = true;

        //function to facilitate inviting a new user
        //$scope.inviteUser = function () {
        //    //show the user a prompt to type in a username and
        //    var myPopup = $ionicPopup.show({
        //        template: '<input type="text" ng-model="data.userToInvite">',
        //        title: 'Invite new member',
        //        subTitle: 'Enter username of person to invite',
        //        scope: $scope,
        //        buttons: [
        //            {text: 'Cancel'},
        //            {
        //                text: '<b>Invite</b>',
        //                type: 'button-positive',
        //                onTap: function (e) {
        //                    if (!$scope.data.userToInvite) {
        //                        //don't allow the user to close unless he enters a username
        //                        e.preventDefault();
        //                    } else {
        //                        cancelled = false;
        //                        return $scope.data.userToInvite;
        //                    }
        //                }
        //            }
        //        ]
        //    });
        //    myPopup.then(function (res) {
        //
        //        if (!cancelled) {
        //            //validate the username, check not user's or existing member
        //
        //            console.log("Now attempting validation before sending invitation");
        //
        //            console.log("The creator of the private league is: " + $scope.privateLeague.creator);
        //
        //            //check that the user has not attempted to invite themselves
        //            if ($scope.data.userToInvite == auth.profile.nickname) {
        //                console.log("The username of the creator of the private league is: " + $scope.privateLeague.creator);
        //                console.log("The invitation was not sent because ysou can not invite yourself");
        //
        //                //then this user has already been invited
        //                $ionicPopup.alert({
        //                    title: 'Error! Invite Not Sent',
        //                    template: 'You can not invite yourself to join this league! (You\'re already in it).'
        //                });
        //
        //                return
        //            }
        //
        //            //check that user has not already been invited
        //            for (var i = 0; i < $scope.privateLeague.members.length; i++) {
        //
        //                console.log("Now checking member in the private league: " + $scope.privateLeague.members[i].username);
        //
        //                if ($scope.privateLeague.members[i].username == $scope.data.userToInvite) {
        //
        //                    validUser = false;
        //                    memberExists = true;
        //
        //                    //then this user has already been invited
        //                    $ionicPopup.alert({
        //                        title: 'Error! Invite Not Sent',
        //                        template: 'This user has already been invited/ is a member.'
        //                    });
        //
        //                    console.log("The invitation was not sent as this user has already been invited to this league.");
        //
        //                    return;
        //                }
        //            }
        //
        //            //use the data to call through to the user and pass through the provided username
        //            PrivateLeagues.inviteNewMember(auth.profile.user_id, $scope.data.userToInvite, $scope.privateLeague.privateLeagueId).then(
        //                function (res) {
        //
        //                    //check the message that was returned...
        //                    console.log(res);
        //
        //                    //Confirm that the invitation has been sent
        //                    $ionicPopup.alert({
        //                        title: 'Invitation',
        //                        template: res
        //                    });
        //
        //                    //reset flag
        //                    cancelled = true;
        //
        //                    //Refresh the list of invited users
        //                    _getPrivateLeagueData();
        //
        //                }
        //            );
        //        }
        //    });
        //};

        $scope.renameLeague = function () {
            //show the user a prompt to type in a username and
            var myPopup = $ionicPopup.show({
                template: '<input type="text" ng-model="data.newLeagueName">',
                title: 'Rename league',
                subTitle: 'Enter the new name for the league',
                scope: $scope,
                buttons: [
                    {text: 'Cancel'},
                    {
                        text: '<b>Rename</b>',
                        type: 'button-positive',
                        onTap: function (e) {
                            if (!$scope.data.newLeagueName) {
                                //don't allow the user to close unless he enters a username
                                e.preventDefault();
                            } else {
                                cancelled = false;
                                return $scope.data.newLeagueName;
                            }
                        }
                    }
                ]
            });
            myPopup.then(function (res) {

                if (!cancelled) {
                    //validate the username, check not user's or existing member

                    console.log("Now attempting validation before renaming");

                    console.log("The creator of the private league is: " + $scope.privateLeague.creator);

                    //check that the user has not attempted to invite themselves
                    if ($scope.data.newLeagueName == $scope.privateLeague.privateLeagueName) {
                        console.log("The username of the creator of the private league is: " + $scope.privateLeague.creator);
                        console.log("You can only rename the league if you are giving it a new name.");

                        //then this user has already been invited
                        $ionicPopup.alert({
                            title: 'Error! League not renamed!',
                            template: 'To rename this league you must give it a new name.'
                        });

                        return
                    }

                    //use the data to call through to the user and pass through the provided username
                    PrivateLeagues.renameLeague(auth.profile.user_id, $scope.data.newLeagueName, $scope.privateLeague.privateLeagueId).then(
                        function (res) {

                            //check the message that was returned...
                            console.log(res);

                            //Confirm that the invitation has been sent
                            $ionicPopup.alert({
                                title: 'Rename',
                                template: res
                            });

                            //reset flag
                            cancelled = true;

                            //Refresh the name of the league as stored on the server
                            _getPrivateLeagueData();

                        }
                    );
                }
            });
        };

        $scope.leaveLeague = function () {
            //show the user a prompt to type in a username and
            var myPopup = $ionicPopup.confirm({
                title: 'Confirm Leaving',
                template: 'Are you sure you want to leave this private league?'
            });
            myPopup.then(function (res) {
                if (res) {
                    //use the data to call through to the user and pass through the provided username
                    PrivateLeagues.leaveLeague(auth.profile.user_id, $scope.privateLeague.privateLeagueId).then(
                        function (res) {
                            //check the message that was returned...
                            console.log(res);

                            //Confirm that the invitation has been sent
                            $ionicPopup.alert({
                                title: 'League Left',
                                template: 'The private league was left successfully!'
                            });

                            //update the local user data
                            User.getUserData();

                            //take the user back to the list of private leagues
                            $state.go('tab.scoreboard-private-leagues');
                        }
                    );
                }
            });
        };

        $scope.deleteMember = function (user_id_to_delete) {
            //show the user a prompt to type in a username and
            var myPopup = $ionicPopup.confirm({
                title: 'Confirm Deletion',
                template: 'Are you sure you want to remove the member from this private league?'
            });
            myPopup.then(function (res) {
                if (res) {
                    //use the data to call through to the user and pass through the provided username
                    PrivateLeagues.deleteMember(auth.profile.user_id, user_id_to_delete, $scope.privateLeague.privateLeagueId).then(
                        function (res) {
                            //check the message that was returned...
                            console.log(res);

                            //Confirm that the invitation has been sent
                            $ionicPopup.alert({
                                title: 'Member Deleted',
                                template: 'The member was removed from the league successfully!'
                            });

                            //update the local user data
                            User.getUserData();

                            _getPrivateLeagueData();

                        }
                    );
                }
            });
        };

        $scope.deleteLeague = function () {
            //show the user a prompt to type in a username and
            var myPopup = $ionicPopup.confirm({
                title: 'Confirm Delete',
                template: 'Are you sure you want to delete this entire private league?'
            });
            myPopup.then(function (res) {

                if (res) {
                    //validate the username, check not user's or existing member

                    //TODO: Remove this is it is an unnecessary precaution
                    //check that the user has not attempted to invite themselves
                    if (!$scope.user_id == $scope.privateLeague.creator) {
                        console.log("The username of the creator of the private league is: " + $scope.privateLeague.creator);
                        console.log("Only the creator of a league can delete it!.");

                        //then this user has already been invited
                        $ionicPopup.alert({
                            title: 'Error! League not deleted!',
                            template: 'To delete this league you must have created it.'
                        });

                        return
                    }

                    //use the data to call through to the user and pass through the provided username
                    PrivateLeagues.deleteLeague(auth.profile.user_id, $scope.privateLeague.privateLeagueId).then(
                        function (res) {
                            //check the message that was returned...
                            console.log(res);

                            //Confirm that the invitation has been sent
                            $ionicPopup.alert({
                                title: 'Deleted',
                                template: 'The private league was deleted successfully!'
                            });

                            //take the user back to the list of private leagues
                            $state.go('tab.scoreboard-private-leagues');
                        }
                    );
                }
            });
        };

        //Implementing sharing of the private league code - for an open invitation
        $scope.shareLeague = function() {
            //$cordovaSocialSharing.share("This is your message", "This is your subject", "www/imagefile.png", "http://blog.nraboy.com");
            console.log("Share functin invoked.");
            $cordovaSocialSharing.share("Join my Yes! Get In! Private league using code: \n\t" + $scope.privateLeague.privateLeagueCode, "Join my Yes! Get In! Private League", null, "http://www.yesgetin.com");
        };

        //$scope.shareViaTwitter = function(message, image, link) {
        //    $cordovaSocialSharing.canShareVia("twitter", message, image, link).then(function(result) {
        //        $cordovaSocialSharing.shareViaTwitter(message, image, link);
        //    }, function(error) {
        //        alert("Cannot share on Twitter");
        //    });
        //}

    })

    .controller('GlobalScoreboardCtrl', function ($scope, Scoreboard, auth) {

        //Get the global scoreboard
        //Get the data for scores for leaderboard
        Scoreboard.all().then(function (data) {
            $scope.scores = data;
        });

    })

    .controller('AccountCtrl', function ($scope, $state, User, auth, $ionicPopup, PrivateLeagues) {

        //hopefully this should get run every time the user navigates to this tab
        User.getUserData(auth.profile.user_id);
        $scope.userData = User.currentUser();

        //ionic list control values
        $scope.shouldShowDelete = false;
        $scope.shouldShowReorder = false;
        $scope.listCanSwipe = true;

        $scope.signOut = function () {

            //clear the stored user data in out service
            User.clearCurrentUser();

            //call the signout method on the auth service
            auth.signout();

            //need to manually display the login screen again
            auth.signin({
                // This is a must for mobile projects
                popup: true,
                // Make the widget non closeable
                standalone: true,
                closable: false,
                // This asks for the refresh token
                // So that the user never has to log in again
                offline_mode: true,
                device: 'Phone'
            }, function () {
                // Login was successful

                //check to see if this user exists on the server already, if not, create this user using auth0 details
                debugger;
                User.sync(auth.profile).then(function () {
                    //Once the user data has been synced, get the user data object from our server also
                    //Have to do in this callback otherwise we attempt to get the user data before the sync has finished
                    console.log('Logging in after logging out and sending user_id: ' + auth.profile.user_id);
                    User.getUserData(auth.profile.user_id).then(function (results) {
                        console.log("Getting the current user data from our server... : " + JSON.stringify(User.currentUser()));

                        //expose the user's invitations to the scope
                        $scope.userData = User.currentUser();

                        debugger;

                        console.log("Invitations are: " + $scope.userData.invitations);
                        console.log("Notifications are: " + $scope.userData.notifications);

                        $state.go('tab.rounds');

                        //show an alert for testing purposes
                        $ionicPopup.alert({
                            title: 'Login successful!',
                            template: 'Welcome ' + auth.profile.nickname + '!'
                        }).then(function (res) {
                            console.log(auth.profile);
                        });
                    });
                });
            }, function (error) {
                // Oops something went wrong during login:
                console.log("There was an error logging in", error);
            });
        };

        //function to accept an invitation
        //unique because a user can't be invited to the same private league more than once
        $scope.acceptInvitation = function (privateLeagueId) {
            //call the method in the service, passing in the user id of the logged in user (invitee)
            //as well as the private league id

            debugger;

            PrivateLeagues.acceptInvitation(auth.profile.user_id, privateLeagueId).then(function (response) {
                    //popup to let the user know they are now a member of that league
                    console.log("The response from the server was: " + JSON.stringify(response));
                    if (response == 200) {
                        //then everything went ok, let the user know
                        //show an alert for testing purposes
                        $ionicPopup.alert({
                            title: 'Invitation was Accepted!',
                            template: 'Go have a look at your new private league!'
                        });

                        //now delete the invitation from the user/reload the page!
                        //TODO: Replace all fors used to find with findWhere in underscore.js
                        for (var i = 0; i < $scope.userData.invitations.length; i++) {
                            if ($scope.userData.invitations[i].privateLeagueId == privateLeagueId) {
                                //then this invitation has been successfully removed from the server, so delete
                                $scope.userData.invitations.splice(i, 1); //this should now get removed from the view
                                //if not view updated, then scope.apply. - test this.
                            }
                        }

                    } else {
                        //print the error message that was returned instead todo: Use error objects properly for this?
                        $ionicPopup.alert({
                            title: 'Something went awry!',
                            template: response
                        });
                    }

                    //TODO: button to take the user directly to this league, $state.go(...)
                }
            );
        };

        $scope.rejectInvitation = function (invitedByUsername, privateLeagueId) {
            //call through to service and then server
            PrivateLeagues.rejectInvitation(auth.profile.user_id, invitedByUsername, privateLeagueId).then(
                function (response) {
                    //popup to let the user know they are now a member of that league
                    console.log("The response from the server was: " + JSON.stringify(response));
                    if (response == 202) {
                        //then everything went ok, let the user know
                        //show an alert for testing purposes
                        $ionicPopup.alert({
                            title: 'Invitation was rejected!',
                            template: 'Who needs friends anyway.'
                        });

                        //now delete the invitation from the user/reload the page!
                        //TODO: Replace all fors used to find with findWhere in underscore.js
                        for (var i = 0; i < $scope.userData.invitations.length; i++) {
                            if ($scope.userData.invitations[i].privateLeagueId == privateLeagueId) {
                                //then this invitation has been successfully removed from the server, so delete
                                $scope.userData.invitations.splice(i, 1); //this should now get removed from the view
                                //if not view updated, then scope.apply. - test this.
                            }
                        }

                    } else {
                        //print the error message that was returned instead todo: Use error objects properly for this?
                        $ionicPopup.alert({
                            title: 'Something went awry!',
                            template: response
                        });
                    }

                    //TODO: button to take the user directly to this league, $state.go(...)
                }
            );

            //popup to let user know of the result of that

        };

        //load the text of the notification into a modal/popup
        $scope.showNotification = function (notification_index) {
            //get the notification at the given index
            var notification_text = $scope.userData.notifications[notification_index].message;

            console.log("The notification text to display is: " + notification_text);

            //now display this text within a modal or popup
            $ionicPopup.alert({
                title: 'Notification!',
                template: notification_text
            });
        };

        //remove the desired notification from the user on the server
        $scope.deleteNotification = function (notification_id) {
            //call  through to the server, sending user_id and notification_id
            User.clearNotification(auth.profile.user_id, notification_id).then(
                function (res) {
                    console.log('Notification cleared');

                    //splice the notification out to remove from view for now
                    for (var i = 0; i < $scope.userData.notifications.length; i++) {
                        if ($scope.userData.notifications[i].notification_id == notification_id) {
                            $scope.userData.notifications.splice(i, 1); //TODO: implement some sort of model refresh from server for this.
                            //TODO: Refresh in the same way as the predictions get refreshed after changes are made.
                        }
                    }
                }
            );
        };

        //TODO: Update the user's info with a pull to refresh and push notifications
        $scope.doRefresh = function () {

            //Replace this with a manual check of new invitations and notifications
            $scope.userData = User.getUserData(auth.profile.user_id).then(function () {
                //TODO: Ionic popup if new notifications here
                $scope.$broadcast('scroll.refreshComplete');

                //renew the scope
                //$scope.userData = User.getUserData(); //TODO: may need to update the view
            });
        };
    });

