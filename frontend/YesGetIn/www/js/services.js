//(function () {
//    'use strict';
//
//    angular.module('starter.services')
//
//    .factory('Rounds', ['$http', '$q', '$resource', Rounds]);
//
//    function Rounds($http, $q) {
//
//        var rounds;
//
//        function all() {
//            var deferred = $q.defer();
//
//            // Make a call to ye olde server
//            $http.get('http://nodejs-getin.rhcloud.com/'
//            ).success(function (data) {
//                    deferred.resolve(data);
//                }).error(function () {
//                    console.log("Error while making HTTP call.");
//                    deferred.promise;
//                });
//            return deferred.promise;
//        }
//
//        function remove(round) {
//            rounds.splice(rounds.indexOf(round), 1);
//        }
//
//        function get(round) {
//            for (var i = 0; i < rounds.length; i++) {
//                if (rounds[i].id === parseInt(round)) {
//                    return rounds[i];
//                }
//            }
//            return null;
//        }
//
//        function predict() {
//
//        }
//
//        return {
//            all: all,
//            remove: remove,
//            get: get,
//            predict: predict
//        };
//    }
//})();

angular.module('starter.services', ['ngResource'])

    .factory('Chats', function() {
        // Might use a resource here that returns a JSON array

        // Some fake testing data
        var chats = [{
            id: 0,
            name: '***REMOVED*** Sparrow',
            lastText: 'You on your way?',
            face: 'https://pbs.twimg.com/profile_images/514549811765211136/9SgAuHeY.png'
        }, {
            id: 1,
            name: 'Max Lynx',
            lastText: 'Hey, it\'s me',
            face: 'https://avatars3.githubusercontent.com/u/11214?v=3&s=460'
        }, {
            id: 2,
            name: 'Andrew Jostlin',
            lastText: 'Did you get the ice cream?',
            face: 'https://pbs.twimg.com/profile_images/491274378181488640/Tti0fFVJ.jpeg'
        }, {
            id: 3,
            name: 'Adam Bradleyson',
            lastText: 'I should buy a boat',
            face: 'https://pbs.twimg.com/profile_images/479090794058379264/84TKj_qa.jpeg'
        }, {
            id: 4,
            name: 'Perry Governor',
            lastText: 'Look at my mukluks!',
            face: 'https://pbs.twimg.com/profile_images/491995398135767040/ie2Z_V6e.jpeg'
        }];

        return {
            all: function() {
                return chats;
            },
            remove: function(chat) {
                chats.splice(chats.indexOf(chat), 1);
            },
            get: function(chatId) {
                for (var i = 0; i < chats.length; i++) {
                    if (chats[i].id === parseInt(chatId)) {
                        return chats[i];
                    }
                }
                return null;
            }
        }
    })

    .factory('Rounds', ['$http', '$q', '$resource', function($http, $q, $resource) {

        var rounds = [];

        return {
            all: function() {
                var deferred = $q.defer();

                //TODO: Replace the use of http with resource
                // Make a call to ye olde server
                $http.get('http://nodejs-getin.rhcloud.com/rounds/'
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
                //;

                //make the request to the server to get the specified round

                //for (var i = 0; i < rounds.length; i++) {
                //    if (rounds[i].id === parseInt(roundId)) {
                //        return rounds[i];
                //    }
                //}

                //return a promise


                //
                //// Make a call to ye olde server
                //
                ////TODO: Replace the use of http with resource
                //
                //debugger;
                //

                var deferred = $q.defer();

                $http.get('http://nodejs-getin.rhcloud.com/fixtures/' + roundId
                ).success(function(data){
                        rounds = data;
                        deferred.resolve(data);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        deferred.promise;
                    });
                return deferred.promise;

                //return $resource('http://nodejs-getin.rhcloud.com/fixtures/ + ');

            },
            //might need to take in the userid, although this may be global
            makePredictions: function(username, round, predictions) {
                //make a call to server to send predictions away

                //prepend the predictions array with the necessary information
                predictions = "[{\"predictions\":" + JSON.stringify(predictions) + "}]"

                //predictions = JSON.stringify(predictions);

                console.log(predictions);

                ////invalid json
                //[
                //    {
                //        "predictions":[
                //            [
                //                {
                //                    "fixtureid":"54ef7b929bf65365a7fe8e27",
                //                    "prediction":3
                //                }
                //            ]
                //    }
                //]
                //
                //// valid json
                //[
                //    {
                //        "predictions":[
                //            {
                //                "fixture":"54ef7b929bf65365a7fe8e27",
                //                "prediction":"1"
                //            }
                //        ]
                //    }
                //]

                debugger

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                //use dummy user sillybilly for now
                $http.post('http://nodejs-getin.rhcloud.com/users/predictions/' + username + '/' + round , predictions
                ).success(function(response){
                        console.log(response)
                        deferred.resolve(response); //TODO not sure this is necessary
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong");
                        deferred.promise;
                    });
                return deferred.promise;
            },
            getExistingPredictions: function(username) {

                //make a call to the server to get the existing predictions made by a user
                debugger

                var deferred = $q.defer();

                //TODO: Implement getting the username from the session somehow
                $http.get('http://nodejs-getin.rhcloud.com/users/predictions/' + username
                ).success(function(response){
                        console.log("CURRENT USER PREDICTIONS:" + response)
                        deferred.resolve(response);
                    }).error(function(){
                        console.log("Error while making HTTP call.");
                        alert("Something went wrong"); //TODO: Use an ionicPopUp for this
                        //deferred.promise;
                    });
                return deferred.promise;
            }
        }
    }])

    .factory('Scoreboard', ['$http', '$q', function($http, $q) {

        return {
            all: function() {
                var deferred = $q.defer();

                //TODO: Replace the use of http with resource
                // Make a call to ye olde server
                $http.get('http://nodejs-getin.rhcloud.com/scoreboard/'
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

/**
* A simple example service that returns some data.
*/
    .factory('Friends', function() {
        // Might use a resource here that returns a JSON array

        // Some fake testing data
        var friends = [{
            id: 0,
            name: '***REMOVED*** Sparrow',
            notes: 'Enjoys drawing things',
            face: 'https://pbs.twimg.com/profile_images/514549811765211136/9SgAuHeY.png'
        }, {
            id: 1,
            name: 'Max Lynx',
            notes: 'Odd obsession with everything',
            face: 'https://avatars3.githubusercontent.com/u/11214?v=3&s=460'
        }, {
            id: 2,
            name: 'Andrew Jostlen',
            notes: 'Wears a sweet leather Jacket. I\'m a bit jealous',
            face: 'https://pbs.twimg.com/profile_images/491274378181488640/Tti0fFVJ.jpeg'
        }, {
            id: 3,
            name: 'Adam Bradleyson',
            notes: 'I think he needs to buy a boat',
            face: 'https://pbs.twimg.com/profile_images/479090794058379264/84TKj_qa.jpeg'
        }, {
            id: 4,
            name: 'Perry Governor',
            notes: 'Just the nicest guy',
            face: 'https://pbs.twimg.com/profile_images/491995398135767040/ie2Z_V6e.jpeg'
        }];


        return {
            all: function() {
                return friends;
            },
            get: function(friendId) {
                // Simple index lookup
                return friends[friendId];
            }
        }
    });
