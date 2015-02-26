angular.module('starter.controllers', [])

    .controller('LeagueTableCtrl', function($scope) {})

    //.controller('ChatsCtrl', function($scope, Chats) {
    //    $scope.chats = Chats.all();
    //    $scope.remove = function(chat) {
    //        Chats.remove(chat);
    //    }
    //})

    .controller('RoundsCtrl', function($scope, $ionicLoading, Rounds) {

        //only publicly accessible elements get added to the scope

        Rounds.all().then(function(data){
            //debugger;
            $scope.rounds = data;
            $scope.rounds = $scope.rounds.rounds;
        });

        //debugger
        $scope.remove = function(round) {
            Rounds.remove(round);
        }

        $scope.predict = function(roundid, prediction) { //prediction will be left, right, up
            Rounds.predict(roundid, prediction);
        }

        //home win on swipe left
        //$scope.onSwipeLeft(fixtureid){
        //   //call the function in the service
        //};
        //// away win on swipe right
        //$scope.onSwipeRight(fixtureid){
        //  //call the function in the service
        //}
    })

    //.controller('ChatDetailCtrl', function($scope, $stateParams, Chats) {
    //    alert("This feature has been disabled for the demo app.")
    //
    //    //$scope.chat = Chats.get($stateParams.chatId);
    //})

    .controller('RoundDetailCtrl', function($scope, $ionicPopup, $stateParams, Rounds) {

        //Get the data for this particular round from the server
        Rounds.get($stateParams.roundId).then(function(data){
            //$ionicLoading.hide();
            $scope.fixtures = data;
        });

        //TODO: Remove these predictions
        //dummy predictions!
        var _predictions = [
            {fixtureid: 1, prediction: 1},
            {fixtureid: 2, prediction: 2}
        ];

        //TODO: maybe show popup for each prediction using $ionicPopup
        function _dummyPredict(prediction) {
            var alertPopup = $ionicPopup.alert({
                title: 'You\'ve made a prediction!',
                template: 'You predicted an ' + prediction + '!'
            });
        }

        $scope.predictHomeWin = function (fixtureId) {
            debugger

            //_predictions.push({fixtureid: fixtureId, prediction: 0});
            _dummyPredict("home win");
        };

        $scope.predictAwayWin = function (fixtureId) {
            debugger
            //_predictions.push({fixtureid: fixtureId, prediction: 1});

            _dummyPredict("away win");
        };

        $scope.predictDraw = function (fixtureId) {
            debugger
            //_predictions.push({fixtureid: fixtureId, prediction: 2});

            _dummyPredict("draw");
        };

        //TODO: Implement validation for the predictions.
        //once predictions are all validated, and predict button send, send all predictions
        $scope.sendPredictions = function () {
            Rounds.makePredictions(_predictions);
        }
    })

    .controller('ScoreboardCtrl', function($scope, Scoreboard) {

        //Get the data for scores for leaderboard
        Scoreboard.all().then(function(data){
            //debugger;
            $scope.scores = data;
        });
    })

    .controller('FriendsCtrl', function($scope, Friends) {
        alert("This feature has been disabled for the demo app.");
        //$scope.friends = Friends.all();
    })

    .controller('FriendDetailCtrl', function($scope, $stateParams, Friends) {
        $scope.friend = Friends.get($stateParams.friendId);
    })

    .controller('AccountCtrl', function($scope) {
        alert("This feature has been disabled for the demo app.");

        //$scope.settings = {
        //    enableFriends: true
        //};
    })

    .controller('DemoTabCtrl', function($scope, $ionicPopup, $state) {
        //alert("This feature has been disabled for the demo app.");

        $scope.accessDeny = function() {
            $ionicPopup.alert({
                title: 'Tab not available in demo!',
                template: 'This thing is a work in progress...'
            }).then(function(res) {

                //deflect the user from the tab which has not yet been implemented to a good tab
                $state.transitionTo("tab.rounds");
            });
        }
    });
