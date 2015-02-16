angular.module('starter.controllers', [])

.controller('DashCtrl', function($scope) {})

.controller('ChatsCtrl', function($scope, Chats) {
  $scope.chats = Chats.all();
  $scope.remove = function(chat) {
    Chats.remove(chat);
  }
})

.controller('RoundsCtrl', function($scope, Rounds) {
  $scope.rounds = Rounds.all();
  $scope.remove = function(round) {
    Rounds.remove(round);
  }
  $scope.predict = function(roundid, prediction) { //prediction will be left, right, up
      Rounds.predict(roundid, prediction);
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
