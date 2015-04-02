angular.module('starter.services', ['ngResource'])

    .factory('Rounds', ['$http', '$q', '$resource', function($http, $q, $resource) {

        //var SERVER = "http://localhost:8000";
        var SERVER = "http://nodejs-getin.rhcloud.com/";

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
            makePredictions: function(username, round, predictions) {
                //make a call to server to send predictions away

                //prepend the predictions array with the necessary information
                predictions = "[{\"predictions\":" + JSON.stringify(predictions) + "}]";

                console.log('SENDING PREDICTIONS:' + predictions);

                debugger;

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                //use dummy user sillybilly for now
                $http.post(SERVER + '/users/predictions/' + username + '/' + round , predictions
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
            updatePrediction: function(username, predictions) {
                //make a call to server to send predictions away

                //prepend the predictions array with the necessary information
                predictions = JSON.stringify(predictions);

                console.log('UPDATING PREDICTIONS:' + predictions);

                debugger;

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                //use dummy user ***REMOVED***6969 for now
                $http.put(SERVER + '/users/predictions/update/' + username, predictions //TODO: Do we need round?
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

            getExistingPredictions: function(username, round) {

                //make a call to the server to get the existing predictions made by a user
                //do this for a given round
                debugger;

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                $http.get(SERVER + '/users/predictions/' + username +  '/' + round
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

            deleteRoundPredictions: function(username, round) {

                //make a call to the server to get the existing predictions made by a user
                debugger;

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                $http.delete(SERVER + '/users/predictions/clear/' + username + '/' + round
                ).success(function(response){
                        console.log("DELETED USER " + username + "'S PREDICTIONS FOR ROUND " + round);
                        deferred.resolve(response);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong");
                    });
                return deferred.promise;
            }
        }
    }])

    .factory('Scoreboard', ['$http', '$q', function($http, $q) {

        //var SERVER = "http://localhost:8000";
        var SERVER = "http://nodejs-getin.rhcloud.com/";

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
