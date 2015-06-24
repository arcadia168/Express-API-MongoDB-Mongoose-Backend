module.exports = function(app){
    var fixtures = require('./mongo/controllers/fixtures');
    var users = require('./mongo/controllers/users');
    var privateLeagues = require('./mongo/controllers/privateleagues');

    //TODO: MAKE URL GET REQUESTS WHICH DISPLAY SENSITIVE INFORMATION INTO POST REQUESTS, MOVE INFO INTO BODYS
    //TODO: REMOVE ANY ROUTES WHICH WOULD NOT GET USED.
    //ROUTES REQUIRED BY THE APP, USED BY THE USER
    app.get('/api/users/:user_id', users.getUserData); //protect
    app.get('/api/users/predictions/:user_id', users.getPredictions); //protect
    app.get('/api/users/predictions/:user_id/:round', users.findRoundPredictions); //protect
    app.get('/api/users/private_leagues/create/:user_id/:private_league_name', privateLeagues.createPrivateLeague); //protect
    app.get('/api/users/private_leagues/list/:user_id', privateLeagues.getPrivateLeagues); //
    app.get('/api/users/private_leagues/join/:user_id/:private_league_code', privateLeagues.joinPrivateLeagueWithCode); //protect
    app.get('/api/users/private_leagues/get/:user_id/:private_league_id', privateLeagues.getPrivateLeague);
    app.put('/api/users/private_leagues/remove/:user_id/:private_league_id/', privateLeagues.removePrivateLeagueMembers); //protect
    app.get('/api/users/private_leagues/rename/:user_id/:private_league_id/:new_league_name', privateLeagues.renamePrivateLeague); //protect
    app.post('/api/users/private_leagues/edit/captain/:user_id/:private_league_id/:new_captain_id', privateLeagues.changeLeagueCaptain); //protect
    app.post('/api/users/private_leagues/edit/vcaptain/:user_id/:private_league_id/:new_vice_captain_id', privateLeagues.changeLeagueViceCaptain); //protect
    app.delete('/api/users/private_leagues/delete/:user_id/:private_league_id', privateLeagues.deletePrivateLeague); //protect
    app.post('/api/users/sync', users.userSync); //protect //TODO: How do users delete accounts? Implement user delete
    app.get('/api/users/team/:user_id/:team', users.updateUserTeam);
    app.post('/api/users/devices', users.userDeviceTokenManager);
    app.post('/api/users/predictions/update/:user_id', users.updatePredictions);//protect  //for the sake of ease these get done one by one
    app.post('/api/users/predictions/create/:user_id/:round', users.addPredictions); //protect
    //app.delete('/api/users/predictions/clear', users.clearPredictions); //protect
    app.delete('/api/users/predictions/clear/:user_id/:round', users.clearRoundPredictions); //protect

    //below API functionalities are not user dependent (don't need to be JWT protected)
    //DON'T NEED TO BE LOGGED IN TO ACCESS THESE
    app.get('/api/leaderboard', users.getLeaderboard); //don't protect
    app.get('/api/fixtures', fixtures.getFixtures); //don't protect
    app.get('/api/fixtures/:round', fixtures.getRound); //don't protect
    app.get('/api/standings', fixtures.getStandings); //don't protect
    app.get('/api/rounds', fixtures.getGroupedFixtures); //don't protect

    //TODO: Review how necessary/remove these routes.
    //routes used for server/db admin, not used by app
    //app.post('/api/fixtures/createfixtures', fixtures.addFixtures); //protect
    //app.delete('/api/fixtures/clearfixtures', fixtures.clearFixtures); //protect
    //app.delete('/api/fixtures/:round', fixtures.clearRound); //protect

    //TODO: Remove these from the release version of the API
    //routes which quickly manipulate dummy data into the database
    //always disable these when pushing to the server.
    //app.get('/api/dummy/users', users.dummyData);
    //app.get('/api/dummy/fixtures', fixtures.dummyData);
    //app.get('/api/dummy/results/:round', users.dummyResults);
    //app.delete('/api/clear/all', users.wipe);
    //app.delete('/admin/clear/fixtures', fixtures.clearFixtures);
    //app.delete('/api/clear/users', users.clearUsers);
    //app.delete('/api/clear/predictions', users.clearPredictions);
    //app.get('/api/dummy/fixtures/testresult', fixtures.testGetResultThenScore);
    //app.get('/api/dummy/fixtures/testcores', fixtures.testScoringUsers);
    //app.get('/admin/fixtures/load', fixtures.uploadFixturesFromFile);
};