angular.module('starter.controllers', [])

    .controller('DashCtrl', function($scope) {})

    //.controller('ChatsCtrl', function($scope, Chats) {
    //    $scope.chats = Chats.all();
    //    $scope.remove = function(chat) {
    //        Chats.remove(chat);
    //    }
    //})

    .controller('RoundsCtrl', function($scope, $ionicLoading, Rounds) {

        //only publicly accessible elements get added to the scope

        Rounds.all().then(function(data){
            //$ionicLoading.hide();
            $scope.rounds = data;
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

    .controller('RoundDetailCtrl', function($scope, $stateParams, Rounds) {
        //Change this to use $q and show loading modal

        Rounds.get($stateParams.roundId).then(function(data){
            //$ionicLoading.hide();
            $scope.round = data;
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

    .controller('DemoTabCtrl', function($scope) {
        alert("This feature has been disabled for the demo app.");
    });
