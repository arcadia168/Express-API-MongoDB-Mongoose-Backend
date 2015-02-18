angular.module('starter.controllers', [])

.controller('DashCtrl', function($scope) {})

.controller('ChatsCtrl', function($scope, Chats) {
  $scope.chats = Chats.all();
  $scope.remove = function(chat) {
    Chats.remove(chat);
  }
})

.controller('RoundsCtrl', function($scope, Rounds) {
    
  //only publicly accessible elements get added to the scope
  $scope.rounds = Rounds.all();
  $scope.remove = function(round) {
    Rounds.remove(round);
  }
      
  //private array to hold the predictions
  var _predictions = [
      {
        id: 1,
        fixtureid: 1,
        prediction: 'homewin'
      },
      {
        id: 2,
        fixtureid: 2,
        prediction: 'draw'
      }
  ];
    
  $scope.predict = function(roundid, prediction) { //prediction will be left, right, up
    Rounds.predict(roundid, prediction);
  }
  //home win on swipe left
  $scope.onSwipeLeft(fixtureid){
     //call the function in the service
  }
  // away win on swipe right
  $scope.onSwipeRight(fixtureid){
    //call the function in the service
  }
})

.controller('ChatDetailCtrl', function($scope, $stateParams, Chats) {
  $scope.chat = Chats.get($stateParams.chatId);
})

.controller('RoundDetailCtrl', function($scope, $stateParams, Rounds) {
  $scope.round = Rounds.get($stateParams.roundId);
})

.controller('FriendsCtrl', function($scope, Friends) {
  $scope.friends = Friends.all();
})

.controller('FriendDetailCtrl', function($scope, $stateParams, Friends) {
  $scope.friend = Friends.get($stateParams.friendId);
})

.controller('AccountCtrl', function($scope) {
  $scope.settings = {
    enableFriends: true
  };
});
