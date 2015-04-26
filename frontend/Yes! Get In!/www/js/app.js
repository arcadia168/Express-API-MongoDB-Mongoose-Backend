// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.services' is found in services.js
// 'starter.controllers' is found in controllers.js
angular.module('starter', ['ionic', 'starter.controllers', 'starter.services', 'auth0',
    'angular-storage',
    'angular-jwt'])

    .config(function($stateProvider, $urlRouterProvider, authProvider, $httpProvider,
                     jwtInterceptorProvider) {

        $httpProvider.interceptors.push(function($rootScope) {
            return {
                request: function(config) {
                    $rootScope.$broadcast('loading:show');
                    return config
                },
                response: function(response) {
                    $rootScope.$broadcast('loading:hide');
                    return response
                }
            }
        });

        //add the auth0 jwt http interceptor
        jwtInterceptorProvider.tokenGetter = function(store, jwtHelper, auth) {
            var idToken = store.get('token');
            var refreshToken = store.get('refreshToken');
            // If no token return null
            if (!idToken || !refreshToken) {
                return null;
            }
            // If token is expired, get a new one
            if (jwtHelper.isTokenExpired(idToken)) {
                return auth.refreshIdToken(refreshToken).then(function(idToken) {
                    store.set('token', idToken);
                    return idToken;
                });
            } else {
                return idToken;
            }
        };

        $httpProvider.interceptors.push('jwtInterceptor');

        //$httpProvider.interceptors.push('authInterceptor');


        // Ionic uses AngularUI Router which uses the concept of states
        // Learn more here: https://github.com/angular-ui/ui-router
        // Set up the various states which the app can be in.
        // Each state's controller can be found in controllers.js
        $stateProvider

            //Set up the state which displays the login
            // This is the state where you'll show the login
            .state('login', {
                url: '/login',
                templateUrl: 'templates/login.html',
                controller: 'LoginCtrl'
            })

            // setup an abstract state for the tabs directive
            .state('tab', {
                url: "/tab",
                abstract: true,
                templateUrl: "templates/tabs.html",
                data: {
                    // This tells Auth0 that this state requires the user to be logged in.
                    // If the user isn't logged in and he tries to access this state
                    // he'll be redirected to the login page
                    requiresLogin: true
                }
            })

            .state('tab.rounds', {
                url: '/rounds',
                views: {
                    'tab-rounds': {
                        templateUrl: 'templates/tab-rounds.html',
                        controller: 'RoundsCtrl'
                    }
                },
                data: {
                    // This tells Auth0 that this state requires the user to be logged in.
                    // If the user isn't logged in and he tries to access this state
                    // he'll be redirected to the login page
                    requiresLogin: true
                }
            })
            .state('tab.round-detail', {
                url: '/rounds/:roundId',
                views: {
                    'tab-rounds': {
                        templateUrl: 'templates/round-detail.html',
                        controller: 'RoundDetailCtrl'
                    }
                },
                data: {
                    // This tells Auth0 that this state requires the user to be logged in.
                    // If the user isn't logged in and he tries to access this state
                    // he'll be redirected to the login page
                    requiresLogin: true
                }
            })

            .state('tab.scoreboard', {
                url: '/scoreboard',
                views: {
                    'tab-scoreboard': {
                        templateUrl: 'templates/tab-scoreboard.html',
                        controller: 'ScoreboardCtrl'
                    }
                },
                data: {
                    // This tells Auth0 that this state requires the user to be logged in.
                    // If the user isn't logged in and he tries to access this state
                    // he'll be redirected to the login page
                    requiresLogin: true
                }
            })
            .state('tab.scoreboard-private-leagues', {
                url: '/scoreboard/privateleagues',
                views: {
                    'tab-scoreboard' : {
                        templateUrl: 'templates/scoreboard-private-leagues.html',
                        controller: 'PrivateLeaguesCtrl'
                    }
                },
                data: {
                    // This tells Auth0 that this state requires the user to be logged in.
                    // If the user isn't logged in and he tries to access this state
                    // he'll be redirected to the login page
                    requiresLogin: true
                }
            })
            .state('tab.scoreboard-private-leagues-detail', {
                url: '/scoreboard/privateleagues/:privateLeagueId',
                views: {
                    'tab-scoreboard' : {
                        templateUrl: 'templates/scoreboard-private-leagues-detail.html',
                        controller: 'PrivateLeaguesDetailCtrl'
                    }
                },
                data: {
                    // This tells Auth0 that this state requires the user to be logged in.
                    // If the user isn't logged in and he tries to access this state
                    // he'll be redirected to the login page
                    requiresLogin: true
                }
            })
            .state('tab.scoreboard-global', {
                url: '/scoreboard/global',
                views: {
                    'tab-scoreboard' : {
                        templateUrl: 'templates/scoreboard-global.html',
                        controller:  'GlobalScoreboardCtrl'
                    }
                },
                data: {
                    // This tells Auth0 that this state requires the user to be logged in.
                    // If the user isn't logged in and he tries to access this state
                    // he'll be redirected to the login page
                    requiresLogin: true
                }
            })

            .state('tab.leaguetable', {
                url: '/leaguetable',
                views: {
                    'tab-leaguetable': {
                        templateUrl: 'templates/tab-leaguetable.html',
                        controller: 'LeagueTableCtrl'
                    }
                },
                data: {
                    // This tells Auth0 that this state requires the user to be logged in.
                    // If the user isn't logged in and he tries to access this state
                    // he'll be redirected to the login page
                    requiresLogin: true
                }
            })
            .state('tab.account', {
                url: '/account',
                views: {
                    'tab-account': {
                        templateUrl: 'templates/tab-account.html',
                        controller: 'AccountCtrl'
                    }
                },
                data: {
                    // This tells Auth0 that this state requires the user to be logged in.
                    // If the user isn't logged in and he tries to access this state
                    // he'll be redirected to the login page
                    requiresLogin: true
                }
            });

        // if none of the above states are matched, use this as the fallback
        $urlRouterProvider.otherwise('/login');

        //Attempting to configure the use of Auth0
        authProvider.init({
            domain: 'yesgetin.eu.auth0.com',
            clientID: 'Ny44FwyaGBQvKOV9FxIRDX6JvogUm80j',
            loginState: 'login'
        });

    })

    .run(function($ionicPlatform, $rootScope, $ionicLoading, auth, store, jwtHelper, $location) {

        //this function contains globally run application functions.

        // This hooks all auth events to check everything as soon as the app starts
        auth.hookEvents();

        $rootScope.$on('loading:show', function() {
            $ionicLoading.show({template: 'Fetching data from server'}); //TODO: ADD A SPINNER IN HERE
        });

        $rootScope.$on('loading:hide', function() {
            $ionicLoading.hide()
        });

        $ionicPlatform.ready(function() {
            // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
            // for form inputs)
            if (window.cordova && window.cordova.plugins.Keyboard) {
                cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
            }
            if (window.StatusBar) {
                // org.apache.cordova.statusbar required
                StatusBar.styleDefault();
            }
        });

        // This events gets triggered on refresh or URL change
        $rootScope.$on('$locationChangeStart', function() {
            if (!auth.isAuthenticated) {
                var token = store.get('token');
                if (token) {
                    if (!jwtHelper.isTokenExpired(token)) {
                        auth.authenticate(store.get('profile'), token);
                    } else {
                        // Either show Login page or use the refresh token to get a new idToken
                        $location.path('/');
                    }
                }
            }
        });

    });
