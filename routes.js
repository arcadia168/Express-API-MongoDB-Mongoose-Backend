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
    app.get('/api/users/create_private_league/:user_id/:private_league_name', privateLeagues.createPrivateLeague); //protect
    app.get('/api/users/private_leagues/invite/:user_id', privateLeagues.getPrivateLeagues); //protect
    app.get('/api/users/private_leagues/remove/:user_id/:private_league_id/:remove_user_id', privateLeagues.removePrivateLeagueMember); //protect
    app.get('/api/users/private_leagues/invite/:user_id/:private_league_id/:invited_user_name', privateLeagues.invitePrivateLeagueMember); //protect
    app.get('/api/users/private_leagues/rename/:user_id/:private_league_id/:new_league_name', privateLeagues.renamePrivateLeague); //protect
    app.delete('/api/users/private_leagues/delete/:user_id/:private_league_id', privateLeagues.deletePrivateLeague); //protect
    //app.post('api/users', users.addUser); //protect TODO: Remove as not necessary
    app.post('/api/users/sync', users.userSync); //protect //TODO: How do users delete accounts? Implement user delete
    app.post('/api/users/predictions/:user_id/:round', users.addPredictions); //protect
    app.put('/api/users/predictions/update/:user_id', users.updatePrediction);//protect  //for the sake of ease these get done one by one
    //todo: attempt to implement a single call which takes a list of predictions and updates them
    //app.put('api/users/:user_id', users.updateUser); //protect TODO: Remove as not necessary
    app.delete('/api/users/predictions/clear', users.clearPredictions); //protect
    app.delete('/api/users/predictions/clear/:user_id/:round', users.clearRoundPredictions); //protect

    //below API functionalities are not user dependent (don't need to be JWT protected)
    //DON'T NEED TO BE LOGGED IN TO ACCESS THESE
    app.get('/api/scoreboard', users.getScoreboard); //don't protect
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
    app.get('/api/dummy/users', users.dummyData);
    app.get('/api/dummy/fixtures', fixtures.dummyData);
    app.get('/api/dummy/results/:round', users.dummyResults);
    app.delete('/api/clear/all', users.wipe);
};