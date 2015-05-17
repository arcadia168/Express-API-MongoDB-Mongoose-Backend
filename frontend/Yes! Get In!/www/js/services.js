angular.module('starter.services', ['ngResource'])

//Using a service to create  a globally accessible variable
    .factory('RunMode', [function(){

        //TO SET THE WHOLE APP TO RELEASE MODE CHANGE THIS HERE
        var debugRelease = 'debug';//'debug'//'release';//'deviceDebug';

        var serverToUse = '';

        var runMode = {}; //object to be returned by the factory for use all over - this is a singleton (I think)

        if (debugRelease == 'release') {
            serverToUse = "http://nodejs-getin.rhcloud.com/api";
        } else if (debugRelease == 'deviceDebug') {
            //running the app on the device hosting server on mac
            //use the ip address of mac from router, port 8000 as usual
            var code = 'mtpbbiwtbz';
            var localTunnelUrl = 'https://' + code + '.localtunnel.me'; //THIS WILL CHANGE DYNAMICALLY, UPDATE ALWAYS
            console.log("Local tunnel url is: %s", localTunnelUrl);
            serverToUse = localTunnelUrl + "/api";
        } else { //inefficiency for the sake of ease of reading here
            serverToUse = "http://localhost:8000/api";
        }

        //Now assign the server being used to a property of the service
        runMode.server = function() {
            return serverToUse;
        };

        //return this object to quickly get which server to use
        return runMode;
    }])

    .factory('Rounds', ['$http', '$q', 'RunMode', function($http, $q, RunMode) {

        var SERVER = RunMode.server();
        console.log(SERVER);

        var rounds = [];

        return {
            all: function() {
                var deferred = $q.defer();

                //TODO: Replace the use of http with resource
                // Make a call to ye olde server
                $http.get(SERVER + '/rounds/'
                ).success(function(data){
                        rounds = data;
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                    });
                return deferred.promise;
            },
            remove: function(round) {
                rounds.splice(rounds.indexOf(round), 1);
            },
            get: function(roundId) {

                //TODO: Replace the use of http with resource

                var deferred = $q.defer();

                $http.get(SERVER + '/fixtures/' + roundId
                ).success(function(data){
                        rounds = data;
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                    });
                return deferred.promise;

            },

            //might need to take in the userid, although this may be global
            makePredictions: function(userid, round, predictions) {
                //make a call to server to send predictions away

                //prepend the predictions array with the necessary information
                predictions = "[{\"predictions\":" + JSON.stringify(predictions) + "}]";

                console.log('SENDING PREDICTIONS:' + predictions);

                debugger;

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                //use dummy user sillybilly for now
                $http.post(SERVER + '/users/predictions/' + userid + '/' + round , predictions
                ).success(function(response){
                        console.log(response);
                        //deferred.resolve(response); //TODO not sure this is necessary
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong");
                        //deferred.promise;
                    });
                return deferred.promise;
            },

            //might need to take in the userid, although this may be global
            updatePrediction: function(userid, predictions) {
                //make a call to server to send predictions away

                //prepend the predictions array with the necessary information
                predictions = JSON.stringify(predictions);

                console.log('UPDATING PREDICTIONS:' + predictions);

                debugger;

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                //use dummy user ***REMOVED***6969 for now
                $http.put(SERVER + '/users/predictions/update/' + userid, predictions
                ).success(function(response){
                        console.log(response);
                        //deferred.resolve(response); //TODO not sure this is necessary
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong");
                        //deferred.promise;
                    });
                return deferred.promise;
            },

            getExistingPredictions: function(userid, round) {

                //make a call to the server to get the existing predictions made by a user
                //do this for a given round
                debugger;

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                $http.get(SERVER + '/users/predictions/' + userid +  '/' + round
                ).success(function(response){
                        console.log("CURRENT USER PREDICTIONS:" + response);
                        deferred.resolve(response);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong"); //TODO: Use an ionicPopUp for this
                        //deferred.promise;
                    });
                return deferred.promise;
            },

            deleteRoundPredictions: function(userid, round) {

                //make a call to the server to get the existing predictions made by a user
                debugger;

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                $http.delete(SERVER + '/users/predictions/clear/' + userid + '/' + round
                ).success(function(response){
                        console.log("DELETED USER " + userid + "'S PREDICTIONS FOR ROUND " + round);
                        deferred.resolve(response);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong");
                    });
                return deferred.promise;
            }
        }
    }])

    .factory('PrivateLeagues', ['$http', '$q', 'RunMode', function($http, $q, RunMode) {

        var SERVER = RunMode.server();
        console.log(SERVER);

        return {
            all: function(user_id) {
                var deferred = $q.defer();

                //TODO: Replace the use of http with resource
                // Make a call to ye olde server
                $http.get(SERVER + '/users/private_leagues/list/' + user_id
                ).success(function(data){
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        //deferred.promise;
                    });
                return deferred.promise;
            },
            get: function(user_id, privateLeagueId) {
                var deferred = $q.defer();

                //TODO: Replace the use of http with resource
                // Make a call to ye olde server
                $http.get(SERVER + '/users/private_leagues/get/' + user_id + '/' + privateLeagueId
                ).success(function(data){
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        //deferred.promise;
                    });
                return deferred.promise;
            },
            //inviteNewMember: function(user_id, userToInvite, privateLeagueId) {
            //    var deferred = $q.defer();
            //
            //    //TODO: Replace the use of http with resource
            //
            //    console.log("Now sending an invite to user: " + userToInvite + " from user " + user_id);
            //
            //    $http.get(SERVER + '/users/private_leagues/invite/' + user_id + '/' + privateLeagueId + '/' + userToInvite
            //    ).success(function(data){
            //            deferred.resolve(data);
            //        }).error(function(){
            //            console.log("Error while making HTTP call.");
            //            //deferred.promise;
            //        });
            //    return deferred.promise;
            //},
            //acceptInvitation: function(user_id, private_league_id) {
            //
            //    var deferred = $q.defer();
            //
            //    //TODO: Replace the use of http with resource
            //
            //    //sends the user_id of the invited user and the league to which they have been invited
            //    console.log("Now accepting invitation for user: " + user_id + " into private league: " + private_league_id);
            //
            //    $http.get(SERVER + '/users/private_leagues/accept/' + user_id + '/' + private_league_id
            //    ).success(function(data){
            //            deferred.resolve(data);
            //        }).error(function(){
            //            console.log("Error while making HTTP call.");
            //            //deferred.promise;
            //        });
            //    return deferred.promise;
            //},
            rejectInvitation: function(invited_user_id, inviting_username, private_league_id) {

                var deferred = $q.defer();

                //TODO: Replace the use of http with resource

                //sends the user_id of the invited user and the league to which they have been invited
                console.log("Now rejecting invitation for user: " + invited_user_id + " for private league: " + private_league_id
                    + " from user " + inviting_username);


                $http.get(SERVER + '/users/private_leagues/reject/' + inviting_username + '/' + invited_user_id + '/' + private_league_id
                ).success(function(data){
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        //deferred.promise;
                    });
                return deferred.promise;
            },
            renameLeague: function(user_id, new_league_name, private_league_id) {

                var deferred = $q.defer();

                //TODO: Replace the use of http with resource

                //sends the user_id of the invited user and the league to which they have been invited
                console.log("Now renaming league: " + private_league_id + " to " + new_league_name);


                $http.get(SERVER + "/users/private_leagues/rename/" + user_id + "/" + private_league_id + "/" + new_league_name
                ).success(function(data){
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        //deferred.promise;
                    });
                return deferred.promise;
            },
            createNewLeague: function(user_id, private_league_name) {

                var deferred = $q.defer();

                //TODO: Replace the use of http with resource

                //sends the user_id of the invited user and the league to which they have been invited
                console.log("Now creating a private league with the name: " + private_league_name);


                $http.get(SERVER + '/users/private_leagues/create/' + user_id + '/' + private_league_name
                ).success(function(data){
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        //deferred.promise;
                    });
                return deferred.promise;
            },
            deleteLeague: function(user_id, private_league_id) {

                var deferred = $q.defer();

                //TODO: Replace the use of http with resource

                //sends the user_id of the invited user and the league to which they have been invited
                console.log("Now deleting the private league: " + private_league_id);


                $http.delete(SERVER + '/users/private_leagues/delete/' + user_id + '/' + private_league_id
                ).success(function(data){
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        //deferred.promise;
                    });
                return deferred.promise;

            },
            leaveLeague: function(user_id, private_league_id) {

                var deferred = $q.defer();

                //TODO: Replace the use of http with resource

                //sends the user_id of the invited user and the league to which they have been invited
                console.log("Now leaving the private league: " + private_league_id);


                $http.get(SERVER + '/users/private_leagues/remove/' + user_id + '/' + private_league_id + '/' + user_id
                ).success(function(data){
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        //deferred.promise;
                    });
                return deferred.promise;
            },
            deleteMember: function(user_id, user_to_delete, private_league_id) {

                var deferred = $q.defer();

                //TODO: Replace the use of http with resource

                //sends the user_id of the invited user and the league to which they have been invited
                console.log("Now removing member " + user_to_delete + " from the private league: " + private_league_id);


                $http.get(SERVER + '/users/private_leagues/remove/' + user_id + '/' + private_league_id + '/' + user_to_delete
                ).success(function(data){
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        //deferred.promise;
                    });
                return deferred.promise;

            },
            joinLeagueWithCode: function(joiningUser, privateLeagueCode) {

                var deferred = $q.defer();

                //TODO: Replace the use of http with resource

                //sends the user_id of the invited user and the league to which they have been invited
                console.log("Now attempting to join the league with code: " + privateLeagueCode);

                //make the request to the server.
                $http.get(SERVER + '/users/private_leagues/join/' + joiningUser + '/' + privateLeagueCode
                ).success(function(data){
                        //if $http promise is fulfilled, fulfill service promise
                        deferred.resolve(data);
                    }).error(function(error){
                        console.log("Error while making HTTP call.");

                        //if an error occured, reject the promise todo: in front end use a popup to denote error
                        deferred.reject(error); //todo: go and replace all $http rejects with this.
                    });

                //return a promise
                return deferred.promise;

            }
        }
    }])

    .factory('Scoreboard', ['$http', '$q', 'RunMode', function($http, $q, RunMode) {

        //TODO: Sort out the formatting and indentation of these promise functions

        var SERVER = RunMode.server();
        console.log(SERVER);

        return {
            all: function() {
                var deferred = $q.defer();

                //TODO: Replace the use of http with resource
                // Make a call to ye olde server
                $http.get(SERVER + '/scoreboard/'
                ).success(function(data){
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        //deferred.promise; //TODO: Remove these deferred.promise statements, not quite sure what they do.
                    });
                return deferred.promise;
            }
        }
    }])

    .factory('LeagueTable', ['$http', '$q', 'RunMode', function($http, $q, RunMode) {

        var SERVER = RunMode.server();
        console.log(SERVER);

        return {
            all: function() {
                var deferred = $q.defer();

                //Retrieve the English Premiere League standings
                $http.get(SERVER + '/standings').success(
                    function(data) {
                        deferred.resolve(data);
                    }).error(
                    function(){
                        console.log("Error while making HTTP call.");
                        //deferred.promise;
                    });
                return deferred.promise;
            }
        }
    }])

    .factory('User', ['$http', '$q', 'RunMode', function($http, $q, RunMode){

        var SERVER = RunMode.server();

        //store the current users data in this service so it is globally accessible
        //return this object once retrieved
        var currentUserData = {};

        return {
            sync: function(user) {

                //prepend the predictions array with the necessary information
                console.log('CHECKING SERVER FOR USER:' + user.nickname);

                //need to convert the user object into a JSON string
                user = JSON.stringify(user);

                var deferred = $q.defer();

                //use dummy user sillybilly for now
                $http.post(SERVER + '/users/sync/', user
                ).success(function(response){
                        console.log(response);
                        deferred.resolve(response); //TODO not sure this is necessary
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong"); //TODO change this to be an ionic popup
                        //deferred.promise;
                    });
                return deferred.promise;
            },
            getUserData: function(user_id) {

                //get the data for a particular user from the server

                var deferred = $q.defer();

                $http.get(SERVER + '/users/' + user_id
                ).success(function(response){
                        console.log("function getUserData in the User service successfully synced data:");
                        console.log(response); //should be the newly loggied in user, not the old!
                        //assign the returned user data to the factory
                        currentUserData = response[0];
                        console.log("The app has now updated the stored user data: " + JSON.stringify(currentUserData));
                        deferred.resolve(response);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong"); //TODO: Replace this with an ionic popup
                        deferred.promise;
                    });
                return deferred.promise;
            },
            currentUser: function() {
                //simply return the user data of the user who is currently logged in
                return currentUserData;
            },
            clearCurrentUser: function() {
                //for use when logging out
                currentUserData = {};
                return "Stored user data cleared.";
                //to avoid having old user data after logging out and back in again
            },
            clearNotification: function (user_id, notification_id) {
                var deferred = $q.defer();

                $http.delete(SERVER + '/api/users/notifications/clear/' + user_id + '/' + notification_id
                ).success(function (response) {
                        console.log("Notification deleted");
                        //assign the returned user data to the factory
                        deferred.resolve(response);
                    }).error(function () {
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong"); //TODO: Replace this with an ionic popup
                        deferred.promise;
                    });
                return deferred.promise;
            }
        }

    }])

    .factory('SaveChanges', [function (){
        var saveChangesNeeded = false;

        //need to return an object to call objects on
        var saveChanges = {};

        //add functions
        saveChanges.saveChangesNeeded = function() {
            saveChangesNeeded = true;
        };

        saveChanges.saveChangesNotNeeded = function() {
            saveChangesNeeded = false;
        };

        //give access to the property
        saveChanges.check = function () {
            return saveChangesNeeded;
        };

        //return object to provide access to methods.
        return saveChanges;

    }]);
