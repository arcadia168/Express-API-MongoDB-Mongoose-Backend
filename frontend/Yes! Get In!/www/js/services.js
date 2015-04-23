angular.module('starter.services', ['ngResource'])

//Using a service to create  a globally accessible variable
    .factory('RunMode', [function(){

        //TO SET THE WHOLE APP TO RELEASE MODE CHANGE THIS HERE
        var debugRelease = 'release';

        var serverToUse = '';

        var runMode = {}; //object to be returned by the factory for use all over - this is a singleton (I think)

        if (debugRelease == 'release') {
            serverToUse = "http://nodejs-getin.rhcloud.com/api";
        } else { //inefficiency for the sake of ease of reading here
            serverToUse = "http://localhost:8000/api";
        }

        //Now assign the server being used to a property of the service
        runMode.server = function() {
            return serverToUse;
        }

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
                        deferred.promise;
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
                        deferred.promise;
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
                        rounds = data;
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        deferred.promise; //TODO: Remove these deferred.promise statements, not quite sure what they do.
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
                        deferred.promise;
                    });
                return deferred.promise;
            }
        }
    }])

    .factory('User', ['$http', '$q', 'RunMode', function($http, $q, RunMode){

        var SERVER = RunMode.server();

        return {
            sync: function(user) {
                //make a call to server to send predictions away

                //prepend the predictions array with the necessary information
                debugger;

                console.log('CHECKING SERVER FOR USER:' + user.nickname);

                debugger;

                //need to convert the user object into a JSON string
                user = JSON.stringify(user);

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                //use dummy user sillybilly for now
                $http.post(SERVER + '/users/sync/', user
                ).success(function(response){
                        console.log(response);
                        //deferred.resolve(response); //TODO not sure this is necessary
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong");
                        //deferred.promise;
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
