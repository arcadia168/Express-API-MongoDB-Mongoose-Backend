module.exports = function(app){
    var fixtures = require('./mongo/controllers/fixtures');
    var users = require('./mongo/controllers/users');

    app.get('/users/:user_id', users.getUserData);
    app.get('/users/predictions/:user_id', users.getPredictions);
    app.get('/users/predictions/:user_id/:round', users.findRoundPredictions);
    app.post('/users', users.addUser);
    app.post('/users/sync', users.userSync);
    app.post('/users/predictions/:user_id/:round', users.addPredictions);
    app.put('/users/predictions/update/:user_id', users.updatePrediction); //for the sake of ease these get done one by one
    //todo: attempt to implement a single call which takes a list of predictions and updates them
    app.put('/users/:user_id', users.updateUser);
    app.delete('/users/predictions/clear', users.clearPredictions);
    app.delete('/users/predictions/clear/:user_id/:round', users.clearRoundPredictions);

    //below API functionalities are not user dependent (don't need to be JWT protected)
    app.get('/scoreboard', users.getScoreboard);
    app.get('/fixtures', fixtures.getFixtures);
    app.get('/fixtures/:round', fixtures.getRound);
    app.get('/standings', fixtures.getStandings);
    app.get('/rounds', fixtures.getGroupedFixtures);
    app.post('/fixtures', fixtures.addFixtures);
    app.delete('/fixtures', fixtures.clearFixtures);
    app.delete('/fixtures/:round', fixtures.clearRound);

    //TODO: Remove these from the release version of the API
    //routes which quickly manipulate dummy data into the database
    app.get('/dummy/users', users.dummyData);
    app.get('/dummy/fixtures', fixtures.dummyData);
    app.get('/dummy/results/:round', users.dummyResults);
    app.delete('/clear/all', users.wipe);
};